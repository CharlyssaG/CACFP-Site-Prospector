import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are a CACFP (Child and Adult Care Food Program) site prospecting assistant.
When given a location, find childcare centers, daycare facilities, Head Start programs, 
adult care programs, and similar CACFP-eligible sites in that area using web search.

Return ONLY a valid JSON array of objects with these exact fields:
{
  "name": "string — facility name",
  "address": "string — street address",
  "city": "string",
  "state": "string — 2-letter code",
  "zip": "string — 5 digits",
  "county": "string or null",
  "phone": "string or null — formatted (XXX) XXX-XXXX",
  "email": "string or null",
  "director_name": "string or null",
  "center_type": "one of: childcare-nonprofit, childcare-forprofit, head-start, early-head-start, migrant-seasonal-head-start, migrant-seasonal-early-head-start, aian-head-start, aian-early-head-start, adult-care-program, aras-sfsp",
  "is_licensed": true or false,
  "license_number": "string or null",
  "licensed_capacity": number or null,
  "area_eligibility": "one of: eligible, maybe, not-eligible, unknown",
  "is_cacfp_participant": true or false,
  "latitude": number or null,
  "longitude": number or null,
  "notes": "string or null — any relevant details"
}

Rules:
- Return 10-25 results when possible
- Only include real, verifiable facilities you find via web search
- Do not invent or hallucinate facilities
- Prefer licensed childcare centers over unlicensed home daycares
- Set area_eligibility to "eligible" if the area is known to be low-income, "unknown" otherwise
- Set is_cacfp_participant to true only if you find evidence they are enrolled in CACFP
- Return ONLY the JSON array, no preamble, no markdown, no backticks`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ centers: [], stats: null }, { status: 400 });
  }

  try {
    // Call Anthropic API with web search enabled
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Find childcare centers, Head Start programs, adult care programs, and other CACFP-eligible facilities in or near: ${query}. Search for licensed childcare facilities in this location and return them as a JSON array.`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
    }

    const anthropicData = await anthropicRes.json();

    // Extract text content from response (may be across multiple blocks)
    const textContent = anthropicData.content
      ?.filter((b: any) => b.type === "text")
      ?.map((b: any) => b.text)
      ?.join("") || "";

    // Parse JSON from response
    let facilities: any[] = [];
    try {
      // Strip any accidental markdown fences
      const clean = textContent.replace(/```json|```/g, "").trim();
      // Find the JSON array
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) {
        facilities = JSON.parse(match[0]);
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse search results. Try a more specific location." },
        { status: 500 }
      );
    }

    if (!Array.isArray(facilities) || facilities.length === 0) {
      return NextResponse.json({ centers: [], stats: null });
    }

    // Normalize and save to Supabase
    const now = new Date().toISOString();
    const toInsert = facilities
      .filter((f) => f.name && f.address && f.city && f.state)
      .map((f) => ({
        name:                f.name?.trim(),
        address:             f.address?.trim(),
        city:                f.city?.trim(),
        state:               f.state?.trim().toUpperCase().slice(0, 2),
        zip:                 (f.zip || "").trim().slice(0, 10) || "00000",
        county:              f.county || null,
        phone:               f.phone || null,
        email:               f.email?.toLowerCase() || null,
        director_name:       f.director_name || null,
        center_type:         f.center_type || "childcare-nonprofit",
        is_licensed:         f.is_licensed ?? true,
        license_number:      f.license_number || null,
        licensed_capacity:   f.licensed_capacity || null,
        current_enrollment:  null,
        area_eligibility:    f.area_eligibility || "unknown",
        frp_percentage:      null,
        subsidy_pct:         null,
        is_cacfp_participant: f.is_cacfp_participant ?? false,
        latitude:            f.latitude || null,
        longitude:           f.longitude || null,
        notes:               f.notes || null,
        source:              "web-search",
        last_verified_at:    now,
      }));

    // Upsert — skip exact duplicates by name + city + state
    const { data: saved, error: saveError } = await adminSupabase
      .from("centers")
      .upsert(toInsert, {
        onConflict: "name,city,state",
        ignoreDuplicates: true,
      })
      .select("*, sponsor:sponsors(*)");

    if (saveError) {
      // If upsert fails (e.g. no unique constraint), fall back to plain insert
      const { data: inserted } = await adminSupabase
        .from("centers")
        .insert(toInsert)
        .select("*, sponsor:sponsors(*)");

      const results = inserted || [];
      return NextResponse.json({
        centers: results,
        stats: buildStats(results),
        source: "web-search",
        saved_count: results.length,
      });
    }

    const results = saved || [];
    return NextResponse.json({
      centers: results,
      stats: buildStats(results),
      source: "web-search",
      saved_count: results.length,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Web search failed" },
      { status: 500 }
    );
  }
}

function buildStats(results: any[]) {
  const total = results.length;
  const HEAD_START_TYPES = [
    "head-start", "early-head-start",
    "migrant-seasonal-head-start", "migrant-seasonal-early-head-start",
    "aian-head-start", "aian-early-head-start",
  ];
  return {
    total_count:       total,
    unsponsored_count: results.filter((c) => !c.sponsor_id).length,
    eligible_count:    results.filter((c) => c.area_eligibility === "eligible").length,
    avg_capacity:      total
      ? Math.round(results.reduce((s, c) => s + (c.licensed_capacity || 0), 0) / total)
      : 0,
    nonprofit_count:   results.filter((c) => c.center_type === "childcare-nonprofit").length,
    forprofit_count:   results.filter((c) => c.center_type === "childcare-forprofit").length,
    headstart_count:   results.filter((c) => HEAD_START_TYPES.includes(c.center_type)).length,
    licensed_count:    results.filter((c) => c.is_licensed).length,
  };
}
