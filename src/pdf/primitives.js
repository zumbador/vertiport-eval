import { PALETTE, PAGE, TYPE, scoreColor } from "./tokens.js";

export const logoFmt = (url) =>
  url?.startsWith("data:image/jpeg") || url?.startsWith("data:image/jpg") ? "JPEG" : "PNG";

export function drawPageChrome(doc, opts) {
  const { siteName, sectionTitle, pageNum, totalPages, branding } = opts;
  const { W, H, margin, headerH } = PAGE;

  doc.setFillColor(...PALETTE.paper);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...PALETTE.ink);
  doc.rect(0, 0, W, headerH, "F");

  doc.setTextColor(...PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h2.size);
  doc.text(siteName || "Site", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.body.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text((sectionTitle || "").toUpperCase(), W - margin, 12, { align: "right" });

  doc.setLineWidth(0.3);
  doc.setDrawColor(...PALETTE.rule);
  doc.line(margin, H - 10, W - margin, H - 10);

  const firmName = branding?.firmName?.trim() || "LOWALTITUDEECONOMY.AERO";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text(firmName, margin, H - 5);
  if (typeof pageNum === "number" && typeof totalPages === "number") {
    doc.text(`Page ${pageNum} of ${totalPages}`, W - margin, H - 5, { align: "right" });
  }
}

export function drawCard(doc, opts) {
  const { x, y, w, h, accent = false, accentColor = PALETTE.accent } = opts;
  doc.setFillColor(...PALETTE.white);
  doc.setDrawColor(...PALETTE.rule);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");
  if (accent) {
    doc.setFillColor(...accentColor);
    doc.rect(x, y, 2.5, h, "F");
  }
}

export function drawBadge(doc, opts) {
  const {
    x, y, w, h, label,
    color = PALETTE.accent2,
    textColor = PALETTE.white,
    fontSize = TYPE.h3.size,
  } = opts;
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.text(label, x + w / 2, y + h / 2 + fontSize * 0.18, { align: "center" });
}

export function drawScoreCircle(doc, opts) {
  const {
    cx, cy, r, score = 0, label,
    ringColor = scoreColor(score),
    numberColor = PALETTE.ink,
    labelColor = PALETTE.muted,
    ringWidth = 1.5,
  } = opts;
  doc.setLineWidth(ringWidth);
  doc.setDrawColor(...ringColor);
  doc.circle(cx, cy, r);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...numberColor);
  doc.text(String(Math.round(score)), cx, cy + 2.5, { align: "center" });
  if (label) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.pageMeta.size);
    doc.setTextColor(...labelColor);
    doc.text(label, cx, cy + r + 5, { align: "center" });
  }
}

export function drawProgressBar(doc, opts) {
  const {
    x, y, w, h = 2, score = 0,
    bgColor = PALETTE.rule,
    fillColor = scoreColor(score),
  } = opts;
  doc.setFillColor(...bgColor);
  doc.rect(x, y, w, h, "F");
  const fillW = Math.max(0, Math.min(1, score / 100)) * w;
  doc.setFillColor(...fillColor);
  doc.rect(x, y, fillW, h, "F");
}
