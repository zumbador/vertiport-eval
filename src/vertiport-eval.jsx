import { useState } from "react";
import { jsPDF } from "jspdf";
import { findNearestHeliport } from './heliportLookup.js';
import { TX_AIRSPACE } from './txAirspace.js';
import { estimateFlyingDays } from './flyingDays.js';
import { buildRegulatoryChecklist, CATEGORIES } from './regulatoryChecklist.js';
import { buildInvestmentSummary } from './investmentViability.js';
import SiteMap from './SiteMap.jsx';
import SiteMap3D from './SiteMap3D.jsx';

const C = {
  bg: "#F9F9F9", surface: "#FFFFFF", card: "#EAF4FC", border: "#d0dce8",
  amber: "#5B9BD5", amberDim: "#7db0b5", amberGlow: "rgba(91,155,213,0.15)",
  green: "#1a8a58", yellow: "#c87a10", red: "#C0392B", teal: "#4a9a8e",
  text: "#444444", textBright: "#222222", textDim: "#999999", textLabel: "#5B9BD5",
  pending: "#9ab8d0",
};

const scoreColor = (s) => {
  if (s === null || s === undefined) return C.pending;
  if (s >= 75) return C.green;
  if (s >= 45) return C.yellow;
  return C.red;
};

const priorityIndex = (site, demand) => Math.round(site * 0.60 + demand * 0.40);

// ── Demand criteria config — drives display, PDF, and prompt ──
const DEMAND_CRITERIA = {
  passenger: [
    { key:"employment",       label:"Employment Density",          wt:"30%", icon:"🏢" },
    { key:"destinations",     label:"Destinations & Attractions",  wt:"25%", icon:"📍" },
    { key:"medical",          label:"Medical & Institutional",     wt:"20%", icon:"🏥" },
    { key:"cargo",            label:"Cargo & Logistics",           wt:"15%", icon:"📦" },
    { key:"transit_gap",      label:"Transit Gap",                 wt:"10%", icon:"🚌" },
  ],
  cargo: [
    { key:"logistics_hub",    label:"Logistics Infrastructure",    wt:"30%", icon:"🏭" },
    { key:"last_mile",        label:"Last-Mile Demand",            wt:"25%", icon:"📦" },
    { key:"cargo_network",    label:"Cargo Network Value",         wt:"20%", icon:"✈" },
    { key:"priority_freight", label:"Priority Freight",            wt:"15%", icon:"⚡" },
    { key:"ground_access",    label:"Ground Access",               wt:"10%", icon:"🚛" },
  ],
  combo: [
    { key:"logistics_hub",    label:"Logistics Infrastructure",    wt:"25%", icon:"🏭" },
    { key:"employment",       label:"Employment & Destinations",   wt:"25%", icon:"🏢" },
    { key:"cargo_network",    label:"Cargo Network",               wt:"20%", icon:"✈" },
    { key:"priority_freight", label:"Priority / Medical Cargo",    wt:"15%", icon:"⚡" },
    { key:"last_mile",        label:"Last-Mile + Transit",         wt:"15%", icon:"📦" },
  ],
};

const DEMAND_HEADER = {
  passenger: "DEMAND SCORE — WHY FLY HERE?",
  cargo:     "DEMAND SCORE — WHY SHIP HERE?",
  combo:     "DEMAND SCORE — WHY FLY & SHIP HERE?",
};

function getQuadrant(site, demand, evalMode = "passenger") {
  const hs = site >= 55, hd = demand >= 70;
  const desc = {
    passenger: {
      pp:"Strong infrastructure and high demand. Priority development candidate.",
      pn:"Good site fundamentals, limited demand. Suited for cargo-first or logistics.",
      np:"Strong destination appeal but site constraints limit operations. Find a nearby parcel.",
      nn:"Neither site fundamentals nor demand justify development at this time.",
    },
    cargo: {
      pp:"Prime cargo vertiport candidate. Strong logistics demand meets viable site.",
      pn:"Excellent infrastructure, developing logistics demand. Position early for cargo hub.",
      np:"High cargo demand but site constraints. Seek larger parcel or rooftop option.",
      nn:"Neither site fundamentals nor cargo demand justify development at this time.",
    },
    combo: {
      pp:"Prime mixed-use vertiport. Serves both cargo logistics and passenger demand.",
      pn:"Strong site, developing demand. Position early — cargo with passenger upside.",
      np:"Strong combined demand but site limits both cargo and passenger operations.",
      nn:"Low priority for cargo/passenger combo development at this time.",
    },
  }[evalMode] || {};
  if (hs && hd)  return { label:"PRIME SITE",          color:C.green,  desc:desc.pp };
  if (hs && !hd) return { label:"INFRASTRUCTURE PLAY", color:C.teal,   desc:desc.pn };
  if (!hs && hd) return { label:"DEMAND WITHOUT SITE", color:C.yellow, desc:desc.np };
  return                 { label:"LOW PRIORITY",        color:C.red,    desc:desc.nn };
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
  setFill("#5B9BD5");
  doc.rect(0, 0, W, 38, "F");
  setFill("#FFFFFF");
  doc.rect(0, 0, 4, 38, "F");

  setTxt("#FFFFFF");
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("VERTIPORT", col + 6, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica","normal");
  setTxt("#daeaf6");
  const modeLabel = results.evalMode === "cargo" ? "CARGO" : results.evalMode === "combo" ? "CARGO + PAX" : "PASSENGER";
  doc.text(`SITE EVALUATION SYSTEM  ·  ${modeLabel}  ·  FAA/NREL CALIBRATED  ·  TEXAS BETA`, col + 6, 20);

  setTxt("#daeaf6");
  doc.setFontSize(7.5);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}`, col + 6, 27);
  doc.text("Phase 1 — Texas  ·  Two-Axis Scoring Model", col + 6, 32);

  // ── Site name ──
  y = 46;
  setTxt("#222222");
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text(results.geocode.matched || "Site Analysis", col, y);
  y += 5;
  setTxt("#999999");
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
    const col_ = s.val >= 75 ? "#1a8a58" : s.val >= 45 ? "#c87a10" : "#C0392B";
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(bx, y, boxW, 28, 2, 2, "FD");
    setFill(col_);
    doc.rect(bx, y, 2.5, 28, "F");
    setTxt("#5B9BD5");
    doc.setFont("helvetica","bold");
    doc.setFontSize(6.5);
    doc.text(s.label, bx + 6, y + 7);
    setTxt(col_);
    doc.setFontSize(22);
    doc.setFont("helvetica","bold");
    doc.text(String(s.val), bx + 6, y + 20);
    setTxt("#999999");
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
  setTxt("#444444");
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.text(q.desc, col + 4, y + 11);

  // ── Development thesis ──
  if (results.development_thesis) {
    y += 19;
    setTxt("#5B9BD5");
    doc.setFont("helvetica","bold");
    doc.setFontSize(7.5);
    doc.text("▶  " + results.development_thesis, col, y, { maxWidth: W - margin*2 });
  }

  // ── Summary ──
  if (results.summary) {
    y += 9;
    setFill("#EAF4FC");
    const sumLines = doc.splitTextToSize(results.summary, W - margin*2 - 8);
    const sumH = sumLines.length * 4.5 + 8;
    doc.rect(col, y, W - margin*2, sumH, "F");
    setDraw("#5B9BD5");
    doc.line(col, y, col, y + sumH);
    doc.line(col + 3, y, col + 3, y + sumH);
    setTxt("#444444");
    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.text(sumLines, col + 7, y + 6);
    y += sumH + 4;
  }

  // ── Section header helper ──
  const sectionHeader = (title, yp) => {
    setFill("#EAF4FC");
    doc.rect(col, yp, W - margin*2, 8, "F");
    setFill("#5B9BD5");
    doc.rect(col, yp, 2, 8, "F");
    setTxt("#5B9BD5");
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
    { label:"Community DER Support",  wt:"5%",  score:results.nrel?.score??null, notes:results.nrel?.notes||"NREL API key not set", detail:results.nrel ? `${results.nrel.details?.["Utility"]||""} · GHI ${results.nrel.details?.["Solar GHI"]||"N/A"} · ${results.nrel.details?.["Comm. rate"]||""} · ${results.nrel.details?.["Net meter"]||""}` : "Pending activation" },
  ];

  siteCriteria.forEach((cr) => {
    const rowH = 13;
    const sc = cr.score;
    const cCol = sc === null ? "#9ab8d0" : sc >= 75 ? "#1a8a58" : sc >= 45 ? "#c87a10" : "#C0392B";
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#444444");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 5);
    setTxt("#999999");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`WT ${cr.wt}`, col + 5, y + 10);
    // score
    setTxt(cCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text(sc !== null ? String(sc) : "–", col + 60, y + 9);
    // bar
    const barX = col + 72, barW = 60, barH = 3;
    setFill("#e0eaf4");
    doc.rect(barX, y + 5, barW, barH, "F");
    if (sc !== null) {
      setFill(cCol);
      doc.rect(barX, y + 5, barW * sc / 100, barH, "F");
    }
    // detail
    setTxt("#666666");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    const detLines = doc.splitTextToSize(cr.detail || "", W - margin*2 - 140);
    doc.text(detLines, col + 136, y + 5);
    if (cr.notes) {
      setTxt("#999999");
      doc.setFontSize(6);
      const noteLines = doc.splitTextToSize(cr.notes, W - margin*2 - 140);
      doc.text(noteLines, col + 136, y + 9);
    }
    y += rowH + 2;
  });

  // ── Demand criteria ──
  const em = results.evalMode || "passenger";
  y += 3;
  y = sectionHeader(DEMAND_HEADER[em] || "DEMAND SCORE — WHY FLY HERE?", y);

  const demandCriteria = (DEMAND_CRITERIA[em] || DEMAND_CRITERIA.passenger).map(cr => ({
    label: cr.label, wt: cr.wt,
    score: results.demand?.[cr.key]?.score ?? null,
    notes: results.demand?.[cr.key]?.notes,
  }));

  demandCriteria.forEach((cr) => {
    const rowH = 13;
    const sc = cr.score || 0;
    const cCol = sc >= 75 ? "#1a8a58" : sc >= 45 ? "#c87a10" : "#C0392B";
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#444444");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 5);
    setTxt("#999999");
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`WT ${cr.wt}`, col + 5, y + 10);
    setTxt(cCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text(String(sc), col + 60, y + 9);
    const barX = col + 72, barW = 60, barH = 3;
    setFill("#e0eaf4");
    doc.rect(barX, y + 5, barW, barH, "F");
    setFill(cCol);
    doc.rect(barX, y + 5, barW * sc / 100, barH, "F");
    if (cr.notes) {
      setTxt("#666666");
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
      setFill("#FFF8E8"); setDraw("#e8c040");
      doc.rect(col, y, W - margin*2, fH, "FD");
      setTxt("#c87a10");
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.text(lines, col + 3, y + 4.5);
      y += fH + 1.5;
    });
  }

  // ── Flying Days ──
  const fly = results.flyingDays;
  if (fly) {
    y += 3;
    y = sectionHeader("ESTIMATED FLYING DAYS PER YEAR", y);
    // Summary row
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, 16, 2, 2, "FD");
    const flyCol = fly.flyingDays >= 300 ? "#1a8a58" : fly.flyingDays >= 275 ? "#2da06a" : fly.flyingDays >= 250 ? "#c87a10" : "#C0392B";
    setFill(flyCol);
    doc.rect(col, y, 2.5, 16, "F");
    setTxt(flyCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(16);
    doc.text(String(fly.flyingDays), col + 6, y + 11);
    setTxt("#444444");
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`days/yr  ·  ${fly.rating}  ·  ${Math.round((fly.flyingDays/365)*100)}% availability  ·  ${fly.noFlyDays} grounded`, col + 28, y + 7);
    setTxt("#666666");
    doc.setFontSize(6.5);
    const flyNotes = doc.splitTextToSize(fly.notes, W - margin*2 - 32);
    doc.text(flyNotes, col + 28, y + 12);
    y += 20;
    // Constraint mini-bars
    const constraints = Object.entries(fly.breakdown).filter(([k]) => k !== "overlap");
    const cLabels = { thunderstorm:"Thunderstorms", fog:"Fog/Low Vis", wind:"High Wind", precip:"Heavy Precip", heat:"Extreme Heat", icing:"Icing" };
    const bw = (W - margin*2 - (constraints.length-1)*2) / constraints.length;
    constraints.forEach(([key, days], i) => {
      const bx = col + i * (bw + 2);
      const cCol = days >= 30 ? "#C0392B" : days >= 15 ? "#c87a10" : "#1a8a58";
      setFill("#F9F9F9"); setDraw("#d0dce8");
      doc.roundedRect(bx, y, bw, 12, 1, 1, "FD");
      setTxt("#999999");
      doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
      doc.text(cLabels[key] || key, bx + 2, y + 4.5);
      setTxt(cCol);
      doc.setFont("helvetica","bold"); doc.setFontSize(8);
      doc.text(String(days), bx + 2, y + 10);
    });
    y += 16;
  }

  // ── Strengths / Concerns ──
  const strengths = results.top_strengths || [];
  const concerns = (results.top_concerns || []).filter(Boolean);
  if (strengths.length || concerns.length) {
    y += 3;
    setFill("#F9F9F9");
    doc.rect(col, y, W - margin*2, (strengths.length + concerns.length) * 6 + 8, "F");
    strengths.forEach((s) => {
      setTxt("#1a8a58"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
      doc.text("✓  " + s, col + 4, y + 7);
      y += 6;
    });
    concerns.forEach((s) => {
      setTxt("#c87a10"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
      doc.text("⚑  " + s, col + 4, y + 7);
      y += 6;
    });
    y += 6;
  }

  // ── Regulatory Checklist (page 2) ──
  const regItems = results.regulatory || [];
  if (regItems.length > 0) {
    doc.addPage();
    y = 0;
    // Page 2 header
    setFill("#5B9BD5");
    doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF");
    doc.rect(0, 0, 4, 22, "F");
    setTxt("#FFFFFF");
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("REGULATORY CHECKLIST", col + 6, 10);
    setTxt("#daeaf6");
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`${results.geocode.matched || "Site"} · ${regItems.length} items · ${regItems.filter(r=>r.status==="required").length} required · ${regItems.filter(r=>r.urgency==="critical").length} critical`, col + 6, 17);
    y = 28;

    const statusCol = { required:"#C0392B", likely_required:"#c87a10", conditional:"#20c0b0", recommended:"#999999" };
    const statusLbl = { required:"REQ", likely_required:"LIKELY", conditional:"COND", recommended:"REC" };
    const urgCol = { critical:"#C0392B", high:"#c87a10", medium:"#5B9BD5", low:"#4a9a8e" };

    // Group by category
    const grouped = {};
    for (const item of regItems) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    const catNames = { FAA:"FAA / Federal Aviation", ENV:"Environmental", STATE:"State of Texas", LOCAL:"Local / Municipal", UTIL:"Utility & Infrastructure", OPS:"Operational Readiness" };

    for (const [cat, items] of Object.entries(grouped)) {
      // Check page space
      if (y > 260) { doc.addPage(); y = 15; }
      // Category header
      setFill("#EAF4FC");
      doc.rect(col, y, W - margin*2, 7, "F");
      setFill("#5B9BD5");
      doc.rect(col, y, 2, 7, "F");
      setTxt("#5B9BD5");
      doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
      doc.text(catNames[cat] || cat, col + 5, y + 5);
      y += 9;

      for (const item of items) {
        if (y > 272) { doc.addPage(); y = 15; }
        const sc = statusCol[item.status] || "#5B9BD5";
        const uc = urgCol[item.urgency] || "#5B9BD5";
        // Row
        const noteLines = doc.splitTextToSize(item.notes, W - margin*2 - 10);
        const rowH = 10 + noteLines.length * 3.5;
        setFill("#FFFFFF"); setDraw("#d0dce8");
        doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
        setFill(sc);
        doc.rect(col, y, 2, rowH, "F");
        // Title
        setTxt("#222222");
        doc.setFont("helvetica","bold"); doc.setFontSize(7);
        doc.text(item.title, col + 5, y + 5);
        // Status + urgency badges
        setTxt(sc);
        doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
        doc.text(statusLbl[item.status] || "", colR - 30, y + 5);
        setTxt(uc);
        doc.text((item.urgency || "").toUpperCase(), colR - 14, y + 5);
        // Citation
        setTxt("#999999");
        doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
        doc.text(item.citation || "", col + 5, y + 9);
        // Notes
        setTxt("#444444");
        doc.setFontSize(6);
        doc.text(noteLines, col + 5, y + 13);
        y += rowH + 2;
      }
      y += 3;
    }
  }

  // ── Investment / Viability (new page) ──
  const inv = results.investment;
  if (inv) {
    doc.addPage();
    y = 0;
    // Header
    setFill("#5B9BD5");
    doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF");
    doc.rect(0, 0, 4, 22, "F");
    setTxt("#FFFFFF");
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("INVESTMENT / VIABILITY SUMMARY", col + 6, 10);
    setTxt("#daeaf6");
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`${results.geocode.matched || "Site"} · ${inv.scenarioLabel} · Grade ${inv.grade.grade}`, col + 6, 17);
    y = 28;

    // Grade + key metrics row
    const gCol = inv.grade.gradeColor;
    // Grade circle
    setDraw(gCol); doc.setLineWidth(1);
    doc.circle(col + 15, y + 12, 12, "D");
    setTxt(gCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(20);
    doc.text(inv.grade.grade, col + 15, y + 15, { align:"center" });
    doc.setFontSize(6);
    doc.text(`${inv.grade.score}/100`, col + 15, y + 20, { align:"center" });
    // Grade label
    setTxt(gCol);
    doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text(inv.grade.gradeLabel, col + 32, y + 6);
    setTxt("#666666");
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`Scenario: ${inv.scenarioLabel}`, col + 32, y + 12);

    // Key metrics
    const fmtPdf = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n}`;
    const metricsX = col + 100;
    const metrics = [
      { l:"CAPEX", v:fmtPdf(inv.capex.mid) },
      { l:"OPEX/yr", v:fmtPdf(inv.opex.mid) },
      { l:"Payback", v:inv.paybackYears ? `${inv.paybackYears}yr` : "N/A" },
      { l:"10yr NPV", v:(inv.npv>=0?"+":"-")+fmtPdf(Math.abs(inv.npv)) },
    ];
    metrics.forEach((m,i) => {
      const mx = metricsX + i * 22;
      setTxt("#999999");
      doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
      doc.text(m.l, mx, y + 6);
      setTxt("#222222");
      doc.setFont("helvetica","bold"); doc.setFontSize(8);
      doc.text(m.v, mx, y + 12);
    });
    y += 28;

    // CAPEX breakdown
    y = sectionHeader("CAPITAL EXPENDITURE BREAKDOWN", y);
    inv.capex.breakdown.forEach((item) => {
      setFill("#FFFFFF"); setDraw("#d0dce8");
      doc.roundedRect(col, y, W - margin*2, 8, 1, 1, "FD");
      setTxt("#444444");
      doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
      doc.text(item.label, col + 4, y + 5.5);
      setTxt("#222222");
      doc.setFont("helvetica","bold"); doc.setFontSize(7);
      doc.text(fmtPdf(item.mid), col + 80, y + 5.5);
      setTxt("#999999");
      doc.setFont("helvetica","normal"); doc.setFontSize(6);
      doc.text(`${fmtPdf(item.low)} – ${fmtPdf(item.high)}`, col + 110, y + 5.5);
      y += 9.5;
    });
    y += 4;

    // Revenue projections
    y = sectionHeader("REVENUE & MOVEMENTS", y);
    setFill("#F9F9F9"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, 18, 1, 1, "FD");
    const revItems = [
      { l:"Year 1", v:fmtPdf(inv.revenue.yr1), m:`${(inv.movements.yr1/1000).toFixed(1)}K mov` },
      { l:"Year 3", v:fmtPdf(inv.revenue.yr3), m:`${(inv.movements.yr3/1000).toFixed(1)}K mov` },
      { l:"Year 5", v:fmtPdf(inv.revenue.yr5), m:`${(inv.movements.yr5/1000).toFixed(1)}K mov` },
      { l:"Steady State", v:`${inv.movements.perDay} mov/day`, m:`${(inv.movements.steadyState/1000).toFixed(1)}K/yr` },
    ];
    revItems.forEach((r,i) => {
      const rx = col + 4 + i * 43;
      setTxt("#999999");
      doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
      doc.text(r.l, rx, y + 5);
      setTxt("#222222");
      doc.setFont("helvetica","bold"); doc.setFontSize(8);
      doc.text(r.v, rx, y + 10.5);
      setTxt("#666666");
      doc.setFont("helvetica","normal"); doc.setFontSize(6);
      doc.text(r.m, rx, y + 15);
    });
    y += 22;

    // Risk summary
    y = sectionHeader("RISK ASSESSMENT", y);
    const riskW = (W - margin*2 - (inv.risks.length-1)*2) / inv.risks.length;
    inv.risks.forEach((r,i) => {
      const rx = col + i * (riskW + 2);
      const rc = r.score >= 65 ? "#C0392B" : r.score >= 40 ? "#c87a10" : "#1a8a58";
      setFill("#FFFFFF"); setDraw("#d0dce8");
      doc.roundedRect(rx, y, riskW, 14, 1, 1, "FD");
      setFill(rc);
      doc.rect(rx, y, 2, 14, "F");
      setTxt("#999999");
      doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
      doc.text(r.category, rx + 4, y + 5);
      setTxt(rc);
      doc.setFont("helvetica","bold"); doc.setFontSize(7);
      doc.text(r.label, rx + 4, y + 11);
    });
    y += 18;

    // Timeline
    y = sectionHeader(`DEVELOPMENT TIMELINE — ${inv.timeline.totalMonths} MONTHS`, y);
    const tlW = W - margin*2;
    const totalMo = inv.timeline.totalMonths;
    const tlColors = ["#5B9BD5","#f0a030","#1a8a58","#4a9a8e"];
    // Bar
    let tlX = col;
    inv.timeline.phases.forEach((p,i) => {
      const pw = (p.months / totalMo) * tlW;
      setFill(tlColors[i%4]);
      doc.rect(tlX, y, pw, 5, "F");
      tlX += pw;
    });
    y += 7;
    // Labels
    inv.timeline.phases.forEach((p,i) => {
      setTxt(tlColors[i%4]);
      doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
      doc.text(`${p.name} (${p.months}mo)`, col + i * 43, y + 4);
    });
    y += 10;

    // Disclaimer
    setTxt("#999999");
    doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
    doc.text("Model estimates based on industry benchmarks (NEXA, McKinsey). Not financial advice. NPV at 8% discount rate.", col, y + 3);
  }

  // ── Footer ──
  const pageH = doc.internal.pageSize.height;
  setFill("#EAF4FC");
  doc.rect(0, pageH - 16, W, 16, "F");
  setTxt("#666666");
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  doc.text("Data sources: FAA · NREL · FEMA NFHL · USGS 3DEP · EIA · NOAA Climate Normals · OpenStreetMap · Census Bureau", col, pageH - 9);
  doc.text("Scores are estimates based on publicly available data. All site assessments require independent verification before investment decisions.", col, pageH - 5);
  setTxt("#5B9BD5");
  doc.text("VERTIPORT EVALUATION SYSTEM  ·  BETA", colR, pageH - 7, { align:"right" });

  // ── Mode Comparison Page ──
  const allModes = results.modes;
  if (allModes) {
    doc.addPage();
    y = 0;
    setFill("#5B9BD5"); doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF"); doc.rect(0, 0, 4, 22, "F");
    setTxt("#FFFFFF"); doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text("MODE COMPARISON", col + 6, 10);
    setTxt("#daeaf6"); doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text("PASSENGER  ·  CARGO  ·  CARGO + PAX — same site, three demand lenses", col + 6, 17);

    y = 30;
    const siteS = results.site?.composite || 0;
    const colW = (W - margin * 2 - 10) / 3;
    const modeDefs = [
      { id:"passenger", label:"PASSENGER", color:"#5B9BD5" },
      { id:"cargo",     label:"CARGO",     color:"#4a9a8e" },
      { id:"combo",     label:"CARGO+PAX", color:"#7b7bd5" },
    ];

    modeDefs.forEach((md, i) => {
      const mx = col + i * (colW + 5);
      const mData = allModes[md.id] || {};
      const dScore = mData.demand?.composite || 0;
      const mPI = priorityIndex(siteS, dScore);
      const mq = getQuadrant(siteS, dScore, md.id);
      const inv = mData.investment;
      const grade = inv?.grade?.grade || "–";
      const capex = inv?.capex?.mid ? `$${(inv.capex.mid/1e6).toFixed(1)}M` : "–";
      const npv = inv?.npv?.mid !== undefined ? `$${(inv.npv.mid/1e6).toFixed(1)}M` : "–";
      let cy = y;

      // Column header
      setFill(md.color); doc.rect(mx, cy, colW, 11, "F");
      setTxt("#FFFFFF"); doc.setFont("helvetica","bold"); doc.setFontSize(8);
      doc.text(md.label, mx + colW / 2, cy + 7.5, { align:"center" });
      cy += 14;

      // Demand + PI score boxes side-by-side
      const halfW = (colW - 3) / 2;
      const dCol = dScore >= 75 ? "#1a8a58" : dScore >= 45 ? "#c87a10" : "#C0392B";
      const piCol = mPI >= 75 ? "#1a8a58" : mPI >= 45 ? "#c87a10" : "#C0392B";
      setFill("#EAF4FC"); setDraw("#d0dce8"); doc.roundedRect(mx, cy, halfW, 22, 1, 1, "FD");
      setTxt("#5B9BD5"); doc.setFontSize(5.5); doc.setFont("helvetica","normal");
      doc.text("DEMAND", mx + halfW / 2, cy + 5, { align:"center" });
      setTxt(dCol); doc.setFontSize(18); doc.setFont("helvetica","bold");
      doc.text(String(dScore), mx + halfW / 2, cy + 17, { align:"center" });
      const piX = mx + halfW + 3;
      setFill("#EAF4FC"); setDraw("#d0dce8"); doc.roundedRect(piX, cy, halfW, 22, 1, 1, "FD");
      setTxt("#5B9BD5"); doc.setFontSize(5.5); doc.setFont("helvetica","normal");
      doc.text("PRIORITY", piX + halfW / 2, cy + 5, { align:"center" });
      setTxt(piCol); doc.setFontSize(18); doc.setFont("helvetica","bold");
      doc.text(String(mPI), piX + halfW / 2, cy + 17, { align:"center" });
      cy += 25;

      // Quadrant badge
      setFill(mq.color + "22"); setDraw(mq.color + "55");
      doc.roundedRect(mx, cy, colW, 8, 1, 1, "FD");
      setTxt(mq.color); doc.setFont("helvetica","bold"); doc.setFontSize(6);
      doc.text(mq.label, mx + colW / 2, cy + 5.5, { align:"center" });
      cy += 11;

      // Investment summary row
      const gradeCol = grade === "A" ? "#1a8a58" : grade === "B" ? "#2da06a" : grade === "C" ? "#c87a10" : "#C0392B";
      setFill("#FFFFFF"); setDraw("#d0dce8"); doc.roundedRect(mx, cy, colW, 16, 1, 1, "FD");
      setFill(gradeCol); doc.rect(mx, cy, 2, 16, "F");
      setTxt(gradeCol); doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text(grade, mx + 6, cy + 11);
      setTxt("#5B9BD5"); doc.setFontSize(5); doc.setFont("helvetica","normal");
      doc.text("GRADE", mx + 6, cy + 14.5);
      setTxt("#444444"); doc.setFontSize(6); doc.setFont("helvetica","bold");
      doc.text("CAPEX", mx + 22, cy + 6);
      setTxt("#444444"); doc.setFont("helvetica","normal"); doc.setFontSize(7);
      doc.text(capex, mx + 22, cy + 12);
      setTxt("#444444"); doc.setFontSize(6); doc.setFont("helvetica","bold");
      doc.text("10yr NPV", mx + 40, cy + 6);
      const npvNum = parseFloat(npv);
      setTxt(!isNaN(npvNum) && npvNum < 0 ? "#C0392B" : "#1a8a58");
      doc.setFont("helvetica","normal"); doc.setFontSize(7);
      doc.text(npv, mx + 40, cy + 12);
      cy += 19;

      // Demand criteria mini bars
      const demCrit = DEMAND_CRITERIA[md.id] || [];
      demCrit.forEach(cr => {
        const sc = mData.demand?.[cr.key]?.score || 0;
        const cCol2 = sc >= 75 ? "#1a8a58" : sc >= 45 ? "#c87a10" : "#C0392B";
        setTxt("#444444"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
        const lbl = cr.label.length > 20 ? cr.label.slice(0, 19) + "…" : cr.label;
        doc.text(lbl, mx, cy + 3.5);
        setTxt(cCol2); doc.setFont("helvetica","bold"); doc.setFontSize(6);
        doc.text(String(sc), mx + colW - 7, cy + 3.5);
        setFill("#e0eaf4"); doc.rect(mx, cy + 5, colW - 10, 2, "F");
        setFill(cCol2); doc.rect(mx, cy + 5, (colW - 10) * sc / 100, 2, "F");
        cy += 9;
      });

      // Development thesis (3 lines max)
      if (mData.development_thesis) {
        cy += 3;
        setFill("#EAF4FC"); doc.rect(mx, cy, colW, 1, "F"); // divider
        cy += 4;
        setTxt("#5B9BD5"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
        const thLines = doc.splitTextToSize("▶ " + mData.development_thesis, colW);
        doc.text(thLines.slice(0, 4), mx, cy);
      }
    });
  }

  // ── Save ──
  const filename = `vertiport-report-${(results.geocode.matched||"site").split(",")[0].replace(/\s+/g,"-").toLowerCase()}.pdf`;
  doc.save(filename);
}

// ── Prompt builder ────────────────────────────────────────────
function buildPrompt(input, inputMode, evalMode = "passenger") {
  const locationDesc = inputMode === "coords"
    ? `GPS Coordinates: ${input.lat}, ${input.lon} (Texas)${input.label ? ` — Site: ${input.label}` : ""}`
    : `Address: "${input.address}"`;
  const coordNote = inputMode === "coords"
    ? `IMPORTANT: Evaluate what is actually at these coordinates. For parks or open land score parcel based on actual site area not adjacent residential lot.` : ``;

  const siteCriteria = `SITE CRITERIA:
PARCEL (25%): >10ac=90-100, 5-10=80-90, 2-5=60-75, 0.5-2=25-45, <0.5=5-20. Flag <1.5ac.
AIRSPACE (25%): Rural no airport=90-100. Humble/Will Clayton Class G IAH 18km=72-82. Suburban GA 10-20km=70-85. Heliport nearby=50-65. SW Houston near HOU 5-6km=32-42. Galleria Class B=18-28. IAH Class B=10-22.
ZONING (15%): Industrial/logistics=88-100. Business park=65-80. Public park/greenspace=55-70. Mixed commercial=45-62. Galleria/luxury retail=22-35. Residential=8-22.
SOIL (10%): Zone X=85-98. Stormwater detention=35-50. Zone AE=18-35. Humble Zone X=82-92.
SITE_COMPOSITE = parcel*0.25 + airspace*0.25 + zoning*0.15 + soil*0.10. Max=75.`;

  const demandSections = {
    passenger: `DEMAND CRITERIA:
EMPLOYMENT (30%): CBD/Energy Corridor/major hub=80-100. Business park=55-75. Mixed=30-50. Residential/park=5-25.
DESTINATIONS (25%): Stadium/arena/convention=85-100. Major international/hub airport (IAH/HOU/DAL/DFW)=80-95. Regional/commercial airport=65-80. General aviation airport=45-62. Outdoor venue/major park/museum=55-75. Willow Waterhole with music venue=58-70. Industrial=5-20.
MEDICAL (20%): Texas Medical Center=90-100. Regional hospital=60-80. Clinic=25-45. None=5-20.
CARGO (15%): Port/major hub=85-100. Industrial corridor=60-80. Humble/Will Clayton logistics=75-90. Residential/park=5-20.
TRANSIT_GAP (10%): Remote/car-dependent=70-90. Suburban limited transit=50-70. Near Metro rail=10-30.
DEMAND_COMPOSITE = employment*0.30 + destinations*0.25 + medical*0.20 + cargo*0.15 + transit_gap*0.10.`,

    cargo: `DEMAND CRITERIA (CARGO OPERATIONS):
LOGISTICS_HUB (30%): Major fulfillment/distribution center adjacent=85-100. Industrial/logistics park=65-82. Near freight corridor=45-65. Commercial=25-45. Residential=5-20.
LAST_MILE (25%): Dense urban delivery demand (pop >50K in 5nm)=80-100. Suburban e-commerce density=55-75. Mixed delivery zone=35-55. Low density=10-30.
CARGO_NETWORK (20%): Adjacent to major freight airport or port=85-100. Near intermodal terminal=65-80. Near major highway interchange=50-65. Suburban access=35-50. No freight infra=10-25.
PRIORITY_FREIGHT (15%): On medical/pharma supply route (TMC area)=80-100. Cold chain/perishables hub=65-80. High-value cargo corridor=50-65. General freight=25-45. None=5-20.
GROUND_ACCESS (10%): Direct truck dock + highway ramp=80-100. Good road network=55-75. Limited heavy vehicle access=30-50. Poor=5-25.
DEMAND_COMPOSITE = logistics_hub*0.30 + last_mile*0.25 + cargo_network*0.20 + priority_freight*0.15 + ground_access*0.10.`,

    combo: `DEMAND CRITERIA (CARGO + PASSENGER COMBO):
LOGISTICS_HUB (25%): Logistics/fulfillment infrastructure — score same scale as cargo mode.
EMPLOYMENT (25%): Employment density AND major passenger destinations combined. Business districts with logistics workers=80-100. Suburban commercial=45-70. Residential=10-30.
CARGO_NETWORK (20%): Freight network value AND transit connectivity. Airport/port adjacent=85-100. Good highway + transit=55-75. Car-dependent=25-50.
PRIORITY_FREIGHT (15%): Medical supply routes AND hospital/institutional passenger demand combined. TMC area=85-100. Regional hospital + freight=55-75. Neither=10-30.
LAST_MILE (15%): Last-mile delivery demand AND transit gap for passengers combined. Dense urban=80-100. Suburban=45-65. Rural=10-30.
DEMAND_COMPOSITE = logistics_hub*0.25 + employment*0.25 + cargo_network*0.20 + priority_freight*0.15 + last_mile*0.15.`,
  };

  const benchmarks = {
    passenger: `BENCHMARKS: Will Clayton: site 68-82, demand 45-60. Galleria: site 28-42, demand 62-78. TMC: site 35-55, demand 85-95. IAH airport area: site 35-55, demand 78-90. Residential: site 15-28, demand 15-30.`,
    cargo:     `BENCHMARKS (cargo): Will Clayton logistics park: site 68-82, demand 70-85. IAH cargo area: site 55-70, demand 75-90. Port Houston area: site 55-72, demand 80-92. TMC (medical supply): site 35-55, demand 72-85.`,
    combo:     `BENCHMARKS (combo): Will Clayton: site 68-82, demand 60-75. Galleria area: site 28-42, demand 52-68. TMC: site 35-55, demand 78-90.`,
  };

  const demandSchemas = {
    passenger: `"demand":{"composite":0,"employment":{"score":0,"notes":"short note"},"destinations":{"score":0,"notes":"short note"},"medical":{"score":0,"notes":"short note"},"cargo":{"score":0,"notes":"short note"},"transit_gap":{"score":0,"notes":"short note"}}`,
    cargo:     `"demand":{"composite":0,"logistics_hub":{"score":0,"notes":"short note"},"last_mile":{"score":0,"notes":"short note"},"cargo_network":{"score":0,"notes":"short note"},"priority_freight":{"score":0,"notes":"short note"},"ground_access":{"score":0,"notes":"short note"}}`,
    combo:     `"demand":{"composite":0,"logistics_hub":{"score":0,"notes":"short note"},"employment":{"score":0,"notes":"short note"},"cargo_network":{"score":0,"notes":"short note"},"priority_freight":{"score":0,"notes":"short note"},"last_mile":{"score":0,"notes":"short note"}}`,
  };

  const em = evalMode in demandSchemas ? evalMode : "passenger";

  return `You are a vertiport site feasibility scoring engine. Evaluation mode: ${em.toUpperCase()}. Score two axes: SITE (can infrastructure be built here?) and DEMAND.

Location: ${locationDesc}
${coordNote}

${siteCriteria}

${demandSections[em]}

${benchmarks[em]}

Return ONLY valid JSON, keep ALL string values under 80 chars:
{"geocode":{"matched":"location name","lat":29.76,"lon":-95.37,"valid":true},"site":{"composite":0,"parcel":{"score":0,"acreage_estimate":0.0,"land_type":"type","notes":"short note","flags":["flag"]},"airspace":{"score":0,"status":"class","laanc_required":false,"nearest_airport":"name dist","notes":"short note","flags":[]},"zoning":{"score":0,"compliance":"Good","land_use":"type","notes":"short note","flags":[]},"soil":{"score":0,"flood_zone":"Zone X","slope_estimate":"<1%","elevation_ft":50,"notes":"short note","flags":[]}},${demandSchemas[em]},"summary":"2 sentences max","development_thesis":"one sentence best use case","top_strengths":["strength 1","strength 2"],"top_concerns":["concern 1"]}

If outside Texas set geocode.valid=false and all scores to 0.`;
}

async function analyzeWithClaude(input, inputMode, evalMode = "passenger") {
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
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:2000, messages:[{role:"user",content:buildPrompt(input,inputMode,evalMode)}] }),
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
// Scoring components (max 100):
//   Solar resource quality  (GHI)           0–30 pts
//   Utility type / grid access              0–30 pts
//   Commercial electricity rate             0–25 pts  (charging economics)
//   Net metering availability               0–15 pts
async function fetchNRELDERScore(lat, lon) {
  const apiKey = import.meta.env.VITE_NREL_API_KEY;
  if (!apiKey) throw new Error("VITE_NREL_API_KEY not set");

  // Fetch both; treat each independently so a single failure doesn't zero the score
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

  // ── Utility data ──────────────────────────────────────────────
  const utilityName  = uOut?.utility_name  || "Unknown";
  const commercialRate = typeof uOut?.commercial === "number" ? uOut.commercial : null; // $/kWh
  const netMetering  = uOut?.net_metering  ?? null; // boolean or null if unknown
  const u = utilityName.toLowerCase();
  const isMajorTXUtil = u.includes("centerpoint") || u.includes("oncor") ||
                        u.includes("tnmp") || u.includes("aep texas") ||
                        u.includes("aep central") || u.includes("aep north") ||
                        u.includes("texas new mexico");

  // ── Solar data ────────────────────────────────────────────────
  const ghi = sOut?.avg_ghi?.annual || 0;  // kWh/m²/day
  const dni = sOut?.avg_dni?.annual || 0;  // direct normal irradiance

  // ── Score: Solar resource (0–30) ─────────────────────────────
  const solarPts = ghi >= 5.5 ? 30 : ghi >= 5.0 ? 22 : ghi >= 4.5 ? 15 : ghi >= 4.0 ? 8 : solarLive ? 4 : 12; // 12 = TX baseline if API unavailable

  // ── Score: Utility type (0–30) ────────────────────────────────
  const utilityPts = !utilityLive ? 20  // TX ERCOT baseline if API unavailable
    : isMajorTXUtil ? 30
    : u.includes("unknown") ? 15
    : 20; // other known utility

  // ── Score: Commercial rate (0–25) — lower = better for charging economics ──
  const ratePts = commercialRate === null ? 12  // TX average baseline
    : commercialRate < 0.07 ? 25
    : commercialRate < 0.09 ? 18
    : commercialRate < 0.11 ? 12
    : commercialRate < 0.13 ? 6
    : 0;

  // ── Score: Net metering (0–15) ────────────────────────────────
  const nmPts = netMetering === true ? 15 : netMetering === false ? 5 : 8; // 8 = unknown/baseline

  const score = Math.min(100, Math.max(0, Math.round(solarPts + utilityPts + ratePts + nmPts)));

  // ── Details for UI card and PDF ──────────────────────────────
  const rateStr   = commercialRate !== null ? `$${commercialRate.toFixed(3)}/kWh commercial` : "Rate N/A";
  const nmStr     = netMetering === true ? "Net metering: yes" : netMetering === false ? "Net metering: no" : "Net metering: unknown";
  const ghiStr    = ghi   ? `${ghi.toFixed(2)} kWh/m²/day` : "N/A";
  const dniStr    = dni   ? `${dni.toFixed(2)} kWh/m²/day` : "N/A";
  const sourceTag = (!utilityLive && !solarLive) ? " (TX baseline — NREL unavailable)" : (!utilityLive || !solarLive) ? " (partial live data)" : "";

  const notes = score >= 75
    ? `High solar resource, strong utility DER programs. ${rateStr}. ${nmStr}.`
    : score >= 55
    ? `Solid DER environment. ${rateStr}. ${nmStr}. Verify interconnection queue with ${utilityName}.`
    : `Standard DER support${sourceTag}. TX deregulated market provides interconnection pathways. ${rateStr}.`;

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
    _meta: { utilityLive, solarLive, solarPts, utilityPts, ratePts, nmPts },
  };
}

// ── Harris County parcel score (HCAD ArcGIS public REST API) ──
// Coverage: Harris County, TX only. Falls through gracefully elsewhere.
// Scoring thresholds mirror the LLM prompt so live data is consistent:
//   >10 ac → 95  |  5-10 ac → 85  |  2-5 ac → 67  |  1.5-2 ac → 40
//   0.5-1.5 ac → 30  |  <0.5 ac → 12
async function fetchHarrisParcelScore(lat, lon) {
  // Query with 100m buffer — single-point queries often land on road easements
  // or tiny sub-lots within a larger complex. Take the largest parcel in range.
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

  // Pick the largest parcel within the buffer
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

// ── FEMA NFHL + USGS 3DEP flood & elevation score ─────────────
// FEMA NFHL layer 28 = Flood Hazard Zones (S_FLD_HAZ_AR), nationwide
// USGS 3DEP EPQS = point elevation in feet, nationwide
// Scoring mirrors LLM prompt thresholds:
//   Zone X (minimal)  → 90  |  Zone X (500-yr)  → 72  |  Zone X (levee) → 60
//   Zone AE/A (SFHA)  → 25  |  Zone VE (coastal) → 15  |  Unknown → 65
async function fetchFEMAFloodScore(lat, lon) {
  const [femaSettled, usgsSettled] = await Promise.allSettled([
    // FEMA NFHL — flood hazard zone polygon query
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
    // USGS 3DEP — point elevation in feet
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

  const fema = femaSettled.status === "fulfilled" ? femaSettled.value : null;
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

  const elevStr = elevFt !== null ? `${Math.round(elevFt)} ft` : null;
  const sourceTag = fema ? "(FEMA NFHL live)" : "(FEMA unavailable — estimate)";

  const notes = score >= 80
    ? `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Low flood risk.`
    : score >= 55
    ? `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Verify site drainage.`
    : `${zoneLabel} ${sourceTag}.${elevStr ? ` Elevation ${elevStr}.` : ""} Fill permit and LOMA likely required.`;

  return {
    score,
    flood_zone: zoneLabel,
    slope_estimate: "< 2% (TX flat terrain)",
    elevation_ft: elevFt !== null ? Math.round(elevFt) : null,
    notes,
    flags,
    _source: { fema: !!fema, usgs: elevFt !== null },
  };
}

// ── OSM/Overpass zoning score ─────────────────────────────────
// Queries landuse polygons within 100m and buildings within 50m.
// Takes the most common landuse tag; falls back to building type.
// Throws on no data — LLM estimate used as fallback.
async function fetchZoningScore(lat, lon) {
  // Run is_in (exact containment) and around:100m in parallel.
  // is_in is authoritative when OSM has a landuse polygon; around catches gaps.
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

  const isInElements  = isInSettled.status  === "fulfilled" ? (isInSettled.value.elements  || []) : [];
  const aroundElements = aroundSettled.status === "fulfilled" ? (aroundSettled.value.elements || []) : [];

  // Prefer is_in landuse/aeroway; fall back to around
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

  // Collect tags; most common wins
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

// ── FAA Airspace scoring (static TX_AIRSPACE data + Haversine) ─
// No live API — uses the same airport dataset as the map overlay.
// Circular tier model is a simplification; real Class B has irregular legs.
// Primary signal: whether the site is inside a SFC-floor tier.
// For eVTOL ops (below ~1000ft AGL), outer tiers with elevated floors are
// permissive at surface level but require authorization above the floor.
//
// Scoring calibrated against validated TX benchmarks:
//   Class B SFC → 15  |  Class B outer (2000ft floor) → 45
//   Class B outer (3000ft+) → 60  |  Class C SFC → 42  |  Class C outer → 65
//   Class D → 65  |  Class G <10nm → 78  |  Class G 10-20nm → 83
//   Class G 20-40nm → 90  |  Class G >40nm → 95
function scoreAirspace(lat, lon) {
  // Haversine in nautical miles
  function distNM(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let tightest = null;  // { ap, tier, dist, score }
  let nearest  = null;  // closest airport regardless of airspace
  let nearestDist = Infinity;

  for (const ap of TX_AIRSPACE) {
    const dist = distNM(lat, lon, ap.lat, ap.lon);
    if (dist < nearestDist) { nearestDist = dist; nearest = ap; }

    // Check tiers innermost-first; stop at first enclosing tier
    for (const tier of ap.tiers) {
      // Class B SFC radius shrunk to 4nm: real boundary has northeast cutouts
      // and LLM geocoding can place addresses ~1nm closer than Census truth.
      const effectiveRadius = (ap.class === "B" && tier.floor === "SFC") ? 4 : tier.radius_nm;
      if (dist <= effectiveRadius) {
        const isSFC = tier.floor === "SFC";
        let tierScore;
        if      (ap.class === "B" && isSFC)              tierScore = 15;
        else if (ap.class === "B" && tier.floor <= 2000) tierScore = 45;
        else if (ap.class === "B")                    tierScore = 60;
        else if (ap.class === "C" && isSFC)           tierScore = 42;
        else if (ap.class === "C")                    tierScore = 65;
        else                                          tierScore = 65; // Class D
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

  // Class G — score by distance to nearest airport
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

// ── Quadrant Plot ─────────────────────────────────────────────
function QuadrantPlot({ site, demand, previousSite, previousDemand }) {
  const W=224,H=224,pad=30,plotW=W-pad*2,plotH=H-pad*2;
  const toX=v=>pad+(v/100)*plotW, toY=v=>pad+(1-v/100)*plotH;
  const q=getQuadrant(site,demand);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.15em"}}>SITE vs DEMAND MATRIX</div>
      <svg width={W} height={H}>
        <rect x={pad} y={pad} width={plotW/2} height={plotH/2} fill="rgba(200,122,16,0.07)"/>
        <rect x={pad+plotW/2} y={pad} width={plotW/2} height={plotH/2} fill="rgba(26,138,88,0.08)"/>
        <rect x={pad} y={pad+plotH/2} width={plotW/2} height={plotH/2} fill="rgba(192,57,43,0.06)"/>
        <rect x={pad+plotW/2} y={pad+plotH/2} width={plotW/2} height={plotH/2} fill="rgba(74,154,142,0.07)"/>
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
        {previousSite!=null&&previousDemand!=null&&(()=>{
          const px=toX(previousSite),py=toY(previousDemand);
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

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CONSTRAINT_ICONS = { thunderstorm:"⛈", fog:"🌫", wind:"💨", precip:"🌧", heat:"🌡", icing:"❄" };
const CONSTRAINT_LABELS = { thunderstorm:"Thunderstorms", fog:"Low Visibility / Fog", wind:"High Wind (>30 kt)", precip:"Heavy Precipitation", heat:"Extreme Heat / DA", icing:"Winter Icing" };

function FlyingDaysPanel({ data }) {
  if (!data) return null;
  const { flyingDays, noFlyDays, breakdown, rating, ratingColor, notes, monthly } = data;
  const pct = Math.round((flyingDays / 365) * 100);

  // Bar chart max for monthly view
  const maxFly = Math.max(...monthly.map(m => m.flyDays), 1);

  return (
    <div style={{marginBottom:20}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>ESTIMATED FLYING DAYS PER YEAR</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 22px"}}>

        {/* Top row: big number + rating + donut-style ring */}
        <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:18,flexWrap:"wrap"}}>
          {/* Ring gauge */}
          <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={C.border} strokeWidth="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke={ratingColor} strokeWidth="8"
                strokeDasharray={`${(pct / 100) * 264} 264`}
                strokeLinecap="round" transform="rotate(-90 50 50)"
                style={{transition:"stroke-dasharray 1.2s ease",filter:`drop-shadow(0 0 4px ${ratingColor}66)`}}/>
            </svg>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:24,fontWeight:700,color:ratingColor,lineHeight:1}}>{flyingDays}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel,marginTop:2}}>DAYS/YR</div>
            </div>
          </div>

          {/* Rating + stats */}
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,color:ratingColor,letterSpacing:"0.15em",border:`1px solid ${ratingColor}44`,background:`${ratingColor}12`,padding:"4px 12px",borderRadius:4}}>{rating}</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel}}>{pct}% operational availability</span>
            </div>
            <div style={{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>FLYABLE</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700,color:C.green}}>{flyingDays}</div>
              </div>
              <div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>GROUNDED</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700,color:C.red}}>{noFlyDays}</div>
              </div>
              <div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>OVERLAP CREDIT</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700,color:C.teal}}>-{breakdown.overlap}</div>
              </div>
            </div>
            <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,lineHeight:1.55}}>{notes}</div>
          </div>
        </div>

        {/* Constraint breakdown */}
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.15em",marginBottom:8}}>GROUNDING CONSTRAINTS (DAYS/YR · BEFORE OVERLAP)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
          {Object.entries(breakdown).filter(([k]) => k !== "overlap").map(([key, days]) => {
            const barPct = Math.min(100, (days / 90) * 100);
            const isHigh = key === "thunderstorm" ? days >= 60 : key === "fog" ? days >= 25 : key === "wind" ? days >= 15 : key === "heat" ? days >= 25 : key === "icing" ? days >= 5 : days >= 20;
            const barColor = isHigh ? C.red : days > 10 ? C.yellow : C.green;
            return (
              <div key={key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>{CONSTRAINT_ICONS[key]} {CONSTRAINT_LABELS[key]}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,color:barColor}}>{days}</span>
                </div>
                <div style={{height:3,background:C.border,borderRadius:2}}>
                  <div style={{width:`${barPct}%`,height:"100%",background:barColor,borderRadius:2,transition:"width 0.8s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Monthly chart */}
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.15em",marginBottom:8}}>MONTHLY FLYING DAYS</div>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
          {monthly.map((m, i) => {
            const h = Math.max(4, (m.flyDays / 31) * 70);
            const barColor = m.flyDays >= 26 ? C.green : m.flyDays >= 22 ? C.teal : m.flyDays >= 18 ? C.yellow : C.red;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.textLabel}}>{m.flyDays.toFixed(0)}</div>
                <div style={{width:"100%",height:h,background:barColor,borderRadius:"3px 3px 0 0",transition:"height 0.8s ease",boxShadow:`0 0 4px ${barColor}44`}}/>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>{MONTH_LABELS[i]}</div>
              </div>
            );
          })}
        </div>

        {/* Data source note */}
        <div style={{marginTop:12,fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textDim}}>
          Source: NOAA 30-year climate normals (1991-2020) · IDW interpolation from {">"}15 TX reference stations · eVTOL operational thresholds
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = { required:C.red, likely_required:C.yellow, conditional:C.teal, recommended:C.textLabel };
const STATUS_LABELS = { required:"REQUIRED", likely_required:"LIKELY REQUIRED", conditional:"CONDITIONAL", recommended:"RECOMMENDED" };
const URGENCY_COLORS = { critical:"#C0392B", high:"#c87a10", medium:"#5B9BD5", low:"#4a9a8e" };
const URGENCY_LABELS = { critical:"CRITICAL", high:"HIGH", medium:"MEDIUM", low:"LOW" };
const CAT_ICONS = { FAA:"✈", ENV:"🌿", STATE:"⭐", LOCAL:"🏛", UTIL:"⚡", OPS:"📋" };

function RegulatoryChecklist({ items }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  if (!items || items.length === 0) return null;

  const grouped = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const totalRequired = items.filter(i => i.status === "required").length;
  const totalCritical = items.filter(i => i.urgency === "critical").length;

  return (
    <div style={{marginBottom:20}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>REGULATORY CHECKLIST</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 22px"}}>

        {/* Summary bar */}
        <div style={{display:"flex",gap:14,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:C.textBright}}>{items.length}</span>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>ITEMS</span>
          </div>
          <div style={{height:20,width:1,background:C.border}}/>
          <StatBadge count={totalRequired} label="REQUIRED" color={C.red}/>
          <StatBadge count={totalCritical} label="CRITICAL" color="#C0392B"/>
          <StatBadge count={items.filter(i=>i.status==="likely_required").length} label="LIKELY REQ" color={C.yellow}/>
          <StatBadge count={items.filter(i=>i.status==="recommended").length} label="RECOMMENDED" color={C.textLabel}/>
        </div>

        {/* Urgency timeline hint */}
        <div style={{display:"flex",gap:4,marginBottom:16,height:4,borderRadius:2,overflow:"hidden"}}>
          {["critical","high","medium","low"].map(u => {
            const count = items.filter(i => i.urgency === u).length;
            return <div key={u} style={{flex:count,background:URGENCY_COLORS[u],minWidth:count>0?4:0,transition:"flex 0.5s ease"}}/>;
          })}
        </div>

        {/* Category groups */}
        {Object.entries(grouped).map(([cat, catItems]) => {
          const isOpen = expandedCat === cat;
          const critCount = catItems.filter(i => i.urgency === "critical" || i.urgency === "high").length;
          return (
            <div key={cat} style={{marginBottom:8}}>
              {/* Category header */}
              <div onClick={() => setExpandedCat(isOpen ? null : cat)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:isOpen?"6px 6px 0 0":6,cursor:"pointer",userSelect:"none"}}>
                <span style={{fontSize:13}}>{CAT_ICONS[cat]||"📄"}</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textBright,fontWeight:600,flex:1,letterSpacing:"0.08em"}}>{CATEGORIES[cat]||cat}</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>{catItems.length} items</span>
                {critCount > 0 && <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#C0392B",background:"rgba(192,57,43,0.1)",border:"1px solid rgba(192,57,43,0.25)",borderRadius:3,padding:"1px 6px"}}>{critCount} critical/high</span>}
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>▸</span>
              </div>

              {/* Items */}
              {isOpen && (
                <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 6px 6px",overflow:"hidden"}}>
                  {catItems.map((item) => {
                    const isItemOpen = expandedItem === item.id;
                    const sColor = STATUS_COLORS[item.status] || C.textLabel;
                    const uColor = URGENCY_COLORS[item.urgency] || C.textLabel;
                    return (
                      <div key={item.id} style={{borderTop:item.id===catItems[0].id?"none":`1px solid ${C.border}`}}>
                        <div onClick={() => setExpandedItem(isItemOpen ? null : item.id)}
                          style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none",background:isItemOpen?"rgba(91,155,213,0.04)":"transparent"}}>
                          {/* Status indicator */}
                          <div style={{width:3,height:24,borderRadius:2,background:sColor,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textBright,marginBottom:2}}>{item.title}</div>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>{item.authority}</div>
                          </div>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:sColor,border:`1px solid ${sColor}44`,background:`${sColor}12`,padding:"2px 6px",borderRadius:3,whiteSpace:"nowrap",flexShrink:0}}>{STATUS_LABELS[item.status]}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:uColor,border:`1px solid ${uColor}44`,background:`${uColor}12`,padding:"2px 6px",borderRadius:3,whiteSpace:"nowrap",flexShrink:0}}>{URGENCY_LABELS[item.urgency]}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,transition:"transform 0.2s",transform:isItemOpen?"rotate(90deg)":"rotate(0deg)",flexShrink:0}}>▸</span>
                        </div>
                        {isItemOpen && (
                          <div style={{padding:"0 14px 12px 24px",background:"rgba(91,155,213,0.04)"}}>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.amber,marginBottom:6}}>{item.citation}</div>
                            <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:C.text,lineHeight:1.6}}>{item.notes}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{marginTop:12,fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textDim}}>
          Checklist is site-specific based on evaluation data. Items are auto-classified by airspace, zoning, flood zone, and heliport proximity. Verify with legal counsel before proceeding.
        </div>
      </div>
    </div>
  );
}

function StatBadge({ count, label, color }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color}}>{count}</span>
      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>{label}</span>
    </div>
  );
}

function fmt$(n) {
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function InvestmentPanel({ data }) {
  const [showCapex, setShowCapex] = useState(false);
  if (!data) return null;
  const { scenario, scenarioLabel, grade, capex, opex, movements, revenue, paybackYears, npv, risks, timeline } = data;

  const riskAvg = Math.round(risks.reduce((s,r) => s+r.score, 0) / risks.length);
  const riskColor = riskAvg >= 65 ? C.red : riskAvg >= 40 ? C.yellow : C.green;

  return (
    <div style={{marginBottom:20}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>INVESTMENT / VIABILITY SUMMARY</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 22px"}}>

        {/* Grade + Scenario header */}
        <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          {/* Grade badge */}
          <div style={{width:90,height:90,borderRadius:"50%",border:`3px solid ${grade.gradeColor}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`${grade.gradeColor}0a`,flexShrink:0}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:32,fontWeight:700,color:grade.gradeColor,lineHeight:1}}>{grade.grade}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:grade.gradeColor,marginTop:2}}>{grade.score}/100</div>
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:600,color:grade.gradeColor,letterSpacing:"0.1em",marginBottom:4}}>{grade.gradeLabel}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,marginBottom:8}}>
              Scenario: <span style={{color:C.textBright}}>{scenarioLabel}</span>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <MiniStat label="CAPEX (MID)" value={fmt$(capex.mid)} color={C.textBright}/>
              <MiniStat label="ANNUAL OPEX" value={fmt$(opex.mid)} color={C.textBright}/>
              <MiniStat label="PAYBACK" value={paybackYears ? `${paybackYears} yr` : "N/A"} color={paybackYears && paybackYears <= 8 ? C.green : paybackYears ? C.yellow : C.red}/>
              <MiniStat label="10-YR NPV" value={fmt$(Math.abs(npv))} prefix={npv >= 0 ? "+" : "-"} color={npv >= 0 ? C.green : C.red}/>
              <MiniStat label="RISK INDEX" value={`${riskAvg}/100`} color={riskColor}/>
            </div>
          </div>
        </div>

        {/* CAPEX / OPEX / Revenue row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
          {/* CAPEX */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:6}}>CAPITAL EXPENDITURE</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <RangeVal label="LOW" value={fmt$(capex.low)}/>
              <RangeVal label="MID" value={fmt$(capex.mid)} highlight/>
              <RangeVal label="HIGH" value={fmt$(capex.high)}/>
            </div>
            <div onClick={() => setShowCapex(!showCapex)} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.amber,cursor:"pointer",marginTop:4}}>
              {showCapex ? "Hide" : "Show"} breakdown {showCapex ? "▴" : "▾"}
            </div>
            {showCapex && (
              <div style={{marginTop:8}}>
                {capex.breakdown.map(item => (
                  <div key={item.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderTop:`1px solid ${C.border}`,fontFamily:"'IBM Plex Mono',monospace",fontSize:8}}>
                    <span style={{color:C.textLabel}}>{item.label}</span>
                    <span style={{color:C.textBright}}>{fmt$(item.mid)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OPEX */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:6}}>ANNUAL OPERATING COST</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <RangeVal label="LOW" value={fmt$(opex.low)}/>
              <RangeVal label="MID" value={fmt$(opex.mid)} highlight/>
              <RangeVal label="HIGH" value={fmt$(opex.high)}/>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel,marginTop:4}}>
              {((opex.mid / capex.mid) * 100).toFixed(1)}% of CAPEX
            </div>
          </div>

          {/* Revenue */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:6}}>REVENUE PROJECTION</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <RangeVal label="YR 1" value={fmt$(revenue.yr1)}/>
              <RangeVal label="YR 3" value={fmt$(revenue.yr3)}/>
              <RangeVal label="YR 5" value={fmt$(revenue.yr5)} highlight/>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel,marginTop:4}}>
              {fmt$(revenue.perMovement)}/movement · {movements.perDay} mov/day
            </div>
          </div>
        </div>

        {/* Movement projections */}
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:8}}>MOVEMENT PROJECTIONS</div>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60,marginBottom:6}}>
          {[
            { label:"YR 1",val:movements.yr1,max:movements.steadyState },
            { label:"YR 3",val:movements.yr3,max:movements.steadyState },
            { label:"YR 5",val:movements.yr5,max:movements.steadyState },
            { label:"STEADY",val:movements.steadyState,max:movements.steadyState },
          ].map((m,i) => {
            const h = Math.max(6, (m.val / m.max) * 50);
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.textBright}}>{(m.val/1000).toFixed(1)}K</div>
                <div style={{width:"60%",height:h,background:i===3?C.amber:C.teal,borderRadius:"3px 3px 0 0",transition:"height 0.8s ease"}}/>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:16,marginBottom:18,fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>
          <span>Passenger: {Math.round(movements.paxPct*100)}%</span>
          <span>Cargo: {Math.round(movements.cargoPct*100)}%</span>
          <span>Flyable days: {data.movements?.steadyState ? Math.round(data.movements.steadyState / movements.perDay) : "—"}/yr</span>
        </div>

        {/* Risk matrix */}
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:8}}>RISK ASSESSMENT</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
          {risks.map((r,i) => {
            const rc = r.score >= 65 ? C.red : r.score >= 40 ? C.yellow : C.green;
            return (
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>{r.category}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:rc,border:`1px solid ${rc}44`,background:`${rc}12`,padding:"1px 5px",borderRadius:3}}>{r.label}</span>
                </div>
                <div style={{height:3,background:C.border,borderRadius:2,marginBottom:4}}>
                  <div style={{width:`${r.score}%`,height:"100%",background:rc,borderRadius:2,transition:"width 0.8s ease"}}/>
                </div>
                <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:9,color:C.text,lineHeight:1.45}}>{r.notes}</div>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.12em",marginBottom:8}}>
          DEVELOPMENT TIMELINE — {timeline.totalMonths} MONTHS
        </div>
        <div style={{display:"flex",gap:0,marginBottom:6,borderRadius:4,overflow:"hidden",height:8}}>
          {timeline.phases.map((p,i) => {
            const colors = ["#5B9BD5","#f0a030","#1a8a58","#4a9a8e"];
            return <div key={i} style={{flex:p.months,background:colors[i%4],position:"relative"}} title={`${p.name}: ${p.months} months`}/>;
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${timeline.phases.length},1fr)`,gap:8,marginBottom:12}}>
          {timeline.phases.map((p,i) => {
            const colors = ["#5B9BD5","#f0a030","#1a8a58","#4a9a8e"];
            return (
              <div key={i}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:colors[i%4],fontWeight:600,marginBottom:2}}>{p.name}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel,marginBottom:4}}>{p.months} months</div>
                {p.items.map((item,j) => (
                  <div key={j} style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:9,color:C.text,lineHeight:1.5,paddingLeft:8,borderLeft:`1px solid ${C.border}`,marginBottom:2}}>
                    {item}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div style={{marginTop:12,fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textDim}}>
          Projections are model estimates based on evaluation data, industry benchmarks (NEXA, McKinsey), and 2025-2026 Texas cost indices. Not financial advice. Independent feasibility study required before investment decisions. NPV at 8% discount rate.
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, prefix, color }) {
  return (
    <div>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textLabel}}>{label}</div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color:color||C.textBright,lineHeight:1.2}}>
        {prefix||""}{value}
      </div>
    </div>
  );
}

function RangeVal({ label, value, highlight }) {
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:C.textLabel}}>{label}</div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:highlight?13:11,fontWeight:highlight?700:400,color:highlight?C.textBright:C.textLabel}}>{value}</div>
    </div>
  );
}

function parseCoords(lat,lon){const la=parseFloat(lat),lo=parseFloat(lon);if(isNaN(la)||isNaN(lo))return null;if(la<25||la>37||lo<-107||lo>-93)return null;return{lat:la,lon:lo};}

const ADDR_EXAMPLES=["8900 Will Clayton Pkwy, Humble TX","6900 N Loop E, Houston TX","1400 Post Oak Blvd, Houston TX"];
const COORD_EXAMPLES=[{label:"Willow Waterhole",lat:"29.6620",lon:"-95.5197"},{label:"Texas Medical Center",lat:"29.7079",lon:"-95.4010"},{label:"Ship Channel",lat:"29.7355",lon:"-95.2307"}];

// ── Beta email gate ───────────────────────────────────────────
const ROLES = [
  "Property owner",
  "Real estate broker / agent",
  "Portfolio manager",
  "Logistics / cargo operator",
  "Developer / investor",
  "Consultant / advisor",
  "Other",
];

function EmailGate({ onAccess }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [role, setRole]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !role) return;
    setSubmitting(true); setErr(null);
    // HubSpot submission — non-blocking, gate passes regardless
    try {
      const pid  = import.meta.env.VITE_HUBSPOT_PORTAL_ID;
      const fgid = import.meta.env.VITE_HUBSPOT_FORM_GUID;
      if (pid && fgid) {
        fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${pid}/${fgid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: [
              { name: "email",     value: email.trim() },
              { name: "firstname", value: firstName.trim() },
              { name: "jobtitle",  value: role },
            ],
            context: { pageUri: window.location.href, pageName: "Vertiport Eval Beta" },
          }),
        }).catch(() => {});
      }
    } catch (_) {}
    localStorage.setItem("veval_beta_access", JSON.stringify({ email: email.trim(), role, ts: Date.now() }));
    onAccess();
  }

  const inp = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.textBright, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
    padding: "10px 14px", width: "100%", outline: "none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(240,245,250,0.92)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
        padding:"36px 40px", width:"100%", maxWidth:420, boxShadow:"0 8px 40px rgba(91,155,213,0.12)" }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:"0.2em",
          color:C.amberDim, marginBottom:10 }}>FREE BETA ACCESS</div>
        <h2 style={{ fontFamily:"'Orbitron',monospace", fontSize:18, color:C.textBright,
          margin:"0 0 6px" }}>Start evaluating sites</h2>
        <p style={{ fontSize:13, color:C.textDim, margin:"0 0 24px", lineHeight:1.5 }}>
          No credit card. No commitment. We'll share occasional updates on new features.
        </p>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input placeholder="First name (optional)" value={firstName}
            onChange={e=>setFirstName(e.target.value)} style={inp}/>
          <input type="email" placeholder="Email address *" value={email} required
            onChange={e=>setEmail(e.target.value)} style={inp}/>
          <select required value={role} onChange={e=>setRole(e.target.value)}
            style={{...inp, color: role ? C.textBright : C.textDim}}>
            <option value="" disabled>Your role *</option>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          {err && <div style={{ fontSize:12, color:C.red }}>{err}</div>}
          <button type="submit" disabled={submitting || !email || !role}
            style={{ background:C.amber, color:"#fff", border:"none", borderRadius:6,
              fontFamily:"'IBM Plex Mono',monospace", fontSize:12, letterSpacing:"0.1em",
              padding:"12px", cursor:"pointer", marginTop:4, opacity: (!email||!role)?0.5:1 }}>
            {submitting ? "SUBMITTING…" : "GET ACCESS →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Landing page ──────────────────────────────────────────────
function LandingPage({ onStart }) {
  const [showGate, setShowGate] = useState(false);

  const feat = [
    { icon: "▣", title: "Site Score", body: "Parcel size, FAA airspace class, zoning, flood risk, and grid capacity — scored against FAA and NREL vertiport standards." },
    { icon: "◎", title: "Demand Score", body: "Employment density, medical facilities, cargo infrastructure, and transit gaps — calibrated for eVTOL cargo-first operations." },
    { icon: "◈", title: "Priority Index", body: "Site × 0.60 + Demand × 0.40. Quadrant placement tells you exactly where to focus your due diligence." },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .lp-cta:hover{background:${C.textBright}!important;box-shadow:0 0 32px rgba(34,34,34,0.15)!important;}
        .lp-feat:hover{border-color:${C.amber}!important;transform:translateY(-2px);transition:all 0.2s;}
      `}</style>

      {/* Nav */}
      <nav style={{ padding:"20px 40px", display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:900,
          color:C.textBright, letterSpacing:"0.1em" }}>VERTIPORT EVAL</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
          letterSpacing:"0.2em", background:C.card, padding:"4px 10px", borderRadius:20,
          border:`1px solid ${C.border}` }}>PHASE 1 BETA · TEXAS</div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth:760, margin:"0 auto", padding:"80px 40px 60px", textAlign:"center" }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:"0.25em",
          color:C.amberDim, marginBottom:16 }}>FAA · FEMA · HCAD · NREL · EIA · OSM</div>
        <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:"clamp(24px,4vw,42px)",
          fontWeight:900, color:C.textBright, lineHeight:1.15, marginBottom:20 }}>
          Is your site ready<br/>for eVTOL?
        </h1>
        <p style={{ fontSize:17, color:C.text, lineHeight:1.65, maxWidth:540, margin:"0 auto 36px" }}>
          Enter an address. Get a two-axis feasibility score built on live government data.
          Find out in 30 seconds whether your site can support a vertiport — before you spend
          a dollar on engineering.
        </p>
        <button className="lp-cta" onClick={()=>setShowGate(true)}
          style={{ background:C.textBright, color:"#fff", border:"none", borderRadius:8,
            fontFamily:"'IBM Plex Mono',monospace", fontSize:13, letterSpacing:"0.12em",
            padding:"16px 40px", cursor:"pointer", transition:"all 0.18s" }}>
          EVALUATE A SITE — FREE
        </button>
        <div style={{ fontSize:12, color:C.textDim, marginTop:12 }}>
          No credit card. Texas sites only during beta.
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ maxWidth:900, margin:"0 auto", padding:"0 40px 80px",
        display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
        {feat.map(f=>(
          <div key={f.title} className="lp-feat"
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
              padding:"24px 24px 28px", transition:"all 0.2s" }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20,
              color:C.amber, marginBottom:10 }}>{f.icon}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
              fontWeight:600, color:C.textBright, letterSpacing:"0.1em",
              marginBottom:8 }}>{f.title.toUpperCase()}</div>
            <p style={{ fontSize:13, color:C.text, lineHeight:1.6 }}>{f.body}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:"20px 40px",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:C.textDim }}>
          BUSINESSAVIATION.AERO
        </span>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:C.textDim }}>
          FAA/NREL CALIBRATED · PHASE 1 TEXAS
        </span>
      </footer>

      {showGate && <EmailGate onAccess={onStart} />}
    </div>
  );
}

export default function App() {
  const [gated, setGated] = useState(() => !!localStorage.getItem("veval_beta_access"));
  const [mode,setMode]=useState("address");
  const [address,setAddress]=useState("");
  const [lat,setLat]=useState("");const [lon,setLon]=useState("");const [siteLabel,setSiteLabel]=useState("");
  const [phase,setPhase]=useState("idle");
  const [log,setLog]=useState([]);
  const [results,setResults]=useState(null);
  const [previous,setPrevious]=useState(null);
  const [error,setError]=useState(null);
  const [pdfGenerating,setPdfGenerating]=useState(false);
  const [mapView,setMapView]=useState("2d");
  const [approachBearing,setApproachBearing]=useState(0);
  const [demandTab,setDemandTab]=useState("passenger");
  const [recentReports,setRecentReports]=useState(()=>{try{return JSON.parse(localStorage.getItem("veval_recent")||"[]");}catch{return [];}});

  if (!gated) return <LandingPage onStart={() => setGated(true)} />;

  const canRun=phase!=="loading"&&(mode==="address"?address.trim().length>0:parseCoords(lat,lon)!==null);

  async function run(override=null){
    if(!override&&!canRun)return;
    const runMode=override?.mode||mode;

    // ── Rate limiting — disabled for development ───────────────
    // ──────────────────────────────────────────────────────────

    if(results)setPrevious(results);
    setPhase("loading");setResults(null);setError(null);
    const logs=[];
    const addL=(msg,s="running")=>{logs.push({msg,s});setLog([...logs]);};
    const setL=(i,msg,s)=>{logs[i]={msg,s};setLog([...logs]);};
    try{
      let input;
      if(runMode==="coords"){
        const rawLat=override?override.lat:lat; const rawLon=override?override.lon:lon; const rawLabel=override?.label||siteLabel;
        const c=override?{lat:parseFloat(rawLat),lon:parseFloat(rawLon)}:parseCoords(rawLat,rawLon);
        if(!c)throw new Error("Invalid coordinates. Texas is ~26-36°N, -94 to -107°W.");
        input={lat:c.lat,lon:c.lon,label:rawLabel||`${c.lat}, ${c.lon}`};addL(`Coordinates: ${c.lat.toFixed(5)}°N, ${Math.abs(c.lon).toFixed(5)}°W`);
      }else{const addr=override?override.address:address.trim();input={address:addr};addL(`Geocoding: ${addr}`);}

      // ── Three parallel Claude calls — one per demand mode ──
      const analysisIdx=logs.length; addL("Running passenger · cargo · combo analysis in parallel...","running");
      const [paxS,cargoS,comboS]=await Promise.allSettled([
        analyzeWithClaude(input,runMode,"passenger"),
        analyzeWithClaude(input,runMode,"cargo"),
        analyzeWithClaude(input,runMode,"combo"),
      ]);
      const firstOk=[paxS,cargoS,comboS].find(s=>s.status==="fulfilled"&&s.value?.geocode?.valid);
      if(!firstOk){
        const firstErr=[paxS,cargoS,comboS].find(s=>s.status==="rejected");
        const firstVal=[paxS,cargoS,comboS].find(s=>s.status==="fulfilled");
        console.error("All Claude calls invalid. Rejected:",firstErr?.reason,"Fulfilled sample:",JSON.stringify(firstVal?.value)?.slice(0,400));
        throw new Error(firstErr?`API error: ${firstErr.reason?.message||firstErr.reason}`:`Response missing geocode.valid — check console for raw output`);
      }
      const base=firstOk.value;
      setL(analysisIdx,`Resolved → ${base.geocode.lat?.toFixed(5)}°N, ${Math.abs(base.geocode.lon)?.toFixed(5)}°W`,"done");

      const get=(s,fb)=>s.status==="fulfilled"?s.value:fb;
      const paxData=get(paxS,base), cargoData=get(cargoS,base), comboData=get(comboS,base);

      // ── Heliport lookup (shared) ───────────────────────────
      const heli=findNearestHeliport(base.geocode.lat,base.geocode.lon,500);
      const siteBoost=heli.site_boost||0, demandBoost=heli.demand_boost||0;
      const heliNote=siteBoost>0?` · heliport +${siteBoost}/${demandBoost}`:"";

      // Shared site (use base, apply site boost)
      const siteData={...base.site};
      siteData.composite=Math.min(100,Math.round((siteData.composite||0)+siteBoost));

      // Per-mode demand with heliport boost
      const bd=(d)=>({...d,composite:Math.min(100,Math.round((d?.composite||0)+demandBoost))});
      const paxDemand=bd(paxData.demand), cargoDemand=bd(cargoData.demand), comboDemand=bd(comboData.demand);
      addL(`PAX demand: ${paxDemand?.composite} · Cargo: ${cargoDemand?.composite} · Combo: ${comboDemand?.composite}${heliNote}`,"done");
      if(siteBoost>0) addL(`Heliport: ${heli.name} · ${heli.distance_m}m · +${siteBoost} site / +${demandBoost} demand`,"done");

      // ── Flying days (shared) ───────────────────────────────
      const flyData=estimateFlyingDays(base.geocode.lat,base.geocode.lon);
      addL(`Flying days: ${flyData.flyingDays}/yr · ${flyData.rating}`,"done");

      // ── FAA airspace (shared, synchronous) ────────────────
      const airspaceResult=scoreAirspace(base.geocode.lat,base.geocode.lon);
      const oldAir=siteData?.airspace?.score||0;
      siteData.airspace={...siteData.airspace,...airspaceResult};
      siteData.composite=Math.min(100,Math.round((siteData?.composite||0)-(oldAir*0.25)+(airspaceResult.score*0.25)));
      addL(`FAA → ${airspaceResult.status} · score ${airspaceResult.score}/100 · ${airspaceResult.nearest_airport}`,"done");

      // ── Live APIs (shared) ─────────────────────────────────
      const eiaIdx=logs.length;  addL("EIA power grid → fetching...","running");
      const nrelIdx=logs.length; addL("NREL DER layer → fetching...","running");
      const hcadIdx=logs.length; addL("Harris County parcel → fetching...","running");
      const femaIdx=logs.length; addL("FEMA NFHL + elevation → fetching...","running");
      const osmIdx=logs.length;  addL("OSM zoning → fetching...","running");
      const flags=[...(siteData?.parcel?.flags||[]),...(siteData?.airspace?.flags||[]),...(siteData?.zoning?.flags||[]),...(siteData?.soil?.flags||[])];
      const [eiaS,nrelS,hcadS,femaS,osmS]=await Promise.allSettled([
        fetchEIAPowerScore(base.geocode.lat,base.geocode.lon,siteData?.zoning?.score||50),
        fetchNRELDERScore(base.geocode.lat,base.geocode.lon),
        fetchHarrisParcelScore(base.geocode.lat,base.geocode.lon),
        fetchFEMAFloodScore(base.geocode.lat,base.geocode.lon),
        fetchZoningScore(base.geocode.lat,base.geocode.lon),
      ]);
      const eia=eiaS.status==="fulfilled"?eiaS.value:null;
      const nrel=nrelS.status==="fulfilled"?nrelS.value:null;
      const hcad=hcadS.status==="fulfilled"?hcadS.value:null;
      const fema=femaS.status==="fulfilled"?femaS.value:null;
      const osm=osmS.status==="fulfilled"?osmS.value:null;
      if(eia)  setL(eiaIdx, `EIA → Power Grid & DER: ${eia.score}/100`,"done");
      else     setL(eiaIdx, `EIA → ${eiaS.reason?.message||"fetch failed"}`,"warn");
      if(nrel) setL(nrelIdx,`NREL → Community DER: ${nrel.score}/100`,"done");
      else     setL(nrelIdx,`NREL → ${nrelS.reason?.message||"fetch failed"}`,"warn");
      if(hcad){
        setL(hcadIdx,`HCAD → Parcel: ${hcad.acreage_estimate} ac · score ${hcad.score}/100`,"done");
        const oldP=siteData?.parcel?.score||0;
        siteData.parcel={...siteData.parcel,...hcad};
        siteData.composite=Math.min(100,Math.round((siteData?.composite||0)-(oldP*0.25)+(hcad.score*0.25)));
      } else setL(hcadIdx,`HCAD → ${hcadS.reason?.message||"fetch failed"}`,"warn");
      if(fema){
        const elevNote=fema.elevation_ft!==null?` · ${fema.elevation_ft} ft elev`:"";
        setL(femaIdx,`FEMA → ${fema.flood_zone} · score ${fema.score}/100${elevNote}`,"done");
        const oldF=siteData?.soil?.score||0;
        siteData.soil={...siteData.soil,...fema};
        siteData.composite=Math.min(100,Math.round((siteData?.composite||0)-(oldF*0.10)+(fema.score*0.10)));
        flags.push(...(fema.flags||[]));
      } else setL(femaIdx,`FEMA → ${femaS.reason?.message||"fetch failed"}`,"warn");
      if(osm){
        setL(osmIdx,`OSM → ${osm.land_use} (${osm._raw}) · score ${osm.score}/100`,"done");
        const oldZ=siteData?.zoning?.score||0;
        siteData.zoning={...siteData.zoning,...osm};
        siteData.composite=Math.min(100,Math.round((siteData?.composite||0)-(oldZ*0.15)+(osm.score*0.15)));
        flags.push(...(osm.flags||[]));
      } else setL(osmIdx,`OSM → ${osmS.reason?.message||"fetch failed"}`,"warn");

      // ── Build per-mode results ─────────────────────────────
      const sharedBase={geocode:base.geocode,site:siteData,flags,eia,nrel,hcad,fema,osm,heliport:heli,flyingDays:flyData};
      const buildMode=(modeClaudeData,demandObj,em)=>{
        const ctx={...sharedBase,demand:demandObj,evalMode:em};
        const reg=buildRegulatoryChecklist(ctx,em);
        const inv=buildInvestmentSummary(ctx,em);
        addL(`${em}: demand ${demandObj?.composite} · grade ${inv.grade.grade} · CAPEX $${(inv.capex.mid/1e6).toFixed(1)}M`,"done");
        return{demand:demandObj,summary:modeClaudeData.summary,development_thesis:modeClaudeData.development_thesis,top_strengths:modeClaudeData.top_strengths,top_concerns:modeClaudeData.top_concerns,regulatory:reg,investment:inv};
      };
      const fullResults={
        ...sharedBase,
        modes:{
          passenger:buildMode(paxData,  paxDemand,  "passenger"),
          cargo:    buildMode(cargoData,cargoDemand,"cargo"),
          combo:    buildMode(comboData,comboDemand,"combo"),
        },
      };
      setResults(fullResults);setPhase("complete");
      // ── Save to recent reports ─────────────────────────────
      const inputSnap=runMode==="coords"?{mode:"coords",lat:input.lat,lon:input.lon,label:input.label}:{mode:"address",address:input.address};
      const ss=fullResults.site?.composite; const sd=fullResults.modes?.passenger?.demand?.composite;
      const entry={id:Date.now(),ts:new Date().toISOString(),input:inputSnap,evalMode:demandTab,results:fullResults,display:input.label||input.address||`${input.lat?.toFixed(4)}, ${input.lon?.toFixed(4)}`,scores:{site:ss,demand:sd,pi:priorityIndex(ss,sd)}};
      setRecentReports(prev=>{
        const updated=[entry,...prev.filter(r=>r.display!==entry.display)].slice(0,10);
        try{const json=JSON.stringify(updated);if(json.length<4*1024*1024){localStorage.setItem("veval_recent",json);}else{const trimmed=updated.slice(0,-1);localStorage.setItem("veval_recent",JSON.stringify(trimmed));return trimmed;}}catch(e){}
        return updated;
      });
    }catch(err){setL(0,`Error: ${err.message}`,"error");setError(err.message);setPhase("error");}
  }

  async function handleDownloadPDF(){
    if(!results)return;
    setPdfGenerating(true);
    try{
      const dr={...results,...(results.modes?.[demandTab]||{}),evalMode:demandTab};
      generatePDF(dr);
    }
    catch(err){ console.error("PDF error:",err); alert("PDF generation failed: "+err.message); }
    finally{ setPdfGenerating(false); }
  }

  const reset=()=>{setPhase("idle");setResults(null);setPrevious(null);setLog([]);setAddress("");setLat("");setLon("");setSiteLabel("");setError(null);setDemandTab("passenger");};
  function loadReport(r){setPrevious(results);setResults(r.results);setPhase("complete");setDemandTab(r.evalMode);setLog([]);setError(null);if(r.input.mode==="coords"){setMode("coords");setLat(String(r.input.lat));setLon(String(r.input.lon));setSiteLabel(r.input.label||"");}else{setMode("address");setAddress(r.input.address||"");}}
  function rerunReport(r){if(r.input.mode==="coords"){setMode("coords");setLat(String(r.input.lat));setLon(String(r.input.lon));setSiteLabel(r.input.label||"");}else{setMode("address");setAddress(r.input.address||"");}run(r.input);}
  function clearRecent(){setRecentReports([]);localStorage.removeItem("veval_recent");}
  function relativeTime(ts){const s=Math.floor((Date.now()-new Date(ts))/1000);if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;}
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
        .pdf-btn:hover:not(:disabled){background:${C.green}!important;color:${C.surface}!important;box-shadow:0 0 20px rgba(26,138,88,0.25);}
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
                <button className="run-btn" onClick={()=>run()} disabled={!canRun} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.2em",padding:"11px 22px",borderRadius:6,cursor:"pointer",opacity:!canRun?0.4:1,whiteSpace:"nowrap"}}>{phase==="loading"?"RUNNING...":"ANALYZE"}</button>
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
                <button className="run-btn" onClick={()=>run()} disabled={!canRun} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.2em",padding:"11px 22px",borderRadius:6,cursor:"pointer",opacity:!canRun?0.4:1,whiteSpace:"nowrap"}}>{phase==="loading"?"RUNNING...":"ANALYZE"}</button>
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

        {/* Recent Reports */}
        {recentReports.length>0&&(
          <div style={{marginBottom:24,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"9px 16px",background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",color:C.textLabel}}>RECENT REPORTS</span>
              <button onClick={clearRecent} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.1em"}}>CLEAR ALL</button>
            </div>
            {recentReports.map(r=>{
              const q=getQuadrant(r.scores.site,r.scores.demand,r.evalMode);
              const btnBase={fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.12em",padding:"5px 10px",borderRadius:4,cursor:"pointer",border:`1px solid ${C.border}`};
              return(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:`1px solid ${C.border}`,background:C.bg}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.textBright,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.display}</div>
                    <div style={{display:"flex",gap:14,marginTop:3,alignItems:"center"}}>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textDim}}>S:{r.scores.site} · D:{r.scores.demand} · PI:{r.scores.pi}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:q.color}}>{q.label}</span>
                    </div>
                  </div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textDim,whiteSpace:"nowrap"}}>{relativeTime(r.ts)}</span>
                  <button onClick={()=>loadReport(r)} style={{...btnBase,background:C.surface,color:C.textLabel}}>LOAD</button>
                  <button onClick={()=>rerunReport(r)} style={{...btnBase,background:"transparent",color:C.amber,borderColor:C.amber}} disabled={phase==="loading"}>{phase==="loading"?"...":"RE-RUN"}</button>
                </div>
              );
            })}
          </div>
        )}

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
          <div style={{background:"rgba(192,57,43,0.06)",border:"1px solid rgba(192,57,43,0.3)",borderRadius:8,padding:"14px 18px",marginBottom:24}}>
            <div style={{color:C.red,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,marginBottom:8}}>ERROR — {error}</div>
            <button onClick={()=>run()} style={{background:"transparent",border:`1px solid ${C.red}`,color:C.red,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.15em",padding:"7px 16px",borderRadius:4,cursor:"pointer"}}>RETRY</button>
          </div>
        )}

        {/* Results */}
        {phase==="complete"&&results&&(()=>{
          const dr={...results,...(results.modes?.[demandTab]||{}),evalMode:demandTab};
          const siteScore=results.site?.composite||0;
          const demandScore=dr.demand?.composite||0;
          const pi=priorityIndex(siteScore,demandScore);
          const q=getQuadrant(siteScore,demandScore,demandTab);
          const demandSubLabel={passenger:"passenger draw",cargo:"cargo & logistics",combo:"cargo + passenger"}[demandTab]||"demand";
          const prevSite=previous?.site?.composite??null;
          const prevDemand=previous?.modes?.[demandTab]?.demand?.composite??null;
          return (
            <div>
              {/* Demand mode tabs */}
              <div style={{display:"flex",gap:6,marginBottom:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px",flexWrap:"wrap",alignItems:"center"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginRight:8,flexShrink:0}}>EVALUATION MODE:</div>
                {[
                  {id:"passenger",label:"PASSENGER"},
                  {id:"cargo",    label:"CARGO"},
                  {id:"combo",    label:"CARGO+PAX"},
                ].map(m=>{
                  const mDemand=results.modes?.[m.id]?.demand?.composite||0;
                  const mPI=priorityIndex(siteScore,mDemand);
                  const active=demandTab===m.id;
                  return(
                    <button key={m.id} onClick={()=>setDemandTab(m.id)} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,letterSpacing:"0.12em",padding:"7px 16px",borderRadius:4,cursor:"pointer",border:`1px solid ${active?C.amber:C.border}`,background:active?C.amberGlow:"transparent",color:active?C.amber:C.textLabel,transition:"all 0.15s"}}>
                      {m.label} · D:{mDemand} · PI:{mPI}
                    </button>
                  );
                })}
              </div>

              {/* Score header */}
              <div style={{display:"flex",gap:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"22px 24px",marginBottom:20,flexWrap:"wrap"}}>
                <QuadrantPlot site={siteScore} demand={demandScore} previousSite={prevSite} previousDemand={prevDemand}/>
                <div style={{flex:1,minWidth:260}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:8}}>DUAL-AXIS ASSESSMENT</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:C.textBright,marginBottom:3}}>{results.geocode.matched}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.textLabel,marginBottom:14}}>{results.geocode.lat?.toFixed(5)}°N · {Math.abs(results.geocode.lon)?.toFixed(5)}°W</div>

                  <div style={{display:"flex",gap:10,marginBottom:14}}>
                    <ScorePill label="SITE SCORE" score={siteScore} sub="infrastructure viability"/>
                    <ScorePill label="DEMAND SCORE" score={demandScore} sub={demandSubLabel}/>
                    <ScorePill label="PRIORITY INDEX" score={pi} sub="cargo-weighted 60/40"/>
                  </div>

                  <div style={{padding:"10px 14px",background:`${q.color}0e`,border:`1px solid ${q.color}33`,borderRadius:6,marginBottom:12}}>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:q.color,marginBottom:4,letterSpacing:"0.1em"}}>{q.label}</div>
                    <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.text,lineHeight:1.5}}>{q.desc}</div>
                  </div>

                  {dr.summary&&<div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:C.text,lineHeight:1.65,marginBottom:10,paddingLeft:12,borderLeft:`2px solid ${C.border}`}}>{dr.summary}</div>}
                  {dr.development_thesis&&<div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.amber,marginBottom:12,lineHeight:1.5}}>▶ {dr.development_thesis}</div>}

                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                    {(dr.top_strengths||[]).map((s,i)=><span key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.green,background:"rgba(26,138,88,0.09)",border:"1px solid rgba(26,138,88,0.25)",borderRadius:3,padding:"3px 9px"}}>✓ {s}</span>)}
                    {(dr.top_concerns||[]).filter(Boolean).map((s,i)=><span key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.yellow,background:"rgba(200,122,16,0.09)",border:"1px solid rgba(200,122,16,0.25)",borderRadius:3,padding:"3px 9px"}}>⚑ {s}</span>)}
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

              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.amberDim,letterSpacing:"0.2em",marginBottom:10}}>{DEMAND_HEADER[demandTab]}</div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px",marginBottom:20}}>
                {(DEMAND_CRITERIA[demandTab]).map(cr=>(
                  <DemandRow key={cr.key} label={cr.label} icon={cr.icon} score={dr.demand?.[cr.key]?.score||0} notes={dr.demand?.[cr.key]?.notes}/>
                ))}
              </div>

              {/* Flying Days */}
              <FlyingDaysPanel data={results.flyingDays}/>

              {/* Regulatory Checklist */}
              <RegulatoryChecklist items={dr.regulatory}/>

              {/* Investment / Viability */}
              <InvestmentPanel data={dr.investment}/>

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


              {/* Map — 2D / 3D tab */}
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
                  <button onClick={()=>setMapView("2d")} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,letterSpacing:"0.18em",padding:"5px 14px",borderRadius:4,cursor:"pointer",border:`1px solid ${mapView==="2d"?C.amber:C.border}`,background:mapView==="2d"?C.amberGlow:"transparent",color:mapView==="2d"?C.amber:C.textDim}}>GROUND VIEW</button>
                  <button onClick={()=>setMapView("3d")} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,letterSpacing:"0.18em",padding:"5px 14px",borderRadius:4,cursor:"pointer",border:`1px solid ${mapView==="3d"?C.amber:C.border}`,background:mapView==="3d"?C.amberGlow:"transparent",color:mapView==="3d"?C.amber:C.textDim}}>3D OBSTACLE SURFACES</button>
                  {mapView==="3d"&&(<>
                    <div style={{width:1,height:16,background:C.border,marginLeft:4}}/>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:C.textDim}}>APPROACH:</span>
                    {[{label:"N/S",brg:0},{label:"NE/SW",brg:45},{label:"E/W",brg:90},{label:"NW/SE",brg:135}].map(({label,brg})=>(
                      <button key={brg} onClick={()=>setApproachBearing(brg)} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,padding:"4px 10px",borderRadius:4,cursor:"pointer",border:`1px solid ${approachBearing===brg?C.amber:C.border}`,background:approachBearing===brg?C.amberGlow:"transparent",color:approachBearing===brg?C.amber:C.textDim}}>{label}</button>
                    ))}
                  </>)}
                </div>
                {mapView==="2d"
                  ? <SiteMap geocode={results.geocode} heliport={results.heliport} airspace={results.site?.airspace}/>
                  : <SiteMap3D geocode={results.geocode} airspace={results.site?.airspace} approachBearing={approachBearing}/>
                }
              </div>

              <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                <button onClick={()=>run()} disabled={phase==="loading"} style={{background:"transparent",border:`1px solid ${C.amber}`,color:C.amber,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",padding:"10px 24px",borderRadius:6,cursor:"pointer"}}>RE-ANALYZE</button>
                <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textLabel,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:"0.2em",padding:"10px 24px",borderRadius:6,cursor:"pointer"}}>NEW SITE</button>
              </div>
            </div>
          );
        })()}

        <div style={{marginTop:48,paddingTop:18,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.textLabel}}>
          <span>FAA · NREL · FEMA · USGS · EIA · NOAA · OSM</span>
          <span>PHASE 1 — TEXAS · FAA/NREL CALIBRATED</span>
        </div>
      </div>
    </div>
  );
}
