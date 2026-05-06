import { PALETTE, PAGE, TYPE, scoreColor, sanitize } from "../tokens.js";
import { drawPageChrome, drawCard, drawProgressBar } from "../primitives.js";

export function drawSiteCriteria(doc, results, ctx) {
  const { margin, contentW } = PAGE;
  const { branding } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, { siteName, sectionTitle: "Site Criteria", branding });

  const site = results?.site || {};
  const items = [
    {
      name: "Parcel Size & Contours",
      score: site.parcel?.score,
      detail: parcelDetail(site.parcel, results?.rooftop_mode),
      notes: site.parcel?.notes,
    },
    {
      name: "FAA Airspace",
      score: site.airspace?.score,
      detail: `${site.airspace?.status || "—"}${site.airspace?.nearest_airport ? `  ·  ${site.airspace.nearest_airport}` : ""}`,
      notes: site.airspace?.notes,
    },
    {
      name: "Zoning & Land Use",
      score: site.zoning?.score,
      detail: `${site.zoning?.compliance || "—"}${site.zoning?.land_use ? `  ·  ${site.zoning.land_use}` : ""}`,
      notes: site.zoning?.notes,
    },
    {
      name: "Soil Stability & Flood",
      score: site.soil?.score,
      detail: `${site.soil?.flood_zone || "—"}${site.soil?.slope_estimate ? `  ·  Slope ${site.soil.slope_estimate}` : ""}`,
      notes: site.soil?.notes,
    },
  ];

  let y = 30;
  const cardH = 48, gap = 6;
  items.forEach((it) => {
    drawCriterionCard(doc, { x: margin, y, w: contentW, h: cardH, item: it });
    y += cardH + gap;
  });
}

function drawCriterionCard(doc, { x, y, w, h, item }) {
  const score = typeof item.score === "number" ? item.score : null;
  drawCard(doc, { x, y, w, h, accent: true, accentColor: score == null ? PALETTE.muted : scoreColor(score) });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h2.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(item.name, x + 8, y + 9);

  if (item.detail) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.steel);
    doc.text(sanitize(item.detail), x + 8, y + 16, { maxWidth: w - 50 });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...(score == null ? PALETTE.muted : scoreColor(score)));
  doc.text(score == null ? "—" : String(Math.round(score)), x + w - 8, y + 16, { align: "right" });

  if (score != null) {
    drawProgressBar(doc, { x: x + 8, y: y + 22, w: w - 16, h: 1.5, score });
  }

  if (item.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.caption.size);
    doc.setTextColor(...PALETTE.muted);
    const lines = doc.splitTextToSize(sanitize(item.notes), w - 16);
    doc.text(lines.slice(0, 3), x + 8, y + 30);
  }
}

function parcelDetail(parcel, rooftop) {
  if (rooftop) return "Rooftop site — ground parcel N/A";
  const ac = parcel?.acreage_estimate;
  const lt = parcel?.land_type;
  if (ac && lt) return `~${ac} ac  ·  ${lt}`;
  if (ac)        return `~${ac} ac`;
  if (lt)        return lt;
  return "—";
}
