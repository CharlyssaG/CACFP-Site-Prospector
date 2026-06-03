import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HEAD_START_TYPES = [
  "head-start",
  "early-head-start",
  "migrant-seasonal-head-start",
  "migrant-seasonal-early-head-start",
  "aian-head-start",
  "aian-early-head-start",
];

function detectSearchType(query: string): string {
  const q = query.trim();
  if (/^\d{5}$/.test(q)) return "zip";
  if (/county/i.test(q)) return "county";
  if (/^[A-Z]{2}$/i.test(q) && q.length === 2) return "state";
  return "city";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query       = searchParams.get("q") || "";
  const type        = searchParams.get("type") || "auto";
  const unsponsoredOnly  = searchParams.get("unsponsored") === "true";
  const centerTypesRaw   = searchParams.get("centerTypes") || ""; // comma-separated
  const areaEligibleOnly = searchParams.get("eligible") === "true";
  const licensedOnly     = searchParams.get("licensed") === "true";
  const sortBy  = searchParams.get("sort") || "name";
  const limit   = parseInt(searchParams.get("limit") || "2000");
  const offset  = parseInt(searchParams.get("offset") || "0");

  if (!query.trim()) {
    return NextResponse.json({ centers: [], stats: null }, { status: 400 });
  }

  // Parse center type filter — empty string means "all types"
  const selectedTypes = centerTypesRaw
    ? centerTypesRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const effectiveType = type === "auto" ? detectSearchType(query) : type;

  try {
    // Log search (non-blocking)
    supabase.from("search_log").insert({ query, search_type: effectiveType });

    // Build query
    let dbQuery = supabase
      .from("centers")
      .select("*, sponsor:sponsors(*)")
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Location filter
    switch (effectiveType) {
      case "zip":
        dbQuery = dbQuery.eq("zip", query.trim());
        break;
      case "state":
        dbQuery = dbQuery.eq("state", query.trim().toUpperCase());
        break;
      case "county":
        dbQuery = dbQuery.ilike("county", `%${query.replace(/\s*county\s*/i, "").trim()}%`);
        break;
      default:
        dbQuery = dbQuery.ilike("city", `%${query.split(",")[0].trim()}%`);
        break;
    }

    // Filters
    if (unsponsoredOnly)           dbQuery = dbQuery.is("sponsor_id", null);
    if (selectedTypes.length > 0)  dbQuery = dbQuery.in("center_type", selectedTypes);
    if (areaEligibleOnly)          dbQuery = dbQuery.eq("area_eligibility", "eligible");
    if (licensedOnly)              dbQuery = dbQuery.eq("is_licensed", true);

    // Sort
    switch (sortBy) {
      case "capacity-desc":
        dbQuery = dbQuery.order("licensed_capacity", { ascending: false, nullsFirst: false });
        break;
      case "capacity-asc":
        dbQuery = dbQuery.order("licensed_capacity", { ascending: true, nullsFirst: false });
        break;
      case "eligibility":
        // Handled client-side below after fetch
        dbQuery = dbQuery.order("name");
        break;
      default:
        dbQuery = dbQuery.order("name");
    }

    const { data: centers, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let results = centers || [];

    // Client-side eligibility sort
    if (sortBy === "eligibility") {
      results.sort((a: any, b: any) => {
        const score = (c: any) => {
          let s = 0;
          if (c.area_eligibility === "eligible") s += 3;
          else if (c.area_eligibility === "maybe") s += 2;
          else s += 1;
          if (!c.sponsor_id) s += 2;
          if (c.is_licensed) s += 1;
          if (c.center_type !== "childcare-forprofit") s += 1;
          return s;
        };
        return score(b) - score(a);
      });
    }

    // Compute stats with updated enum values
    const total = results.length;
    const stats = {
      total_count:       total,
      unsponsored_count: results.filter((c: any) => !c.sponsor_id).length,
      eligible_count:    results.filter((c: any) => c.area_eligibility === "eligible").length,
      avg_capacity:      total
        ? Math.round(results.reduce((s: number, c: any) => s + (c.licensed_capacity || 0), 0) / total)
        : 0,
      nonprofit_count:   results.filter((c: any) => c.center_type === "childcare-nonprofit").length,
      forprofit_count:   results.filter((c: any) => c.center_type === "childcare-forprofit").length,
      headstart_count:   results.filter((c: any) => HEAD_START_TYPES.includes(c.center_type)).length,
      licensed_count:    results.filter((c: any) => c.is_licensed).length,
    };

    return NextResponse.json({ centers: results, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Search failed" }, { status: 500 });
  }
}
