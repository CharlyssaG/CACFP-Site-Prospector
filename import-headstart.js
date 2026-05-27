/**
 * CACFP Site Prospector — Head Start Data Importer
 *
 * Downloads the full national Head Start service locations dataset from
 * HeadStart.gov and upserts it into your Supabase `centers` table.
 *
 * Usage:
 *   node import-headstart.js
 *
 * Requirements:
 *   npm install @supabase/supabase-js papaparse node-fetch dotenv
 *
 * Environment variables (in .env.local or your shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← use service role, not anon, for bulk writes
 */

import "dotenv/config";
import fetch from "node-fetch";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const HEADSTART_CSV_URL =
  "https://s3foa.s3.us-east-1.amazonaws.com/HS_Service_Locations.csv";

const UPSERT_BATCH_SIZE = 100; // Supabase handles ~500/batch fine; 100 is safe

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Program type map ─────────────────────────────────────────────────────────
// Head Start dataset uses numeric codes; we map to our center_type enum.
// All Head Start types map to "head-start" in our schema.
const PROGRAM_TYPE_LABELS = {
  1: "Head Start Preschool",
  2: "Early Head Start",
  3: "Migrant and Seasonal Head Start",
  4: "Migrant and Seasonal Head Start",
  5: "American Indian and Alaska Native Head Start",
  6: "American Indian and Alaska Native Early Head Start",
};

// ── Field mapping ────────────────────────────────────────────────────────────
// HeadStart.gov CSV field → our centers table column
//
// Full data dictionary: https://headstart.gov/about-us/article/head-start-service-location-datasets
//
// Key source fields used:
//   service_location_name       → name
//   service_location_address    → address
//   service_location_city       → city
//   service_location_state      → state
//   service_location_zip        → zip
//   service_location_county     → county
//   service_location_phone      → phone
//   service_location_latitude   → latitude
//   service_location_longitude  → longitude
//   program_type                → used to confirm head-start type + notes
//   recipient_name              → notes (grantee org name)
//   grant_number                → license_number (repurposed as unique ref)
//   enrollment_total            → current_enrollment (if present)
//   funded_enrollment           → licensed_capacity (if present)

function mapRow(row) {
  const programTypeNum = parseInt(row.program_type, 10);
  const programTypeLabel = PROGRAM_TYPE_LABELS[programTypeNum] || "Head Start";

  // Normalize zip — source may include ZIP+4, we want just 5 digits
  const rawZip = (row.service_location_zip || "").trim();
  const zip = rawZip.replace(/^(\d{5}).*$/, "$1") || rawZip;

  // State — uppercase 2-letter
  const state = (row.service_location_state || "").trim().toUpperCase();

  // Capacity fields — Head Start data uses "funded_enrollment" and "enrollment_total"
  const licensedCapacity = parseIntOrNull(row.funded_enrollment);
  const currentEnrollment = parseIntOrNull(row.enrollment_total);

  // Coordinates
  const latitude = parseFloatOrNull(row.service_location_latitude);
  const longitude = parseFloatOrNull(row.service_location_longitude);

  // Phone — strip to digits and reformat if needed
  const phone = normalizePhone(row.service_location_phone);

  // Build a notes string with grantee context
  const notes = [
    row.recipient_name ? `Grantee: ${row.recipient_name}` : null,
    row.grant_number ? `Grant #: ${row.grant_number}` : null,
    `Program type: ${programTypeLabel}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    // Identity
    name: (row.service_location_name || "").trim(),
    address: (row.service_location_address_line_one || row.service_location_address || "").trim(),
    city: (row.service_location_city || "").trim(),
    state,
    zip,
    county: (row.service_location_county || "").trim() || null,

    // Contact
    phone: phone || null,
    email: null, // Head Start dataset does not include center-level email

    // Classification — all Head Start = head-start type, auto-eligible
    center_type: "head-start",
    area_eligibility: "eligible", // Head Start programs are always CACFP-eligible
    is_cacfp_participant: false,  // They're eligible but may not be enrolled yet — flag for follow-up

    // Licensing — Head Start programs are federally funded, not state-licensed
    // We store the grant number as a reference identifier
    is_licensed: true,
    license_number: (row.grant_number || "").trim() || null,

    // Capacity
    licensed_capacity: licensedCapacity,
    current_enrollment: currentEnrollment,

    // Geo
    latitude,
    longitude,

    // Meta
    source: "HeadStart.gov national dataset",
    notes: notes || null,
    last_verified_at: new Date().toISOString(),

    // Not set by this import — left for sponsor matching later
    sponsor_id: null,
    frp_percentage: null,
    subsidy_pct: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseIntOrNull(val) {
  if (!val || val.toString().trim() === "") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function parseFloatOrNull(val) {
  if (!val || val.toString().trim() === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim() || null; // Return original if format is unexpected
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📥  Downloading Head Start service locations dataset...");

  const response = await fetch(HEADSTART_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to download dataset: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  console.log(`✅  Downloaded. Parsing CSV...`);

  const { data: rows, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (errors.length > 0) {
    console.warn(`⚠️  CSV parse warnings: ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.warn("   ", e.message));
  }

  console.log(`📋  Parsed ${rows.length.toLocaleString()} service location records.`);

  // Filter out records with no name or address — these are incomplete entries
  const validRows = rows.filter(
    (r) =>
      (r.service_location_name || "").trim() &&
      (r.service_location_address_line_one || r.service_location_address || "").trim() &&
      (r.service_location_state || "").trim()
  );

  console.log(`✅  ${validRows.length.toLocaleString()} records passed validation.`);
  console.log(`⏭️  Skipped ${rows.length - validRows.length} incomplete records.`);

  const mapped = validRows.map(mapRow);

  // ── Upsert in batches ────────────────────────────────────────────────────
  // We use upsert on (name, address, state, zip) as the natural unique key
  // since Head Start records don't have a consistent single unique ID we can
  // rely on across imports. grant_number can repeat across program types.

  console.log(`\n🚀  Upserting to Supabase in batches of ${UPSERT_BATCH_SIZE}...`);

  let inserted = 0;
  let errors_count = 0;

  for (let i = 0; i < mapped.length; i += UPSERT_BATCH_SIZE) {
    const batch = mapped.slice(i, i + UPSERT_BATCH_SIZE);

    const { error } = await supabase
      .from("centers")
      .upsert(batch, {
        onConflict: "name,address,state,zip",
        ignoreDuplicates: false, // Update existing records with fresh data
      });

    if (error) {
      console.error(`❌  Batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1} error:`, error.message);
      errors_count += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(
        `\r   Progress: ${inserted.toLocaleString()} / ${mapped.length.toLocaleString()}`
      );
    }
  }

  console.log(`\n\n✅  Import complete.`);
  console.log(`   Upserted:  ${inserted.toLocaleString()} records`);
  if (errors_count > 0) {
    console.log(`   Errors:    ${errors_count.toLocaleString()} records failed`);
  }
  console.log(
    `\n💡  Next steps:\n` +
    `   - Head Start centers are flagged as area_eligibility = 'eligible'\n` +
    `   - is_cacfp_participant = false — they're prospects, not confirmed participants\n` +
    `   - No emails in the source data — enrich via sponsor outreach or web research\n` +
    `   - Run again anytime to pull fresh data (dataset updates daily)`
  );
}

main().catch((err) => {
  console.error("💥  Fatal error:", err);
  process.exit(1);
});
