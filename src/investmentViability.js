// Investment / Viability Summary generator for vertiport sites.
// Synthesizes all evaluation data into cost estimates, revenue projections,
// risk-adjusted ROI, development timeline, and an overall investment grade.
//
// Cost model calibrated to 2025-2026 industry data:
//   - NEXA Advisors vertiport cost benchmarks
//   - McKinsey/Deloitte AAM market sizing
//   - FAA Engineering Brief 105 design standards
//   - Texas construction cost indices (RSMeans)
//   - Public SPAC filings from Joby, Archer, Lilium

// ── Cost Model ──────────────────────────────────────────────────

// Base CAPEX ranges (USD, low/mid/high) by development scenario
const CAPEX_BASE = {
  greenfield:   { low: 8_000_000,  mid: 14_000_000, high: 22_000_000 },
  brownfield:   { low: 4_500_000,  mid: 8_500_000,  high: 14_000_000 },
  heliport_conv:{ low: 2_000_000,  mid: 4_500_000,  high: 8_000_000 },
  rooftop:      { low: 5_000_000,  mid: 10_000_000, high: 16_000_000 },
};

const CAPEX_ITEMS = [
  { id: "land",        label: "Land Acquisition / Lease",     pctRange: [0.15, 0.30] },
  { id: "design",      label: "Design & Engineering",         pctRange: [0.08, 0.12] },
  { id: "tlof",        label: "TLOF/FATO Construction",       pctRange: [0.18, 0.25] },
  { id: "charging",    label: "Charging Infrastructure",      pctRange: [0.12, 0.18] },
  { id: "terminal",    label: "Passenger Terminal / Shelter",  pctRange: [0.08, 0.14] },
  { id: "permitting",  label: "Permitting & Regulatory",      pctRange: [0.04, 0.08] },
  { id: "contingency", label: "Contingency (15%)",            pctRange: [0.12, 0.18] },
];

// Annual OPEX as % of CAPEX
const OPEX_PCT = { low: 0.06, mid: 0.09, high: 0.14 };

// Revenue drivers (per movement, 2026 projected)
const REV_PER_MOVEMENT = { passenger: 85, cargo: 45 }; // landing fee + facility fee
const ANCILLARY_PER_PAX = 12; // retail, lounge, parking
const CHARGE_FEE_PER_MOVEMENT = 35; // energy margin

function classifyScenario(results) {
  const heli = results.heliport || {};
  const parcel = results.site?.parcel || {};
  const zoning = results.site?.zoning || {};
  const landType = (parcel.land_type || "").toLowerCase();
  const zoningUse = (zoning.land_use || "").toLowerCase();

  if (heli.status && heli.status !== "none" && heli.distance_m <= 200) return "heliport_conv";
  if (landType.includes("roof") || zoningUse.includes("roof")) return "rooftop";
  if (zoningUse.includes("industrial") || zoningUse.includes("commercial") || zoningUse.includes("business") ||
      landType.includes("developed") || landType.includes("parking") || landType.includes("paved")) return "brownfield";
  return "greenfield";
}

function estimateMovements(results) {
  const demand = results.demand?.composite || 0;
  const flyDays = results.flyingDays?.flyingDays || 280;
  const site = results.site?.composite || 0;

  // Base movements/day scaled by demand score
  // Low demand (20): ~4 movements/day → High demand (90): ~30 movements/day
  const movPerDay = Math.max(2, Math.round(2 + (demand / 100) * 28));
  // Split: passenger vs cargo based on demand sub-scores
  const cargoScore = results.demand?.cargo?.score || 0;
  const cargoPct = Math.min(0.60, Math.max(0.10, cargoScore / 200 + 0.10));
  const paxPct = 1 - cargoPct;

  // Annual movements (adjusted for flyable days + ramp-up)
  const yr1Factor = 0.25; // year 1: 25% capacity (ramp-up)
  const yr3Factor = 0.55;
  const yr5Factor = 0.80;
  const steadyState = movPerDay * flyDays;

  return {
    perDay: movPerDay,
    steadyState,
    yr1: Math.round(steadyState * yr1Factor),
    yr3: Math.round(steadyState * yr3Factor),
    yr5: Math.round(steadyState * yr5Factor),
    paxPct,
    cargoPct,
  };
}

// ── Risk Model ──────────────────────────────────────────────────

function assessRisks(results) {
  const risks = [];
  const site = results.site?.composite || 0;
  const demand = results.demand?.composite || 0;
  const airspace = results.site?.airspace || {};
  const zoning = results.site?.zoning || {};
  const soil = results.site?.soil || {};
  const parcel = results.site?.parcel || {};
  const reg = results.regulatory || [];
  const fly = results.flyingDays || {};

  // Regulatory risk
  const criticalReg = reg.filter(r => r.urgency === "critical").length;
  const regScore = criticalReg >= 5 ? 85 : criticalReg >= 3 ? 65 : criticalReg >= 1 ? 40 : 20;
  risks.push({
    category: "Regulatory",
    score: regScore,
    label: regScore >= 70 ? "HIGH" : regScore >= 40 ? "MODERATE" : "LOW",
    notes: criticalReg >= 3
      ? `${criticalReg} critical regulatory items. Extended permitting timeline likely (12-18 months).`
      : `${criticalReg} critical items. Standard permitting path expected (6-12 months).`,
  });

  // Airspace risk
  const airClass = (airspace.status || "").toUpperCase();
  const airRisk = airClass.includes("B") ? 80 : airClass.includes("C") ? 55 : airClass.includes("D") ? 40 : 15;
  risks.push({
    category: "Airspace",
    score: airRisk,
    label: airRisk >= 70 ? "HIGH" : airRisk >= 40 ? "MODERATE" : "LOW",
    notes: airRisk >= 70 ? "Class B airspace significantly constrains operations and requires extensive FAA coordination."
      : airRisk >= 40 ? "Controlled airspace adds procedural overhead but is manageable with proper ATC coordination."
      : "Favorable airspace with minimal operational constraints.",
  });

  // Community / political risk
  const isResidential = (zoning.land_use || "").toLowerCase().includes("residen");
  const zoningPoor = (zoning.compliance || "").toLowerCase().includes("poor") || (zoning.compliance || "").toLowerCase().includes("non");
  const commRisk = isResidential ? 85 : zoningPoor ? 70 : zoning.score < 50 ? 55 : 25;
  risks.push({
    category: "Community",
    score: commRisk,
    label: commRisk >= 70 ? "HIGH" : commRisk >= 40 ? "MODERATE" : "LOW",
    notes: commRisk >= 70
      ? "Residential proximity or zoning non-compliance creates significant community opposition risk. Budget for public engagement."
      : commRisk >= 40
      ? "Some community sensitivity expected. Proactive outreach recommended."
      : "Commercial/industrial setting with low community opposition risk.",
  });

  // Construction / site risk
  const floodZone = (soil.flood_zone || "").toUpperCase();
  const inFlood = floodZone.includes("AE") || floodZone.includes("VE");
  const smallParcel = (parcel.acreage_estimate || 5) < 2;
  const constRisk = inFlood ? 75 : smallParcel ? 60 : site < 40 ? 55 : 20;
  risks.push({
    category: "Construction",
    score: constRisk,
    label: constRisk >= 70 ? "HIGH" : constRisk >= 40 ? "MODERATE" : "LOW",
    notes: inFlood ? "Floodplain location adds elevation requirements, permitting complexity, and insurance costs."
      : smallParcel ? "Constrained parcel requires creative design. Engineering costs may exceed baseline."
      : "Standard construction risk profile.",
  });

  // Market / demand risk
  const mktRisk = demand < 35 ? 80 : demand < 55 ? 55 : demand < 75 ? 35 : 15;
  risks.push({
    category: "Market",
    score: mktRisk,
    label: mktRisk >= 70 ? "HIGH" : mktRisk >= 40 ? "MODERATE" : "LOW",
    notes: mktRisk >= 70
      ? "Low demand score indicates weak passenger/cargo fundamentals. Revenue projections carry high uncertainty."
      : mktRisk >= 40
      ? "Moderate demand. Revenue depends on market maturation and route network development."
      : "Strong demand drivers support revenue assumptions.",
  });

  // Weather / operational risk
  const flyDays = fly.flyingDays || 280;
  const wxRisk = flyDays < 240 ? 70 : flyDays < 270 ? 50 : flyDays < 290 ? 30 : 15;
  risks.push({
    category: "Weather",
    score: wxRisk,
    label: wxRisk >= 70 ? "HIGH" : wxRisk >= 40 ? "MODERATE" : "LOW",
    notes: wxRisk >= 70
      ? `Only ${flyDays} flyable days/yr. Significant revenue loss from weather cancellations.`
      : `${flyDays} flyable days/yr. ${wxRisk >= 40 ? "Seasonal disruptions will impact scheduling." : "Favorable operating environment."}`,
  });

  return risks;
}

// ── Timeline Model ──────────────────────────────────────────────

function buildTimeline(results, scenario) {
  const reg = results.regulatory || [];
  const criticalReg = reg.filter(r => r.urgency === "critical").length;
  const airClass = (results.site?.airspace?.status || "").toUpperCase();
  const isClassB = airClass.includes("B");
  const inFlood = ((results.site?.soil?.flood_zone || "").toUpperCase()).includes("AE");
  const needsRezoning = (results.site?.zoning?.compliance || "").toLowerCase().includes("poor");

  const phases = [];

  // Phase 1: Pre-development
  let preDev = 3;
  if (isClassB) preDev += 3;
  if (needsRezoning) preDev += 4;
  if (inFlood) preDev += 2;
  phases.push({
    name: "Pre-Development",
    months: preDev,
    items: ["Site due diligence & Phase I ESA", "FAA 7460-1 filing & aeronautical study", "Zoning/entitlement applications", "Environmental review (NEPA)"],
  });

  // Phase 2: Design & Permitting
  let design = 4;
  if (criticalReg >= 4) design += 2;
  phases.push({
    name: "Design & Permitting",
    months: design,
    items: ["Architectural & structural design (EB 105)", "Building permit & fire marshal review", "ERCOT interconnection application", "TxDOT aviation notification"],
  });

  // Phase 3: Construction
  let construct = scenario === "heliport_conv" ? 6 : scenario === "brownfield" ? 10 : 14;
  if (inFlood) construct += 2;
  phases.push({
    name: "Construction",
    months: construct,
    items: ["Site preparation & grading", "TLOF/FATO construction", "Charging infrastructure installation", "Terminal/shelter build-out"],
  });

  // Phase 4: Commissioning
  phases.push({
    name: "Commissioning",
    months: 3,
    items: ["FAA final inspection", "Operational readiness review", "Emergency response drill", "Soft launch / proving flights"],
  });

  const totalMonths = phases.reduce((s, p) => s + p.months, 0);

  return { phases, totalMonths };
}

// ���─ Investment Grade ────────────────────────────────────────────

function computeGrade(site, demand, risks, flyDays, scenario) {
  // Weighted score: site fundamentals, demand, risk profile, weather, scenario fit
  const avgRisk = risks.reduce((s, r) => s + r.score, 0) / risks.length;
  const riskPenalty = avgRisk * 0.35;
  const siteContrib = site * 0.20;
  const demandContrib = demand * 0.25;
  const flyContrib = Math.min(100, (flyDays / 365) * 100) * 0.10;
  const scenarioBonus = scenario === "heliport_conv" ? 8 : scenario === "brownfield" ? 4 : 0;

  const raw = siteContrib + demandContrib + flyContrib + scenarioBonus - riskPenalty + 25; // base offset
  const capped = Math.max(0, Math.min(100, Math.round(raw)));

  let grade, gradeLabel, gradeColor;
  if (capped >= 80) { grade = "A"; gradeLabel = "STRONG BUY"; gradeColor = "#28c87a"; }
  else if (capped >= 70) { grade = "B+"; gradeLabel = "FAVORABLE"; gradeColor = "#1a8a58"; }
  else if (capped >= 60) { grade = "B"; gradeLabel = "VIABLE WITH CONDITIONS"; gradeColor = "#5B9BD5"; }
  else if (capped >= 50) { grade = "C+"; gradeLabel = "MARGINAL — HIGH DUE DILIGENCE"; gradeColor = "#f0a030"; }
  else if (capped >= 38) { grade = "C"; gradeLabel = "SPECULATIVE"; gradeColor = "#c87a10"; }
  else { grade = "D"; gradeLabel = "NOT RECOMMENDED"; gradeColor = "#C0392B"; }

  return { score: capped, grade, gradeLabel, gradeColor };
}

// ── Main Export ─────────────────────────────────���───────────────

export function buildInvestmentSummary(results, evalMode = "passenger") {
  const siteScore = results.site?.composite || 0;
  const demandScore = results.demand?.composite || 0;
  const flyDays = results.flyingDays?.flyingDays || 280;

  const scenario = classifyScenario(results);

  // Cargo mode: smaller base CAPEX (no passenger terminal) but adjust items
  const capexBaseRaw = CAPEX_BASE[scenario];
  const cargoCapexScale = evalMode === "cargo" ? 0.72 : evalMode === "combo" ? 0.88 : 1.0;
  const capexBase = {
    low: Math.round(capexBaseRaw.low * cargoCapexScale),
    mid: Math.round(capexBaseRaw.mid * cargoCapexScale),
    high: Math.round(capexBaseRaw.high * cargoCapexScale),
  };

  const movements = estimateMovements(results);
  const risks = assessRisks(results);
  const timeline = buildTimeline(results, scenario);
  const grade = computeGrade(siteScore, demandScore, risks, flyDays, scenario);

  // CAPEX breakdown — swap terminal item for cargo handling dock in cargo/combo mode
  const capexMid = capexBase.mid;
  const capexItemsAdjusted = CAPEX_ITEMS.map(item => {
    if (item.id === "terminal" && evalMode === "cargo") {
      return { ...item, label: "Cargo Dock & Handling Bay", pctRange: [0.05, 0.09] };
    }
    if (item.id === "terminal" && evalMode === "combo") {
      return { ...item, label: "Terminal + Cargo Dock", pctRange: [0.07, 0.12] };
    }
    return item;
  });
  const capexBreakdown = capexItemsAdjusted.map(item => ({
    ...item,
    low: Math.round(capexBase.low * item.pctRange[0]),
    mid: Math.round(capexMid * ((item.pctRange[0] + item.pctRange[1]) / 2)),
    high: Math.round(capexBase.high * item.pctRange[1]),
  }));

  // Annual OPEX
  const opex = {
    low: Math.round(capexBase.low * OPEX_PCT.low),
    mid: Math.round(capexMid * OPEX_PCT.mid),
    high: Math.round(capexBase.high * OPEX_PCT.high),
  };

  // Revenue projections — cargo ops: higher frequency, lower per-movement revenue
  // Cargo delivery: ~$25-35/delivery landing fee; passenger: $85 + ancillary
  const cargoMovMult = evalMode === "cargo" ? 1.8 : evalMode === "combo" ? 1.3 : 1.0;
  const adjMovements = { ...movements, perDay: Math.round(movements.perDay * cargoMovMult), steadyState: Math.round(movements.steadyState * cargoMovMult), yr1: Math.round(movements.yr1 * cargoMovMult), yr3: Math.round(movements.yr3 * cargoMovMult), yr5: Math.round(movements.yr5 * cargoMovMult) };
  const effMovements = evalMode === "passenger" ? movements : adjMovements;

  const revPerMov = evalMode === "cargo"
    ? 30 + CHARGE_FEE_PER_MOVEMENT  // cargo: $30 landing fee + $35 charge = $65/mov
    : evalMode === "combo"
    ? 0.55 * 30 + 0.45 * (REV_PER_MOVEMENT.passenger + ANCILLARY_PER_PAX) + CHARGE_FEE_PER_MOVEMENT
    : movements.paxPct * (REV_PER_MOVEMENT.passenger + ANCILLARY_PER_PAX) +
      movements.cargoPct * REV_PER_MOVEMENT.cargo +
      CHARGE_FEE_PER_MOVEMENT;
  const revenue = {
    yr1: Math.round(effMovements.yr1 * revPerMov),
    yr3: Math.round(effMovements.yr3 * revPerMov),
    yr5: Math.round(effMovements.yr5 * revPerMov),
    perMovement: Math.round(revPerMov),
  };

  // Simple payback (mid scenario)
  const yr5NetIncome = revenue.yr5 - opex.mid;
  const paybackYears = yr5NetIncome > 0
    ? Math.round((capexMid / yr5NetIncome) * 10) / 10
    : null;

  // 10-year NPV (simplified, 8% discount rate)
  const discountRate = 0.08;
  let npv = -capexMid;
  for (let yr = 1; yr <= 10; yr++) {
    const rampFactor = yr <= 1 ? 0.25 : yr <= 2 ? 0.40 : yr <= 3 ? 0.55 : yr <= 5 ? 0.80 : 0.90;
    const yearRev = effMovements.steadyState * revPerMov * rampFactor;
    const yearOpex = opex.mid * (0.85 + yr * 0.015); // slight opex escalation
    const netCF = yearRev - yearOpex;
    npv += netCF / Math.pow(1 + discountRate, yr);
  }
  npv = Math.round(npv);

  const scenarioLabels = {
    greenfield: "Greenfield Development",
    brownfield: "Brownfield / Redevelopment",
    heliport_conv: "Heliport Conversion",
    rooftop: "Rooftop Installation",
  };

  return {
    scenario,
    scenarioLabel: scenarioLabels[scenario],
    grade,
    capex: { low: capexBase.low, mid: capexMid, high: capexBase.high, breakdown: capexBreakdown },
    opex,
    movements: effMovements,
    revenue,
    paybackYears,
    npv,
    discountRate,
    risks,
    timeline,
  };
}
