import { useState, useEffect, useRef, createContext, useContext } from "react";
import aamLogo from './assets/aam_logo.png';
import SetupScreen from './SetupScreen.jsx';
import { jsPDF } from "jspdf";
import { downloadPDF } from './ReportPDF.jsx';
import { findNearestHeliport } from './heliportLookup.js';
import { estimateFlyingDays } from './flyingDays.js';
import { buildRegulatoryChecklist, CATEGORIES } from './regulatoryChecklist.js';
import { buildInvestmentSummary } from './investmentViability.js';
import SiteMap from './SiteMap.jsx';
import {
  priorityIndex,
  getQuadrant,
  getSiteDesc,
  getDemandDesc,
  DEMAND_CRITERIA,
  DEMAND_HEADER,
  buildPrompt,
  extractLLMJson,
  analyzeWithClaude,
  fetchEIAPowerScore,
  fetchNRELDERScore,
  fetchTexasParcelScore,
  fetchRegridParcelScore,
  fetchFEMAFloodScore,
  fetchZoningScore,
  scoreAirspace,
} from './scoring.js';

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

// priorityIndex, getQuadrant, getSiteDesc, getDemandDesc,
// DEMAND_CRITERIA, DEMAND_HEADER — imported from ./scoring.js

// ── PDF Generation ─────────────────────────────────────────
function generatePDF(results, mapDataUrl = null, logoDataUrl = null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  const col = margin, colR = W - margin;
  let y = 0;
  const SAFE_BOTTOM = 268;
  const newPage = () => { doc.addPage(); y = 15; };
  const addPageLogo = () => { if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", colR - 12, 4, 13, 13); };

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
  const em = results.evalMode || "passenger";

  // ── Header band ──
  setFill("#5B9BD5");
  doc.rect(0, 0, W, 38, "F");
  setFill("#FFFFFF");
  doc.rect(0, 0, 4, 38, "F");

  // Logo
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", col + 4, 4, 30, 30);
  const txtX = logoDataUrl ? col + 40 : col + 6;

  setTxt("#FFFFFF");
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("VERTIPORT", txtX, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica","normal");
  setTxt("#daeaf6");
  const modeLabel = results.evalMode === "cargo" ? "CARGO" : results.evalMode === "combo" ? "CARGO + PAX" : "PASSENGER";
  doc.text(`SITE EVALUATION SYSTEM  ·  ${modeLabel}  ·  FAA/NREL CALIBRATED  ·  TEXAS BETA`, txtX, 20);

  // Branding — right side
  setTxt("#FFFFFF");
  doc.setFont("helvetica","bold"); doc.setFontSize(7);
  doc.text("LOWALTITUDEECONOMY.AERO", colR, 12, {align:"right"});
  setTxt("#daeaf6");
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}`, colR, 19, {align:"right"});
  doc.text("Nationwide  ·  Two-Axis Scoring Model", colR, 25, {align:"right"});

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
  const modeBadgeLabel = { passenger:"PASSENGER", cargo:"CARGO", combo:"CARGO+PAX" }[em] || em.toUpperCase();
  const modeBadgeColor = { passenger:"#5B9BD5", cargo:"#4a9a8e", combo:"#7b7bd5" }[em] || "#5B9BD5";
  const scores = [
    { label:"SITE SCORE",     sub:"infrastructure viability", val:siteScore },
    { label:"DEMAND SCORE",   sub:{passenger:"passenger draw",cargo:"cargo & logistics",combo:"cargo + passenger"}[em]||"demand", val:demandScore, badge:modeBadgeLabel, badgeColor:modeBadgeColor },
    { label:"PRIORITY INDEX", sub:"site + demand composite",  val:pi },
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
    if (s.badge) {
      const bW = 20, bH = 5.5;
      const bX = bx + boxW - bW - 3, bY = y + 3;
      setFill(s.badgeColor);
      doc.roundedRect(bX, bY, bW, bH, 1, 1, "F");
      setTxt("#FFFFFF");
      doc.setFont("helvetica","bold");
      doc.setFontSize(5);
      doc.text(s.badge, bX + bW / 2, bY + 3.8, { align:"center" });
    }
  });

  // ── Quadrant badge ──
  y += 34;
  const qCol = q.color;
  setFill(qCol + "22"); setDraw(qCol + "66");
  doc.roundedRect(col, y, W - margin*2, 20, 2, 2, "FD");
  setTxt(qCol);
  doc.setFont("helvetica","bold");
  doc.setFontSize(8);
  doc.text(q.label, col + 4, y + 6);
  setTxt("#444444");
  doc.setFont("helvetica","normal");
  doc.setFontSize(7);
  doc.text(getSiteDesc(siteScore), col + 4, y + 12, { maxWidth: W - margin*2 - 8 });
  doc.text(getDemandDesc(demandScore, em), col + 4, y + 17, { maxWidth: W - margin*2 - 8 });

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
    { label:"Parcel Size & Contours", score:results.site?.parcel?.score, notes:results.site?.parcel?.notes, detail:`${results.site?.parcel?.acreage_estimate ? `~${results.site.parcel.acreage_estimate} ac · ` : ""}${results.site?.parcel?.land_type||""}` },
    { label:"FAA Airspace",           score:results.site?.airspace?.score, notes:results.site?.airspace?.notes, detail:`${results.site?.airspace?.status||""} · ${results.site?.airspace?.nearest_airport||""}` },
    { label:"Power Grid & DER",       score:results.eia?.score??null, notes:results.eia?.notes||"EIA API key not set", detail:results.eia ? `${results.eia.details?.["Grid"]||""} · ${results.eia.details?.["US sales"]||""}` : "Pending activation" },
    { label:"Zoning Compliance",      score:results.site?.zoning?.score, notes:results.site?.zoning?.notes, detail:`${results.site?.zoning?.compliance||""} · ${results.site?.zoning?.land_use||""}` },
    { label:"Soil Stability & Flood", score:results.site?.soil?.score, notes:results.site?.soil?.notes, detail:`${results.site?.soil?.flood_zone||""} · ${results.site?.soil?.slope_estimate||""}` },
    { label:"Community DER Support",  score:results.nrel?.score??null, notes:results.nrel?.notes||"NREL API key not set", detail:results.nrel ? `${results.nrel.details?.["Utility"]||""} · GHI ${results.nrel.details?.["Solar GHI"]||"N/A"} · ${results.nrel.details?.["Comm. rate"]||""} · ${results.nrel.details?.["Net meter"]||""}` : "Pending activation" },
  ];

  siteCriteria.forEach((cr) => {
    if (y + 15 > SAFE_BOTTOM) newPage();
    const rowH = 13;
    const sc = cr.score;
    const cCol = sc === null ? "#9ab8d0" : sc >= 75 ? "#1a8a58" : sc >= 45 ? "#c87a10" : "#C0392B";
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#444444");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 7);
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
  y += 3;
  y = sectionHeader(DEMAND_HEADER[em] || "DEMAND SCORE — WHY FLY HERE?", y);

  const demandCriteria = (DEMAND_CRITERIA[em] || DEMAND_CRITERIA.passenger).map(cr => ({
    label: cr.label,
    score: results.demand?.[cr.key]?.score ?? null,
    notes: results.demand?.[cr.key]?.notes,
  }));

  demandCriteria.forEach((cr) => {
    if (y + 15 > SAFE_BOTTOM) newPage();
    const rowH = 13;
    const sc = cr.score || 0;
    const cCol = sc >= 75 ? "#1a8a58" : sc >= 45 ? "#c87a10" : "#C0392B";
    setFill("#FFFFFF"); setDraw("#d0dce8");
    doc.roundedRect(col, y, W - margin*2, rowH, 1, 1, "FD");
    setFill(cCol);
    doc.rect(col, y, 2, rowH, "F");
    setTxt("#444444");
    doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text(cr.label, col + 5, y + 7);
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
    if (y + 20 > SAFE_BOTTOM) newPage();
    y += 3;
    y = sectionHeader("FLAGS — ITEMS REQUIRING INVESTIGATION", y);
    flags.forEach((flag) => {
      if (y + 12 > SAFE_BOTTOM) newPage();
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
    if (y + 50 > SAFE_BOTTOM) newPage();
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
    if (y + (strengths.length + concerns.length) * 6 + 12 > SAFE_BOTTOM) newPage();
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

  // ── Site Map ──
  if (mapDataUrl) {
    doc.addPage();
    y = 0;
    setFill("#5B9BD5"); doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF"); doc.rect(0, 0, 4, 22, "F");
    addPageLogo();
    setTxt("#FFFFFF"); doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("SITE MAP", col + 6, 10);
    setTxt("#daeaf6"); doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`${results.geocode.matched || "Site"} · ${results.geocode.lat?.toFixed(5)}°N · ${Math.abs(results.geocode.lon)?.toFixed(5)}°W · Satellite imagery via Mapbox`, col + 6, 17);
    y = 28;
    const imgW = W - margin * 2;
    const imgH = imgW * (300 / 600);
    doc.addImage(mapDataUrl, "JPEG", col, y, imgW, imgH);
    y += imgH + 6;
    setTxt("#999999"); doc.setFont("helvetica","normal"); doc.setFontSize(6);
    doc.text("Map for orientation only. Verify site boundaries, parcel lines, and airspace limits with official sources before proceeding.", col, y);
  }

  // ── Regulatory Checklist ──
  const regItems = results.regulatory || [];
  if (regItems.length > 0) {
    doc.addPage();
    y = 0;
    setFill("#5B9BD5");
    doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF");
    doc.rect(0, 0, 4, 22, "F");
    addPageLogo();
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
    const catNames = { FAA:"FAA / Federal Aviation", ENV:"Environmental", STATE:"State / Regional", LOCAL:"Local / Municipal", UTIL:"Utility & Infrastructure", OPS:"Operational Readiness" };

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
    setFill("#5B9BD5");
    doc.rect(0, 0, W, 22, "F");
    setFill("#FFFFFF");
    doc.rect(0, 0, 4, 22, "F");
    addPageLogo();
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
    addPageLogo();
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
      const mq = getQuadrant(siteS, dScore);
      const inv = mData.investment;
      const grade = inv?.grade?.grade || "–";
      const capex = inv?.capex?.mid ? `$${(inv.capex.mid/1e6).toFixed(1)}M` : "–";
      const npv = inv?.npv !== undefined ? `${inv.npv >= 0 ? "+" : "-"}$${(Math.abs(inv.npv)/1e6).toFixed(1)}M` : "–";
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

// ── Report V2 ────────────────────────────────────────────────
function renderGauge(score, fillHex) {
  const S = 280;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  const cx = S / 2, cy = S * 0.54, R = S * 0.36, lw = S * 0.078;
  const startA = Math.PI * 0.75, sweep = Math.PI * 1.5;
  ctx.fillStyle = "#0d1f38";
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.49, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.49, 0, Math.PI * 2);
  ctx.strokeStyle = "#1e3a5c"; ctx.lineWidth = S * 0.013; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R, startA, startA + sweep);
  ctx.strokeStyle = "#1e3a5c"; ctx.lineWidth = lw; ctx.lineCap = "butt"; ctx.stroke();
  if (score > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, R, startA, startA + (score / 100) * sweep);
    ctx.strokeStyle = fillHex; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const a = startA + (i / 4) * sweep;
    ctx.beginPath();
    ctx.moveTo(cx + (R - lw * 0.65) * Math.cos(a), cy + (R - lw * 0.65) * Math.sin(a));
    ctx.lineTo(cx + (R + lw * 0.65) * Math.cos(a), cy + (R + lw * 0.65) * Math.sin(a));
    ctx.strokeStyle = "#ffffff44"; ctx.lineWidth = S * 0.009; ctx.stroke();
  }
  ctx.fillStyle = "#ffffff"; ctx.font = `bold ${S * 0.23}px Arial`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(score), cx, cy - S * 0.02);
  ctx.fillStyle = "#6a8aaa"; ctx.font = `${S * 0.065}px Arial`;
  ctx.fillText("/100", cx, cy + S * 0.145);
  return c.toDataURL("image/png");
}

function generatePDF_v2(results, mapDataUrl = null, logoDataUrl = null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, margin = 16;
  const col = margin, colR = W - margin, contentW = W - margin * 2;
  let y = 0;
  const SAFE_BOTTOM = 274;

  const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const setFill = h => doc.setFillColor(...hex(h));
  const setDraw = h => doc.setDrawColor(...hex(h));
  const setTxt  = h => doc.setTextColor(...hex(h));

  const NAVY="#0a1628", NAVY2="#0d1f38", AMBER="#f59e0b", BLUE="#5B9BD5";
  const GREEN="#1a8a58", RED="#C0392B", AMBER_DIM="#c87a10";
  const scoreCol = s => s >= 75 ? GREEN : s >= 45 ? AMBER_DIM : RED;

  const headerLogo = logoDataUrl;
  const logoFmt = (headerLogo?.startsWith("data:image/jpeg")||headerLogo?.startsWith("data:image/jpg")) ? "JPEG" : "PNG";
  const firmDisplay = "LOWALTITUDEECONOMY.AERO";

  const siteScore = results.site?.composite || 0;
  const demandScore = results.demand?.composite || 0;
  const pi = priorityIndex(siteScore, demandScore);
  const q = getQuadrant(siteScore, demandScore);
  const em = results.evalMode || "passenger";
  const modeLabel = { passenger:"PASSENGER", cargo:"CARGO", combo:"CARGO+PAX" }[em] || em.toUpperCase();
  const modeBadgeColor = { passenger:BLUE, cargo:"#4a9a8e", combo:"#7b7bd5" }[em] || BLUE;

  const pageHeader = () => {
    setFill(NAVY2); doc.rect(0, 0, W, 14, "F");
    setFill(AMBER); doc.rect(0, 14, W, 0.6, "F");
    if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 1.5, 11, 11);
    setTxt("#888888"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
    doc.text(firmDisplay, col + (headerLogo ? 15 : 0), 8.5);
    setTxt("#555555"); doc.text(results.geocode?.matched || "Site", colR, 8.5, { align:"right" });
    y = 20;
  };
  const newPage = () => { doc.addPage(); pageHeader(); };

  const sH = title => {
    if (y + 14 > SAFE_BOTTOM) newPage();
    setFill(NAVY2); doc.rect(col, y, contentW, 10, "F");
    setFill(AMBER);  doc.rect(col, y + 10, contentW, 0.6, "F");
    setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
    doc.text(title, col + 5, y + 7);
    y += 13; return y;
  };

  const criterionCard = cr => {
    if (y + 17 > SAFE_BOTTOM) newPage();
    const sc = cr.score, cCol = sc === null ? "#9ab8d0" : scoreCol(sc);
    setFill("#f4f7fc"); setDraw("#c8d8ea"); doc.roundedRect(col, y, contentW, 15, 1.5, 1.5, "FD");
    setFill(cCol); doc.rect(col, y, 3.5, 15, "F");
    setTxt("#111111"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
    doc.text(cr.label, col + 7, y + 6.5);
    setTxt(cCol); doc.setFont("helvetica","bold"); doc.setFontSize(16);
    doc.text(sc !== null ? String(sc) : "–", col + 68, y + 10);
    setFill("#dde8f0"); doc.rect(col + 84, y + 6, 50, 3, "F");
    if (sc !== null) { setFill(cCol); doc.rect(col + 84, y + 6, 50 * sc / 100, 3, "F"); }
    if (cr.detail) {
      setTxt("#555555"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
      doc.text(doc.splitTextToSize(cr.detail, contentW - 142), col + 138, y + 5.5);
    }
    if (cr.notes) {
      setTxt("#999999"); doc.setFontSize(6);
      doc.text(doc.splitTextToSize(cr.notes, contentW - 142), col + 138, y + 9.5);
    }
    y += 17;
  };

  // ═══ PAGE 1: COVER ═════════════════════════════════════════
  setFill(NAVY); doc.rect(0, 0, W, H, "F");
  const panelSplit = mapDataUrl ? 124 : W;
  if (mapDataUrl) {
    doc.addImage(mapDataUrl, "JPEG", panelSplit, 0, W - panelSplit, H);
    setFill(NAVY); doc.rect(panelSplit, 0, 10, H, "F");
    setFill(AMBER); doc.rect(panelSplit - 0.5, 0, 1, H, "F");
  }
  setFill(NAVY2); doc.rect(0, 0, panelSplit, 16, "F");
  setFill(AMBER); doc.rect(0, 16, panelSplit, 0.6, "F");
  if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 2, 12, 12);
  setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
  doc.text(firmDisplay, col + (headerLogo ? 16 : 0), 8.5);
  setTxt("#44445a"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
  doc.text(new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}), col + (headerLogo ? 16 : 0), 13.5);

  y = 26;
  setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
  doc.text("SITE EVALUATION SYSTEM  ·  VES", col, y);
  y += 10;
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(22);
  doc.text("VERTIPORT", col, y);
  y += 8;
  setTxt(BLUE); doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.text("SITE FEASIBILITY REPORT", col, y);

  y += 14;
  const addrMaxW = panelSplit - col - 8;
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(15);
  const addrLines = doc.splitTextToSize(results.geocode?.matched || "Site Analysis", addrMaxW);
  doc.text(addrLines, col, y);
  y += addrLines.length * 7 + 3;
  setTxt("#6a8aaa"); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  doc.text(`${results.geocode?.lat?.toFixed(5)}°N  ·  ${Math.abs(results.geocode?.lon)?.toFixed(5)}°W`, col, y);
  y += 7;
  setFill(modeBadgeColor); doc.roundedRect(col, y, 34, 6.5, 1.5, 1.5, "F");
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
  doc.text(modeLabel, col + 17, y + 4.5, { align:"center" });
  y += 11;

  // PI Gauge
  const dialMM = 62;
  const dialCanvas = renderGauge(pi, pi >= 70 ? GREEN : pi >= 50 ? AMBER_DIM : RED);
  const dialCenterX = col + (addrMaxW - dialMM) / 2;
  doc.addImage(dialCanvas, "PNG", dialCenterX, y, dialMM, dialMM);
  setTxt("#6a8aaa"); doc.setFont("helvetica","bold"); doc.setFontSize(6);
  doc.text("PRIORITY INDEX", col + addrMaxW / 2, y + dialMM + 5, { align:"center" });
  y += dialMM + 10;

  // Mini score pills
  const halfW = (addrMaxW - 3) / 2;
  setFill(NAVY2); doc.roundedRect(col, y, halfW, 10, 1.5, 1.5, "F");
  setFill(NAVY2); doc.roundedRect(col + halfW + 3, y, halfW, 10, 1.5, 1.5, "F");
  setTxt("#777799"); doc.setFont("helvetica","normal"); doc.setFontSize(5);
  doc.text("SITE SCORE", col + halfW / 2, y + 3, { align:"center" });
  doc.text("DEMAND SCORE", col + halfW + 3 + halfW / 2, y + 3, { align:"center" });
  setTxt(scoreCol(siteScore)); doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text(String(siteScore), col + halfW / 2, y + 8.5, { align:"center" });
  setTxt(scoreCol(demandScore));
  doc.text(String(demandScore), col + halfW + 3 + halfW / 2, y + 8.5, { align:"center" });
  y += 14;

  // Quadrant stamp
  y += 4;
  const stampW = addrMaxW, stampH = 22;
  setFill(q.color); doc.roundedRect(col, y, stampW, stampH, 3, 3, "F");
  setDraw("#ffffff33"); doc.setLineWidth(0.5);
  doc.roundedRect(col + 2.5, y + 2.5, stampW - 5, stampH - 5, 2, 2, "D");
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text(q.label, col + stampW / 2, y + 12, { align:"center" });
  setTxt("#ffffffcc"); doc.setFont("helvetica","normal"); doc.setFontSize(6);
  doc.text(`Priority Index ${pi}/100`, col + stampW / 2, y + 18.5, { align:"center" });

  // Cover footer
  setFill(AMBER); doc.rect(0, H - 14, panelSplit, 0.5, "F");
  setFill(NAVY2); doc.rect(0, H - 13.5, panelSplit, 13.5, "F");
  setTxt("#44445a"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
  doc.text("FAA · NREL · FEMA NFHL · USGS · EIA · OSM · Census Bureau", col, H - 7);
  setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(6);
  doc.text("VES", colR, H - 7, { align:"right" });

  // ═══ PAGE 2: INSTRUMENT PANEL ══════════════════════════════
  doc.addPage();
  setFill(NAVY); doc.rect(0, 0, W, H, "F");
  setFill(NAVY2); doc.rect(0, 0, W, 14, "F");
  setFill(AMBER); doc.rect(0, 14, W, 0.6, "F");
  if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 1.5, 11, 11);
  setTxt("#888888"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
  doc.text(firmDisplay, col + (headerLogo ? 15 : 0), 8.5);
  setTxt("#555555"); doc.text(results.geocode?.matched || "Site", colR, 8.5, { align:"right" });
  y = 22;
  setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(7);
  doc.text("INSTRUMENT ASSESSMENT  ·  TWO-AXIS SCORING MODEL", col, y);
  setFill(AMBER); doc.rect(col, y + 3, contentW, 0.4, "F");
  y += 9;

  const gaugeSize = 60;
  const gGap = (contentW - 2 * gaugeSize) / 3;
  const g1x = col + gGap, g2x = col + gGap * 2 + gaugeSize;
  const demandSubLbl = { passenger:"PASSENGER DRAW", cargo:"CARGO & LOGISTICS", combo:"CARGO + PAX" }[em] || "DEMAND";
  doc.addImage(renderGauge(siteScore, scoreCol(siteScore)), "PNG", g1x, y, gaugeSize, gaugeSize);
  doc.addImage(renderGauge(demandScore, scoreCol(demandScore)), "PNG", g2x, y, gaugeSize, gaugeSize);
  const mbX = col + contentW / 2 - 14;
  setFill(modeBadgeColor); doc.roundedRect(mbX, y + gaugeSize / 2 - 4, 28, 7, 2, 2, "F");
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(6);
  doc.text(modeLabel, col + contentW / 2, y + gaugeSize / 2 + 0.5, { align:"center" });
  setTxt("#888888"); doc.setFont("helvetica","bold"); doc.setFontSize(6);
  doc.text("SITE SCORE", g1x + gaugeSize / 2, y + gaugeSize + 5, { align:"center" });
  doc.text("INFRASTRUCTURE VIABILITY", g1x + gaugeSize / 2, y + gaugeSize + 10, { align:"center" });
  doc.text("DEMAND SCORE", g2x + gaugeSize / 2, y + gaugeSize + 5, { align:"center" });
  doc.text(demandSubLbl, g2x + gaugeSize / 2, y + gaugeSize + 10, { align:"center" });
  y += gaugeSize + 16;

  const matSize = 58;
  const matX = col + (contentW - matSize - 52) / 2;
  const piBoxX = matX + matSize + 8;
  const qs = matSize / 2;
  [
    { label:["DEMAND","W/O SITE"], c:"#f59e0b", active:siteScore < 50 && demandScore >= 50, qx:matX,      qy:y },
    { label:["PRIME","SITE"],      c:"#1a8a58", active:siteScore >= 50 && demandScore >= 50, qx:matX+qs, qy:y },
    { label:["LOW","PRIORITY"],    c:"#C0392B", active:siteScore < 50 && demandScore < 50,   qx:matX,      qy:y+qs },
    { label:["INFRA","PLAY"],      c:"#5B9BD5", active:siteScore >= 50 && demandScore < 50,  qx:matX+qs, qy:y+qs },
  ].forEach(({ label, c, active, qx, qy }) => {
    if (active) { setFill(c); doc.rect(qx, qy, qs, qs, "F"); setTxt("#ffffff"); }
    else { setFill(c + "22"); setDraw(c + "66"); doc.rect(qx, qy, qs, qs, "FD"); setTxt(c); }
    doc.setFont("helvetica","bold"); doc.setFontSize(5);
    doc.text(label[0], qx + qs / 2, qy + qs / 2 - 2, { align:"center" });
    doc.text(label[1], qx + qs / 2, qy + qs / 2 + 3, { align:"center" });
  });
  const dotX = matX + (siteScore / 100) * matSize, dotY = y + (1 - demandScore / 100) * matSize;
  setFill("#ffffff"); doc.ellipse(dotX, dotY, 2.2, 2.2, "F");
  setDraw("#ffffff55"); doc.setLineWidth(0.3);
  doc.line(matX, dotY, matX + matSize, dotY);
  doc.line(dotX, y, dotX, y + matSize);
  setTxt("#44445a"); doc.setFont("helvetica","normal"); doc.setFontSize(5);
  doc.text("SITE →", matX + matSize + 1, y + matSize + 4);

  setFill(NAVY2); doc.roundedRect(piBoxX, y, 44, matSize, 2, 2, "F");
  setFill(q.color + "22"); doc.roundedRect(piBoxX, y, 44, matSize, 2, 2, "F");
  setDraw(q.color + "55"); doc.roundedRect(piBoxX, y, 44, matSize, 2, 2, "D");
  setTxt("#888888"); doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
  doc.text("PRIORITY INDEX", piBoxX + 22, y + 7, { align:"center" });
  setTxt(q.color); doc.setFont("helvetica","bold"); doc.setFontSize(28);
  doc.text(String(pi), piBoxX + 22, y + 27, { align:"center" });
  setTxt("#888888"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
  doc.text("/100", piBoxX + 22, y + 34, { align:"center" });
  setFill(q.color); doc.roundedRect(piBoxX + 4, y + matSize - 10, 36, 6, 1, 1, "F");
  setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
  doc.text(q.label, piBoxX + 22, y + matSize - 6, { align:"center" });
  y += matSize + 10;

  setFill(NAVY2); doc.roundedRect(col, y, contentW, 18, 2, 2, "F");
  setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  const descTxt = `${getSiteDesc(siteScore)}  ·  ${getDemandDesc(demandScore, em)}`;
  doc.text(doc.splitTextToSize(descTxt, contentW - 10), col + 5, y + 7);
  if (results.development_thesis) {
    setTxt(AMBER); doc.setFontSize(6.5);
    doc.text(doc.splitTextToSize("▶  " + results.development_thesis, contentW - 10), col + 5, y + 13);
  }
  y += 22;

  if (results.summary) {
    setFill(NAVY2); doc.roundedRect(col, y, contentW, 20, 2, 2, "F");
    setFill(AMBER); doc.rect(col, y, 2, 20, "F");
    setTxt("#cccccc"); doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(doc.splitTextToSize(results.summary, contentW - 10), col + 6, y + 6);
    y += 24;
  }

  // ═══ CONTENT PAGES ════════════════════════════════════════
  newPage();

  sH("SITE SCORE — INFRASTRUCTURE CRITERIA");
  [
    { label:"Parcel Size & Contours", score:results.site?.parcel?.score, notes:results.site?.parcel?.notes, detail:`${results.site?.parcel?.acreage_estimate ? `~${results.site.parcel.acreage_estimate} ac · ` : ""}${results.site?.parcel?.land_type||""}` },
    { label:"FAA Airspace",           score:results.site?.airspace?.score, notes:results.site?.airspace?.notes, detail:`${results.site?.airspace?.status||""} · ${results.site?.airspace?.nearest_airport||""}` },
    { label:"Power Grid & DER",       score:results.eia?.score??null, notes:results.eia?.notes||"EIA key not set", detail:results.eia ? `${results.eia.details?.["Grid"]||""} · ${results.eia.details?.["US sales"]||""}` : "Pending" },
    { label:"Zoning Compliance",      score:results.site?.zoning?.score, notes:results.site?.zoning?.notes, detail:`${results.site?.zoning?.compliance||""} · ${results.site?.zoning?.land_use||""}` },
    { label:"Soil Stability & Flood", score:results.site?.soil?.score, notes:results.site?.soil?.notes, detail:`${results.site?.soil?.flood_zone||""} · ${results.site?.soil?.slope_estimate||""}` },
    { label:"Community DER Support",  score:results.nrel?.score??null, notes:results.nrel?.notes||"NREL key not set", detail:results.nrel ? `${results.nrel.details?.["Utility"]||""} · GHI ${results.nrel.details?.["Solar GHI"]||"N/A"}` : "Pending" },
  ].forEach(criterionCard);

  y += 3; sH(DEMAND_HEADER[em] || "DEMAND SCORE — WHY FLY HERE?");
  (DEMAND_CRITERIA[em] || DEMAND_CRITERIA.passenger).map(cr => ({
    label: cr.label, score: results.demand?.[cr.key]?.score ?? null, notes: results.demand?.[cr.key]?.notes,
  })).forEach(criterionCard);

  const flags = results.flags || [];
  if (flags.length > 0) {
    if (y + 20 > SAFE_BOTTOM) newPage();
    y += 3; sH("FLAGS — ITEMS REQUIRING INVESTIGATION");
    flags.forEach(flag => {
      if (y + 12 > SAFE_BOTTOM) newPage();
      const ls = doc.splitTextToSize("⚑  " + flag, contentW - 6);
      const fH = ls.length * 4.5 + 6;
      setFill("#fffbec"); setDraw(AMBER); doc.roundedRect(col, y, contentW, fH, 1.5, 1.5, "FD");
      setTxt(AMBER_DIM); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.text(ls, col + 4, y + 5);
      y += fH + 2;
    });
  }

  const fly = results.flyingDays;
  if (fly) {
    if (y + 52 > SAFE_BOTTOM) newPage();
    y += 3; sH("ESTIMATED FLYING DAYS PER YEAR");
    const flyCol = fly.flyingDays >= 300 ? GREEN : fly.flyingDays >= 275 ? "#2da06a" : fly.flyingDays >= 250 ? AMBER_DIM : RED;
    setFill("#f4f7fc"); setDraw("#c8d8ea"); doc.roundedRect(col, y, contentW, 16, 1.5, 1.5, "FD");
    setFill(flyCol); doc.rect(col, y, 3.5, 16, "F");
    setTxt(flyCol); doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.text(String(fly.flyingDays), col+8, y+11);
    setTxt("#444444"); doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(`days/yr  ·  ${fly.rating}  ·  ${Math.round((fly.flyingDays/365)*100)}% availability  ·  ${fly.noFlyDays} grounded`, col+30, y+7);
    setTxt("#666666"); doc.setFontSize(6.5); doc.text(doc.splitTextToSize(fly.notes, contentW - 34), col+30, y+12);
    y += 20;
    const constraints = Object.entries(fly.breakdown).filter(([k]) => k !== "overlap");
    const cLabels3 = { thunderstorm:"Thunderstorms", fog:"Fog/Low Vis", wind:"High Wind", precip:"Heavy Precip", heat:"Extreme Heat", icing:"Icing" };
    const bw3 = (contentW - (constraints.length-1)*2) / constraints.length;
    constraints.forEach(([key, days], i) => {
      const bx3 = col + i * (bw3 + 2);
      const cCol3 = days >= 30 ? RED : days >= 15 ? AMBER_DIM : GREEN;
      setFill("#f4f7fc"); setDraw("#d0dce8"); doc.roundedRect(bx3, y, bw3, 12, 1, 1, "FD");
      setTxt("#999999"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.text(cLabels3[key]||key, bx3+2, y+4.5);
      setTxt(cCol3); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text(String(days), bx3+2, y+10);
    });
    y += 16;
  }

  const strengths = results.top_strengths || [];
  const concerns = (results.top_concerns || []).filter(Boolean);
  if (strengths.length || concerns.length) {
    const scH2 = (strengths.length + concerns.length) * 6 + 12;
    if (y + scH2 > SAFE_BOTTOM) newPage();
    y += 3;
    setFill("#f9fafb"); setDraw("#e0e8f0"); doc.roundedRect(col, y, contentW, scH2, 1.5, 1.5, "FD");
    strengths.forEach(s => { setTxt(GREEN); doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.text("✓  " + s, col+5, y+7); y += 6; });
    concerns.forEach(s => { setTxt(AMBER_DIM); doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.text("⚑  " + s, col+5, y+7); y += 6; });
    y += 8;
  }

  if (mapDataUrl) {
    doc.addPage(); y = 0;
    setFill(NAVY2); doc.rect(0, 0, W, 20, "F");
    setFill(AMBER); doc.rect(0, 20, W, 0.6, "F");
    if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 2, 12, 12);
    setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("SITE MAP — SATELLITE", col + (headerLogo ? 16 : 5), 10);
    setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`${results.geocode?.matched||"Site"} · ${results.geocode?.lat?.toFixed(5)}°N · ${Math.abs(results.geocode?.lon)?.toFixed(5)}°W`, col + (headerLogo ? 16 : 5), 16);
    y = 21;
    doc.addImage(mapDataUrl, "JPEG", 0, y, W, H - y);
    const asStatus = results.site?.airspace?.status || "Class G/E";
    const asColor = asStatus.includes("Class B SFC") ? RED : asStatus.includes("Class B") ? "#8B0000" : asStatus.includes("Class C") ? "#800080" : asStatus.includes("Class D") ? "#00008B" : GREEN;
    setFill(NAVY + "ee"); doc.roundedRect(col, H - 22, 62, 14, 2, 2, "F");
    setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(5); doc.text("AIRSPACE", col+4, H-17);
    setTxt(asColor); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text(asStatus, col+4, H-11);
  }

  {
    doc.addPage(); y = 0;
    setFill(NAVY); doc.rect(0, 0, W, 20, "F");
    setFill(AMBER); doc.rect(0, 20, W, 0.6, "F");
    if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 2, 12, 12);
    setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("REGULATORY CHECKLIST", col + (headerLogo ? 16 : 5), 10);
    const regItems = results.modes?.[em]?.regulatory?.items || results.regulatory?.items || [];
    setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
    doc.text(`${results.geocode?.matched||"Site"} · ${regItems.length} items · ${regItems.filter(r=>r.status==="required").length} required · ${regItems.filter(r=>r.urgency==="critical").length} critical`, col + (headerLogo ? 16 : 5), 16);
    y = 26;
    const regByCat = {};
    regItems.forEach(item => { const cat = item.category || "General"; if (!regByCat[cat]) regByCat[cat] = []; regByCat[cat].push(item); });
    Object.entries(regByCat).forEach(([cat, items]) => {
      if (y + 10 > SAFE_BOTTOM) { newPage(); }
      setFill("#1a2f4a"); doc.rect(col, y, contentW, 7, "F");
      setFill(AMBER); doc.rect(col, y + 7, contentW, 0.5, "F");
      setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text(cat.toUpperCase(), col+4, y+5);
      y += 9;
      items.forEach(item => {
        if (y + 10 > SAFE_BOTTOM) { newPage(); }
        const urg = item.urgency || "routine";
        const bColor = urg === "critical" ? RED : urg === "important" ? AMBER_DIM : GREEN;
        setFill(item.status === "required" ? "#fff8f0" : "#f9fafb"); setDraw("#d8e4f0");
        doc.roundedRect(col, y, contentW, 10, 1, 1, "FD");
        setFill(bColor); doc.rect(col, y, 2.5, 10, "F");
        setTxt("#222222"); doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
        doc.text(item.item || "", col+5, y+4.5);
        setTxt(item.status === "required" ? RED : GREEN); doc.setFont("helvetica","bold"); doc.setFontSize(5.5);
        doc.text((item.status||"").toUpperCase(), colR-2, y+4.5, { align:"right" });
        if (item.notes) {
          setTxt("#777777"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
          doc.text(doc.splitTextToSize(item.notes, contentW - 55), col+5, y+7.5);
        }
        y += 11.5;
      });
      y += 3;
    });
  }

  {
    const inv = results.modes?.[em]?.investment || results.investment;
    if (inv) {
      doc.addPage(); y = 0;
      setFill(NAVY); doc.rect(0, 0, W, 20, "F");
      setFill(AMBER); doc.rect(0, 20, W, 0.6, "F");
      if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 2, 12, 12);
      setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(10);
      doc.text("INVESTMENT & VIABILITY", col + (headerLogo ? 16 : 5), 10);
      setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
      doc.text(`${modeLabel} mode · Grade ${inv.grade?.grade||"—"} · CAPEX $${inv.capex?.mid ? (inv.capex.mid/1e6).toFixed(1) : "–"}M`, col + (headerLogo ? 16 : 5), 16);
      y = 26;
      const gColor = { A:GREEN, B:"#2da06a", C:AMBER_DIM, D:RED }[inv.grade?.grade] || AMBER_DIM;
      setFill(gColor); doc.roundedRect(col, y, contentW, 18, 2, 2, "F");
      setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(22); doc.text(inv.grade?.grade||"–", col+12, y+14);
      doc.setFontSize(9); doc.text(inv.grade?.label||"", col+26, y+8);
      doc.setFont("helvetica","normal"); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(inv.grade?.description||"", contentW - 32), col+26, y+13.5);
      y += 22;
      if (inv.scenario) {
        setFill(NAVY2); doc.roundedRect(col, y, contentW, 10, 1.5, 1.5, "F");
        setTxt(AMBER); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("DEVELOPMENT SCENARIO", col+5, y+4);
        setTxt("#ffffff"); doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.text(inv.scenario, col+5, y+8.5);
        y += 13;
      }
      y += 3; sH("CAPITAL EXPENDITURE BREAKDOWN");
      [
        { label:"Site Acquisition",    lo:inv.capex?.acquisition?.low,    mid:inv.capex?.acquisition?.mid,    hi:inv.capex?.acquisition?.high },
        { label:"Infrastructure Build",lo:inv.capex?.infrastructure?.low,  mid:inv.capex?.infrastructure?.mid,  hi:inv.capex?.infrastructure?.high },
        { label:"Equipment & Systems", lo:inv.capex?.equipment?.low,       mid:inv.capex?.equipment?.mid,       hi:inv.capex?.equipment?.high },
        { label:"Permits & Compliance",lo:inv.capex?.permits?.low,         mid:inv.capex?.permits?.mid,         hi:inv.capex?.permits?.high },
        { label:"Contingency",         lo:inv.capex?.contingency?.low,     mid:inv.capex?.contingency?.mid,     hi:inv.capex?.contingency?.high },
        { label:"TOTAL CAPEX",         lo:inv.capex?.low,                  mid:inv.capex?.mid,                  hi:inv.capex?.high, total:true },
      ].forEach((ci, ri) => {
        if (ci.mid == null && !ci.total) return;
        if (y + 9 > SAFE_BOTTOM) newPage();
        const fmt = v => v != null ? `$${(v/1e6).toFixed(1)}M` : "–";
        if (ci.total) { setFill(NAVY2); doc.rect(col, y, contentW, 9, "F"); setTxt("#ffffff"); }
        else { setFill(ri % 2 === 0 ? "#f4f7fc" : "#ffffff"); doc.rect(col, y, contentW, 9, "F"); setTxt("#222222"); }
        doc.setFont("helvetica", ci.total ? "bold" : "normal"); doc.setFontSize(7); doc.text(ci.label, col+4, y+6);
        setTxt(ci.total ? "#999999" : "#777777"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
        doc.text(`${fmt(ci.lo)} – ${fmt(ci.hi)}`, colR - 48, y+6);
        setTxt(ci.total ? "#ffffff" : "#222222"); doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
        doc.text(fmt(ci.mid), colR-4, y+6, { align:"right" });
        y += 9;
      });
      if (inv.npv !== undefined) {
        y += 4;
        const npvColor = inv.npv >= 0 ? GREEN : RED;
        setFill(npvColor + "22"); setDraw(npvColor + "66"); doc.roundedRect(col, y, contentW, 12, 1.5, 1.5, "FD");
        setTxt(npvColor); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("10-YEAR NPV", col+5, y+5);
        doc.setFontSize(14); doc.text(`${inv.npv >= 0 ? "+" : "-"}$${(Math.abs(inv.npv)/1e6).toFixed(1)}M`, colR-4, y+9, { align:"right" });
        y += 16;
      }
      if (inv.risks?.length) {
        y += 3; sH("RISK ASSESSMENT");
        inv.risks.forEach(r => {
          if (y + 9 > SAFE_BOTTOM) newPage();
          const rCol2 = r.score >= 65 ? RED : r.score >= 40 ? AMBER_DIM : GREEN;
          setFill("#f9f9f9"); setDraw("#e0e8f0"); doc.roundedRect(col, y, contentW, 9, 1, 1, "FD");
          setFill(rCol2); doc.rect(col, y, 2.5, 9, "F");
          setTxt("#222222"); doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.text(r.category||r.risk||"", col+5, y+3.5);
          setTxt("#777777"); doc.setFontSize(6); doc.text(doc.splitTextToSize(r.notes||r.mitigation||"", contentW - 50), col+5, y+7);
          setTxt(rCol2); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.text(r.label||(r.level||"").toUpperCase()||"", colR-2, y+5.5, { align:"right" });
          y += 10;
        });
      }
      if (inv.timeline) {
        y += 3; sH(`DEVELOPMENT TIMELINE — ${inv.timeline.totalMonths} MONTHS`);
        const tlPhases = inv.timeline.phases || [];
        const totalMo = inv.timeline.totalMonths || 1;
        let tx = col;
        tlPhases.forEach(p => {
          const tw = contentW * (p.months || 0) / totalMo;
          if (tw < 1) { tx += tw; return; }
          const pColor = (p.name||"").toLowerCase().includes("pre") ? "#777777" : (p.name||"").toLowerCase().includes("design") || (p.name||"").toLowerCase().includes("permit") ? AMBER_DIM : (p.name||"").toLowerCase().includes("construct") ? BLUE : GREEN;
          setFill(pColor); doc.roundedRect(tx, y, tw - 0.5, 8, 1, 1, "F");
          setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(5);
          if (tw > 14) doc.text(`${p.name} (${p.months}mo)`, tx + tw/2, y+5.5, { align:"center" });
          tx += tw;
        });
        y += 12;
      }
    }
  }

  {
    const modes3 = [{ id:"passenger",label:"PASSENGER" },{ id:"cargo",label:"CARGO" },{ id:"combo",label:"CARGO+PAX" }];
    if (modes3.some(m => results.modes?.[m.id])) {
      doc.addPage(); y = 0;
      setFill(NAVY); doc.rect(0, 0, W, 20, "F");
      setFill(AMBER); doc.rect(0, 20, W, 0.6, "F");
      if (headerLogo) doc.addImage(headerLogo, logoFmt, col, 2, 12, 12);
      setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.text("MULTI-MODE COMPARISON", col+(headerLogo?16:5), 10);
      y = 26;
      const cW3 = (contentW - 4) / 3;
      modes3.forEach((m, i) => {
        const mx = col + i * (cW3 + 2), mData2 = results.modes?.[m.id];
        if (!mData2) return;
        const mD = mData2.demand?.composite || 0, mPI2 = priorityIndex(siteScore, mD), mq2 = getQuadrant(siteScore, mD);
        const inv2 = mData2.investment, isActive = m.id === em;
        const mBc = { passenger:BLUE, cargo:"#4a9a8e", combo:"#7b7bd5" }[m.id] || BLUE;
        setFill(isActive ? mBc : NAVY2); doc.roundedRect(mx, y, cW3, 10, 2, 2, "F");
        setTxt("#ffffff"); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.text(m.label, mx+cW3/2, y+7, { align:"center" });
        let cy3 = y + 13;
        [["SITE", siteScore],["DEMAND", mD],["P.I.", mPI2]].forEach(([lbl3, sc3]) => {
          const cCol4 = scoreCol(sc3);
          setTxt(cCol4); doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.text(String(sc3), mx+8, cy3+7);
          setTxt("#999999"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.text(lbl3, mx+8, cy3+2);
          setFill("#e0eaf4"); doc.rect(mx+20, cy3+4, cW3-22, 2, "F");
          setFill(cCol4); doc.rect(mx+20, cy3+4, (cW3-22)*sc3/100, 2, "F");
          cy3 += 9;
        });
        setFill(mq2.color+"22"); setDraw(mq2.color+"55"); doc.roundedRect(mx, cy3, cW3, 8, 1, 1, "FD");
        setTxt(mq2.color); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.text(mq2.label, mx+cW3/2, cy3+5.5, { align:"center" });
        cy3 += 11;
        if (inv2?.npv !== undefined) {
          const npvStr3 = `${inv2.npv >= 0 ? "+" : "-"}$${(Math.abs(inv2.npv)/1e6).toFixed(1)}M NPV`;
          setTxt(inv2.npv >= 0 ? GREEN : RED); doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
          doc.text(npvStr3, mx+cW3/2, cy3+4, { align:"center" });
          cy3 += 8;
        }
        if (mData2.summary) {
          setTxt("#666666"); doc.setFont("helvetica","normal"); doc.setFontSize(5.5);
          doc.text(doc.splitTextToSize(mData2.summary, cW3-2), mx, cy3);
        }
      });
    }
  }

  const totalPgs = doc.internal.getNumberOfPages();
  for (let pg = 3; pg <= totalPgs; pg++) {
    doc.setPage(pg);
    setFill("#dde8f0"); doc.rect(0, H - 8, W, 0.4, "F");
    setTxt("#aaaaaa"); doc.setFont("helvetica","normal"); doc.setFontSize(5);
    doc.text(`VES  ·  ${firmDisplay}`, col, H - 4);
    doc.text(`${results.geocode?.matched||"Site"}  ·  Page ${pg} of ${totalPgs}`, colR, H - 4, { align:"right" });
  }

  const filename2 = `vertiport-report-${(results.geocode?.matched||"site").split(",")[0].replace(/\s+/g,"-").toLowerCase()}.pdf`;
  doc.save(filename2);
}

// buildPrompt, extractLLMJson, analyzeWithClaude,
// fetchEIAPowerScore, fetchNRELDERScore, fetchTexasParcelScore,
// fetchFEMAFloodScore, fetchZoningScore, scoreAirspace
// — all imported from ./scoring.js


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

function SiteCard({ label, icon, score, details, pending, notes }) {
  const color = pending ? C.pending : scoreColor(score);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color,borderRadius:"8px 0 0 8px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{color:C.textLabel,fontSize:9,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.12em",marginBottom:3}}>{icon} {label.toUpperCase()}</div>
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
          Source: NOAA 30-year climate normals (1991-2020) · IDW interpolation from 80+ US reference stations · eVTOL operational thresholds
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
          Projections are model estimates based on evaluation data, industry benchmarks (NEXA, McKinsey), and 2025-2026 US construction cost indices. Not financial advice. Independent feasibility study required before investment decisions. NPV at 8% discount rate.
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

function parseCoords(lat,lon){const la=parseFloat(lat),lo=parseFloat(lon);if(isNaN(la)||isNaN(lo))return null;if(la<18||la>72||lo<-180||lo>-65)return null;return{lat:la,lon:lo};}

const ADDR_EXAMPLES=["8900 Will Clayton Pkwy, Humble TX","1400 Post Oak Blvd, Houston TX","3900 N Causeway Blvd, Metairie LA","1600 E Grand Ave, El Segundo CA"];
const COORD_EXAMPLES=[{label:"Texas Medical Center",lat:"29.7079",lon:"-95.4010"},{label:"O'Hare Cargo Area",lat:"41.9857",lon:"-87.9284"},{label:"Port of LA",lat:"33.7361",lon:"-118.2639"}];

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
    // AcyMailing submission — non-blocking, gate passes regardless
    const base = import.meta.env.VITE_ACYM_BASE_URL;
    const key  = import.meta.env.VITE_ACYM_API_KEY;
    const list = import.meta.env.VITE_ACYM_LIST_ID;

    if (base && key && list) {
      const headers = { "Api-Key": key, "Content-Type": "application/json" };
      const apiUrl  = `${base}/index.php?page=acymailing_front&option=com_acym&ctrl=api`;

      await fetch(`${apiUrl}&task=createOrUpdateUser`, {
        method: "POST", headers,
        body: JSON.stringify({ email: email.trim(), name: firstName.trim(), active: 1, confirmed: 1, sendConf: false, customFields: [{ id: 4, value: role }] }),
      }).catch(() => {});

      await fetch(`${apiUrl}&task=subscribeUsers`, {
        method: "POST", headers,
        body: JSON.stringify({ emails: [email.trim()], listIds: [list], sendWelcomeEmail: true, trigger: true }),
      }).catch(() => {});
    }
    if (window.electronAPI) {
      const cfg = await window.electronAPI.getConfig().catch(() => ({}));
      await window.electronAPI.setConfig({ ...cfg, veval_beta_access: { email: email.trim(), role, ts: Date.now() } }).catch(() => {});
    } else {
      localStorage.setItem("veval_beta_access", JSON.stringify({ email: email.trim(), role, ts: Date.now() }));
    }
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
    { icon: "◈", title: "Priority Index", body: "Composite index combining site infrastructure and demand potential. Quadrant placement tells you exactly where to focus your due diligence." },
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
          No credit card. Any US address. Free during beta.
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
          FAA/NREL CALIBRATED · NATIONWIDE
        </span>
      </footer>

      {showGate && <EmailGate onAccess={onStart} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR NAV + PANEL ARCHITECTURE
   Theme tokens, context, and layout components live here.
   All scoring/API logic stays inside App() below.
═══════════════════════════════════════════════════════════════ */

const LIGHT_T = {
  sidebarBg:'#ffffff', sidebarBorder:'#e2e8f0',
  navActiveBg:'rgba(91,155,213,0.09)', navActiveBorder:'rgba(91,155,213,0.22)',
  navActiveColor:'#5B9BD5', navInactive:'#4b5563', navLabel:'#b0bec5',
  topbarBg:'#ffffff', topbarBorder:'#e2e8f0',
  mainBg:'#f0f4f8',
  cardBg:'#ffffff', cardBorder:'#e2e8f0', cardShadow:'0 1px 3px rgba(0,0,0,0.06)',
  textPrimary:'#0f172a', textSecondary:'#374151', textMuted:'#64748b', textHint:'#94a3b8',
  divider:'#f1f5f9', inputBg:'#f8fafc',
  pillBg:'#f1f5f9', logoText:'#0f172a', logoSub:'#94a3b8',
  toggleBg:'#f1f5f9', toggleColor:'#64748b',
};
const DARK_T = {
  sidebarBg:'#0a1628', sidebarBorder:'#1a3a5c',
  navActiveBg:'rgba(6,182,212,0.12)', navActiveBorder:'rgba(6,182,212,0.22)',
  navActiveColor:'#06b6d4', navInactive:'#94a3b8', navLabel:'#2a4a6c',
  topbarBg:'#0f2137', topbarBorder:'#1a3a5c',
  mainBg:'#060e1a',
  cardBg:'#0f2137', cardBorder:'#1a3a5c', cardShadow:'0 1px 4px rgba(0,0,0,0.3)',
  textPrimary:'#f1f5f9', textSecondary:'#e2e8f0', textMuted:'#94a3b8', textHint:'#475569',
  divider:'#1a3a5c', inputBg:'#0a1628',
  pillBg:'#1a3a5c', logoText:'#f1f5f9', logoSub:'#4a6fa5',
  toggleBg:'#1a3a5c', toggleColor:'#94a3b8',
};
const tok = t => t === 'dark' ? DARK_T : LIGHT_T;

const AppCtx = createContext({});
const useApp = () => useContext(AppCtx);

/* ─── PRO GATE ────────────────────────────────── */
function ProGate({ isPro, children }) {
  if (isPro) return children;
  return (
    <div style={{ position:'relative' }}>
      <div style={{ filter:'blur(3px)', opacity:0.4, pointerEvents:'none', userSelect:'none' }}>
        {children}
      </div>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                    justifyContent:'center', borderRadius:8 }}>
        <div style={{ textAlign:'center', padding:'20px 28px', background:'rgba(255,255,255,0.96)',
                      border:'1px solid #e2e8f0', borderRadius:10,
                      boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize:22, marginBottom:8 }}>🔒</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700,
                        color:C.amber, letterSpacing:'0.15em', marginBottom:6 }}>PRO FEATURE</div>
          <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>
            Available in the Desktop Analyst plan
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SITE PICKER (sidebar dropdown) ──────────── */
function SitePicker() {
  const { results, recentReports, loadReport, setActivePanel, theme } = useApp();
  const T = tok(theme);
  const [open, setOpen] = useState(false);
  const siteName = results?.geocode?.matched || 'No site loaded';
  const siteScore = results?.site?.composite;

  return (
    <div style={{ padding:'10px 12px', borderBottom:`1px solid ${T.sidebarBorder}`, position:'relative' }}>
      <div onClick={() => recentReports.length && setOpen(o => !o)}
        style={{ cursor: recentReports.length ? 'pointer' : 'default',
                 background:T.inputBg, borderRadius:8, padding:'10px 12px',
                 border:`1px solid ${T.sidebarBorder}` }}>
        <div style={{ fontSize:9, color:T.navLabel, fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'0.08em', marginBottom:4,
                      fontFamily:"'IBM Plex Mono',monospace" }}>ACTIVE SITE</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textPrimary, whiteSpace:'nowrap',
                          overflow:'hidden', textOverflow:'ellipsis',
                          fontFamily:"'IBM Plex Mono',monospace" }}>{siteName}</div>
            {results && <div style={{ fontSize:9, color:T.textMuted, marginTop:1 }}>Current session</div>}
          </div>
          {siteScore != null && (
            <div style={{ flexShrink:0, background:T.cardBg, border:`1px solid ${T.cardBorder}`,
                          borderRadius:6, padding:'4px 8px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:T.textHint,
                            fontFamily:"'IBM Plex Mono',monospace" }}>SCORE</div>
              <div style={{ fontSize:13, fontWeight:800, color:scoreColor(siteScore),
                            fontFamily:"'IBM Plex Mono',monospace", lineHeight:1 }}>{siteScore}</div>
            </div>
          )}
          {recentReports.length > 0 && (
            <span style={{ fontSize:10, color:T.textHint,
                           transform:open?'rotate(180deg)':'none',
                           transition:'transform 0.15s', flexShrink:0 }}>▾</span>
          )}
        </div>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% - 2px)', left:12, right:12,
                      background:T.sidebarBg, border:`1px solid ${T.sidebarBorder}`,
                      borderRadius:'0 0 9px 9px', zIndex:200,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.14)',
                      maxHeight:260, overflowY:'auto' }}>
          {recentReports.map(r => (
            <div key={r.id}
              onClick={() => { loadReport(r); setOpen(false); setActivePanel('dashboard'); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                       cursor:'pointer', borderBottom:`1px solid ${T.divider}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.textPrimary, overflow:'hidden',
                              textOverflow:'ellipsis', whiteSpace:'nowrap',
                              fontFamily:"'IBM Plex Mono',monospace" }}>{r.display}</div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:1 }}>{r.evalMode||'passenger'}</div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:scoreColor(r.scores?.site),
                            fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                {r.scores?.site}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SIDEBAR ─────────────────────────────────── */
function VESSidebar({ isPro }) {
  const { activePanel, setActivePanel, theme, setTheme, results,
          pdfGenerating, handleDownloadPDF, llmConfig, setShowSetup } = useApp();
  const T = tok(theme);

  const siteScore = results?.site?.composite;
  const regItems = results?.modes?.passenger?.regulatory || [];
  const critCount = regItems.filter(i => i.urgency === 'critical').length;
  const flagCount = results?.flags?.length || 0;

  const panels = [
    { id:'dashboard',      label:'Dashboard',      icon:'⊞',  badge:null, bc:null, proOnly:false },
    { id:'site',           label:'Site Analysis',  icon:'📍', badge:siteScore!=null?String(siteScore):null, bc:null, proOnly:false },
    { id:'infrastructure', label:'Infrastructure', icon:'🏗️', badge:null, bc:null, proOnly:false },
    { id:'regulatory',     label:'Regulatory',     icon:'🛡️', badge:critCount>0?String(critCount):null, bc:'#dc2626', proOnly:false },
    { id:'financial',      label:'Financial',      icon:'💰', badge:null, bc:null, proOnly:true },
    { id:'actions',        label:'Action Items',   icon:'✅', badge:flagCount>0?String(flagCount):null, bc:'#d97706', proOnly:true },
    { id:'map',            label:'Map View',       icon:'🗺️', badge:null, bc:null, proOnly:false },
    { id:'batch',          label:'Batch Scoring',  icon:'⬡',  badge:null, bc:null, proOnly:true  },
  ];

  return (
    <div style={{ width:228, background:T.sidebarBg, display:'flex', flexDirection:'column',
                  flexShrink:0, borderRight:`1px solid ${T.sidebarBorder}`, height:'100vh',
                  fontFamily:"'IBM Plex Sans',sans-serif" }}>
      {/* Logo */}
      <div style={{ padding:'16px 16px 14px', borderBottom:`1px solid ${T.sidebarBorder}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src={aamLogo} alt="LAE" style={{ width:34, height:34, objectFit:'contain', flexShrink:0 }}/>
          <div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontWeight:900, fontSize:13,
                          color:T.logoText, letterSpacing:'0.1em' }}>VES</div>
            <div style={{ fontSize:9, fontWeight:600, color:T.logoSub,
                          fontFamily:"'IBM Plex Mono',monospace",
                          letterSpacing:'0.08em' }}>VERTIPORT EVAL</div>
          </div>
          {!isPro && (
            <span style={{ marginLeft:'auto', fontSize:8, fontFamily:"'IBM Plex Mono',monospace",
                           color:C.amber, background:'rgba(91,155,213,0.1)',
                           border:'1px solid rgba(91,155,213,0.2)', borderRadius:3,
                           padding:'2px 6px', letterSpacing:'0.05em', flexShrink:0 }}>FREE</span>
          )}
        </div>
      </div>

      <SitePicker/>

      <nav style={{ padding:'8px', flex:1, overflowY:'auto' }}>
        <div style={{ fontSize:9, color:T.navLabel, fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'0.1em', padding:'6px 10px 4px',
                      fontFamily:"'IBM Plex Mono',monospace" }}>NAVIGATION</div>
        {panels.map(n => {
          const on = activePanel === n.id;
          return (
            <button key={n.id} onClick={() => setActivePanel(n.id)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                       borderRadius:8, marginBottom:1,
                       background:on ? T.navActiveBg : 'transparent',
                       border:on ? `1px solid ${T.navActiveBorder}` : '1px solid transparent',
                       color:on ? T.navActiveColor : T.navInactive, cursor:'pointer',
                       fontSize:13, fontWeight:on?700:500, textAlign:'left',
                       transition:'background 0.13s, color 0.13s',
                       fontFamily:"'IBM Plex Sans',sans-serif" }}>
              <span style={{ fontSize:15 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {n.proOnly && !isPro && (
                <span style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:C.amber,
                               background:'rgba(91,155,213,0.1)',
                               border:'1px solid rgba(91,155,213,0.2)',
                               borderRadius:3, padding:'1px 5px' }}>PRO</span>
              )}
              {n.badge && (
                <span style={{ fontSize:10, fontWeight:800,
                               background:n.bc ? n.bc+'22' : T.pillBg,
                               color:n.bc || T.textHint, padding:'1px 6px', borderRadius:10,
                               border:`1px solid ${n.bc ? n.bc+'44' : T.sidebarBorder}`,
                               fontFamily:"'IBM Plex Mono',monospace" }}>
                  {n.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding:'10px 12px', borderTop:`1px solid ${T.sidebarBorder}`,
                    display:'flex', flexDirection:'column', gap:8 }}>
        {results && (
          <button onClick={handleDownloadPDF} disabled={pdfGenerating}
            style={{ width:'100%', padding:'8px 12px', background:'#5B9BD5', border:'none',
                     borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer',
                     fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.08em',
                     opacity:pdfGenerating ? 0.6 : 1 }}>
            📄 {pdfGenerating ? 'GENERATING…' : 'EXPORT PDF'}
          </button>
        )}
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderRadius:8,
                   border:`1px solid ${T.sidebarBorder}`, background:T.toggleBg,
                   color:T.toggleColor, fontSize:12, fontWeight:600, cursor:'pointer',
                   width:'100%', fontFamily:"'IBM Plex Sans',sans-serif" }}>
          <span style={{ fontSize:14 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        {window.electronAPI && (
          <button onClick={() => setShowSetup(true)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderRadius:7,
                     border:`1px solid ${T.sidebarBorder}`, background:'none',
                     color:T.toggleColor, fontSize:10, cursor:'pointer', width:'100%',
                     fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.08em' }}>
            ⚙ {llmConfig?.provider?.toUpperCase() || 'SETUP'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── TOP BAR ─────────────────────────────────── */
const CRUMBS_MAP = {
  dashboard:'Dashboard', site:'Site Analysis', infrastructure:'Infrastructure',
  regulatory:'Regulatory', financial:'Financial', actions:'Action Items', map:'Map View',
};

function VESTopBar() {
  const { activePanel, results, phase, theme } = useApp();
  const T = tok(theme);
  const live = phase === 'loading';
  const hasData = !!results;
  return (
    <div style={{ height:50, background:T.topbarBg, borderBottom:`1px solid ${T.topbarBorder}`,
                  display:'flex', alignItems:'center', padding:'0 24px', gap:12, flexShrink:0 }}>
      <span style={{ fontSize:11, color:T.textHint,
                     fontFamily:"'IBM Plex Mono',monospace" }}>VES</span>
      <span style={{ color:T.textHint }}>›</span>
      <span style={{ fontSize:14, fontWeight:700, color:T.textPrimary,
                     fontFamily:"'IBM Plex Sans',sans-serif" }}>{CRUMBS_MAP[activePanel]}</span>
      <div style={{ flex:1 }}/>
      {results?.geocode?.matched && (
        <span style={{ fontSize:11, color:T.textMuted, fontFamily:"'IBM Plex Mono',monospace",
                       maxWidth:240, overflow:'hidden', textOverflow:'ellipsis',
                       whiteSpace:'nowrap' }}>{results.geocode.matched}</span>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:T.textMuted,
                    background:T.inputBg, padding:'4px 10px', borderRadius:20,
                    border:`1px solid ${T.sidebarBorder}`,
                    fontFamily:"'IBM Plex Mono',monospace" }}>
        <div style={{ width:6, height:6, borderRadius:'50%',
                      background:live ? '#f59e0b' : hasData ? '#22c55e' : '#94a3b8' }}/>
        {live ? 'ANALYZING…' : hasData ? 'LIVE DATA' : 'NO SITE LOADED'}
      </div>
    </div>
  );
}

/* ─── NO-DATA PLACEHOLDER ─────────────────────── */
function NoPanelData({ onGo }) {
  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:32, marginBottom:16 }}>📡</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:C.textLabel,
                      marginBottom:16 }}>No site loaded — run an analysis first.</div>
        <button onClick={onGo}
          style={{ background:'transparent', border:`1px solid ${C.amber}`, color:C.amber,
                   fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:'0.2em',
                   padding:'10px 24px', borderRadius:6, cursor:'pointer' }}>
          GO TO DASHBOARD →
        </button>
      </div>
    </div>
  );
}

/* ─── RECENT REPORTS PANEL ─────────────────────── */
function RecentReportsPanel({ compact }) {
  const { recentReports, loadReport, rerunReport, clearRecent, phase, theme } = useApp();
  const T = tok(theme);
  if (!recentReports.length) return null;
  function relativeTime(ts){const s=Math.floor((Date.now()-new Date(ts))/1000);if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;}
  return (
    <div style={{ border:`1px solid ${T.cardBorder}`, borderRadius:8, overflow:'hidden',
                  maxWidth: compact ? undefined : 700 }}>
      <div style={{ padding:'9px 16px', background:T.cardBg,
                    borderBottom:`1px solid ${T.cardBorder}`,
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                       letterSpacing:'0.2em', color:T.textMuted }}>RECENT REPORTS</span>
        <button onClick={clearRecent}
          style={{ background:'none', border:'none', cursor:'pointer',
                   fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                   color:T.textHint, letterSpacing:'0.1em' }}>CLEAR ALL</button>
      </div>
      {recentReports.slice(0, compact ? 3 : 10).map(r => {
        const q = getQuadrant(r.scores.site, r.scores.demand);
        const btnBase = { fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.12em',
                          padding:'5px 10px', borderRadius:4, cursor:'pointer',
                          border:`1px solid ${T.cardBorder}` };
        return (
          <div key={r.id}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
                     borderBottom:`1px solid ${T.cardBorder}`, background:T.inputBg }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.textPrimary,
                            overflow:'hidden', textOverflow:'ellipsis',
                            whiteSpace:'nowrap' }}>{r.display}</div>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                             color:q.color }}>{q.label}</span>
            </div>
            <div style={{ display:'flex', gap:6, whiteSpace:'nowrap', flexShrink:0 }}>
              {[['S',r.scores.site],['D',r.scores.demand],['PI',r.scores.pi]].map(([lbl,val]) => (
                <div key={lbl} style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`,
                                        borderRadius:4, padding:'4px 9px', display:'flex',
                                        flexDirection:'column', alignItems:'center', gap:1 }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8,
                                 color:T.textHint }}>{lbl}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13,
                                 fontWeight:600, color:scoreColor(val), lineHeight:1 }}>{val}</span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                           color:T.textHint, whiteSpace:'nowrap' }}>{relativeTime(r.ts)}</span>
            <button onClick={() => loadReport(r)}
              style={{ ...btnBase, background:T.cardBg, color:T.textMuted }}>LOAD</button>
            <button onClick={() => rerunReport(r)}
              style={{ ...btnBase, background:'transparent', color:C.amber, borderColor:C.amber }}
              disabled={phase === 'loading'}>{phase === 'loading' ? '…' : 'RE-RUN'}</button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PANEL: DASHBOARD ─────────────────────────── */
function DashboardPanel({ isPro }) {
  const { results, phase, log, error, mode, setMode, address, setAddress,
          lat, setLat, lon, setLon, siteLabel, setSiteLabel, run, reset,
          demandTab, setDemandTab, recentReports, theme, setActivePanel } = useApp();
  const T = tok(theme);
  const canRun = phase !== 'loading' && (
    mode === 'address' ? address.trim().length > 0 : parseCoords(lat, lon) !== null
  );
  const inputStyle = { background:T.inputBg, border:`1px solid ${T.sidebarBorder}`,
                        borderRadius:6, color:T.textPrimary,
                        fontFamily:"'IBM Plex Mono',monospace", fontSize:12,
                        padding:'11px 14px', width:'100%' };
  const tabSty = (active) => ({
    background:'transparent',
    border:`1px solid ${active ? C.amber : T.sidebarBorder}`,
    color:active ? C.amber : T.textMuted,
    fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
    letterSpacing:'0.12em', padding:'6px 14px', borderRadius:4, cursor:'pointer',
  });

  if (phase === 'complete' && results) {
    const siteScore = results.site?.composite || 0;
    const mData = results.modes?.[demandTab] || {};
    const demandScore = mData.demand?.composite || 0;
    const pi = priorityIndex(siteScore, demandScore);
    const q = getQuadrant(siteScore, demandScore);
    const demandSubLabel = { passenger:'passenger draw', cargo:'cargo & logistics',
                              combo:'cargo + passenger' }[demandTab] || 'demand';
    return (
      <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
        {/* Demand mode tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                        letterSpacing:'0.2em', marginRight:8, flexShrink:0 }}>EVALUATION MODE:</div>
          {[{id:'passenger',label:'PASSENGER'},{id:'cargo',label:'CARGO'},{id:'combo',label:'CARGO+PAX'}].map(m => {
            const mDemand = results.modes?.[m.id]?.demand?.composite || 0;
            const mPI = priorityIndex(siteScore, mDemand);
            const active = demandTab === m.id;
            return (
              <button key={m.id} onClick={() => setDemandTab(m.id)}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'0.12em',
                         padding:'7px 16px', borderRadius:4, cursor:'pointer',
                         border:`1px solid ${active ? C.amber : T.sidebarBorder}`,
                         background:active ? C.amberGlow : 'transparent',
                         color:active ? C.amber : T.textMuted, transition:'all 0.15s' }}>
                {m.label} · D:{mDemand} · PI:{mPI}
              </button>
            );
          })}
        </div>

        {/* Score hero */}
        <div style={{ display:'flex', gap:20, background:T.cardBg, border:`1px solid ${T.cardBorder}`,
                      borderRadius:12, padding:'22px 24px', marginBottom:20, flexWrap:'wrap',
                      boxShadow:T.cardShadow }}>
          <QuadrantPlot site={siteScore} demand={demandScore}
                        previousSite={null} previousDemand={null}/>
          <div style={{ flex:1, minWidth:240 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                          letterSpacing:'0.2em', marginBottom:8 }}>DUAL-AXIS ASSESSMENT</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13,
                          color:T.textPrimary, marginBottom:3 }}>{results.geocode.matched}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
                          color:C.textLabel, marginBottom:14 }}>
              {results.geocode.lat?.toFixed(5)}°N · {Math.abs(results.geocode.lon)?.toFixed(5)}°W
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <ScorePill label="SITE SCORE" score={siteScore} sub="infrastructure viability"/>
              <ScorePill label="DEMAND SCORE" score={demandScore} sub={demandSubLabel}/>
              <ScorePill label="PRIORITY INDEX" score={pi} sub="composite score"/>
            </div>
            <div style={{ padding:'10px 14px', background:`${q.color}0e`,
                          border:`1px solid ${q.color}33`, borderRadius:6, marginBottom:12 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:600,
                            color:q.color, marginBottom:6, letterSpacing:'0.1em' }}>{q.label}</div>
              <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12,
                            color:T.textSecondary, lineHeight:1.5 }}>{getSiteDesc(siteScore)}</div>
              <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12,
                            color:T.textSecondary, lineHeight:1.5,
                            marginTop:4 }}>{getDemandDesc(demandScore, demandTab)}</div>
            </div>
            {mData.summary && (
              <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12,
                            color:T.textSecondary, lineHeight:1.65, marginBottom:10,
                            paddingLeft:12, borderLeft:`2px solid ${T.cardBorder}` }}>
                {mData.summary}
              </div>
            )}
            {mData.development_thesis && (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:C.amber,
                            marginBottom:12, lineHeight:1.5 }}>▶ {mData.development_thesis}</div>
            )}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {(mData.top_strengths||[]).map((s,i) => (
                <span key={i} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                                       color:C.green, background:'rgba(26,138,88,0.09)',
                                       border:'1px solid rgba(26,138,88,0.25)',
                                       borderRadius:3, padding:'3px 9px' }}>✓ {s}</span>
              ))}
              {(mData.top_concerns||[]).filter(Boolean).map((s,i) => (
                <span key={i} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                                       color:C.yellow, background:'rgba(200,122,16,0.09)',
                                       border:'1px solid rgba(200,122,16,0.25)',
                                       borderRadius:3, padding:'3px 9px' }}>⚑ {s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Section nav cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { id:'site', label:'Site Analysis', icon:'📍', score:results.site?.composite, sub:'Parcel · Airspace · Zoning · Flood' },
            { id:'infrastructure', label:'Infrastructure', icon:'🏗️', score:results.eia?.score, sub:'Power Grid · DER · Flying Days' },
            { id:'regulatory', label:'Regulatory', icon:'🛡️', score:null, sub:'FAA · Environmental · Local' },
          ].map(s => (
            <div key={s.id} onClick={() => setActivePanel(s.id)}
              style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:10,
                       padding:16, cursor:'pointer', boxShadow:T.cardShadow,
                       transition:'box-shadow 0.15s, transform 0.13s' }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                            alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:9, color:T.textHint, fontWeight:700,
                                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3,
                                fontFamily:"'IBM Plex Mono',monospace" }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize:11, color:T.textMuted }}>{s.sub}</div>
                </div>
                {s.score != null && (
                  <div style={{ fontSize:24, fontWeight:900, color:scoreColor(s.score),
                                fontFamily:"'IBM Plex Mono',monospace", lineHeight:1 }}>{s.score}</div>
                )}
              </div>
              <div style={{ fontSize:12, color:C.amber, fontWeight:700,
                            fontFamily:"'IBM Plex Mono',monospace" }}>View details →</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:24 }}>
          <button onClick={() => run()} disabled={phase === 'loading'}
            style={{ background:'transparent', border:`1px solid ${C.amber}`, color:C.amber,
                     fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.2em',
                     padding:'10px 24px', borderRadius:6, cursor:'pointer' }}>RE-ANALYZE</button>
          <button onClick={reset}
            style={{ background:'transparent', border:`1px solid ${T.sidebarBorder}`,
                     color:T.textMuted, fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
                     letterSpacing:'0.2em', padding:'10px 24px', borderRadius:6,
                     cursor:'pointer' }}>NEW SITE</button>
        </div>

        {recentReports.length > 0 && <RecentReportsPanel compact/>}
      </div>
    );
  }

  // Idle / loading / error — show input form
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <div style={{ maxWidth:700, marginBottom:24 }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:20, fontWeight:800, color:T.textPrimary, marginBottom:6,
                        fontFamily:"'Orbitron',monospace", letterSpacing:'0.05em' }}>
            Evaluate a site
          </div>
          <div style={{ fontSize:13, color:T.textMuted,
                        fontFamily:"'IBM Plex Sans',sans-serif" }}>
            Enter an address or GPS coordinates to run the two-axis scoring model.
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button style={tabSty(mode === 'address')} onClick={() => setMode('address')}>ADDRESS INPUT</button>
          <button style={tabSty(mode === 'coords')} onClick={() => setMode('coords')}>GPS COORDINATES</button>
        </div>
        {mode === 'address' ? (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                          letterSpacing:'0.2em', marginBottom:8 }}>SITE ADDRESS</div>
            <div style={{ display:'flex', gap:10, marginBottom:8 }}>
              <input value={address} onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canRun && run()}
                placeholder="Street address — any US city"
                style={{ ...inputStyle, flex:1 }}/>
              <button onClick={() => run()} disabled={!canRun}
                style={{ background:'transparent', border:`1px solid ${C.amber}`, color:C.amber,
                         fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:'0.2em',
                         padding:'11px 22px', borderRadius:6, cursor:'pointer',
                         opacity:!canRun ? 0.4 : 1, whiteSpace:'nowrap' }}>
                {phase === 'loading' ? 'RUNNING…' : 'ANALYZE'}
              </button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 16px' }}>
              <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:11, color:T.textMuted }}>Try:</span>
              {ADDR_EXAMPLES.map(ex => (
                <span key={ex} onClick={() => setAddress(ex)}
                  style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
                           color:C.amber, cursor:'pointer' }}>{ex.split(',')[0]}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                          letterSpacing:'0.2em', marginBottom:8 }}>GPS COORDINATES (DECIMAL DEGREES)</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude (29.7079)"
                style={{ ...inputStyle, flex:1, minWidth:130 }}/>
              <input value={lon} onChange={e => setLon(e.target.value)} placeholder="Longitude (-95.4010)"
                style={{ ...inputStyle, flex:1, minWidth:150 }}/>
              <input value={siteLabel} onChange={e => setSiteLabel(e.target.value)}
                placeholder="Site name (optional)"
                style={{ ...inputStyle, flex:1, minWidth:130 }}/>
              <button onClick={() => run()} disabled={!canRun}
                style={{ background:'transparent', border:`1px solid ${C.amber}`, color:C.amber,
                         fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:'0.2em',
                         padding:'11px 22px', borderRadius:6, cursor:'pointer',
                         opacity:!canRun ? 0.4 : 1, whiteSpace:'nowrap' }}>
                {phase === 'loading' ? 'RUNNING…' : 'ANALYZE'}
              </button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 16px' }}>
              <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:11, color:T.textMuted }}>Try:</span>
              {COORD_EXAMPLES.map(ex => (
                <span key={ex.label}
                  onClick={() => { setLat(ex.lat); setLon(ex.lon); setSiteLabel(ex.label); }}
                  style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
                           color:C.amber, cursor:'pointer' }}>{ex.label}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {log.length > 0 && (
        <div style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:8,
                      padding:'14px 18px', marginBottom:24, maxWidth:700,
                      boxShadow:T.cardShadow }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                        letterSpacing:'0.2em', marginBottom:10 }}>ANALYSIS LOG</div>
          {log.map((item, i) => <LogLine key={i} msg={item.msg} s={item.s}/>)}
          {phase === 'loading' && (
            <div style={{ display:'flex', gap:10, padding:'4px 0', color:C.amber,
                          fontFamily:"'IBM Plex Mono',monospace", fontSize:11, marginTop:2 }}>
              <span>●</span><span>Contacting AI API...</span>
            </div>
          )}
        </div>
      )}

      {phase === 'error' && (
        <div style={{ background:'rgba(192,57,43,0.06)', border:'1px solid rgba(192,57,43,0.3)',
                      borderRadius:8, padding:'14px 18px', marginBottom:24, maxWidth:700 }}>
          <div style={{ color:C.red, fontFamily:"'IBM Plex Mono',monospace",
                        fontSize:11, marginBottom:8 }}>ERROR — {error}</div>
          <button onClick={() => run()}
            style={{ background:'transparent', border:`1px solid ${C.red}`, color:C.red,
                     fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.15em',
                     padding:'7px 16px', borderRadius:4, cursor:'pointer' }}>RETRY</button>
        </div>
      )}

      {recentReports.length > 0 && <RecentReportsPanel/>}
    </div>
  );
}

/* ─── PANEL: SITE ANALYSIS ─────────────────────── */
function SitePanel() {
  const { results, demandTab, theme, setActivePanel } = useApp();
  const T = tok(theme);
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  const mData = results.modes?.[demandTab] || {};
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                    letterSpacing:'0.2em', marginBottom:14 }}>SITE SCORE — INFRASTRUCTURE CRITERIA</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        <SiteCard label="Parcel" icon="▣" score={results.site?.parcel?.score}
          notes={results.site?.parcel?.notes}
          details={{ "Acreage":results.site?.parcel?.acreage_estimate?`~${results.site.parcel.acreage_estimate} ac`:null, "Type":results.site?.parcel?.land_type }}/>
        <SiteCard label="FAA Airspace" icon="✈" score={results.site?.airspace?.score}
          notes={results.site?.airspace?.notes}
          details={{ "Class":results.site?.airspace?.status, "Airport":results.site?.airspace?.nearest_airport, "LAANC":results.site?.airspace?.laanc_required?"Required":"Not required" }}/>
        <SiteCard label="Power Grid & DER" icon="⚡" score={results.eia?.score??null}
          pending={!results.eia} notes={results.eia?.notes} details={results.eia?.details}/>
        <SiteCard label="Zoning" icon="◈" score={results.site?.zoning?.score}
          notes={results.site?.zoning?.notes}
          details={{ "Compliance":results.site?.zoning?.compliance, "Use":results.site?.zoning?.land_use }}/>
        <SiteCard label="Soil & Flood" icon="⬡" score={results.site?.soil?.score}
          notes={results.site?.soil?.notes}
          details={{ "Flood":results.site?.soil?.flood_zone, "Slope":results.site?.soil?.slope_estimate, "Elev":results.site?.soil?.elevation_ft?`${results.site.soil.elevation_ft} ft`:null }}/>
        <SiteCard label="DER Support" icon="◉" score={results.nrel?.score??null}
          pending={!results.nrel} notes={results.nrel?.notes} details={results.nrel?.details}/>
      </div>
      <HeliportModifier heli={results.heliport}/>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                    letterSpacing:'0.2em', marginBottom:10 }}>{DEMAND_HEADER[demandTab]}</div>
      <div style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:8,
                    padding:'18px 20px', marginBottom:20, boxShadow:T.cardShadow }}>
        {DEMAND_CRITERIA[demandTab].map(cr => (
          <DemandRow key={cr.key} label={cr.label} icon={cr.icon}
            score={mData.demand?.[cr.key]?.score || 0}
            notes={mData.demand?.[cr.key]?.notes}/>
        ))}
      </div>
    </div>
  );
}

/* ─── PANEL: INFRASTRUCTURE ─────────────────────── */
function InfrastructurePanel() {
  const { results, theme, setActivePanel } = useApp();
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <FlyingDaysPanel data={results.flyingDays}/>
    </div>
  );
}

/* ─── PANEL: REGULATORY ─────────────────────────── */
function RegulatoryPanel() {
  const { results, demandTab, theme, setActivePanel } = useApp();
  const T = tok(theme);
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  const mData = results.modes?.[demandTab] || {};
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <RegulatoryChecklist items={mData.regulatory}/>
      {results.flags?.length > 0 && (
        <div style={{ marginBottom:20, background:'rgba(240,160,48,0.04)',
                      border:'1px solid rgba(240,160,48,0.18)', borderRadius:8,
                      padding:'14px 18px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                        letterSpacing:'0.2em', marginBottom:10 }}>FLAGS — ITEMS REQUIRING INVESTIGATION</div>
          {results.flags.map((flag,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'6px 0',
                                   borderTop:i>0?`1px solid ${T.cardBorder}`:'none',
                                   fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12,
                                   color:C.yellow, lineHeight:1.55 }}>
              <span style={{ flexShrink:0 }}>⚑</span><span>{flag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── PANEL: FINANCIAL (PRO) ─────────────────────── */
function FinancialPanel({ isPro }) {
  const { results, demandTab, setActivePanel } = useApp();
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  const mData = results.modes?.[demandTab] || {};
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <ProGate isPro={isPro}>
        <InvestmentPanel data={mData.investment}/>
      </ProGate>
    </div>
  );
}

/* ─── PANEL: ACTIONS (PRO) ─────────────────────── */
function ActionsPanel({ isPro }) {
  const { results, demandTab, theme, setActivePanel } = useApp();
  const T = tok(theme);
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  const mData = results.modes?.[demandTab] || {};
  const regItems = mData.regulatory || [];
  const priority = regItems.filter(i => i.urgency === 'critical' || i.urgency === 'high');
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <ProGate isPro={isPro}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                        letterSpacing:'0.2em', marginBottom:12 }}>PRIORITY ACTION ITEMS</div>
          {priority.length === 0 ? (
            <div style={{ color:C.green, fontFamily:"'IBM Plex Mono',monospace", fontSize:11 }}>
              ✓ No critical or high-urgency items for this site.
            </div>
          ) : priority.map((item,i) => (
            <div key={item.id||i}
              style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`,
                       borderRadius:8, padding:'12px 16px', marginBottom:8,
                       boxShadow:T.cardShadow }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                               background:item.urgency==='critical'?C.red:C.yellow }}/>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
                               fontWeight:700, color:T.textPrimary }}>{item.title}</span>
              </div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8,
                            color:C.amberDim, marginBottom:4 }}>
                {item.authority} · {item.citation}
              </div>
              <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:11,
                            color:T.textMuted, lineHeight:1.5 }}>{item.notes}</div>
            </div>
          ))}
        </div>
        {results.flags?.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.amberDim,
                          letterSpacing:'0.2em', marginBottom:10 }}>DATA FLAGS</div>
            {results.flags.map((flag,i) => (
              <div key={i}
                style={{ display:'flex', gap:10, padding:'8px 12px', marginBottom:6,
                         background:'rgba(240,160,48,0.06)',
                         border:'1px solid rgba(240,160,48,0.18)',
                         borderRadius:6, fontFamily:"'IBM Plex Sans',sans-serif",
                         fontSize:12, color:C.yellow }}>
                <span>⚑</span><span>{flag}</span>
              </div>
            ))}
          </div>
        )}
      </ProGate>
    </div>
  );
}

/* ─── PANEL: BATCH SCORING (pro gate) ───────────── */
function BatchNetworkPanel() {
  const { isPro, theme } = useApp();
  const T = tok(theme);
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%', background:T.mainBg }}>
      <ProGate isPro={isPro}>
        <div style={{ background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:8,
                      padding:'16px 20px', fontFamily:"'IBM Plex Mono',monospace",
                      fontSize:12, color:T.textDim }}>
          Batch Score Area — draw a polygon on the map to score and rank all parcels within the area.
        </div>
      </ProGate>
    </div>
  );
}

/* ─── PANEL: MAP ─────────────────────────────────── */
function MapPanel() {
  const { results, phase, handleMapClick, setActivePanel } = useApp();
  if (!results) return <NoPanelData onGo={() => setActivePanel('dashboard')}/>;
  return (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <SiteMap geocode={results.geocode} heliport={results.heliport}
               airspace={results.site?.airspace}
               onMapClick={phase !== 'loading' ? handleMapClick : undefined}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP — all state and API logic lives here; new sidebar layout
   wraps around the panel components defined above.
   isPro=false  → free build (pro panels show ProGate overlay)
   isPro=true   → private fork / paid desktop build
═══════════════════════════════════════════════════════════════ */
export default function App({ isPro = false }) {
  // ── All hooks first — Rules of Hooks ─────────────────────────
  const [llmConfig, setLlmConfig] = useState(null);
  // "loading" (Electron, awaiting config read) | "setup" (no key) | "ready"
  const [setupState, setSetupState] = useState(() => window.electronAPI ? "loading" : "ready");
  const [showSetup, setShowSetup] = useState(false);
  const [gated, setGated] = useState(() => window.electronAPI ? false : !!localStorage.getItem("veval_beta_access"));
  const [mode,setMode]=useState("address");
  const [address,setAddress]=useState("");
  const [lat,setLat]=useState("");const [lon,setLon]=useState("");const [siteLabel,setSiteLabel]=useState("");
  const [phase,setPhase]=useState("idle");
  const [log,setLog]=useState([]);
  const [results,setResults]=useState(null);
  const [previous,setPrevious]=useState(null);
  const [error,setError]=useState(null);
  const [pdfGenerating,setPdfGenerating]=useState(false);
  const [demandTab,setDemandTab]=useState("passenger");
  const demandTabRef=useRef("passenger");
  const setDemandTabSync=(v)=>{ demandTabRef.current=v; setDemandTab(v); };
  const [recentReports,setRecentReports]=useState(()=>{try{return JSON.parse(localStorage.getItem("veval_recent")||"[]");}catch{return [];}});
  const [activePanel, setActivePanel] = useState('dashboard');
  const [theme, setTheme] = useState('light');

  // ── Load LLM config on mount ──────────────────────────────────
  useEffect(() => {
    async function initKeys() {
      if (window.electronAPI) {
        const cfg = await window.electronAPI.getConfig();
        if (cfg?.veval_beta_access) setGated(true);
        if (cfg?.apiKey) { setLlmConfig(cfg); setSetupState("ready"); }
        else { setSetupState("setup"); }
      } else {
        setLlmConfig({ provider: "anthropic", apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY });
        // web mode: setupState stays "ready" (set by initializer)
      }
    }
    initKeys();
  }, []);

  // ── BYOK gates (conditional renders — after all hooks) ───────
  if (setupState === "loading") return null; // brief blank while IPC resolves (~10ms)
  if (setupState === "setup") {
    return <SetupScreen onComplete={(cfg) => { setLlmConfig(cfg); setSetupState("ready"); }} />;
  }
  if (showSetup) {
    return <SetupScreen currentConfig={llmConfig} onComplete={(cfg) => { setLlmConfig(cfg); setShowSetup(false); }} />;
  }

  if (!gated) return <LandingPage onStart={() => setGated(true)} />;

  const canRun=phase!=="loading"&&(mode==="address"?address.trim().length>0:parseCoords(lat,lon)!==null);

  async function run(override=null){
    if(!override&&!canRun)return;
    const runMode=override?.mode||mode;

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
        if(!c)throw new Error("Invalid coordinates. US range: 18-72°N, 65-180°W.");
        input={lat:c.lat,lon:c.lon,label:rawLabel||`${c.lat}, ${c.lon}`};addL(`Coordinates: ${c.lat.toFixed(5)}°N, ${Math.abs(c.lon).toFixed(5)}°W`);
      }else{const addr=override?override.address:address.trim();input={address:addr};addL(`Geocoding: ${addr}`);}

      // ── Three parallel LLM calls — one per demand mode ───────
      const analysisIdx=logs.length; addL("Running passenger · cargo · combo analysis in parallel...","running");
      const [paxS,cargoS,comboS]=await Promise.allSettled([
        analyzeWithClaude(input,runMode,"passenger",llmConfig),
        analyzeWithClaude(input,runMode,"cargo",llmConfig),
        analyzeWithClaude(input,runMode,"combo",llmConfig),
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
      const hcadIdx=logs.length; addL("TX parcel (5 counties) → fetching...","running");
      const femaIdx=logs.length; addL("FEMA NFHL + elevation → fetching...","running");
      const osmIdx=logs.length;  addL("OSM zoning → fetching...","running");
      const flags=[...(siteData?.parcel?.flags||[]),...(siteData?.airspace?.flags||[]),...(siteData?.zoning?.flags||[]),...(siteData?.soil?.flags||[])];
      const [eiaS,nrelS,hcadS,femaS,osmS]=await Promise.allSettled([
        fetchEIAPowerScore(base.geocode.lat,base.geocode.lon,siteData?.zoning?.score||50),
        fetchNRELDERScore(base.geocode.lat,base.geocode.lon),
        llmConfig?.regridKey
          ? fetchRegridParcelScore(base.geocode.lat,base.geocode.lon,llmConfig.regridKey)
              .catch(()=>fetchTexasParcelScore(base.geocode.lat,base.geocode.lon))
          : fetchTexasParcelScore(base.geocode.lat,base.geocode.lon),
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
      // Apply EIA (20%) and NREL (5%) live scores to site composite.
      // LLM formula maxes at 75% (parcel+airspace+zoning+soil); these complete the 100%.
      if(eia)  siteData.composite=Math.min(100,Math.round((siteData?.composite||0)+(eia.score*0.20)));
      if(nrel) siteData.composite=Math.min(100,Math.round((siteData?.composite||0)+(nrel.score*0.05)));
      if(hcad){
        setL(hcadIdx,`${hcad._source} → Parcel: ${hcad.acreage_estimate} ac · score ${hcad.score}/100`,"done");
        const oldP=siteData?.parcel?.score||0;
        siteData.parcel={...siteData.parcel,...hcad};
        siteData.composite=Math.min(100,Math.round((siteData?.composite||0)-(oldP*0.25)+(hcad.score*0.25)));
      } else setL(hcadIdx,`TX parcel → ${hcadS.reason?.message||"outside covered counties — using estimate"}`,"warn");
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

      // ── API source audit log ───────────────────────────────
      console.group("[VES] API source audit");
      console.log("Claude API:    temperature=0 · model=claude-sonnet-4-6 · 3 parallel calls (pax/cargo/combo)");
      console.log("FAA airspace:  static dataset ·", airspaceResult.status, "· score", airspaceResult.score, "·", airspaceResult.nearest_airport);
      console.log("EIA power:",    eia?._live ? `live · score ${eia.score}` : `FALLBACK (baseline) · score ${eia?.score??0}`);
      const nrelLive = nrel?._live || {};
      console.log("NREL utility:", nrelLive.utilityLive ? `live · ${nrel.score} pts` : "FALLBACK (national baseline)");
      console.log("NREL solar:",   nrelLive.solarLive   ? `live · GHI from API`      : "FALLBACK (national baseline)");
      console.log("TX parcel:", hcad ? `${hcad._source} live · ${hcad.acreage_estimate} ac · score ${hcad.score}` : `FALLBACK (LLM estimate) · outside Harris/Dallas/Tarrant/Travis/Bexar`);
      if (fema) {
        const fs = fema._source || {};
        console.log("FEMA NFHL:",   fs.fema ? `live · ${fema.flood_zone} · score ${fema.score}` : `FALLBACK (estimate) · score ${fema.score}`);
        console.log("USGS elev:",   fs.usgs ? `live · ${fema.elevation_ft} ft` : "FALLBACK (not available)");
      } else {
        console.log("FEMA NFHL:    FALLBACK ·", femaS.reason?.message||"fetch failed");
        console.log("USGS elev:    FALLBACK");
      }
      console.log("OSM zoning:",  osm ? `live · ${osm.land_use} (${osm._raw}) · score ${osm.score}` : `FALLBACK (LLM estimate) · ${osmS.reason?.message||"no data"}`);
      console.groupEnd();

      // ── Build per-mode results ─────────────────────────────
      // Strip internal audit fields before storing in state / localStorage
      const strip=(obj,keys)=>{ if(!obj)return obj; const r={...obj}; keys.forEach(k=>delete r[k]); return r; };
      const eiaClean  = strip(eia,  ["_live"]);
      const nrelClean = strip(nrel, ["_live"]);
      const hcadClean = strip(hcad, ["_source","_account"]);
      const femaClean = strip(fema, ["_source"]);
      const osmClean  = strip(osm,  ["_source","_raw"]);
      const sharedBase={geocode:base.geocode,site:siteData,flags,eia:eiaClean,nrel:nrelClean,hcad:hcadClean,fema:femaClean,osm:osmClean,heliport:heli,flyingDays:flyData};
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
      const tab=demandTabRef.current;
      const dr={...results,...(results.modes?.[tab]||{}),evalMode:tab};
      // Load logo for PDF header
      let logoDataUrl=null;
      try{logoDataUrl=await new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=img.width;c.height=img.height;c.getContext("2d").drawImage(img,0,0);res(c.toDataURL("image/png"));};img.onerror=rej;img.src=aamLogo;});}catch(e){console.warn("Logo load failed:",e);}

      let mapDataUrl=null;
      const mapToken=import.meta.env.VITE_MAPBOX_TOKEN;
      if(mapToken&&dr.geocode?.lat&&dr.geocode?.lon){
        try{
          const {lat,lon}=dr.geocode;
          const mapUrl=`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-l+e63946(${lon},${lat})/${lon},${lat},14,0/600x300?access_token=${mapToken}`;
          const resp=await fetch(mapUrl);
          if(resp.ok){const blob=await resp.blob();mapDataUrl=await new Promise(res=>{const r=new FileReader();r.onloadend=()=>res(r.result);r.readAsDataURL(blob);});}
        }catch(e){console.warn("Map image fetch failed:",e);}
      }
      await downloadPDF(dr,mapDataUrl,logoDataUrl);
    }
    catch(err){ console.error("PDF error:",err); alert("PDF generation failed: "+err.message); }
    finally{ setPdfGenerating(false); }
  }

  const reset=()=>{setPhase("idle");setResults(null);setPrevious(null);setLog([]);setAddress("");setLat("");setLon("");setSiteLabel("");setError(null);setDemandTabSync("passenger");};
  function loadReport(r){setPrevious(results);setResults(r.results);setPhase("complete");setDemandTabSync(r.evalMode);setLog([]);setError(null);if(r.input.mode==="coords"){setMode("coords");setLat(String(r.input.lat));setLon(String(r.input.lon));setSiteLabel(r.input.label||"");}else{setMode("address");setAddress(r.input.address||"");}}
  function rerunReport(r){if(r.input.mode==="coords"){setMode("coords");setLat(String(r.input.lat));setLon(String(r.input.lon));setSiteLabel(r.input.label||"");}else{setMode("address");setAddress(r.input.address||"");}run(r.input);}
  function clearRecent(){setRecentReports([]);localStorage.removeItem("veval_recent");}
  async function handleMapClick(clickLat, clickLon) {
    let label = `${clickLat.toFixed(5)}, ${clickLon.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickLat}&lon=${clickLon}`,
        { headers: { "Accept-Language": "en-US,en" } }
      );
      if (res.ok) {
        const d = await res.json();
        const a = d.address || {};
        const street = [a.house_number, a.road].filter(Boolean).join(" ");
        const city = a.city || a.town || a.village || a.county || "";
        const state = a.state || "";
        const parts = [street, city, state].filter(Boolean);
        label = parts.length ? parts.join(", ") : d.display_name?.split(",").slice(0,3).join(",").trim() || label;
      }
    } catch {}
    setMode("coords");
    setLat(String(clickLat));
    setLon(String(clickLon));
    setSiteLabel(label);
    run({ mode: "coords", lat: clickLat, lon: clickLon, label });
  }
  const ctxValue = {
    activePanel, setActivePanel, theme, setTheme, isPro,
    results, phase, log, error,
    mode, setMode, address, setAddress,
    lat, setLat, lon, setLon, siteLabel, setSiteLabel,
    run, reset,
    demandTab, setDemandTab: setDemandTabSync,
    recentReports, loadReport, rerunReport, clearRecent,
    handleDownloadPDF, pdfGenerating,
    llmConfig, setShowSetup,
    handleMapClick,
  };
  const T = tok(theme);

  return (
    <AppCtx.Provider value={ctxValue}>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden',
                    fontFamily:"'IBM Plex Sans',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500&family=Orbitron:wght@700;900&display=swap');
          *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
          html, body, #root { height:100%; }
          input::placeholder { color:${C.textDim}; }
          input:focus { outline:none !important; border-color:${C.amber} !important; }
          ::-webkit-scrollbar { width:4px; }
          ::-webkit-scrollbar-track { background:transparent; }
          ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:10px; }
          button { font-family:inherit; }
        `}</style>
        <VESSidebar isPro={isPro}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
                      background:T.mainBg }}>
          <VESTopBar/>
          <div style={{ flex:1, overflow:'hidden' }}>
            {activePanel === 'dashboard'      && <DashboardPanel isPro={isPro}/>}
            {activePanel === 'site'           && <SitePanel/>}
            {activePanel === 'infrastructure' && <InfrastructurePanel/>}
            {activePanel === 'regulatory'     && <RegulatoryPanel/>}
            {activePanel === 'financial'      && <FinancialPanel isPro={isPro}/>}
            {activePanel === 'actions'        && <ActionsPanel isPro={isPro}/>}
            {activePanel === 'map'            && <MapPanel/>}
            {activePanel === 'batch'          && <BatchNetworkPanel/>}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  );
}
