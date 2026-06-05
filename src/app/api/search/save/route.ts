import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEAD_START_TYPES = [
  "head-start", "early-head-start",
  "migrant-seasonal-head-start", "migrant-seasonal-early-head-start",
  "aian-head-start", "aian-early-head-start",
];

export async function POST(request: NextRequest) {
  try {
    const { facilities } = await request.json();

    if (!Array.isArray(facilities) || facilities.length === 0) {
      return NextResponse.json({ saved_count: 0, centers: [] });
    }

    const now = new Date().toISOString();
    const toInsert = facilities
      .filter((f: any) => f.name && f.address && f.city && f.state)
      .map((f: any) => ({
        name:                 f.name?.trim(),
        address:              f.address?.trim(),
        city:                 f.city?.trim(),
        state:                f.state?.trim().toUpperCase().slice(0, 2),
        zip:                  (f.zip || "00000").trim().slice(0, 10),
        county:               f.county || null,
        phone:                f.phone || null,
        email:                f.email?.toLowerCase() || null,
        director_name:        f.director_name || null,
        center_type:          f.center_type || "childcare-nonprofit",
        is_licensed:          f.is_licensed ?? true,
        license_number:       f.license_number || null,
        licensed_capacity:    f.licensed_capacity || null,
        current_enrollment:   null,
        area_eligibility:     f.area_eligibility || "unknown",
        frp_percentage:       null,
        subsidy_pct:          null,
        is_cacfp_participant: f.is_cacfp_participant ?? false,
        latitude:             f.latitude || null,
        longitude:            f.longitude || null,
        notes:                f.notes || null,
        source:               "web-search",
        last_verified_at:     now,
      }));

    // Try upsert first, fall back to insert
    let results: any[] = [];
    const { data: upserted, error: upsertError } = await adminSupabase
      .from("centers")
      .upsert(toInsert, { onConflict: "name,city,state", ignoreDuplicates: true })
      .select("*, sponsor:sponsors(*)");

    if (upsertError) {
      const { data: inserted } = await adminSupabase
        .from("centers")
        .insert(toInsert)
        .select("*, sponsor:sponsors(*)");
      results = inserted || [];
    } else {
      results = upserted || [];
    }

    const total = results.length;
    const stats = {
      total_count:       total,
      unsponsored_count: results.filter((c) => !c.sponsor_id).length,
      eligible_count:    results.filter((c) => c.area_eligibility === "eligible").length,
      avg_capacity:      total
        ? Math.round(results.reduce((s, c) => s + (c.licensed_capacity || 0), 0) / total)
        : 0,
      nonprofit_count:  results.filter((c) => c.center_type === "childcare-nonprofit").length,
      forprofit_count:  results.filter((c) => c.center_type === "childcare-forprofit").length,
      headstart_count:  results.filter((c) => HEAD_START_TYPES.includes(c.center_type)).length,
      licensed_count:   results.filter((c) => c.is_licensed).length,
    };

    return NextResponse.json({ centers: results, stats, saved_count: results.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Save failed" }, { status: 500 });
  }
}
