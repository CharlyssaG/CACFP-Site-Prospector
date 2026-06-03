import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS entirely
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auth client — anon key, used only to verify the session token
const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Source auto-detection ─────────────────────────────────────────────────────

type SourceFormat = "texas_hhsc" | "headstart" | "new_york_ocfs" | "michigan_gis" | "generic";

function detectFormat(headers: string[]): SourceFormat {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("operation_id") && h.includes("operation_type")) return "texas_hhsc";
  if (h.includes("grant_number") && h.includes("service_location_name")) return "headstart";
  if (h.includes("facility_id") && h.includes("facility_type") && h.includes("open_date")) return "new_york_ocfs";
  if (h.includes("license_number") && h.includes("license_type") && h.includes("latitude")) return "michigan_gis";
  return "generic";
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  // Handle \r\n and \r line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Parse headers respecting quoted fields
  const parseRow = (line: string): string[] => {
    const vals: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        vals.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    vals.push(cur.trim());
    return vals;
  };

  const headers = parseRow(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

const clean = (v: string | undefined) => (v ?? "").trim();
const nullable = (v: string) => (v.trim() === "" ? null : v.trim());
const nullableInt = (v: string) => {
  const n = parseInt(v.trim());
  return isNaN(n) ? null : n;
};
const nullableFloat = (v: string) => {
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
};
const cleanZip = (z: string) => z.trim().split(/\s/)[0].substring(0, 10);
const cleanPhone = (p: string) => {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  return nullable(p);
};
const titleCase = (s: string) =>
  s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const slugToName = (s: string) => {
  // Remove trailing _XX state suffix, replace underscores, title case
  let name = s.replace(/_[a-z]{2}$/, "").replace(/_/g, " ");
  name = titleCase(name);
  // Fix small words
  return name
    .replace(/\bOf\b/g, "of").replace(/\bThe\b/g, "the")
    .replace(/\bAnd\b/g, "and").replace(/\bFor\b/g, "for")
    .replace(/^./, (c) => c.toUpperCase());
};

type CenterType = "nonprofit" | "for-profit" | "head-start";
type AreaEligibility = "eligible" | "maybe" | "not-eligible" | "unknown";

interface CenterRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string | null;
  phone?: string | null;
  email?: string | null;
  director_name?: string | null;
  center_type: CenterType;
  is_licensed: boolean;
  license_number?: string | null;
  licensed_capacity?: number | null;
  current_enrollment?: number | null;
  area_eligibility: AreaEligibility;
  frp_percentage?: number | null;
  subsidy_pct?: number | null;
  is_cacfp_participant: boolean;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  source: string;
  last_verified_at: string;
  // sponsor lookup (not a DB column — resolved separately)
  _sponsor_name?: string | null;
}

// ── Format-specific normalizers ───────────────────────────────────────────────

function normalizeTexas(rows: Record<string, string>[]): CenterRow[] {
  return rows
    .filter(r =>
      r["OPERATION_TYPE"] === "Licensed Center" &&
      r["OPERATION_STATUS"] === "Y" &&
      r["TEMPORARILY_CLOSED"] === "NO" &&
      clean(r["OPERATION_NAME"])
    )
    .map(r => {
      const notes = [
        r["ACCEPTS_CHILD_CARE_SUBSIDIES"] === "Y" ? "Accepts subsidies: Yes" : "Accepts subsidies: No",
        r["HOURS_OF_OPERATION"] ? `Hours: ${clean(r["HOURS_OF_OPERATION"])}` : "",
        r["LICENSED_TO_SERVE_AGES"] ? `Ages: ${clean(r["LICENSED_TO_SERVE_AGES"])}` : "",
        r["CARE_TYPE"] ? `Care type: ${clean(r["CARE_TYPE"])}` : "",
      ].filter(Boolean).join(" | ");

      return {
        name: clean(r["OPERATION_NAME"]),
        address: clean(r["ADDRESS_LINE"]),
        city: titleCase(clean(r["CITY"])),
        state: "TX",
        zip: cleanZip(r["ZIPCODE"]),
        county: nullable(titleCase(clean(r["COUNTY"]))),
        phone: cleanPhone(r["PHONE_NUMBER"]),
        email: nullable(clean(r["email_address"]).toLowerCase()),
        director_name: nullable(clean(r["ADMINISTRATOR_DIRECTOR_NAME"])),
        center_type: "nonprofit",
        is_licensed: true,
        license_number: nullable(r["OPERATION_NUMBER"]),
        licensed_capacity: nullableInt(r["TOTAL_CAPACITY"]),
        current_enrollment: null,
        area_eligibility: "unknown",
        frp_percentage: null,
        subsidy_pct: null,
        is_cacfp_participant: false,
        latitude: null,
        longitude: null,
        notes: nullable(notes),
        source: "TX HHSC CCL / data.texas.gov",
        last_verified_at: new Date().toISOString(),
      };
    });
}

function normalizeHeadStart(rows: Record<string, string>[]): { centers: CenterRow[]; sponsors: { name: string; address: string; city: string; state: string; zip: string }[] } {
  const PROG_LABELS: Record<string, string> = {
    "1": "Head Start", "2": "Early Head Start",
    "3": "Migrant & Seasonal Head Start", "4": "Migrant & Seasonal Early Head Start",
    "5": "American Indian/Alaska Native Head Start", "6": "American Indian/Alaska Native Early Head Start",
  };

  const sponsorMap = new Map<string, { name: string; address: string; city: string; state: string; zip: string }>();
  const openRows = rows.filter(r => r["status"] === "Open" && clean(r["service_location_name"]));

  for (const r of openRows) {
    const key = clean(r["recipient_name"]);
    if (!sponsorMap.has(key)) {
      const addrParts = [r["program_admin_address_line_one"], r["program_admin_address_line_two"]].map(clean).filter(Boolean);
      sponsorMap.set(key, {
        name: slugToName(key),
        address: addrParts.join(" "),
        city: titleCase(clean(r["program_admin_city"])),
        state: clean(r["program_admin_state"]),
        zip: clean(r["program_admin_zip"]).substring(0, 5),
      });
    }
  }

  const centers: CenterRow[] = openRows.map(r => {
    const addrParts = [r["address_line_one"], r["address_line_two"]].map(clean).filter(Boolean);
    const prog = PROG_LABELS[clean(r["program_type"])] ?? "Head Start";
    return {
      name: clean(r["service_location_name"]),
      address: addrParts.join(" "),
      city: titleCase(clean(r["city"])),
      state: clean(r["state"]),
      zip: clean(r["zip"]).substring(0, 5),
      county: nullable(clean(r["county"])),
      phone: cleanPhone(r["service_location_phone_number"]),
      email: null,
      director_name: null,
      center_type: "head-start",
      is_licensed: true,
      license_number: nullable(r["grant_Number"]),
      licensed_capacity: nullableInt(r["funded_slots"]),
      current_enrollment: null,
      area_eligibility: "eligible",
      frp_percentage: null,
      subsidy_pct: null,
      is_cacfp_participant: true,
      latitude: nullableFloat(r["latitude"]),
      longitude: nullableFloat(r["longitude"]),
      notes: `Program type: ${prog} | Grant: ${clean(r["grant_Number"])}`,
      source: "Head Start / headstart.gov",
      last_verified_at: new Date().toISOString(),
      _sponsor_name: slugToName(clean(r["recipient_name"])),
    };
  });

  return { centers, sponsors: Array.from(sponsorMap.values()) };
}

function normalizeGeneric(rows: Record<string, string>[], columnMap: Record<string, string>): CenterRow[] {
  return rows
    .map(r => {
      const get = (dbField: string) => {
        const csvCol = Object.keys(columnMap).find(k => columnMap[k] === dbField);
        return csvCol ? clean(r[csvCol]) : "";
      };
      const name = get("name");
      const address = get("address");
      const city = get("city");
      const state = get("state");
      const zip = get("zip");
      if (!name || !address || !city || !state || !zip) return null;

      const ct = get("center_type").toLowerCase();
      const center_type: CenterType =
        ct === "for-profit" || ct === "for profit" ? "for-profit"
        : ct === "head-start" || ct === "head start" ? "head-start"
        : "nonprofit";

      const ae = get("area_eligibility").toLowerCase();
      const area_eligibility: AreaEligibility =
        ae === "eligible" ? "eligible"
        : ae === "maybe" ? "maybe"
        : ae === "not-eligible" || ae === "not eligible" ? "not-eligible"
        : "unknown";

      return {
        name,
        address,
        city,
        state: state.toUpperCase().substring(0, 2),
        zip: cleanZip(zip),
        county: nullable(get("county")),
        phone: cleanPhone(get("phone")),
        email: nullable(get("email").toLowerCase()),
        director_name: nullable(get("director_name")),
        center_type,
        is_licensed: get("is_licensed").toLowerCase() !== "false",
        license_number: nullable(get("license_number")),
        licensed_capacity: nullableInt(get("licensed_capacity")),
        current_enrollment: nullableInt(get("current_enrollment")),
        area_eligibility,
        frp_percentage: nullableFloat(get("frp_percentage")),
        subsidy_pct: nullableFloat(get("subsidy_pct")),
        is_cacfp_participant: get("is_cacfp_participant").toLowerCase() === "true",
        latitude: null,
        longitude: null,
        notes: nullable(get("notes")),
        source: "Manual upload",
        last_verified_at: new Date().toISOString(),
      } as CenterRow;
    })
    .filter((r): r is CenterRow => r !== null);
}

// ── Batch upsert helper ───────────────────────────────────────────────────────

const BATCH = 500;

async function upsertCenters(centers: CenterRow[], sponsorLookup: Map<string, string>) {
  let inserted = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < centers.length; i += BATCH) {
    const batch = centers.slice(i, i + BATCH).map(({ _sponsor_name, ...c }) => ({
      ...c,
      sponsor_id: _sponsor_name ? (sponsorLookup.get(_sponsor_name) ?? null) : null,
    }));

    const { error, count } = await adminSupabase
      .from("centers")
      .insert(batch, { count: "exact" });

    if (error) {
      // Log batch-level error but continue
      errors.push({ row: i + 1, message: error.message });
    } else {
      inserted += count ?? batch.length;
    }
  }

  return { inserted, errors };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Verify admin session
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Parse form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const columnMapRaw = formData.get("columnMap") as string | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const columnMap: Record<string, string> = columnMapRaw ? JSON.parse(columnMapRaw) : {};
  const text = await file.text();
  const allRows = parseCSV(text);
  if (allRows.length === 0) return NextResponse.json({ error: "File appears empty" }, { status: 400 });

  const headers = Object.keys(allRows[0]);
  const format = detectFormat(headers);

  let centers: CenterRow[] = [];
  let sponsorInserts: { name: string; address: string; city: string; state: string; zip: string }[] = [];

  // 3. Normalize based on detected format
  if (format === "texas_hhsc") {
    centers = normalizeTexas(allRows);
  } else if (format === "headstart") {
    const result = normalizeHeadStart(allRows);
    centers = result.centers;
    sponsorInserts = result.sponsors;
  } else {
    centers = normalizeGeneric(allRows, columnMap);
  }

  // 4. Insert sponsors first (Head Start) and build lookup map
  const sponsorLookup = new Map<string, string>();

  if (sponsorInserts.length > 0) {
    for (let i = 0; i < sponsorInserts.length; i += BATCH) {
      const batch = sponsorInserts.slice(i, i + BATCH).map(s => ({ ...s, is_active: true }));
      await adminSupabase.from("sponsors").insert(batch).select("id, name");
    }
    // Re-fetch all sponsors to build the lookup (name → id)
    const { data: allSponsors } = await adminSupabase
      .from("sponsors")
      .select("id, name")
      .eq("is_active", true);
    for (const s of allSponsors ?? []) {
      sponsorLookup.set(s.name, s.id);
    }
  }

  // 5. Upsert centers in batches
  const { inserted, errors } = await upsertCenters(centers, sponsorLookup);

  return NextResponse.json({
    inserted,
    updated: 0,
    format,
    total_parsed: centers.length,
    errors,
  });
}
