// ── Scoring logic — extracted for testability ────────────────────
// All functions here are pure or fetch-only (no React / no state).
// Import this module in vertiport-eval.jsx and in tests.

import { US_AIRSPACE } from './usAirspace.js';

// ── Quadrant color palette (mirrored from UI constants) ───────────
const SCORE_COLORS = {
  green:  "#1a8a58",
  yellow: "#c87a10",
  red:    "#C0392B",
  teal:   "#4a9a8e",
};

// ── Demand criteria config ────────────────────────────────────────
export const DEMAND_CRITERIA = {
  passenger: [
    { key:"employment",       label:"Employment Density",          icon:"🏢" },
    { key:"destinations",     label:"Destinations & Attractions",  icon:"📍" },
    { key:"medical",          label:"Medical & Institutional",     icon:"🏥" },
    { key:"cargo",            label:"Cargo & Logistics",           icon:"📦" },
    { key:"transit_gap",      label:"Transit Gap",                 icon:"🚌" },
  ],
  cargo: [
    { key:"logistics_hub",    label:"Logistics Infrastructure",    icon:"🏭" },
    { key:"last_mile",        label:"Last-Mile Demand",            icon:"📦" },
    { key:"cargo_network",    label:"Cargo Network Value",         icon:"✈" },
    { key:"priority_freight", label:"Priority Freight",            icon:"⚡" },
    { key:"ground_access",    label:"Ground Access",               icon:"🚛" },
  ],
  combo: [
    { key:"logistics_hub",    label:"Logistics Infrastructure",    icon:"🏭" },
    { key:"employment",       label:"Employment & Destinations",   icon:"🏢" },
    { key:"cargo_network",    label:"Cargo Network",               icon:"✈" },
    { key:"priority_freight", label:"Priority / Medical Cargo",    icon:"⚡" },
    { key:"last_mile",        label:"Last-Mile + Transit",         icon:"📦" },
  ],
};

export const DEMAND_HEADER = {
  passenger: "DEMAND SCORE — WHY FLY HERE?",
  cargo:     "DEMAND SCORE — WHY SHIP HERE?",
  combo:     "DEMAND SCORE — WHY FLY & SHIP HERE?",
};

// ── Core scoring formulas ─────────────────────────────────────────
export const priorityIndex = (site, demand) => Math.round(site * 0.60 + demand * 0.40);

export function getQuadrant(site, demand) {
  const hs = site >= 55, hd = demand >= 70;
  if (hs && hd)  return { label:"PRIME SITE",          color:SCORE_COLORS.green  };
  if (hs && !hd) return { label:"INFRASTRUCTURE PLAY", color:SCORE_COLORS.teal   };
  if (!hs && hd) return { label:"DEMAND WITHOUT SITE", color:SCORE_COLORS.yellow };
  return                 { label:"LOW PRIORITY",        color:SCORE_COLORS.red    };
}

export function getSiteDesc(score) {
  if (score >= 75) return "Strong site — parcel, airspace, and grid criteria support fixed vertiport infrastructure.";
  if (score >= 55) return "Viable site — key infrastructure criteria met with manageable constraints.";
  if (score >= 35) return "Marginal site — constraints require engineering mitigation or an alternative parcel.";
  return "Constrained site — significant barriers to fixed vertiport development at this location.";
}

export function getDemandDesc(score, evalMode = "passenger") {
  const tiers = {
    passenger: [
      [75, "High demand — strong employment density, destination anchors, and medical access confirmed."],
      [50, "Moderate demand — partial employment and destination drivers present."],
      [0,  "Limited demand — low destination density or insufficient transit connectivity."],
    ],
    cargo: [
      [75, "High cargo demand — major logistics infrastructure and freight network access confirmed."],
      [50, "Moderate cargo demand — freight corridor access present; logistics infrastructure developing."],
      [0,  "Limited cargo demand — insufficient freight density or logistics infrastructure."],
    ],
    combo: [
      [75, "High mixed-use demand — logistics and passenger drivers both well-established."],
      [50, "Moderate mixed-use demand — partial cargo and passenger draw identified."],
      [0,  "Limited mixed-use demand — cargo and passenger drivers not yet established."],
    ],
  }[evalMode] || [];
  return tiers.find(([min]) => score >= min)?.[1] || tiers[tiers.length - 1]?.[1] || "";
}

// ── Prompt builder ────────────────────────────────────────────────
export function buildPrompt(input, inputMode, evalMode = "passenger") {
  const locationDesc = inputMode === "coords"
    ? `GPS Coordinates: ${input.lat}, ${input.lon}${input.label ? ` — Site: ${input.label}` : ""}`
    : `Address: "${input.address}"`;
  const coordNote = inputMode === "coords"
    ? `IMPORTANT: Evaluate what is actually at these coordinates. For parks or open land score parcel based on actual site area not adjacent residential lot.` : ``;

  const siteCriteria = `SITE CRITERIA:
PARCEL (25%): >10ac=80-100. 3-10ac=60-80. 1-3ac=35-60. <1ac=5-35. Flag sites under 1.5ac (below NREL minimum for fixed vertiport infrastructure).
AIRSPACE (25%): Class G remote (>20nm from controlled airport)=70-100. Class G suburban=50-70. Class D vicinity=40-55. Class C vicinity=30-50. Class B outer=15-35. Class B surface area=5-15.
ZONING (15%): Industrial/logistics/freight=75-100. Business/commercial park=55-75. Mixed commercial=40-60. Retail/residential=5-35.
SOIL (10%): FEMA Zone X (minimal flood risk)=75-100. Zone X (500-yr)=55-75. Zone AE (1%/yr flood)=20-45. Zone VE (coastal wave action)=5-20.
SITE_COMPOSITE = parcel*0.25 + airspace*0.25 + zoning*0.15 + soil*0.10. Max=75.`;

  const demandSections = {
    passenger: `DEMAND CRITERIA (PASSENGER):
EMPLOYMENT (30%): Score employment density and major workforce concentrations within 5nm. Higher scores for CBDs, major employment hubs, and dense office/industrial areas.
DESTINATIONS (25%): Score proximity to major trip generators — airports, stadiums, convention centers, tourist attractions, major transit hubs.
MEDICAL (20%): Score hospital and medical facility density. Major academic medical centers and hospital clusters score highest; clinics and urgent care score lower.
CARGO (15%): Score cargo and logistics infrastructure — ports, freight airports, distribution centers, industrial corridors.
TRANSIT_GAP (10%): Score the gap in ground transit coverage. Higher transit gap = higher eVTOL utility. Remote/car-dependent areas score highest.
DEMAND_COMPOSITE = employment*0.30 + destinations*0.25 + medical*0.20 + cargo*0.15 + transit_gap*0.10.`,

    cargo: `DEMAND CRITERIA (CARGO OPERATIONS):
LOGISTICS_HUB (30%): Score proximity and access to major cargo generators — seaports, container terminals, fulfillment centers, industrial/logistics parks, freight corridors.
LAST_MILE (25%): Score last-mile delivery demand. For port/maritime locations, weight container throughput and intermodal volume. For urban locations, weight delivery density and population concentration.
CARGO_NETWORK (20%): Score freight network connectivity — proximity to major freight airports, intermodal terminals, highway interchange access, and port infrastructure.
PRIORITY_FREIGHT (15%): Score priority freight demand — medical/pharma supply routes, cold chain hubs, high-value cargo corridors, and time-sensitive logistics.
GROUND_ACCESS (10%): Score ground access quality for heavy vehicles — truck docks, highway ramp access, road network capacity, and any access constraints (causeways, weight limits).
DEMAND_COMPOSITE = logistics_hub*0.30 + last_mile*0.25 + cargo_network*0.20 + priority_freight*0.15 + ground_access*0.10.`,

    combo: `DEMAND CRITERIA (CARGO + PASSENGER COMBO):
LOGISTICS_HUB (25%): Score proximity to major cargo generators — seaports, fulfillment centers, industrial parks, freight corridors.
EMPLOYMENT (25%): Score combined employment density and major passenger destinations. Weight both workforce concentration and trip generators.
CARGO_NETWORK (20%): Score freight network value AND passenger transit connectivity combined.
PRIORITY_FREIGHT (15%): Score combined medical/pharma supply routes and hospital/institutional passenger demand.
LAST_MILE (15%): Score combined last-mile delivery demand and passenger transit gap.
DEMAND_COMPOSITE = logistics_hub*0.25 + employment*0.25 + cargo_network*0.20 + priority_freight*0.15 + last_mile*0.15.`,
  };

  const demandSchemas = {
    passenger: `"demand":{"composite":0,"employment":{"score":0,"notes":"short note"},"destinations":{"score":0,"notes":"short note"},"medical":{"score":0,"notes":"short note"},"cargo":{"score":0,"notes":"short note"},"transit_gap":{"score":0,"notes":"short note"}}`,
    cargo:     `"demand":{"composite":0,"logistics_hub":{"score":0,"notes":"short note"},"last_mile":{"score":0,"notes":"short note"},"cargo_network":{"score":0,"notes":"short note"},"priority_freight":{"score":0,"notes":"short note"},"ground_access":{"score":0,"notes":"short note"}}`,
    combo:     `"demand":{"composite":0,"logistics_hub":{"score":0,"notes":"short note"},"employment":{"score":0,"notes":"short note"},"cargo_network":{"score":0,"notes":"short note"},"priority_freight":{"score":0,"notes":"short note"},"last_mile":{"score":0,"notes":"short note"}}`,
  };

  const em = evalMode in demandSchemas ? evalMode : "passenger";

  return `You are a vertiport site feasibility scoring engine. Evaluation mode: ${em.toUpperCase()}. Score two axes: SITE (can infrastructure be built here?) and DEMAND.
Return integer scores only. Apply the rubric ranges literally — do not extrapolate outside them. When a site matches a range, use the midpoint of that range as your score. Do not adjust scores based on general knowledge outside the rubric.

Location: ${locationDesc}
${coordNote}

${siteCriteria}

${demandSections[em]}

Return ONLY valid JSON, keep ALL string values under 80 chars:
{"geocode":{"matched":"location name","lat":29.76,"lon":-95.37,"valid":true},"site":{"composite":0,"parcel":{"score":0,"acreage_estimate":0.0,"land_type":"type","notes":"short note","flags":["flag"]},"airspace":{"score":0,"status":"class","laanc_required":false,"nearest_airport":"name dist","notes":"short note","flags":[]},"zoning":{"score":0,"compliance":"Good","land_use":"type","notes":"short note","flags":[]},"soil":{"score":0,"flood_zone":"Zone X","slope_estimate":"<1%","elevation_ft":50,"notes":"short note","flags":[]}},${demandSchemas[em]},"summary":"2 sentences max","development_thesis":"one sentence best use case","top_strengths":["strength 1","strength 2"],"top_concerns":["concern 1"]}

Evaluate any US address or coordinates. If the location is outside the United States set geocode.valid=false and all scores to 0.`;
}

// ── Shared JSON extractor for all LLM providers ───────────────────
export function extractLLMJson(text) {
  const match = text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  try { return JSON.parse(match[0]); }
  catch {
    let fixed = match[0];
    const opens = (fixed.match(/\{/g)||[]).length - (fixed.match(/\}/g)||[]).length;
    const openArr = (fixed.match(/\[/g)||[]).length - (fixed.match(/\]/g)||[]).length;
    fixed = fixed.replace(/,\s*$/,"");
    for (let i=0;i<openArr;i++) fixed+="]";
    for (let i=0;i<opens;i++) fixed+="}";
    return JSON.parse(fixed);
  }
}

export async function analyzeWithClaude(input, inputMode, evalMode = "passenger", llmConfig = null) {
  const cfg = llmConfig || { provider: "anthropic", apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY };
  const { provider, apiKey, model, baseUrl } = cfg;
  if (!apiKey) throw new Error("No API key configured. Open Settings to add your key.");

  const prompt = buildPrompt(input, inputMode, evalMode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    let text;

    if (provider === "openai" || baseUrl) {
      // OpenAI-compatible: OpenAI, Grok, DeepSeek, Llama (Groq), Qwen, Mistral
      const endpoint = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions";
      const modelId = model || "gpt-4o";
      const r = await fetch(endpoint, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelId, max_tokens: 2000, temperature: 0, messages: [{ role: "user", content: prompt }] }),
      });
      clearTimeout(timeout);
      if (!r.ok) { const t = await r.text(); throw new Error(`${provider || "API"} ${r.status}: ${t.slice(0, 120)}`); }
      const data = await r.json();
      text = data.choices?.[0]?.message?.content || "";

    } else if (provider === "gemini") {
      const modelId = model || "gemini-2.0-flash";
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 2000 },
          }),
        }
      );
      clearTimeout(timeout);
      if (!r.ok) { const t = await r.text(); throw new Error(`Gemini ${r.status}: ${t.slice(0, 120)}`); }
      const data = await r.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    } else {
      // Anthropic
      const modelId = model || "claude-sonnet-4-6";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: modelId, max_tokens: 2000, temperature: 0, messages: [{ role: "user", content: prompt }] }),
      });
      clearTimeout(timeout);
      if (!r.ok) { const t = await r.text(); throw new Error(`API ${r.status}: ${t.slice(0, 120)}`); }
      const data = await r.json();
      if (data.error) throw new Error(data.error.message || "API error");
      text = data.content?.find(b => b.type === "text")?.text || "";
    }

    if (!text) throw new Error("Empty response from LLM");
    return extractLLMJson(text);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Request timed out. Try again.");
    throw err;
  }
}

// ── EIA Power Grid & DER score (EIA API v2) ───────────────────────
export async function fetchEIAPowerScore(lat, lon, zoningScore) {
  const apiKey = import.meta.env.VITE_EIA_API_KEY;
  if (!apiKey) throw new Error("VITE_EIA_API_KEY not set");
  const zoningBonus = zoningScore >= 75 ? 12 : zoningScore >= 50 ? 7 : zoningScore >= 30 ? 3 : -8;
  let eiaYear = "N/A", eiaSales = "N/A", eiaLive = false;
  try {
    const p = new URLSearchParams();
    p.append("api_key", apiKey);
    p.append("frequency", "annual");
    p.append("data[]", "sales");
    p.append("facets[sectorid][]", "ALL");
    p.append("sort[0][column]", "period");
    p.append("sort[0][direction]", "desc");
    p.append("length", "3");
    const res = await fetch(`https://api.eia.gov/v2/electricity/retail-sales/data/?${p}`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const json = await res.json();
      const row = (json.response?.data || []).find(d => d.sectorid === "ALL");
      if (row) { eiaYear = row.period; eiaSales = `${(parseFloat(row.sales)/1000).toFixed(0)}B kWh/yr`; eiaLive = true; }
    }
  } catch(e) { console.warn("EIA fetch:", e?.message); }
  const score = Math.min(100, Math.max(0, Math.round(68 + zoningBonus)));
  const notes = score >= 75 ? "Grid capacity strong. Three-phase access likely near commercial zones."
    : score >= 50 ? "Grid adequate. Verify transformer capacity for 1 MW+ peak DC loads."
    : "Grid access uncertain for high-power charging. Engineering study required.";
  return { score, details: { "Grid":"US grid (EIA)", "US sales":eiaSales, "Year":eiaLive ? eiaYear : "EIA v2 unavailable — baseline used" }, notes, _live: eiaLive };
}

// ── NREL Community DER Support score ─────────────────────────────
export async function fetchNRELDERScore(lat, lon) {
  const apiKey = import.meta.env.VITE_NREL_API_KEY;
  if (!apiKey) throw new Error("VITE_NREL_API_KEY not set");

  const [utilitySettled, solarSettled] = await Promise.allSettled([
    fetch(`https://developer.nrel.gov/api/utility_rates/v3.json?api_key=${apiKey}&lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(12000) })
      .then(r => r.json()),
    fetch(`https://developer.nrel.gov/api/solar/solar_resource/v1.json?api_key=${apiKey}&lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(12000) })
      .then(r => r.json()),
  ]);

  const uOut        = utilitySettled.status === "fulfilled" ? utilitySettled.value?.outputs : null;
  const sOut        = solarSettled.status  === "fulfilled" ? solarSettled.value?.outputs  : null;
  const utilityLive = !!uOut;
  const solarLive   = !!sOut;

  const utilityName    = uOut?.utility_name  || "Unknown";
  const commercialRate = typeof uOut?.commercial === "number" ? uOut.commercial : null;
  const netMetering    = uOut?.net_metering  ?? null;
  const u = utilityName.toLowerCase();
  const isKnownUtil = u.length > 3 && !u.includes("unknown");

  const ghi = sOut?.avg_ghi?.annual || 0;
  const dni = sOut?.avg_dni?.annual || 0;

  const solarPts   = ghi >= 5.5 ? 30 : ghi >= 5.0 ? 22 : ghi >= 4.5 ? 15 : ghi >= 4.0 ? 8 : solarLive ? 4 : 12;
  const utilityPts = !utilityLive ? 20 : isKnownUtil ? 25 : 15;
  const ratePts    = commercialRate === null ? 12
    : commercialRate < 0.07 ? 25
    : commercialRate < 0.09 ? 18
    : commercialRate < 0.11 ? 12
    : commercialRate < 0.13 ? 6
    : 0;
  const nmPts = netMetering === true ? 15 : netMetering === false ? 5 : 8;

  const score = Math.min(100, Math.max(0, Math.round(solarPts + utilityPts + ratePts + nmPts)));

  const rateStr   = commercialRate !== null ? `$${commercialRate.toFixed(3)}/kWh commercial` : "Rate N/A";
  const nmStr     = netMetering === true ? "Net metering: yes" : netMetering === false ? "Net metering: no" : "Net metering: unknown";
  const ghiStr    = ghi   ? `${ghi.toFixed(2)} kWh/m²/day` : "N/A";
  const dniStr    = dni   ? `${dni.toFixed(2)} kWh/m²/day` : "N/A";
  const sourceTag = (!utilityLive && !solarLive) ? " (baseline — NREL unavailable)" : (!utilityLive || !solarLive) ? " (partial live data)" : "";

  const notes = score >= 75
    ? `High solar resource, strong utility DER programs. ${rateStr}. ${nmStr}.`
    : score >= 55
    ? `Solid DER environment. ${rateStr}. ${nmStr}. Verify interconnection queue with ${utilityName}.`
    : `Standard DER support${sourceTag}. Verify interconnection pathway with local utility. ${rateStr}.`;

  return {
    score,
    details: {
      "Utility":    utilityName,
      "Solar GHI":  ghiStr,
      "Solar DNI":  dniStr,
      "Comm. rate": rateStr,
      "Net meter":  nmStr,
    },
    notes,
    _live: { utilityLive, solarLive },
  };
}

// ── Harris County parcel score (HCAD ArcGIS public REST API) ──────
export async function fetchHarrisParcelScore(lat, lon) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lon, y: lat }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: "100",
    units: "esriSRUnit_Meter",
    outFields: "HCAD_NUM,land_sqft,acreage_1,state_class,land_use,site_str_num,site_str_name",
    returnGeometry: "false",
    outSR: "4326",
    f: "json",
  });
  const res = await fetch(
    `https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`HCAD API ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`HCAD: ${json.error.message || "API error"}`);
  if (!json.features?.length) throw new Error("Outside Harris County coverage — using estimate");

  const feature = json.features.reduce((best, f) =>
    (f.attributes.land_sqft ?? 0) > (best.attributes.land_sqft ?? 0) ? f : best
  );

  const attr = feature.attributes;
  const landSqFt = attr.land_sqft ?? 0;
  const acreage = attr.acreage_1 ?? (landSqFt / 43560);

  let score;
  if      (acreage >= 10)  score = 95;
  else if (acreage >= 5)   score = 85;
  else if (acreage >= 2)   score = 67;
  else if (acreage >= 1.5) score = 40;
  else if (acreage >= 0.5) score = 30;
  else                     score = 12;

  const classMap = {
    A: "Single family residential", B: "Multifamily residential",
    C: "Vacant land", D: "Farm/ranch", E: "Agricultural",
    F: "Commercial", G: "Mineral/oil", I: "Industrial",
    J: "Utilities", L: "Commercial retail", S: "Special purpose",
    X: "Exempt (government/institutional)",
  };
  const classCode = (attr.state_class || "").charAt(0).toUpperCase();
  const land_type = classMap[classCode] || (attr.state_class ? `Class ${attr.state_class}` : "Unknown");

  const flags = [];
  if (acreage < 1.5) flags.push("Below NREL 1.5-ac minimum");
  if (acreage >= 1.5 && acreage < 2) flags.push("Marginal — verify usable footprint");

  const ac = acreage >= 0.1 ? acreage.toFixed(2) : acreage.toFixed(3);
  const notes = acreage >= 5
    ? `${ac} ac (HCAD live) — exceeds NREL minimum for fixed infrastructure`
    : acreage >= 1.5
    ? `${ac} ac (HCAD live) — meets NREL 1.5-ac minimum, tight for phased expansion`
    : `${ac} ac (HCAD live) — below NREL 1.5-ac minimum for fixed vertiport`;

  return {
    score,
    acreage_estimate: parseFloat(ac),
    land_type,
    notes,
    flags,
    _source: "HCAD",
    _account: attr.HCAD_NUM || "",
    _address: [attr.site_str_num, attr.site_str_name].filter(Boolean).join(" "),
  };
}

// ── Shared parcel scoring helper ──────────────────────────────────
export function scoreParcelAcreage(acreage, source) {
  let score;
  if      (acreage >= 10)  score = 95;
  else if (acreage >= 5)   score = 85;
  else if (acreage >= 2)   score = 67;
  else if (acreage >= 1.5) score = 40;
  else if (acreage >= 0.5) score = 30;
  else                     score = 12;

  const flags = [];
  if (acreage < 1.5) flags.push("Below NREL 1.5-ac minimum");
  if (acreage >= 1.5 && acreage < 2) flags.push("Marginal — verify usable footprint");

  const ac = acreage >= 0.1 ? acreage.toFixed(2) : acreage.toFixed(3);
  const notes = acreage >= 5
    ? `${ac} ac (${source} live) — exceeds NREL minimum for fixed infrastructure`
    : acreage >= 1.5
    ? `${ac} ac (${source} live) — meets NREL 1.5-ac minimum, tight for phased expansion`
    : `${ac} ac (${source} live) — below NREL 1.5-ac minimum for fixed vertiport`;

  return { score, flags, notes, ac: parseFloat(ac) };
}

function arcgisParcelParams(lat, lon, fields) {
  return new URLSearchParams({
    geometry: JSON.stringify({ x: lon, y: lat }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: "100",
    units: "esriSRUnit_Meter",
    outFields: fields,
    returnGeometry: "false",
    outSR: "4326",
    f: "json",
  });
}

// ── Dallas County parcel score (DCAD ArcGIS) ──────────────────────
export async function fetchDallasParcelScore(lat, lon) {
  const params = arcgisParcelParams(lat, lon, "PARCELID,SITEADDRESS,CLASSCD,CLASSDSCRP,USECD,USEDSCRP,Shape_Area");
  const res = await fetch(
    `https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`DCAD API ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`DCAD: ${json.error.message || "API error"}`);
  if (!json.features?.length) throw new Error("Outside Dallas County coverage — using estimate");

  const attr = json.features[0].attributes;
  const shapeArea = attr.Shape_Area ?? 0;
  if (shapeArea <= 0) throw new Error("DCAD: no area data");

  // Shape_Area in TX State Plane North Central (FIPS 4202) is sq ft
  // Validate: reasonable parcel is 500 sqft–50M sqft (0.01–1150 ac)
  let acreage = shapeArea / 43560;
  if (acreage < 0.01 || acreage > 2000) throw new Error("DCAD: area out of range");

  const { score, flags, notes, ac } = scoreParcelAcreage(acreage, "DCAD");
  const land_type = attr.USEDSCRP || attr.CLASSDSCRP || (attr.CLASSCD ? `Class ${attr.CLASSCD}` : "Unknown");

  return {
    score, acreage_estimate: ac, land_type, notes, flags,
    _source: "DCAD", _account: attr.PARCELID || "", _address: attr.SITEADDRESS || "",
  };
}

// ── Tarrant County parcel score (TAD ArcGIS) ──────────────────────
export async function fetchTarrantParcelScore(lat, lon) {
  const params = arcgisParcelParams(lat, lon, "ACCOUNT,LAND_ACRES,LAND_SQFT,DESCR,SITUS_ADDR,STREET_NO,STREET_NAM");
  const res = await fetch(
    `https://mapit.tarrantcounty.com/arcgis/rest/services/Tax/TCProperty/MapServer/0/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`TAD API ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`TAD: ${json.error.message || "API error"}`);
  if (!json.features?.length) throw new Error("Outside Tarrant County coverage — using estimate");

  const attr = json.features[0].attributes;
  let acreage = attr.LAND_ACRES ?? (attr.LAND_SQFT > 0 ? attr.LAND_SQFT / 43560 : null);
  if (!acreage || acreage <= 0) throw new Error("TAD: no area data");

  const { score, flags, notes, ac } = scoreParcelAcreage(acreage, "TAD");
  const street = [attr.STREET_NO, attr.STREET_NAM].filter(Boolean).join(" ");
  const address = attr.SITUS_ADDR || street || "";

  return {
    score, acreage_estimate: ac, land_type: attr.DESCR || "Unknown", notes, flags,
    _source: "TAD", _account: attr.ACCOUNT || "", _address: address,
  };
}

// ── Travis County parcel score (TCAD ArcGIS) ──────────────────────
export async function fetchTravisParcelScore(lat, lon) {
  const params = arcgisParcelParams(lat, lon, "PROP_ID,tcad_acres,situs_num,situs_street,situs_address");
  const res = await fetch(
    `https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`TCAD API ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`TCAD: ${json.error.message || "API error"}`);
  if (!json.features?.length) throw new Error("Outside Travis County coverage — using estimate");

  const attr = json.features[0].attributes;
  const acreage = attr.tcad_acres ?? 0;
  if (acreage <= 0) throw new Error("TCAD: no area data");

  const { score, flags, notes, ac } = scoreParcelAcreage(acreage, "TCAD");
  const street = [attr.situs_num, attr.situs_street].filter(Boolean).join(" ");
  const address = attr.situs_address || street || "";

  return {
    score, acreage_estimate: ac, land_type: "Unknown", notes, flags,
    _source: "TCAD", _account: String(attr.PROP_ID || ""), _address: address,
  };
}

// ── Bexar County parcel score (BCAD ArcGIS) ───────────────────────
export async function fetchBexarParcelScore(lat, lon) {
  const params = arcgisParcelParams(lat, lon, "PropID,Acres,LglAcres,State_cd,PropUse,Situs,AddrLn1");
  const res = await fetch(
    `https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`BCAD API ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`BCAD: ${json.error.message || "API error"}`);
  if (!json.features?.length) throw new Error("Outside Bexar County coverage — using estimate");

  const attr = json.features[0].attributes;
  const acreage = attr.Acres ?? attr.LglAcres ?? 0;
  if (acreage <= 0) throw new Error("BCAD: no area data");

  const { score, flags, notes, ac } = scoreParcelAcreage(acreage, "BCAD");

  const classMap = {
    A: "Single family residential", B: "Multifamily residential",
    C: "Vacant land", D: "Farm/ranch", E: "Agricultural",
    F: "Commercial", G: "Mineral/oil", I: "Industrial",
    J: "Utilities", L: "Commercial retail", S: "Special purpose",
    X: "Exempt (government/institutional)",
  };
  const classCode = (attr.State_cd || "").charAt(0).toUpperCase();
  const land_type = classMap[classCode] || attr.PropUse || (attr.State_cd ? `Class ${attr.State_cd}` : "Unknown");

  return {
    score, acreage_estimate: ac, land_type, notes, flags,
    _source: "BCAD", _account: String(attr.PropID || ""), _address: attr.Situs || attr.AddrLn1 || "",
  };
}

// ── Texas parcel score — tries all 5 counties in parallel ─────────
export async function fetchTexasParcelScore(lat, lon) {
  return Promise.any([
    fetchHarrisParcelScore(lat, lon),
    fetchDallasParcelScore(lat, lon),
    fetchTarrantParcelScore(lat, lon),
    fetchTravisParcelScore(lat, lon),
    fetchBexarParcelScore(lat, lon),
  ]);
}

// ── Regrid parcel score (BYOK — nationwide coverage) ──────────────
export async function fetchRegridParcelScore(lat, lon, regridKey) {
  const url = `https://app.regrid.com/api/v2/point?lat=${lat}&lon=${lon}&radius=0&limit=1&token=${encodeURIComponent(regridKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Regrid API ${res.status}`);
  const json = await res.json();

  const features = json?.parcels?.features;
  if (!features?.length) throw new Error("Regrid: no parcel at this location");

  const fields = features[0]?.properties?.fields;
  if (!fields) throw new Error("Regrid: no fields in response");

  const acreage = parseFloat(fields.ll_gisacre);
  if (!acreage || acreage <= 0 || acreage > 50000) throw new Error("Regrid: invalid acreage");

  const usedesc = (fields.usedesc || "").toLowerCase();
  let land_type = "unknown";
  if (/industrial|warehouse|storage|manufactur/.test(usedesc)) land_type = "industrial";
  else if (/commercial|retail|office|hotel/.test(usedesc)) land_type = "commercial";
  else if (/vacant|undeveloped|agricultural|farm|ranch/.test(usedesc)) land_type = "vacant";
  else if (/residential/.test(usedesc)) land_type = "residential";

  const { score, flags, notes, ac } = scoreParcelAcreage(acreage, "Regrid");
  return {
    score,
    acreage_estimate: ac,
    land_type,
    notes,
    flags,
    _source: "Regrid",
    _account: fields.parcelnumb || "",
    _address: fields.address || "",
  };
}

// ── FEMA NFHL + USGS 3DEP flood & elevation score ─────────────────
export async function fetchFEMAFloodScore(lat, lon) {
  const [femaSettled, usgsSettled] = await Promise.allSettled([
    (async () => {
      const p = new URLSearchParams({
        geometry: JSON.stringify({ x: lon, y: lat }),
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
        returnGeometry: "false",
        f: "json",
      });
      const r = await fetch(
        `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${p}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!r.ok) throw new Error(`FEMA API ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(`FEMA: ${j.error.message}`);
      return j.features?.[0]?.attributes || null;
    })(),
    (async () => {
      const r = await fetch(
        `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&wkid=4326&units=Feet&includeDate=false`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (!r.ok) throw new Error(`USGS ${r.status}`);
      const j = await r.json();
      const val = parseFloat(j.value);
      return isFinite(val) ? val : null;
    })(),
  ]);

  const fema  = femaSettled.status === "fulfilled" ? femaSettled.value : null;
  const elevFt = usgsSettled.status === "fulfilled" ? usgsSettled.value : null;

  const fldZone = fema?.FLD_ZONE || "";
  const subtype = (fema?.ZONE_SUBTY || "").toUpperCase();

  let score, zoneLabel;
  const flags = [];

  if (!fema) {
    score = 65;
    zoneLabel = "Unknown (FEMA unavailable)";
  } else if (fldZone === "X") {
    if (subtype.includes("0.2") || subtype.includes("500")) {
      score = 72; zoneLabel = "Zone X (500-yr flood hazard)";
    } else if (subtype.includes("LEVEE")) {
      score = 60; zoneLabel = "Zone X (behind levee)";
      flags.push("Levee-protected — verify accreditation status");
    } else {
      score = 90; zoneLabel = "Zone X (minimal flood hazard)";
    }
  } else if (fldZone === "AE") {
    score = 25; zoneLabel = "Zone AE (100-yr SFHA)";
    flags.push("SFHA — flood insurance required, fill permit needed");
    flags.push("LOMA or LOMR likely required before development");
  } else if (fldZone === "A") {
    score = 22; zoneLabel = "Zone A (100-yr, no BFE)";
    flags.push("SFHA — flood insurance required");
  } else if (fldZone === "VE" || fldZone === "V") {
    score = 15; zoneLabel = `Zone ${fldZone} (coastal high hazard)`;
    flags.push("Coastal SFHA — VE zone restrictions apply, wave action risk");
  } else if (fldZone === "AO" || fldZone === "AH") {
    score = 20; zoneLabel = `Zone ${fldZone} (shallow flooding)`;
    flags.push("SFHA — shallow flooding, drainage engineering critical");
  } else if (fldZone === "D") {
    score = 55; zoneLabel = "Zone D (flood risk undetermined)";
    flags.push("Zone D — FEMA study not available, commission survey");
  } else {
    score = 65; zoneLabel = fldZone ? `Zone ${fldZone}` : "Zone X (estimated)";
  }

  const elevStr   = elevFt !== null ? `${Math.round(elevFt)} ft` : null;
  const sourceTag = fema ? "(FEMA NFHL live)" : "(FEMA unavailable — estimate)";

  const notes = score >= 80
    ? `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Low flood risk.`
    : score >= 55
    ? `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Verify site drainage.`
    : `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Fill permit and LOMA likely required.`;

  return {
    score,
    flood_zone: zoneLabel,
    slope_estimate: "< 2% (estimated)",
    elevation_ft: elevFt !== null ? Math.round(elevFt) : null,
    notes,
    flags,
    _source: { fema: !!fema, usgs: elevFt !== null },
  };
}

// ── OSM/Overpass zoning score ─────────────────────────────────────
export async function fetchZoningScore(lat, lon) {
  const overpassFetch = (q) => fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(q),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(20000),
  }).then(r => { if (!r.ok) throw new Error(`Overpass ${r.status}`); return r.json(); });

  const isInQuery = `[out:json][timeout:15];
is_in(${lat},${lon})->.a;
(way(pivot.a)["landuse"];relation(pivot.a)["landuse"];way(pivot.a)["aeroway"];relation(pivot.a)["aeroway"];);
out tags;`;

  const aroundQuery = `[out:json][timeout:15];
(
  way["landuse"](around:100,${lat},${lon});
  relation["landuse"](around:100,${lat},${lon});
  way["aeroway"](around:200,${lat},${lon});
  relation["aeroway"](around:200,${lat},${lon});
  way["building"](around:60,${lat},${lon});
);
out tags;`;

  const [isInSettled, aroundSettled] = await Promise.allSettled([
    overpassFetch(isInQuery),
    overpassFetch(aroundQuery),
  ]);

  const isInElements   = isInSettled.status  === "fulfilled" ? (isInSettled.value.elements  || []) : [];
  const aroundElements = aroundSettled.status === "fulfilled" ? (aroundSettled.value.elements || []) : [];

  const hasLanduse = (els) => els.some(e => e.tags?.landuse);
  const hasAeroway = (els) => els.some(e => e.tags?.aeroway);
  const elements = hasLanduse(isInElements) || hasAeroway(isInElements)
    ? isInElements
    : aroundElements;

  const AEROWAY_MAP = {
    aerodrome:     { score: 92, label: "Airport / aerodrome" },
    terminal:      { score: 88, label: "Airport terminal" },
    hangar:        { score: 85, label: "Aviation hangar" },
    apron:         { score: 88, label: "Airport apron" },
    helipad:       { score: 80, label: "Helipad" },
    heliport:      { score: 82, label: "Heliport" },
    taxiway:       { score: 80, label: "Airport taxiway area" },
    runway:        { score: 75, label: "Runway area" },
    gate:          { score: 85, label: "Airport gate area" },
    parking_apron: { score: 85, label: "Parking apron" },
  };

  const LANDUSE_MAP = {
    industrial:        { score: 90, label: "Industrial" },
    logistics:         { score: 88, label: "Logistics" },
    port:              { score: 85, label: "Port/logistics" },
    depot:             { score: 68, label: "Transport depot" },
    railway:           { score: 60, label: "Railway/transport corridor" },
    commercial:        { score: 55, label: "Commercial" },
    office:            { score: 58, label: "Office" },
    retail:            { score: 45, label: "Retail" },
    recreation_ground: { score: 62, label: "Recreation ground" },
    grass:             { score: 58, label: "Open grassland" },
    meadow:            { score: 58, label: "Meadow/open land" },
    greenfield:        { score: 62, label: "Undeveloped land" },
    farmland:          { score: 50, label: "Farmland" },
    farm:              { score: 50, label: "Farm" },
    farmyard:          { score: 48, label: "Farmyard" },
    quarry:            { score: 55, label: "Quarry/extraction" },
    forest:            { score: 40, label: "Forest" },
    allotments:        { score: 28, label: "Allotments" },
    military:          { score: 30, label: "Military" },
    cemetery:          { score: 20, label: "Cemetery" },
    residential:       { score: 15, label: "Residential" },
  };

  const BUILDING_MAP = {
    warehouse:   { score: 88, label: "Warehouse" },
    industrial:  { score: 85, label: "Industrial building" },
    stadium:     { score: 65, label: "Stadium/arena" },
    sports_hall: { score: 60, label: "Sports facility" },
    office:      { score: 60, label: "Office building" },
    commercial:  { score: 55, label: "Commercial building" },
    hospital:    { score: 55, label: "Hospital/medical" },
    civic:       { score: 50, label: "Civic building" },
    yes:         { score: 50, label: "Building (unclassified)" },
    retail:      { score: 45, label: "Retail building" },
    church:      { score: 25, label: "Religious building" },
    residential: { score: 15, label: "Residential" },
    apartments:  { score: 15, label: "Residential apartments" },
    house:       { score: 12, label: "House" },
    detached:    { score: 12, label: "Detached house" },
  };

  function dominant(tags) {
    const freq = {};
    for (const t of tags) freq[t] = (freq[t] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  const landuseTags  = elements.filter(e => e.tags?.landuse).map(e => e.tags.landuse);
  const aerowayTags  = elements.filter(e => e.tags?.aeroway && !e.tags?.landuse).map(e => e.tags.aeroway);
  const buildingTags = elements.filter(e => e.tags?.building && !e.tags?.landuse && !e.tags?.aeroway).map(e => e.tags.building);

  let rawType, sourceMap, tagSource;
  if (landuseTags.length) {
    rawType = dominant(landuseTags); sourceMap = LANDUSE_MAP; tagSource = "landuse";
  } else if (aerowayTags.length) {
    rawType = dominant(aerowayTags); sourceMap = AEROWAY_MAP; tagSource = "aeroway";
  } else if (buildingTags.length) {
    rawType = dominant(buildingTags); sourceMap = BUILDING_MAP; tagSource = "building";
  } else {
    throw new Error("No OSM land use data at this location — using estimate");
  }

  const { score, label: land_use } = sourceMap[rawType] || { score: 50, label: rawType };
  const compliance = score >= 75 ? "Favorable" : score >= 50 ? "Permitted with conditions" : score >= 30 ? "Marginal" : "Adverse";
  const flags = [];
  if (score < 30) flags.push("Adverse zoning — rezoning or variance required");
  else if (score < 50) flags.push("Marginal zoning — conditional use permit likely required");

  const src = `(OSM ${tagSource})`;
  const notes = score >= 75
    ? `${land_use} ${src} — favorable land use for vertiport development.`
    : score >= 50
    ? `${land_use} ${src} — conditional use permit or variance likely required.`
    : `${land_use} ${src} — rezoning required. Significant entitlement risk.`;

  return { score, compliance, land_use, notes, flags, _source: "OSM/Overpass", _raw: rawType };
}

// ── FAA Airspace scoring (static US_AIRSPACE data + Haversine) ────
export function scoreAirspace(lat, lon) {
  function distNM(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let tightest = null;
  let nearest  = null;
  let nearestDist = Infinity;

  for (const ap of US_AIRSPACE) {
    const dist = distNM(lat, lon, ap.lat, ap.lon);
    if (dist < nearestDist) { nearestDist = dist; nearest = ap; }

    for (const tier of ap.tiers) {
      const effectiveRadius = (ap.class === "B" && tier.floor === "SFC") ? 4 : tier.radius_nm;
      if (dist <= effectiveRadius) {
        const isSFC = tier.floor === "SFC";
        let tierScore;
        if      (ap.class === "B" && isSFC)              tierScore = 15;
        else if (ap.class === "B" && tier.floor <= 2000) tierScore = 45;
        else if (ap.class === "B")                       tierScore = 60;
        else if (ap.class === "C" && isSFC)              tierScore = 42;
        else if (ap.class === "C")                       tierScore = 65;
        else                                             tierScore = 65; // Class D
        if (!tightest || tierScore < tightest.score) {
          tightest = { ap, tier, dist, score: tierScore };
        }
        break;
      }
    }
  }

  let score, status, laanc_required;
  const flags = [];

  if (tightest) {
    const { ap, tier, dist } = tightest;
    const isSFC = tier.floor === "SFC";
    score = tightest.score;
    laanc_required = true;

    if (ap.class === "B" && isSFC) {
      status = "Class B (SFC floor)";
      flags.push("Class B clearance required — coordinate with TRACON prior to ops");
    } else if (ap.class === "B") {
      status = `Class B (floor ${tier.floor.toLocaleString()}ft MSL)`;
      flags.push(`Class B authorization required above ${tier.floor.toLocaleString()}ft`);
    } else if (ap.class === "C" && isSFC) {
      status = "Class C (SFC floor)";
      flags.push("Class C — two-way ATC radio contact required for all ops");
    } else if (ap.class === "C") {
      status = "Class C (outer ring)";
    } else {
      status = "Class D";
      flags.push("Class D — establish two-way radio contact before entering");
    }

    const distStr = `${dist.toFixed(1)} nm`;
    return { score, status, laanc_required,
      nearest_airport: `${ap.name} · ${distStr}`, flags,
      notes: score >= 60
        ? `${status} — coordination required but ops feasible. ${ap.name} ${distStr}.`
        : `${status} — constrained airspace. Significant FAA coordination required. ${ap.name} ${distStr}.`,
    };
  }

  score = nearestDist < 5 ? 72 : nearestDist < 10 ? 78 : nearestDist < 20 ? 83 : nearestDist < 40 ? 90 : 95;
  laanc_required = nearestDist < 5;
  status = "Class G (uncontrolled)";
  const nearStr = nearest ? `${nearest.name} · ${nearestDist.toFixed(1)} nm` : "No controlled airport within range";
  return { score, status, laanc_required,
    nearest_airport: nearStr, flags,
    notes: score >= 88
      ? `${status} — highly favorable for eVTOL operations. Nearest airport: ${nearStr}.`
      : `${status} — good airspace environment. LAANC self-authorization available. Nearest: ${nearStr}.`,
  };
}

