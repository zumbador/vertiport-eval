import { PALETTE, PAGE, TYPE, verdictColor, fmtMoney, sanitize } from "../tokens.js";
import { drawPageChrome, drawBadge, drawCard } from "../primitives.js";

const SITE_THRESHOLD = 55;
const DEMAND_THRESHOLD = 70;

export function drawExecutiveSummary(doc, results, ctx) {
  const { W, margin, contentW } = PAGE;
  const { verdict, pi = 0, q, buildNowFlag, investment, branding, siteScore = 0, demandScore = 0 } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, { siteName, sectionTitle: "Executive Summary", branding });

  let y = 30;

  const verdictLabel = verdict?.verdict || "PENDING";
  drawBadge(doc, {
    x: margin, y, w: 80, h: 11,
    label: verdictLabel,
    color: verdictColor(verdictLabel),
    fontSize: 9,
  });
  y += 22;

  const tiles = [
    { label: "PRIORITY INDEX", value: String(Math.round(pi)) },
    { label: "QUADRANT",       value: shortQuadrant(q?.label) },
    { label: "BUILD-NOW",      value: buildNowFlag?.flag || "—" },
    { label: "10YR NPV",       value: fmtMoney(investment?.npv) },
  ];
  const tileW = (contentW - 9) / 4;
  const tileH = 26;
  tiles.forEach((t, i) => {
    const tx = margin + i * (tileW + 3);
    drawCard(doc, { x: tx, y, w: tileW, h: tileH });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.pageMeta.size);
    doc.setTextColor(...PALETTE.muted);
    doc.text(t.label, tx + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PALETTE.ink);
    doc.text(String(t.value), tx + 4, y + 19);
  });
  y += tileH + 14;

  if (results?.summary) {
    y = drawSectionHeading(doc, "INVESTMENT THESIS", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.slate);
    const lines = doc.splitTextToSize(sanitize(results.summary), contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 8;
  }

  y = Math.max(y, 142);
  y = drawSectionHeading(doc, "POSITION MATRIX", margin, y);
  drawQuadrantPlot(doc, { siteScore, demandScore, quadrantLabel: q?.label, topY: y });
}

function drawSectionHeading(doc, label, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h3.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(label, x, y);
  doc.setLineWidth(0.5);
  doc.setDrawColor(...PALETTE.accent);
  doc.line(x, y + 2, x + 14, y + 2);
  return y + 10;
}

const QUADRANT_TINT = {
  prime:    [225, 240, 225],
  demand:   [252, 247, 215],
  infra:    [252, 235, 220],
  low:      [250, 224, 224],
};

function drawQuadrantPlot(doc, { siteScore, demandScore, quadrantLabel, topY }) {
  const { W } = PAGE;
  const size = 80;
  const x = (W - size) / 2;
  const y = topY;
  const half = size / 2;

  doc.setFillColor(...QUADRANT_TINT.demand);
  doc.rect(x, y, half, half, "F");
  doc.setFillColor(...QUADRANT_TINT.prime);
  doc.rect(x + half, y, half, half, "F");
  doc.setFillColor(...QUADRANT_TINT.low);
  doc.rect(x, y + half, half, half, "F");
  doc.setFillColor(...QUADRANT_TINT.infra);
  doc.rect(x + half, y + half, half, half, "F");

  doc.setDrawColor(...PALETTE.rule);
  doc.setLineWidth(0.5);
  doc.rect(x, y, size, size);

  doc.setLineWidth(0.3);
  doc.setDrawColor(...PALETTE.rule);
  if (typeof doc.setLineDashPattern === "function") {
    doc.setLineDashPattern([1, 1.5], 0);
  }
  doc.line(x + half, y, x + half, y + size);
  doc.line(x, y + half, x + size, y + half);
  if (typeof doc.setLineDashPattern === "function") {
    doc.setLineDashPattern([], 0);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.steel);
  doc.text("DEMAND W/O SITE", x + half - 2, y + 5,            { align: "right" });
  doc.text("PRIME SITE",      x + half + 2, y + 5);
  doc.text("LOW PRIORITY",    x + half - 2, y + size - 3,     { align: "right" });
  doc.text("INFRA PLAY",      x + half + 2, y + size - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text("100", x - 1, y + 1.5,         { align: "right" });
  doc.text("50",  x - 1, y + half + 1.5,  { align: "right" });
  doc.text("0",   x - 1, y + size + 0.5,  { align: "right" });
  doc.text("0",   x,        y + size + 4, { align: "center" });
  doc.text("50",  x + half, y + size + 4, { align: "center" });
  doc.text("100", x + size, y + size + 4, { align: "center" });

  const dotX = x + (Math.max(0, Math.min(100, siteScore)) / 100) * size;
  const dotY = y + size - (Math.max(0, Math.min(100, demandScore)) / 100) * size;
  doc.setFillColor(...PALETTE.accent2);
  doc.circle(dotX, dotY, 3.2, "F");
  doc.setDrawColor(...PALETTE.white);
  doc.setLineWidth(1.5);
  doc.circle(dotX, dotY, 3.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.steel);
  doc.text("SITE SCORE  ->", x + size / 2, y + size + 9, { align: "center" });
  doc.text("DEMAND  ^", x - 7, y + size / 2, { align: "center", angle: 90 });

  const label = (quadrantLabel || "—").toUpperCase();
  const labelW = 60, labelH = 9;
  const lx = (W - labelW) / 2;
  const ly = y + size + 14;
  doc.setFillColor(...PALETTE.accent);
  doc.roundedRect(lx, ly, labelW, labelH, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h3.size);
  doc.setTextColor(...PALETTE.white);
  doc.text(label, W / 2, ly + 6, { align: "center" });
}

function shortQuadrant(label) {
  if (!label) return "—";
  return label
    .replace("PRIME SITE", "PRIME")
    .replace("INFRASTRUCTURE PLAY", "INFRA")
    .replace("DEMAND WITHOUT SITE", "DEMAND")
    .replace("LOW PRIORITY", "LOW");
}
