import { PALETTE, PAGE, TYPE, scoreColor, sanitize } from "../tokens.js";
import { drawPageChrome, drawCard, drawProgressBar } from "../primitives.js";

const SECTION_BY_MODE = {
  passenger: "Demand Assessment — Passenger",
  cargo:     "Demand Assessment — Cargo",
  combo:     "Demand Assessment — Cargo + Pax",
};

export function drawDemandCriteria(doc, results, ctx) {
  const { margin, contentW } = PAGE;
  const { demandCriteria = [], em = "passenger", branding } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, {
    siteName,
    sectionTitle: SECTION_BY_MODE[em] || "Demand Assessment",
    branding,
  });

  const items = demandCriteria
    .map((cr) => ({
      name: cr.label,
      score: results?.demand?.[cr.key]?.score,
      notes: results?.demand?.[cr.key]?.notes,
    }))
    .filter((it) => typeof it.score === "number");

  let y = 30;
  const cardH = 38, gap = 5;
  items.forEach((it) => {
    drawDemandCard(doc, { x: margin, y, w: contentW, h: cardH, item: it });
    y += cardH + gap;
  });
}

function drawDemandCard(doc, { x, y, w, h, item }) {
  const score = typeof item.score === "number" ? item.score : null;
  drawCard(doc, { x, y, w, h, accent: true, accentColor: score == null ? PALETTE.muted : scoreColor(score) });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h2.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(item.name, x + 8, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...(score == null ? PALETTE.muted : scoreColor(score)));
  doc.text(score == null ? "—" : String(Math.round(score)), x + w - 8, y + 14, { align: "right" });

  if (score != null) {
    drawProgressBar(doc, { x: x + 8, y: y + 14, w: w - 16, h: 1.5, score });
  }

  if (item.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.caption.size);
    doc.setTextColor(...PALETTE.muted);
    const lines = doc.splitTextToSize(sanitize(item.notes), w - 16);
    doc.text(lines.slice(0, 3), x + 8, y + 22);
  }
}
