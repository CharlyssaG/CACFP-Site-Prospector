import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "auto";

  if (!query.trim()) {
    return new NextResponse("Missing query", { status: 400 });
  }

  let dbQuery = supabase
    .from("centers")
    .select("*, sponsor:sponsors(name, phone)")
    .limit(1000);

  // Determine type
  const q = query.trim();
  let effectiveType = type;
  if (type === "auto") {
    if (/^\d{5}$/.test(q)) effectiveType = "zip";
    else if (/county/i.test(q)) effectiveType = "county";
    else if (/^[A-Z]{2}$/i.test(q) && q.length === 2) effectiveType = "state";
    else effectiveType = "city";
  }

  switch (effectiveType) {
    case "zip":
      dbQuery = dbQuery.eq("zip", q);
      break;
    case "state":
      dbQuery = dbQuery.eq("state", q.toUpperCase());
      break;
    case "county":
      dbQuery = dbQuery.ilike("county", `%${q.replace(/\s*county\s*/i, "").trim()}%`);
      break;
    default:
      dbQuery = dbQuery.ilike("city", `%${q.split(",")[0].trim()}%`);
  }

  const { data: centers, error } = await dbQuery.order("name");

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  const headers = [
    "Name", "Address", "City", "State", "ZIP", "County", "Phone", "Email",
    "Director", "Type", "Licensed", "License #", "Capacity", "Enrollment",
    "Area FRP %", "Area Eligible", "CACFP Participant", "Sponsor",
    "Sponsor Phone", "Subsidy %",
  ];

  const rows = (centers || []).map((c: any) => [
    c.name, c.address, c.city, c.state, c.zip, c.county || "",
    c.phone || "", c.email || "", c.director_name || "", c.center_type,
    c.is_licensed ? "Yes" : "No", c.license_number || "",
    c.licensed_capacity || "", c.current_enrollment || "",
    c.frp_percentage || "", c.area_eligibility,
    c.is_cacfp_participant ? "Yes" : "No",
    c.sponsor?.name || "", c.sponsor?.phone || "", c.subsidy_pct || "",
  ]);

  let csv = headers.join(",") + "\n";
  for (const row of rows) {
    csv += row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cacfp-prospects-${q}.csv"`,
    },
  });
}
