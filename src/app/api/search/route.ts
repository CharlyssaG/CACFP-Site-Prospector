import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function detectSearchType(query: string): string {
  const q = query.trim();
  if (/^\d{5}$/.test(q)) return "zip";
  if (/county/i.test(q)) return "county";
  if (/^[A-Z]{2}$/i.test(q) && q.length === 2) return "state";
  return "city";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "auto";
  const unsponsoredOnly = searchParams.get("unsponsored") === "true";
  const centerType = searchParams.get("centerType") || null;
  const areaEligibleOnly = searchParams.get("eligible") === "true";
  const licensedOnly = searchParams.get("licensed") === "true";
  const sortBy = searchParams.get("sort") || "name";
  const limit = parseInt(searchParams.get("limit") || "200");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!query.trim()) {
    return NextResponse.json({ centers: [], stats: null }, { status: 400 });
  }

  const effectiveType = type === "auto" ? detectSearchType(query) : type;

  try {
    // Log search
    await supabase.from("search_log").insert({
      query,
      search_type: effectiveType,
    });

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
        dbQuery = dbQuery.ilike(
          "county",
          `%${query.replace(/\s*county\s*/i, "").trim()}%`
        );
        break;
      default:
        dbQuery = dbQuery.ilike("city", `%${query.split(",")[0].trim()}%`);
        break;
    }

    // Filters
    if (unsponsoredOnly) dbQuery = dbQuery.is("sponsor_id", null);
    if (centerType) dbQuery = dbQuery.eq("center_type", centerType);
    if (areaEligibleOnly) dbQuery = dbQuery.eq("area_eligibility", "eligible");
    if (licensedOnly) dbQuery = dbQuery.eq("is_licensed", true);

    // Sort
    switch (sortBy) {
      case "capacity-desc":
        dbQuery = dbQuery.order("licensed_capacity", { ascending: false });
        break;
      case "capacity-asc":
        dbQuery = dbQuery.order("licensed_capacity", { ascending: true });
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
          if (c.center_type !== "for-profit") s += 1;
          return s;
        };
        return score(b) - score(a);
      });
    }

    // Compute stats
    const total = results.length;
    const stats = {
      total_count: total,
      unsponsored_count: results.filter((c: any) => !c.sponsor_id).length,
      eligible_count: results.filter(
        (c: any) => c.area_eligibility === "eligible"
      ).length,
      avg_capacity: total
        ? Math.round(
            results.reduce(
              (s: number, c: any) => s + (c.licensed_capacity || 0),
              0
            ) / total
          )
        : 0,
      nonprofit_count: results.filter(
        (c: any) => c.center_type === "nonprofit"
      ).length,
      forprofit_count: results.filter(
        (c: any) => c.center_type === "for-profit"
      ).length,
      headstart_count: results.filter(
        (c: any) => c.center_type === "head-start"
      ).length,
      licensed_count: results.filter((c: any) => c.is_licensed).length,
    };

    return NextResponse.json({ centers: results, stats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Search failed" },
      { status: 500 }
    );
  }
}
