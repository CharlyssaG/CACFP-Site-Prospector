import { supabase } from "./supabase";
import type { Center, SearchStats, SearchFilters, CenterType } from "@/types";

function detectSearchType(query: string): string {
  const q = query.trim();
  if (/^\d{5}$/.test(q)) return "zip";
  if (/county/i.test(q)) return "county";
  if (/^[A-Z]{2}$/i.test(q) && q.length === 2) return "state";
  return "city";
}

export async function searchCenters(
  filters: SearchFilters
): Promise<{ centers: Center[]; stats: SearchStats }> {
  const effectiveType =
    filters.searchType === "auto"
      ? detectSearchType(filters.query)
      : filters.searchType;

  // Log the search
  await supabase.from("search_log").insert({
    query: filters.query,
    search_type: effectiveType,
  });

  // Build the query
  let query = supabase
    .from("centers")
    .select("*, sponsor:sponsors(*)")
    .limit(200);

  // Apply location filter
  switch (effectiveType) {
    case "zip":
      query = query.eq("zip", filters.query.trim());
      break;
    case "state":
      query = query.eq("state", filters.query.trim().toUpperCase());
      break;
    case "county":
      query = query.ilike("county", `%${filters.query.replace(/\s*county\s*/i, "").trim()}%`);
      break;
    case "city":
    default:
      query = query.ilike("city", `%${filters.query.split(",")[0].trim()}%`);
      break;
  }

  // Apply filters
  if (filters.unsponsoredOnly) {
    query = query.is("sponsor_id", null);
  }
  if (filters.centerType) {
    query = query.eq("center_type", filters.centerType);
  }
  if (filters.areaEligibleOnly) {
    query = query.eq("area_eligibility", "eligible");
  }
  if (filters.licensedOnly) {
    query = query.eq("is_licensed", true);
  }

  // Apply sort
  switch (filters.sortBy) {
    case "capacity-desc":
      query = query.order("licensed_capacity", { ascending: false, nullsFirst: false });
      break;
    case "capacity-asc":
      query = query.order("licensed_capacity", { ascending: true, nullsFirst: false });
      break;
    case "eligibility":
      // Supabase doesn't support computed sorts easily,
      // so we sort client-side for this option
      query = query.order("name");
      break;
    case "name":
    default:
      query = query.order("name");
      break;
  }

  const { data: centers, error } = await query;

  if (error) {
    console.error("Search error:", error);
    throw new Error(error.message);
  }

  let results = (centers || []) as Center[];

  // Client-side eligibility sort
  if (filters.sortBy === "eligibility") {
    results.sort((a, b) => {
      const score = (c: Center) => {
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

  // Compute stats from unfiltered results for that area
  const stats = computeStats(results);

  return { centers: results, stats };
}

function computeStats(centers: Center[]): SearchStats {
  const total = centers.length;
  return {
    total_count: total,
    unsponsored_count: centers.filter((c) => !c.sponsor_id).length,
    eligible_count: centers.filter((c) => c.area_eligibility === "eligible").length,
    avg_capacity: total
      ? Math.round(
          centers.reduce((s, c) => s + (c.licensed_capacity || 0), 0) / total
        )
      : 0,
    nonprofit_count: centers.filter((c) => c.center_type === "nonprofit").length,
    forprofit_count: centers.filter((c) => c.center_type === "for-profit").length,
    headstart_count: centers.filter((c) => c.center_type === "head-start").length,
    licensed_count: centers.filter((c) => c.is_licensed).length,
  };
}

export async function logOutreach(
  centerId: string,
  method: string,
  notes: string,
  outcome: string
) {
  const { error } = await supabase.from("outreach_log").insert({
    center_id: centerId,
    contact_method: method,
    notes,
    outcome,
  });
  if (error) throw new Error(error.message);
}

export function exportToCSV(centers: Center[]): string {
  const headers = [
    "Name", "Address", "City", "State", "ZIP", "County", "Phone", "Email",
    "Director", "Type", "Licensed", "License #", "Capacity", "Enrollment",
    "Area FRP %", "Area Eligible", "CACFP Participant", "Sponsor",
    "Sponsor Phone", "Subsidy %",
  ];

  const rows = centers.map((c) => [
    c.name,
    c.address,
    c.city,
    c.state,
    c.zip,
    c.county || "",
    c.phone || "",
    c.email || "",
    c.director_name || "",
    c.center_type,
    c.is_licensed ? "Yes" : "No",
    c.license_number || "",
    c.licensed_capacity || "",
    c.current_enrollment || "",
    c.frp_percentage || "",
    c.area_eligibility,
    c.is_cacfp_participant ? "Yes" : "No",
    c.sponsor?.name || "",
    c.sponsor?.phone || "",
    c.subsidy_pct || "",
  ]);

  let csv = headers.join(",") + "\n";
  for (const row of rows) {
    csv += row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
  }
  return csv;
}
