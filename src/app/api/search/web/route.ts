import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are a CACFP (Child and Adult Care Food Program) site prospecting assistant.
When given a location, find childcare centers, daycare facilities, Head Start programs, 
adult care programs, and similar CACFP-eligible sites in that area using web search.

Return ONLY a valid JSON array of objects with these exact fields (no preamble, no markdown, no backticks):
[
  {
    "name": "string",
    "address": "string",
    "city": "string",
    "state": "string — 2-letter code",
    "zip": "string — 5 digits",
    "county": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "director_name": "string or null",
    "center_type": "childcare-nonprofit",
    "is_licensed": true,
    "license_number": "string or null",
    "licensed_capacity": null,
    "area_eligibility": "unknown",
    "is_cacfp_participant": false,
    "latitude": null,
    "longitude": null,
    "notes": "string or null"
  }
]

center_type must be one of: childcare-nonprofit, childcare-forprofit, head-start, early-head-start, migrant-seasonal-head-start, migrant-seasonal-early-head-start, aian-head-start, aian-early-head-start, adult-care-program, aras-sfsp

Rules:
- Return 10-25 real, verifiable facilities found via web search
- Do NOT invent or hallucinate facilities
- Prefer licensed childcare centers
- Return ONLY the raw JSON array`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ centers: [], stats: null }, { status: 400 });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "auto" },
        messages: [
          {
            role: "user",
            content: `Find childcare centers, Head Start programs, adult care programs, and other CACFP-eligible facilities in: ${query}. Use web search to find real licensed facilities and return them as a JSON array only.`,
          },
        ],
      }),
    });

    // Always log the raw response for debugging
    const anthropicData = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Anthropic error:", JSON.stringify(anthropicData));
      return NextResponse.json(
        { error: `Anthropic API error: ${anthropicData?.error?.message || anthropicRes.status}` },
        { status: 500 }
      );
    }

    // Log stop reason to help debug
    console.log("Anthropic stop_reason:", anthropicData.stop_reason);
    console.log("Anthropic content blocks:", anthropicData.content?.map((b: any) => b.type));

    // Extract all text blocks
    const textContent = (anthropicData.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    console.log("Text content length:", textContent.length);
    console.log("Text content preview:", textContent.slice(0, 300));

    // Parse JSON array from response
    let facilities: any[] = [];
    const clean = textContent.replace(/```json|```/g, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        facilities = JSON.parse(match[0]);
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
        return NextResponse.json(
          { error: "Could not parse results. Try a more specific location." },
          { status: 500 }
        );
      }
    } else {
      console.error("No JSON array found in response:", clean.slice(0, 500));
      return NextResponse.json({ centers: [], stats: null, debug: clean.slice(0, 200) });
    }

    if (!Array.isArray(facilities) || facilities.length === 0) {
      return NextResponse.json({ centers: [], stats: null });
    }

    // Normalize
    const now = new Date().toISOString();
    const toInsert = facilities
      .filter((f) => f.name && f.address && f.city && f.state)
      .map((f) => ({
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
      console.error("Upsert error, falling back to insert:", upsertError.message);
      const { data: inserted } = await adminSupabase
        .from("centers")
        .insert(toInsert)
        .select("*, sponsor:sponsors(*)");
      results = inserted || [];
    } else {
      results = upserted || [];
    }

    return NextResponse.json({
      centers: results,
      stats: buildStats(results),
      source: "web-search",
      saved_count: results.length,
    });

  } catch (err: any) {
    console.error("Web search caught error:", err);
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
    nonprofit_count:  results.filter((c) => c.center_type === "childcare-nonprofit").length,
    forprofit_count:  results.filter((c) => c.center_type === "childcare-forprofit").length,
    headstart_count:  results.filter((c) => HEAD_START_TYPES.includes(c.center_type)).length,
    licensed_count:   results.filter((c) => c.is_licensed).length,
  };
}
