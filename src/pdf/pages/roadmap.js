import { PALETTE, PAGE, TYPE, sanitize } from "../tokens.js";
import { drawPageChrome, drawCard, drawBadge } from "../primitives.js";

const PHASES = [
  { n: 1, title: "VALIDATION",       window: "0–90 DAYS",     color: PALETTE.accent2 },
  { n: 2, title: "APPROVALS",        window: "90–180 DAYS",   color: PALETTE.blue },
  { n: 3, title: "BUILD & CERTIFY",  window: "180–365 DAYS",  color: PALETTE.amber },
];

function buildRules(data) {
  const r = data.results || {};
  const sens = data.regulatorySensitivity || [];
  const flag = data.buildNowFlag || {};
  const D = data.designDValue || 50;

  const airStatus  = (r.site?.airspace?.status || "").toString();
  const floodZone  = (r.fema?.flood_zone || r.site?.soil?.flood_zone || "").toString();
  const compliance = (r.osm?.compliance || r.site?.zoning?.compliance || "").toString();
  const acreage    = r.site?.parcel?.acreage_estimate;
  const powerScore = r.eia?.score;

  const rules = [
    { phase: 1, when: true,
      action: "Boundary survey + on-site walkthrough with photographs (record obstacles, slopes, access)",
      source: "Standard kickoff" },
    { phase: 1, when: flag.flag === "AMBER",
      action: `Resolve open BUILD-NOW concerns: ${(flag.softFails || []).map(f => f.label).join(", ") || "see Verdict page"}`,
      source: "BUILD-NOW flag" },
    { phase: 1, when: flag.flag === "RED",
      action: `Address hard-stop blockers before further spend: ${(flag.hardFails || []).map(f => f.label).join(", ") || "see Verdict page"}`,
      source: "BUILD-NOW flag" },
    { phase: 1, when: sens.length > 0,
      action: `Re-test ${sens.length} regulatory-sensitive threshold${sens.length === 1 ? "" : "s"} (see Regulatory Checklist callouts)`,
      source: "Sensitivity sweep" },
    { phase: 1, when: acreage != null && acreage < 3,
      action: "Title search + verify recorded acreage matches county GIS (smaller parcels carry higher boundary risk)",
      source: "Parcel data" },

    { phase: 2, when: /class\s*[bcd]/i.test(airStatus),
      action: `File FAA Form 7480-1 Notice of Construction for ${airStatus}`,
      source: "FAA airspace" },
    { phase: 2, when: r.site?.airspace?.laanc_required === true,
      action: "Establish LAANC authorization workflow with chosen UAS service supplier",
      source: "FAA LAANC" },
    { phase: 2, when: /zone\s*ae/i.test(floodZone),
      action: "FEMA Letter of Map Amendment (LOMA) application + drainage / fill plan",
      source: "FEMA NFHL" },
    { phase: 2, when: /marginal/i.test(compliance),
      action: "Conditional Use Permit (CUP) or zoning amendment filing with city planning",
      source: "Local zoning" },
    { phase: 2, when: true,
      action: "State aviation registration (vertiport / heliport) — typically 30–60 day cycle",
      source: "State DOT aviation" },

    { phase: 3, when: true,
      action: `TLOF + FATO construction per FAA EB 105A geometry (Design D-value ${D} ft → FATO ${Math.round(1.5 * D)} ft)`,
      source: "FAA EB 105A" },
    { phase: 3, when: powerScore != null && powerScore < 60,
      action: "Utility coordination + service upgrade application — 6+ month lead time typical for >1 MW DC charging",
      source: "Power infrastructure" },
    { phase: 3, when: true,
      action: "14 CFR Part 157 Notice of Construction filing (90 days prior to operation)",
      source: "FAA 14 CFR 157" },
    { phase: 3, when: true,
      action: "Final FAA inspection + state airport certification + insurance binder",
      source: "Pre-opening" },
  ];

  return rules.filter(rule => rule.when === true);
}

export function drawRoadmap(doc, results, ctx = {}) {
  const { H, margin, contentW } = PAGE;
  const { branding } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, { siteName, sectionTitle: "Implementation Roadmap", branding });

  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h1.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text("Implementation Roadmap", margin, y);
  y += 4;
  doc.setLineWidth(0.5);
  doc.setDrawColor(...PALETTE.accent);
  doc.line(margin, y, margin + 16, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.caption.size);
  doc.setTextColor(...PALETTE.steel);
  doc.text(
    "Conditional action items derived from this site's scoring outputs. Use as kickoff agenda.",
    margin, y
  );
  y += 8;

  const rules = buildRules({
    results,
    regulatorySensitivity: ctx.regulatorySensitivity,
    buildNowFlag: ctx.buildNowFlag,
    designDValue: ctx.designDValue,
  });

  const cardGap = 5;
  const headerH = 14;
  const cardPadX = 6;
  const lineH = 4;
  const itemPad = 3;
  const SAFE_BOTTOM = H - 18;

  PHASES.forEach((phase) => {
    const items = rules.filter(r => r.phase === phase.n);

    const itemSpecs = items.map((it) => {
      const lines = doc.splitTextToSize(sanitize(it.action), contentW - cardPadX * 2 - 36);
      return { ...it, lines: lines.slice(0, 2) };
    });
    const itemsH = items.length === 0
      ? 8
      : itemSpecs.reduce((sum, s) => sum + (s.lines.length * lineH + itemPad), 0);
    const cardH = headerH + itemsH + 3;

    if (y + cardH > SAFE_BOTTOM) {
      doc.addPage();
      drawPageChrome(doc, { siteName, sectionTitle: "Implementation Roadmap (cont.)", branding });
      y = 30;
    }

    drawCard(doc, { x: margin, y, w: contentW, h: cardH, accent: true, accentColor: phase.color });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TYPE.h2.size);
    doc.setTextColor(...PALETTE.ink);
    doc.text(`PHASE ${phase.n} — ${phase.title}`, margin + cardPadX, y + 8);

    drawBadge(doc, {
      x: margin + contentW - 38,
      y: y + 3.5,
      w: 34, h: 6,
      label: phase.window,
      color: phase.color,
      fontSize: 7,
    });

    let iy = y + headerH;

    if (itemSpecs.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(TYPE.body.size);
      doc.setTextColor(...PALETTE.muted);
      doc.text("(No phase-specific actions flagged for this site.)", margin + cardPadX + 2, iy + 4);
    } else {
      itemSpecs.forEach((it) => {
        doc.setFillColor(...phase.color);
        doc.circle(margin + cardPadX + 1, iy + 3, 0.9, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(TYPE.body.size);
        doc.setTextColor(...PALETTE.ink);
        doc.text(it.lines, margin + cardPadX + 4, iy + 3.8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(TYPE.pageMeta.size);
        doc.setTextColor(...PALETTE.muted);
        doc.text(it.source, margin + contentW - cardPadX - 2, iy + 3.8, { align: "right" });

        iy += it.lines.length * lineH + itemPad;
      });
    }

    y += cardH + cardGap;
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text(
    "Generated from VES scoring outputs. Use as kickoff agenda — not a substitute for licensed engineering review.",
    margin, SAFE_BOTTOM - 2
  );
}
