import { useState } from "react";
import { jsPDF } from "jspdf";
import { findNearestHeliport } from './heliportLookup.js';

const C = {
  bg: "#070a0f", surface: "#0d1520", card: "#111a26", border: "#1e2d3d",
  amber: "#f0a030", amberDim: "#c07820", amberGlow: "rgba(240,160,48,0.12)",
  green: "#28c87a", yellow: "#f0c030", red: "#f04858", teal: "#20c0b0",
  text: "#8aaec8", textBright: "#d8eaf8", textDim: "#4a6278", textLabel: "#6a8fa8",
  pending: "#3a5068",
};

const scoreColor = (s) => {
  if (s === null || s === undefined) return C.pending;
  if (s >= 75) return C.green;
  if (s >= 45) return C.yellow;
  return C.red;
};

const priorityIndex = (site, demand) => Math.round(site * 0.60 + demand * 0.40);

function getQuadrant(site, demand) {
  const hs = site >= 55, hd = demand >= 55;
  if (hs && hd)  return { label:"PRIME SITE",          color:C.green,  desc:"Strong infrastructure and high demand. Priority development candidate." };
  if (hs && !hd) return { label:"INFRASTRUCTURE PLAY", color:C.teal,   desc:"Good site fundamentals, limited demand. Suited for cargo-first or logistics." };
  if (!hs && hd) return { label:"DEMAND WITHOUT SITE", color:C.yellow, desc:"Strong destination appeal but site constraints limit operations. Find a nearby parcel." };
  return                 { label:"LOW PRIORITY",        color:C.red,    desc:"Neither site fundamentals nor demand justify development at this time." };
}

// ── PDF Generation ─────────────────────────────────────────
function generatePDF(results) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  const col = margin, colR = W - margin;
  let y = 0;

  // Color helpers
  const hex = (h) => {
    const r = parseInt(h.slice(1,3),16)/255;
    const g = parseInt(h.slice(3,5),16)/255;
    const b = parseInt(h.slice(5,7),16)/255;
    return [r*255|0, g*255|0, b*255|0];
  };
  const setFill = (h) => doc.setFillColor(...hex(h));
  const setDraw = (h) => doc.setDrawColor(...hex(h));
  const setTxt  = (h) => doc.setTextColor(...hex(h));

  const siteScore = results.site?.composite || 0;
  const demandScore = results.demand?.composite || 0;
  const pi = priorityIndex(siteScore, demandScore);
  const q = getQuadrant(siteScore, demandScore);

  // ── Header band ──
  setFill("#0a1220");
  doc.rect(0, 0, W, 38, "F");
  setFill("#f0a030");
  doc.rect(0, 0, 4, 38, "F");

  setTxt("#f0a030");
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("VERTIPORT", col + 6, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica","normal");
  setTxt("#c07820");
  doc.text("SITE EVALUATION SYSTEM  ·  FAA/NREL CALIBRATED  ·  HOUSTON METRO BETA", col + 6, 20);

  setTxt("#6a8fa8");
  doc.setFontSize(7.5);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}`, col + 6, 27);
  doc.text("Phase 1 — Texas  ·  Two-Axis Scoring Model", col + 6, 32);

  // ── Site name ──
  y = 46;
  setTxt("#d8eaf8");
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text(results.geocode.matched || "Site Analysis", col, y);
  y += 5;
  setTxt("#6a8fa8");
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.text(`${results.geocode.lat?.toFixed(5)}°N  ·  ${Math.abs(results.geocode.lon)?.toFixed(5)}°W`, col, y);

  // ── Three score boxes ──
  y += 8;
  const boxW = (W - margin*2 - 8) / 3;
  const scores = [
    { label:"SITE SCORE", sub:"infrastructure viability", val:siteScore },
    { label:"DEMAND SCORE", sub:"passenger + cargo draw", val:demandScore },
    { label:"PRIORITY INDEX", sub:"cargo-weighted (60/40)", val:pi },
  ];

  scores.forEach((s, i) => {
    const bx = col + i * (boxW + 4);
    const col_ = s.val >= 75 ? "#28c87a" : s.val >= 45 ? "#f0c030" : "#f04858";
    setFill("#0d1520"); setDraw("#1e2d3d");
    doc.roundedRect(bx, y, boxW, 28, 2, 2, "FD");
    setFill(col_);
    doc.rect(bx, y, 2.5, 28, "F");
    setTxt("#6a8fa8");
    doc.setFont("helvetica","bold");
    doc.setFontSize(6.5);
    doc.text(s.label, bx + 6, y + 7);
    setTxt(col_);
    doc.setFontSize(22);
    doc.setFont("helvetica","bold");
    doc.text(String(s.val), bx + 6, y + 20);
    setTxt("#4a6278");
    doc.setFontSize(6);
    doc.setFont("helvetica","normal");
    doc.text(s.sub, bx + 6, y + 26);
  });

  // ── Quadrant badge ──
  y += 34;
  const qCol = q.color;
  setFill(qCol + "22"); setDraw(qCol + "66");
  doc.roundedRect(col, y, W - margin*2, 14, 2, 2, "FD");
  setTxt(qCol);
  doc.setFont("helvetica","bold");
  doc.setFontSize(8);
  doc.text(q.label, col + 4, y + 6);
  setTxt("#8aaec8");
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.text(q.desc, col + 4, y + 11);

  // ── Development thesis ──
  if (results.development_thesis) {
    y += 19;
    setTxt("#f0a030");
    doc.setFont("helvetica","bold");
    doc.setFontSize(7.5);
    doc.text("▶  " + results.development_thesis, col, y, { maxWidth: W - margin*2 });
  }

  // ── Summary ──
  if (results.summary) {
    y += 9;
    setFill("#0d1520");
    const sumLines = doc.splitTextToSize(results.summary, W - margin*2 - 8);
    const sumH = sumLines.length * 4.5 + 8;
    doc.rect(col, y, W - margin*2, sumH, "F");
    setDraw("#1e2d3d");
    doc.line(col, y, col, y + sumH);
    doc.line(col + 3, y, col + 3, y + sumH);
    setTxt("#8aaec8");
    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.text(sumLines, col + 7, y + 6);
    y += sumH + 4;
  }

  // ── Section header helper ──
  const sectionHeader = (title, yp) => {
    setFill("#0d1520");
    doc.rect(col, yp, W - margin*2, 8, "F");
    setFill("#f0a030");
    doc.rect(col, yp, 2, 8, "F");
    setTxt("#c07820");
    doc.setFont("helvetica","bold");
    doc.setFontSize(7);
    doc.text(title, col + 5, yp + 5.5);
    return yp + 11;
  };

  // ── Site criteria ──
  y = sectionHeader("SITE SCORE — INFRASTRUCTURE CRITERIA", y);

  const siteCriteria = [
    { label:"Parcel Size & Contours", wt:"25%", score:results.site?.parcel?.score, notes:results.site?.parcel?.notes, detail:`${results.site?.parcel?.acreage_estimate ? `~${results.site.parcel.acreage_estimate} ac · ` : ""}${results.site?.parcel?.land_type||""}` },
    { label:"FAA Airspace",           wt:"25%", score:results.site?.airspace?.score, notes:results.site?.airspace?.notes, detail:`${results.site?.airspace?.status||""} · ${results.site?.airspace?.nearest_airport||""}` },
    { label:"Power Grid & DER",       wt:"20%", score:results.eia?.score??null, notes:results.eia?.notes||"EIA API key not set", detail:results.eia ? `${results.eia.details?.["Grid"]||""} · ${results.eia.details?.["TX sales"]||""}` : "Pending activation" },
    { label:"Zoning Compliance",      wt:"15%", score:results.site?.zoning?.score, notes:results.site?.zoning?.notes, detail:`${results.site?.zoning?.compliance||""} · ${results.site?.zoning?.land_use||""}` },
    { label:"Soil Stability & Flood", wt:"10%", score:results.site?.soil?.score, notes:results.site?.soil?.notes, detail:`${results.site?.soil?.flood_zone||""} · ${results.site?.soil?.slope_estimate||""}` },
    { label:"Community DER Support",  wt:"5%",  score:results.nrel?.score??null, notes:results.nrel?.notes||"NREL API key not set", detail:results.nrel ? `${results.nrel.details?.["Utility"]||""} · ${results.nrel.details?.["Solar GHI"]||""}` : "Pending activation" },
  ];

  siteCriteria.forEach((cr) => {
    const rowH = 13;
    const sc = cr.score;
    const cCol = sc === null ? "#3a5068" : sc >= 75 ? "#28c87a" : sc >= 45 ? "#f0c030" : "#f04858";
    setFill("#111a26"); setDraw("#1e2d3d");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#6a8fa8");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 5);
    setTxt("#4a6278");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`WT ${cr.wt}`, col + 5, y + 10);
    // score
    setTxt(cCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text(sc !== null ? String(sc) : "–", col + 60, y + 9);
    // bar
    const barX = col + 72, barW = 60, barH = 3;
    setFill("#1e2d3d");
    doc.rect(barX, y + 5, barW, barH, "F");
    if (sc !== null) {
      setFill(cCol);
      doc.rect(barX, y + 5, barW * sc / 100, barH, "F");
    }
    // detail
    setTxt("#8aaec8");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    const detLines = doc.splitTextToSize(cr.detail || "", W - margin*2 - 140);
    doc.text(detLines, col + 136, y + 5);
    if (cr.notes) {
      setTxt("#4a6278");
      doc.setFontSize(6);
      const noteLines = doc.splitTextToSize(cr.notes, W - margin*2 - 140);
      doc.text(noteLines, col + 136, y + 9);
    }
    y += rowH + 2;
  });

  // ── Demand criteria ──
  y += 3;
  y = sectionHeader("DEMAND SCORE — WHY FLY HERE?", y);

  const demandCriteria = [
    { label:"Employment Density",      wt:"30%", score:results.demand?.employment?.score,   notes:results.demand?.employment?.notes },
    { label:"Destinations & Attractions", wt:"25%", score:results.demand?.destinations?.score, notes:results.demand?.destinations?.notes },
    { label:"Medical & Institutional", wt:"20%", score:results.demand?.medical?.score,      notes:results.demand?.medical?.notes },
    { label:"Cargo & Logistics",       wt:"15%", score:results.demand?.cargo?.score,        notes:results.demand?.cargo?.notes },
    { label:"Transit Gap",             wt:"10%", score:results.demand?.transit_gap?.score,  notes:results.demand?.transit_gap?.notes },
  ];

  demandCriteria.forEach((cr) => {
    const rowH = 13;
    const sc = cr.score || 0;
    const cCol = sc >= 75 ? "#28c87a" : sc >= 45 ? "#f0c030" : "#f04858";
    setFill("#111a26"); setDraw("#1e2d3d");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#6a8fa8");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 5);
    setTxt("#4a6278");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`WT ${cr.wt}`, col + 5, y + 10);
    setTxt(cCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text(String(sc), col + 60, y + 9);
    const barX = col + 72, barW = 60, barH = 3;
    setFill("#1e2d3d");
    doc.rect(barX, y + 5, barW, barH, "F");
    setFill(cCol);
    doc.rect(barX, y + 5, barW * sc / 100, barH, "F");
    if (cr.notes) {
      setTxt("#8aaec8");
      doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
      const noteLines = doc.splitTextToSize(cr.notes, W - margin*2 - 140);
      doc.text(noteLines, col + 136, y + 5);
    }
    y += rowH + 2;
  });

  // ── Flags ──
  const flags = results.flags || [];
  if (flags.length > 0) {
    y += 3;
    y = sectionHeader("FLAGS — ITEMS REQUIRING INVESTIGATION", y);
    flags.forEach((flag) => {
      const lines = doc.splitTextToSize("⚑  " + flag, W - margin*2 - 6);
      const fH = lines.length * 4.5 + 5;
      setFill("#1a1200"); setDraw("#3a3000");
      doc.rect(col, y, W - margin*2, fH, "FD");
      setTxt("#f0c030");
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.text(lines, col + 3, y + 4.5);
      y += fH + 1.5;
    });
  }

  // ── Strengths / Concerns ──
  const strengths = results.top_strengths || [];
  const concerns = (results.top_concerns || []).filter(Boolean);
  if (strengths.length || concerns.length) {
    y += 3;
    setFill("#0d1520");
    doc.rect(col, y, W - margin*2, (strengths.length + concerns.length) * 6 + 8, "F");
    strengths.forEach((s) => {
      setTxt("#28c87a"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
      doc.text("✓  " + s, col + 4, y + 7);
      y += 6;
    });
    concerns.forEach((s) => {
      setTxt("#f0c030"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
      doc.text("⚑  " + s, col + 4, y + 7);
      y += 6;
    });
    y += 6;
  }

  // ── Footer ──
  const pageH = doc.internal.pageSize.height;
  setFill("#0a1220");
  doc.rect(0, pageH - 16, W, 16, "F");
  setTxt("#4a6278");
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  doc.text("Data sources: FAA · NREL · FEMA NFHL · USGS 3DEP · EIA · OpenStreetMap · Census Bureau", col, pageH - 9);
  doc.text("Scores are estimates based on publicly available data. All site assessments require independent verification before investment decisions.", col, pageH - 5);
  setTxt("#c07820");
  doc.text("VERTIPORT EVALUATION SYSTEM  ·  BETA", colR, pageH - 7, { align:"right" });

  // ── Save ──
  const filename = `vertiport-report-${(results.geocode.matched||"site").split(",")[0].replace(/\s+/g,"-").toLowerCase()}.pdf`;
  doc.save(filename);
}

// ── Prompt builder ────────────────────────────────────────────
function buildPrompt(input, mode) {
  const locationDesc = mode === "coords"
    ? `GPS Coordinates: ${input.lat}, ${input.lon} (Houston Texas)${input.label ? ` — Site: ${input.label}` : ""}`
    : `Address: "${input.address}"`;
  const coordNote = mode === "coords"
    ? `IMPORTANT: Evaluate what is actually at these coordinates. For parks or open land score parcel based on actual site area not adjacent residential lot.` : ``;

  return `You are a vertiport site feasibility scoring engine. Score two axes: SITE (can infrastructure be built here?) and DEMAND (why would people/cargo fly here?).

Location: ${locationDesc}
${coordNote}

SITE CRITERIA:
PARCEL (25%): >10ac=90-100, 5-10=80-90, 2-5=60-75, 0.5-2=25-45, <0.5=5-20. Flag <1.5ac.
AIRSPACE (25%): Rural no airport=90-100. Humble/Will Clayton Class G IAH 18km=72-82. Suburban GA 10-20km=70-85. Heliport nearby=50-65. SW Houston near HOU 5-6km=32-42. Galleria Class B=18-28. IAH Class B=10-22.
ZONING (15%): Industrial/logistics=88-100. Business park=65-80. Public park/greenspace=55-70. Mixed commercial=45-62. Galleria/luxury retail=22-35. Residential=8-22.
SOIL (10%): Zone X=85-98. Stormwater detention=35-50. Zone AE=18-35. Humble Zone X=82-92.
SITE_COMPOSITE = parcel*0.25 + airspace*0.25 + zoning*0.15 + soil*0.10. Max=75.

DEMAND CRITERIA:
EMPLOYMENT (30%): CBD/Energy Corridor/major hub=80-100. Business park=55-75. Mixed=30-50. Residential/park=5-25.
DESTINATIONS (25%): Stadium/arena/convention=85-100. Outdoor venue/major park/museum=55-75. Willow Waterhole with music venue=58-70. Industrial=5-20.
MEDICAL (20%): Texas Medical Center=90-100. Regional hospital=60-80. Clinic=25-45. None=5-20.
CARGO (15%): Port/major hub=85-100. Industrial corridor=60-80. Humble/Will Clayton logistics=75-90. Residential/park=5-20.
TRANSIT_GAP (10%): Remote/car-dependent=70-90. Suburban limited transit=50-70. Near Metro rail=10-30.
DEMAND_COMPOSITE = employment*0.30 + destinations*0.25 + medical*0.20 + cargo*0.15 + transit_gap*0.10.

BENCHMARKS: Will Clayton: site 68-82, demand 45-60. Galleria: site 28-42, demand 62-78. TMC: site 35-55, demand 85-95. Residential: site 15-28, demand 15-30.

Return ONLY valid JSON, keep ALL string values under 80 chars:
{"geocode":{"matched":"location name","lat":29.76,"lon":-95.37,"valid":true},"site":{"composite":0,"parcel":{"score":0,"acreage_estimate":0.0,"land_type":"type","notes":"short note","flags":["flag"]},"airspace":{"score":0,"status":"class","laanc_required":false,"nearest_airport":"name dist","notes":"short note","flags":[]},"zoning":{"score":0,"compliance":"Good","land_use":"type","notes":"short note","flags":[]},"soil":{"score":0,"flood_zone":"Zone X","slope_estimate":"<1%","elevation_ft":50,"notes":"short note","flags":[]}},"demand":{"composite":0,"employment":{"score":0,"notes":"short note"},"destinations":{"score":0,"notes":"short note"},"medical":{"score":0,"notes":"short note"},"cargo":{"score":0,"notes":"short note"},"transit_gap":{"score":0,"notes":"short note"}},"summary":"2 sentences max","development_thesis":"one sentence best use case","top_strengths":["strength 1","strength 2"],"top_concerns":["concern 1"]}

If outside Texas set geocode.valid=false and all scores to 0.`;
}

async function analyzeWithClaude(input, mode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY not set in .env");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:2000, messages:[{role:"user",content:buildPrompt(input,mode)}] }),
    });
    clearTimeout(timeout);
    if (!response.ok) { const t=await response.text(); throw new Error(`API ${response.status}: ${t.slice(0,120)}`); }
    const data = await response.json();
    if (data.error) throw new Error(data.error.message||"API error");
    const text = data.content?.find(b=>b.type==="text")?.text||"";
    if (!text) throw new Error("Empty response");
    const match = text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch {
      let fixed = match[0];
      const opens = (fixed.match(/\{/g)||[]).length - (fixed.match(/\}/g)||[]).length;
      const openArr = (fixed.match(/\[/g)||[]).length - (fixed.match(/\]/g)||[]).length;
      fixed = fixed.replace(/,\s*$/,"");
      for (let i=0;i<openArr;i++) fixed+="]";
      for (let i=0;i<opens;i++) fixed+="}";
      parsed = JSON.parse(fixed);
    }
    return parsed;
  } catch(err) {
    clearTimeout(timeout);
    if (err.name==="AbortError") throw new Error("Request timed out. Try again.");
    throw err;
  }
}

// ── EIA Power Grid & DER score (EIA API v2) ───────────────────
async function fetchEIAPowerScore(lat, lon, zoningScore) {
  const apiKey = import.meta.env.VITE_EIA_API_KEY;
  if (!apiKey) throw new Error("VITE_EIA_API_KEY not set");
  const zoningBonus = zoningScore >= 75 ? 12 : zoningScore >= 50 ? 7 : zoningScore >= 30 ? 3 : -8;
  let eiaYear = "N/A", eiaSales = "N/A", eiaLive = false;
  try {
    const p = new URLSearchParams();
    p.append("api_key", apiKey);
    p.append("frequency", "annual");
    p.append("data[]", "sales");
    p.append("facets[stateid][]", "TX");
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
  const notes = score >= 75 ? "ERCOT grid + strong load base. Three-phase access likely near commercial zones."
    : score >= 50 ? "ERCOT grid adequate. Verify transformer capacity for 1 MW+ peak DC loads."
    : "Grid access uncertain for high-power charging. Engineering study required.";
  return { score, details: { "Grid":"ERCOT (TX deregulated)", "TX sales":eiaSales, "Year":eiaLive ? eiaYear : "EIA v2 unavailable — baseline used" }, notes };
}

// ── NREL Community DER Support score ─────────────────────────
async function fetchNRELDERScore(lat, lon) {
  const apiKey = import.meta.env.VITE_NREL_API_KEY;
  if (!apiKey) throw new Error("VITE_NREL_API_KEY not set");
  const [utilityRes, solarRes] = await Promise.all([
    fetch(`https://developer.nrel.gov/api/utility_rates/v3.json?api_key=${apiKey}&lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://developer.nrel.gov/api/solar/solar_resource/v1.json?api_key=${apiKey}&lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(10000) }),
  ]);
  const utilityData = await utilityRes.json();
  const solarData   = await solarRes.json();
  const utilityName = utilityData.outputs?.utility_name || "Unknown";
  const ghi         = solarData.outputs?.avg_ghi?.annual || 0;
  let score = 42 + 15; // TX deregulated baseline
  if (ghi >= 5.5) score += 18; else if (ghi >= 5.0) score += 12; else if (ghi >= 4.5) score += 6;
  const u = utilityName.toLowerCase();
  if (u.includes("centerpoint")||u.includes("oncor")||u.includes("tnmp")||u.includes("aep")) score += 10;
  score = Math.min(100, Math.max(0, Math.round(score)));
  const notes = score >= 70 ? "High solar resource and established utility DER programs."
    : "Standard DER support. TX deregulated market provides interconnection pathways.";
  return { score, details: { "Utility":utilityName, "Solar GHI":ghi ? `${ghi.toFixed(2)} kWh/m²/day` : "N/A" }, notes };
}

// ── Quadrant Plot ─────────────────────────────────────────────
function QuadrantPlot({ site, demand, previous }) {
  const W=224,H=224,pad=30,plotW=W-pad*2,plotH=H-pad*2;
  const toX=v=>pad+(v/100)*plotW, toY=v=>pad+(1-v/100)*plotH;
  const q=getQuadrant(site,demand);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.15em"}}>SITE vs DEMAND MATRIX</div>
      <svg width={W} height={H}>
        <rect x={pad} y={pad} width={plotW/2} height={plotH/2} fill="rgba(240,192,48,0.05)"/>
        <rect x={pad+plotW/2} y={pad} width={plotW/2} height={plotH/2} fill="rgba(40,200,122,0.06)"/>
        <rect x={pad} y={pad+plotH/2} width={plotW/2} height={plotH/2} fill="rgba(240,72,88,0.04)"/>
        <rect x={pad+plotW/2} y={pad+plotH/2} width={plotW/2} height={plotH/2} fill="rgba(32,192,176,0.05)"/>
        {[{x:pad+plotW*0.25,y:pad+14,t:"DEMAND W/O SITE",c:C.yellow},{x:pad+plotW*0.75,y:pad+14,t:"PRIME SITE",c:C.green},
          {x:pad+plotW*0.25,y:pad+plotH-6,t:"LOW PRIORITY",c:C.red},{x:pad+plotW*0.75,y:pad+plotH-6,t:"INFRA PLAY",c:C.teal}
        ].map((l,i)=><text key={i} x={l.x} y={l.y} textAnchor="middle" fill={l.c} fontSize="7.5" fontFamily="'IBM Plex Mono',monospace" opacity="0.7">{l.t}</text>)}
        <rect x={pad} y={pad} width={plotW} height={plotH} fill="none" stroke={C.border} strokeWidth="1"/>
        <line x1={pad+plotW/2} y1={pad} x2={pad+plotW/2} y2={pad+plotH} stroke={C.border} strokeWidth="0.5" strokeDasharray="3,3"/>
        <line x1={pad} y1={pad+plotH/2} x2={pad+plotW} y2={pad+plotH/2} stroke={C.border} strokeWidth="0.5" strokeDasharray="3,3"/>
        <text x={pad+plotW/2} y={H-4} textAnchor="middle" fill={C.textLabel} fontSize="9" fontFamily="'IBM Plex Mono',monospace">SITE SCORE →</text>
        <text x={12} y={pad+plotH/2} textAnchor="middle" fill={C.textLabel} fontSize="9" fontFamily="'IBM Plex Mono',monospace" transform={`rotate(-90,12,${pad+plotH/2})`}>DEMAND →</text>
        {[0,50,100].map(v=>(
          <g key={v}>
            <text x={toX(v)} y={pad+plotH+13} textAnchor="middle" fill={C.textLabel} fontSize="8" fontFamily="'IBM Plex Mono',monospace">{v}</text>
            <text x={pad-5} y={toY(v)+3} textAnchor="end" fill={C.textLabel} fontSize="8" fontFamily="'IBM Plex Mono',monospace">{v}</text>
          </g>
        ))}
        {previous&&(()=>{
          const px=toX(previous.site.composite),py=toY(previous.demand.composite);
          return <><line x1={px} y1={py} x2={toX(site)} y2={toY(demand)} stroke={C.textDim} strokeWidth="1" strokeDasharray="3,2" opacity="0.4"/><circle cx={px} cy={py} r={5} fill="none" stroke={C.textDim} strokeWidth="1.5" opacity="0.45"/></>;
        })()}
        <circle cx={toX(site)} cy={toY(demand)} r={9} fill={q.color} opacity="0.15"/>
        <circle cx={toX(site)} cy={toY(demand)} r={5} fill={q.color} style={{filter:`drop-shadow(0 0 6px ${q.color})`}}/>
      </svg>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:q.color,letterSpacing:"0.15em",border:`1px solid ${q.color}44`,background:`${q.color}12`,padding:"4px 14px",borderRadius:4}}>{q.label}</div>
    </div>
  );
}

function ScorePill({ label, score, sub }) {
  const color = scoreColor(score);
  return (
    <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px"}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel,letterSpacing:"0.12em",marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:32,fontWeight:700,color,lineHeight:1,marginBottom:3,filter:`drop-shadow(0 0 8px ${color}55)`}}>{score}</div>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel,marginBottom:8}}>{sub}</div>
      <div style={{height:4,background:C.border,borderRadius:2}}>
        <div style={{width:`${score}%`,height:"100%",background:color,borderRadius:2,transition:"width 1s ease",boxShadow:`0 0 6px ${color}88`}}/>
      </div>
    </div>
  );
}

function SiteCard({ label, icon, score, weight, details, pending, notes }) {
  const color = pending ? C.pending : scoreColor(score);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color,borderRadius:"8px 0 0 8px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{color:C.textLabel,fontSize:9,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.12em",marginBottom:3}}>{icon} {label.toUpperCase()}</div>
          <div style={{color:C.textLabel,fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}}>WT {Math.round(weight*100)}%</div>
        </div>
        {pending?<span style={{color:C.pending,fontSize:9,fontFamily:"'IBM Plex Mono',monospace",border:`1px solid ${C.pending}`,padding:"2px 7px",borderRadius:3}}>PENDING</span>
          :<span style={{color,fontSize:26,fontFamily:"'Space Mono',monospace",fontWeight:700,lineHeight:1}}>{score}</span>}
      </div>
      <div style={{height:3,background:C.border,borderRadius:2,marginBottom:10}}>
        <div style={{width:`${pending?0:score}%`,height:"100%",background:color,borderRadius:2,transition:"width 1.2s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 4px ${color}88`}}/>
      </div>
      <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,lineHeight:1.55}}>
        {pending?<span style={{color:C.textLabel}}>Register free API key to activate.</span>
          :<>{Object.entries(details||{}).filter(([,v])=>v).map(([k,v])=>(
            <div key={k}><span style={{color:C.textLabel}}>{k}: </span><span style={{color:C.textBright}}>{v}</span></div>
          ))}{notes&&<div style={{marginTop:5,color:C.text,fontStyle:"italic"}}>{notes}</div>}</>}
      </div>
    </div>
  );
}

// ── Heliport Modifier ─────────────────────────────────────────
const HELI_STATUS_LABELS = {
  active_medical:    "ACTIVE MEDICAL HELIPORT",
  active_industrial: "ACTIVE INDUSTRIAL / OFFSHORE STAGING",
  active_ga:         "ACTIVE GENERAL AVIATION HELIPORT",
  inactive:          "INACTIVE HELIPAD — STRUCTURALLY INTACT",
};
const HELI_STATUS_COLORS = {
  active_medical:    "#28c87a",
  active_industrial: "#20c0b0",
  active_ga:         "#f0a030",
  inactive:          "#f0c030",
};

function HeliportModifier({ heli }) {
  if (!heli || heli.status === "none" || !heli.site_boost) return null;
  const label = HELI_STATUS_LABELS[heli.status] || heli.status?.toUpperCase();
  const color = HELI_STATUS_COLORS[heli.status] || C.amber;
  return (
    <div style={{background:C.surface,border:`1px solid ${color}44`,borderRadius:8,padding:"14px 18px",marginBottom:20}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:8}}>
        HELIPORT MODIFIER — APPLIED TO BOTH AXES
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color,marginBottom:4}}>◈ {label}</div>
          {heli.name && <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,marginBottom:6}}>{heli.name}{heli.distance_m > 0 ? ` · ${heli.distance_m}m` : ""}</div>}
          {heli.notes && <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,lineHeight:1.55}}>{heli.notes}</div>}
        </div>
        <div style={{display:"flex",gap:10,flexShrink:0}}>
          <div style={{textAlign:"center",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel,marginBottom:4}}>SITE BOOST</div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:24,color:C.green,fontWeight:700,lineHeight:1,filter:`drop-shadow(0 0 6px ${C.green}55)`}}>+{heli.site_boost}</div>
          </div>
          <div style={{textAlign:"center",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 18px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel,marginBottom:4}}>DEMAND BOOST</div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:24,color:C.green,fontWeight:700,lineHeight:1,filter:`drop-shadow(0 0 6px ${C.green}55)`}}>+{heli.demand_boost}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemandRow({ label, icon, score, notes }) {
  const color = scoreColor(score);
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,letterSpacing:"0.1em"}}>{icon} {label.toUpperCase()}</span>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:16,color,fontWeight:700}}>{score}</span>
      </div>
      <div style={{height:3,background:C.border,borderRadius:2,marginBottom:5}}>
        <div style={{width:`${score}%`,height:"100%",background:color,borderRadius:2,transition:"width 1.2s ease",boxShadow:`0 0 4px ${color}88`}}/>
      </div>
      {notes&&<div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,lineHeight:1.5}}>{notes}</div>}
    </div>
  );
}

function LogLine({ msg, s }) {
  const color = s==="done"?C.green:s==="pending"?C.pending:s==="warn"?C.yellow:s==="error"?C.red:C.text;
  return (
    <div style={{display:"flex",gap:10,padding:"2px 0",color,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,lineHeight:1.6}}>
      <span style={{flexShrink:0,width:12}}>{s==="done"?"✓":s==="pending"?"○":s==="warn"?"⚠":s==="error"?"✗":"›"}</span>
      <span>{msg}</span>
    </div>
  );
}

function parseCoords(lat,lon){const la=parseFloat(lat),lo=parseFloat(lon);if(isNaN(la)||isNaN(lo))return null;if(la<25||la>37||lo<-107||lo>-93)return null;return{lat:la,lon:lo};}

const ADDR_EXAMPLES=["8900 Will Clayton Pkwy, Humble TX","6900 N Loop E, Houston TX","1400 Post Oak Blvd, Houston TX"];
const COORD_EXAMPLES=[{label:"Willow Waterhole",lat:"29.6620",lon:"-95.5197"},{label:"Texas Medical Center",lat:"29.7079",lon:"-95.4010"},{label:"Ship Channel",lat:"29.7355",lon:"-95.2307"}];

export default function App() {
  const [mode,setMode]=useState("address");
  const [address,setAddress]=useState("");
  const [lat,setLat]=useState("");const [lon,setLon]=useState("");const [siteLabel,setSiteLabel]=useState("");
  const [phase,setPhase]=useState("idle");
  const [log,setLog]=useState([]);
  const [results,setResults]=useState(null);
  const [previous,setPrevious]=useState(null);
  const [error,setError]=useState(null);
  const [pdfGenerating,setPdfGenerating]=useState(false);

  const canRun=phase!=="loading"&&(mode==="address"?address.trim().length>0:parseCoords(lat,lon)!==null);

  async function run(){
    if(!canRun)return;
    if(results)setPrevious(results);
    setPhase("loading");setResults(null);setError(null);
    const logs=[];
    const addL=(msg,s="running")=>{logs.push({msg,s});setLog([...logs]);};
    const setL=(i,msg,s)=>{logs[i]={msg,s};setLog([...logs]);};
    try{
      let input;
      if(mode==="coords"){const c=parseCoords(lat,lon);if(!c)throw new Error("Invalid coordinates. Houston is ~29-30°N, -95 to -96°W.");input={lat:c.lat,lon:c.lon,label:siteLabel||`${c.lat}, ${c.lon}`};addL(`Coordinates: ${c.lat.toFixed(5)}°N, ${Math.abs(c.lon).toFixed(5)}°W`);}
      else{input={address:address.trim()};addL(`Geocoding: ${address.trim()}`);}
      addL("Running site + demand analysis...");addL("Applying FAA/NREL scoring model...");
      const data=await analyzeWithClaude(input,mode);
      if(!data.geocode?.valid)throw new Error("Location not recognized as a Texas site.");
      // Heliport lookup — FAA NASR data, 500m radius
      const heli = findNearestHeliport(data.geocode.lat, data.geocode.lon, 500);
      const siteBoost = heli.site_boost || 0;
      const demandBoost = heli.demand_boost || 0;
      if (data.site) data.site.composite = Math.min(100, Math.round((data.site.composite||0) + siteBoost));
      if (data.demand) data.demand.composite = Math.min(100, Math.round((data.demand.composite||0) + demandBoost));

      setL(0,`Resolved → ${data.geocode.lat?.toFixed(5)}°N, ${Math.abs(data.geocode.lon)?.toFixed(5)}°W`,"done");
      const heliNote = siteBoost > 0 ? ` · heliport +${siteBoost}/${demandBoost}` : "";
      setL(1,`Site: ${data.site?.composite} | Demand: ${data.demand?.composite} | PI: ${priorityIndex(data.site?.composite||0,data.demand?.composite||0)}${heliNote}`,"done");
      setL(2,`Quadrant: ${getQuadrant(data.site?.composite||0,data.demand?.composite||0).label}`,"done");
      if (siteBoost > 0) addL(`Heliport: ${heli.name} · ${heli.distance_m}m · +${siteBoost} site / +${demandBoost} demand`,"done");
      const eiaLogIdx = logs.length; addL("EIA power grid layer → fetching...","running");
      const nrelLogIdx = logs.length; addL("NREL community DER layer → fetching...","running");
      const flags=[...(data.site?.parcel?.flags||[]),...(data.site?.airspace?.flags||[]),...(data.site?.zoning?.flags||[]),...(data.site?.soil?.flags||[])];
      const [eiaSettled, nrelSettled] = await Promise.allSettled([
        fetchEIAPowerScore(data.geocode.lat, data.geocode.lon, data.site?.zoning?.score || 50),
        fetchNRELDERScore(data.geocode.lat, data.geocode.lon),
      ]);
      const eia  = eiaSettled.status  === "fulfilled" ? eiaSettled.value  : null;
      const nrel = nrelSettled.status === "fulfilled" ? nrelSettled.value : null;
      if (eia)  setL(eiaLogIdx,  `EIA → Power Grid & DER: ${eia.score}/100`,  "done");
      else      setL(eiaLogIdx,  `EIA → ${eiaSettled.reason?.message||"fetch failed"}`, "warn");
      if (nrel) setL(nrelLogIdx, `NREL → Community DER: ${nrel.score}/100`,   "done");
      else      setL(nrelLogIdx, `NREL → ${nrelSettled.reason?.message||"fetch failed"}`, "warn");
      setResults({...data,flags,eia,nrel,heliport:heli});setPhase("complete");
    }catch(err){setL(0,`Error: ${err.message}`,"error");setError(err.message);setPhase("error");}
  }

  async function handleDownloadPDF(){
    if(!results)return;
    setPdfGenerating(true);
    try{ generatePDF(results); }
    catch(err){ console.error("PDF error:",err); alert("PDF generation failed: "+err.message); }
    finally{ setPdfGenerating(false); }
  }

  const reset=()=>{setPhase("idle");setResults(null);setPrevious(null);setLog([]);setAddress("");setLat("");setLon("");setSiteLabel("");setError(null);};
  const tabStyle=(active)=>({background:"transparent",border:`1px solid ${active?C.amber:C.border}`,color:active?C.amber:C.textLabel,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.15em",padding:"6px 14px",borderRadius:4,cursor:"pointer",transition:"all 0.15s"});
  const inputStyle={background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.textBright,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,padding:"11px 14px"};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input::placeholder{color:${C.textDim};}
        input:focus{outline:none!important;border-color:${C.amber}!important;box-shadow:0 0 0 2px ${C.amberGlow}!important;}
        .run-btn,.pdf-btn{transition:all 0.18s ease;}
        .run-btn:hover:not(:disabled){background:${C.amber}!important;color:${C.bg}!important;box-shadow:0 0 24px ${C.amberGlow};}
        .pdf-btn:hover:not(:disabled){background:${C.green}!important;color:${C.bg}!important;box-shadow:0 0 20px rgba(40,200,122,0.25);}
        .ex:hover{color:${C.amber}!important;}
        .log-row{animation:fadeIn 0.25s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-4px);}to{opacity:1;transform:translateX(0);}}
        .blink{animation:blink 1.1s ease-in-out infinite;}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:${C.surface};}::-webkit-scrollbar-thumb{background:${C.border};}
      `}</style>

      <div style={{maxWidth:920,margin:"0 auto",padding:"32px 20px 60px"}}>

        {/* Header */}
        <div style={{marginBottom:36,paddingBottom:24,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
            <div style={{display:"flex",gap:3}}>{[40,28,18].map((h,i)=><div key={i} style={{width:3,height:h,background:i===0?C.amber:i===1?C.amberDim:C.border,borderRadius:2}}/>)}</div>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,fontWeight:900,color:C.textBright,letterSpacing:"0.2em"}}>VERTIPORT</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.amberDim,letterSpacing:"0.25em",marginTop:2}}>SITE EVALUATION SYSTEM</div>
            </div>
            <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
              <div className="blink" style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em"}}>HOUSTON BETA</span>
            </div>
          </div>
          <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.textLabel,paddingLeft:20}}>
            FAA/NREL-calibrated · Site + Demand two-axis scoring · Priority Index · PDF report export
          </div>
        </div>

        {/* Input */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button style={tabStyle(mode==="address")} onClick={()=>setMode("address")}>ADDRESS INPUT</button>
            <button style={tabStyle(mode==="coords")} onClick={()=>setMode("coords")}>GPS COORDINATES</button>
          </div>
          {mode==="address"?(
            <>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:8}}>SITE ADDRESS</div>
              <div style={{display:"flex",gap:10}}>
                <input value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={e=>e.key==="Enter"&&canRun&&run()} placeholder="Street address — Houston metro area" style={{...inputStyle,flex:1}}/>
                <button className="run-btn" onClick={run} disabled={!canRun} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.2em",padding:"11px 22px",borderRadius:6,cursor:"pointer",opacity:!canRun?0.4:1,whiteSpace:"nowrap"}}>{phase==="loading"?"RUNNING...":"ANALYZE"}</button>
              </div>
              <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:"4px 16px"}}>
                <span style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.textLabel}}>Try:</span>
                {ADDR_EXAMPLES.map(ex=><span key={ex} className="ex" onClick={()=>setAddress(ex)} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,cursor:"pointer"}}>{ex.split(",")[0]}</span>)}
              </div>
            </>
          ):(
            <>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:8}}>GPS COORDINATES (DECIMAL DEGREES)</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <input value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitude (e.g. 29.6620)" style={{...inputStyle,flex:1,minWidth:140}}/>
                <input value={lon} onChange={e=>setLon(e.target.value)} placeholder="Longitude (e.g. -95.5197)" style={{...inputStyle,flex:1,minWidth:160}}/>
                <input value={siteLabel} onChange={e=>setSiteLabel(e.target.value)} placeholder="Site name (optional)" style={{...inputStyle,flex:1,minWidth:140}}/>
                <button className="run-btn" onClick={run} disabled={!canRun} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.2em",padding:"11px 22px",borderRadius:6,cursor:"pointer",opacity:!canRun?0.4:1,whiteSpace:"nowrap"}}>{phase==="loading"?"RUNNING...":"ANALYZE"}</button>
              </div>
              <div style={{marginTop:8,padding:"7px 12px",background:"rgba(240,160,48,0.05)",border:`1px solid rgba(240,160,48,0.15)`,borderRadius:5}}>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim}}>TIP: Right-click any location in Google Maps — coordinates appear at the top of the context menu.</span>
              </div>
              <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:"4px 16px"}}>
                <span style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.textLabel}}>Try:</span>
                {COORD_EXAMPLES.map(ex=><span key={ex.label} className="ex" onClick={()=>{setLat(ex.lat);setLon(ex.lon);setSiteLabel(ex.label);}} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,cursor:"pointer"}}>{ex.label}</span>)}
              </div>
            </>
          )}
        </div>

        {/* Log */}
        {log.length>0&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px",marginBottom:24}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>ANALYSIS LOG</div>
            {log.map((item,i)=><div key={i} className="log-row"><LogLine msg={item.msg} s={item.s}/></div>)}
            {phase==="loading"&&<div className="blink" style={{display:"flex",gap:10,padding:"4px 0",color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,marginTop:2}}><span>●</span><span>Contacting Anthropic API...</span></div>}
          </div>
        )}

        {/* Error */}
        {phase==="error"&&(
          <div style={{background:"rgba(240,72,88,0.07)",border:"1px solid rgba(240,72,88,0.3)",borderRadius:8,padding:"14px 18px",marginBottom:24}}>
            <div style={{color:C.red,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,marginBottom:8}}>ERROR — {error}</div>
            <button onClick={run} style={{background:"transparent",border:`1px solid ${C.red}`,color:C.red,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.15em",padding:"7px 16px",borderRadius:4,cursor:"pointer"}}>RETRY</button>
          </div>
        )}

        {/* Results */}
        {phase==="complete"&&results&&(()=>{
          const siteScore=results.site?.composite||0;
          const demandScore=results.demand?.composite||0;
          const pi=priorityIndex(siteScore,demandScore);
          const q=getQuadrant(siteScore,demandScore);
          return (
            <div>
              {/* Score header */}
              <div style={{display:"flex",gap:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"22px 24px",marginBottom:20,flexWrap:"wrap"}}>
                <QuadrantPlot site={siteScore} demand={demandScore} previous={previous}/>
                <div style={{flex:1,minWidth:260}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:8}}>DUAL-AXIS ASSESSMENT</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.textBright,marginBottom:3}}>{results.geocode.matched}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,marginBottom:14}}>{results.geocode.lat?.toFixed(5)}°N · {Math.abs(results.geocode.lon)?.toFixed(5)}°W</div>

                  <div style={{display:"flex",gap:10,marginBottom:14}}>
                    <ScorePill label="SITE SCORE" score={siteScore} sub="infrastructure viability"/>
                    <ScorePill label="DEMAND SCORE" score={demandScore} sub="passenger + cargo draw"/>
                    <ScorePill label="PRIORITY INDEX" score={pi} sub="cargo-weighted 60/40"/>
                  </div>

                  <div style={{padding:"10px 14px",background:`${q.color}0e`,border:`1px solid ${q.color}33`,borderRadius:6,marginBottom:12}}>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:q.color,marginBottom:4,letterSpacing:"0.1em"}}>{q.label}</div>
                    <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.text,lineHeight:1.5}}>{q.desc}</div>
                  </div>

                  {results.summary&&<div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.text,lineHeight:1.65,marginBottom:10,paddingLeft:12,borderLeft:`2px solid ${C.border}`}}>{results.summary}</div>}
                  {results.development_thesis&&<div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.amber,marginBottom:12,lineHeight:1.5}}>▶ {results.development_thesis}</div>}

                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                    {(results.top_strengths||[]).map((s,i)=><span key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.green,background:"rgba(40,200,122,0.09)",border:"1px solid rgba(40,200,122,0.25)",borderRadius:3,padding:"3px 9px"}}>✓ {s}</span>)}
                    {(results.top_concerns||[]).filter(Boolean).map((s,i)=><span key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.yellow,background:"rgba(240,192,48,0.09)",border:"1px solid rgba(240,192,48,0.25)",borderRadius:3,padding:"3px 9px"}}>⚑ {s}</span>)}
                  </div>

                  {/* PDF Download Button */}
                  <button className="pdf-btn" onClick={handleDownloadPDF} disabled={pdfGenerating}
                    style={{background:"transparent",border:`1px solid ${C.green}`,color:C.green,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",padding:"10px 20px",borderRadius:6,cursor:"pointer",opacity:pdfGenerating?0.5:1,display:"flex",alignItems:"center",gap:8}}>
                    <span>⬇</span>
                    <span>{pdfGenerating?"GENERATING...":"DOWNLOAD REPORT PDF"}</span>
                  </button>
                </div>
              </div>

              {/* Site criteria */}
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>SITE SCORE — INFRASTRUCTURE CRITERIA</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
                <SiteCard label="Parcel" icon="▣" score={results.site?.parcel?.score} weight={0.25} notes={results.site?.parcel?.notes} details={{"Acreage":results.site?.parcel?.acreage_estimate?`~${results.site.parcel.acreage_estimate} ac`:null,"Type":results.site?.parcel?.land_type,"NREL min":"1.5 ac"}}/>
                <SiteCard label="FAA Airspace" icon="✈" score={results.site?.airspace?.score} weight={0.25} notes={results.site?.airspace?.notes} details={{"Class":results.site?.airspace?.status,"Airport":results.site?.airspace?.nearest_airport,"LAANC":results.site?.airspace?.laanc_required?"Required":"Not required"}}/>
                <SiteCard label="Power Grid & DER" icon="⚡" score={results.eia?.score??null} weight={0.20} pending={!results.eia} notes={results.eia?.notes} details={results.eia?.details}/>
                <SiteCard label="Zoning" icon="◈" score={results.site?.zoning?.score} weight={0.15} notes={results.site?.zoning?.notes} details={{"Compliance":results.site?.zoning?.compliance,"Use":results.site?.zoning?.land_use}}/>
                <SiteCard label="Soil & Flood" icon="⬡" score={results.site?.soil?.score} weight={0.10} notes={results.site?.soil?.notes} details={{"Flood":results.site?.soil?.flood_zone,"Slope":results.site?.soil?.slope_estimate,"Elev":results.site?.soil?.elevation_ft?`${results.site.soil.elevation_ft} ft`:null}}/>
                <SiteCard label="DER Support" icon="◉" score={results.nrel?.score??null} weight={0.05} pending={!results.nrel} notes={results.nrel?.notes} details={results.nrel?.details}/>
              </div>

              {/* Demand criteria */}
              <HeliportModifier heli={results.heliport}/>

              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>DEMAND SCORE — WHY FLY HERE?</div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px",marginBottom:20}}>
                <DemandRow label="Employment Density" icon="🏢" score={results.demand?.employment?.score||0} notes={results.demand?.employment?.notes}/>
                <DemandRow label="Destinations & Attractions" icon="📍" score={results.demand?.destinations?.score||0} notes={results.demand?.destinations?.notes}/>
                <DemandRow label="Medical & Institutional" icon="🏥" score={results.demand?.medical?.score||0} notes={results.demand?.medical?.notes}/>
                <DemandRow label="Cargo & Logistics" icon="📦" score={results.demand?.cargo?.score||0} notes={results.demand?.cargo?.notes}/>
                <DemandRow label="Transit Gap" icon="🚌" score={results.demand?.transit_gap?.score||0} notes={results.demand?.transit_gap?.notes}/>
              </div>

              {/* Flags */}
              {results.flags?.length>0&&(
                <div style={{marginBottom:20,background:"rgba(240,160,48,0.04)",border:"1px solid rgba(240,160,48,0.18)",borderRadius:8,padding:"14px 18px"}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>FLAGS — ITEMS REQUIRING INVESTIGATION</div>
                  {results.flags.map((flag,i)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderTop:i>0?`1px solid ${C.border}`:"none",fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.yellow,lineHeight:1.55}}>
                      <span style={{flexShrink:0}}>⚑</span><span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* API activation */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px",marginBottom:20}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:12}}>ACTIVATE PENDING LAYERS — FREE REGISTRATION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[{name:"EIA Open Data API",desc:"Grid capacity, utility territory, energy infrastructure",url:"https://www.eia.gov/opendata/",pts:"+20 pts",layer:"Power Grid & DER"},{name:"NREL Developer API",desc:"Distributed energy projects, RE Atlas, community solar",url:"https://developer.nrel.gov/signup/",pts:"+5 pts",layer:"DER Support"}].map(api=>(
                    <div key={api.name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.textBright}}>{api.name}</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.green}}>{api.pts}</span></div>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,marginBottom:4}}>UNLOCKS: {api.layer.toUpperCase()}</div>
                      <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,marginBottom:8,lineHeight:1.5}}>{api.desc}</div>
                      <a href={api.url} target="_blank" rel="noopener noreferrer" style={{color:C.amber,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",textDecoration:"none"}}>REGISTER FREE →</a>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                <button onClick={run} disabled={phase==="loading"} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",padding:"10px 24px",borderRadius:6,cursor:"pointer"}}>RE-ANALYZE</button>
                <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textLabel,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",padding:"10px 24px",borderRadius:6,cursor:"pointer"}}>NEW SITE</button>
              </div>
            </div>
          );
        })()}

        <div style={{marginTop:48,paddingTop:18,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>
          <span>FAA · NREL · FEMA · USGS · EIA · OSM</span>
          <span>PHASE 1 — TEXAS · FAA/NREL CALIBRATED</span>
        </div>
      </div>
    </div>
  );
}
