import { PALETTE, PAGE, TYPE, verdictColor } from "../tokens.js";
import { drawScoreCircle, drawBadge, logoFmt } from "../primitives.js";

const formatDate = (d = new Date()) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function drawCover(doc, results, ctx) {
  const { W, H, margin } = PAGE;
  const { siteScore = 0, demandScore = 0, pi = 0, verdict, branding } = ctx;

  doc.setFillColor(...PALETTE.paper);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...PALETTE.accent);
  doc.rect(0, 0, 4, H, "F");

  doc.setTextColor(...PALETTE.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("VES PRO", 12, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.caption.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text(formatDate(), W - margin, 18, { align: "right" });

  const matched = results?.geocode?.matched || "Untitled Site";
  const [siteName, ...rest] = matched.split(",");
  const addrLine = rest.join(",").trim();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.display.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(siteName.trim(), margin, 115, { maxWidth: W - margin * 2 });

  if (addrLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.steel);
    doc.text(addrLine, margin, 124);
  }

  const lat = results?.geocode?.lat;
  const lon = results?.geocode?.lon;
  if (typeof lat === "number" && typeof lon === "number") {
    doc.setFont("courier", "normal");
    doc.setFontSize(TYPE.mono.size);
    doc.setTextColor(...PALETTE.steel);
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    doc.text(
      `${Math.abs(lat).toFixed(5)}° ${ns}  ·  ${Math.abs(lon).toFixed(5)}° ${ew}`,
      margin, 132
    );
  }

  const cy = 190, r = 18;
  drawScoreCircle(doc, { cx: 65,  cy, r, score: siteScore,   label: "SITE" });
  drawScoreCircle(doc, { cx: 105, cy, r, score: demandScore, label: "DEMAND" });
  drawScoreCircle(doc, { cx: 145, cy, r, score: pi,          label: "PRIORITY INDEX" });

  const verdictLabel = verdict?.verdict || "PENDING";
  const vColor = verdictColor(verdictLabel);
  drawBadge(doc, {
    x: margin, y: 240, w: 80, h: 11,
    label: verdictLabel,
    color: vColor,
    fontSize: 9,
  });

  doc.setLineWidth(0.3);
  doc.setDrawColor(...PALETTE.rule);
  doc.line(margin, 275, W - margin, 275);

  const firmName = branding?.firmName?.trim() || "LOWALTITUDEECONOMY.AERO";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.pageMeta.size);
  doc.setTextColor(...PALETTE.muted);
  doc.text(firmName, margin, 282);
  doc.text("VERTIPORT SITE EVALUATION SYSTEM", W - margin, 282, { align: "right" });

  const logo = branding?.logoDataUrl || ctx.logoDataUrl;
  if (logo) {
    try {
      doc.addImage(logo, logoFmt(logo), W - margin - 16, 263, 16, 8, undefined, "FAST");
    } catch (e) {}
  }
}
