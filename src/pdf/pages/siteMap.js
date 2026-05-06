import { PALETTE, PAGE, TYPE } from "../tokens.js";
import { drawPageChrome } from "../primitives.js";

const imgFmt = (url) =>
  url?.startsWith("data:image/jpeg") || url?.startsWith("data:image/jpg") ? "JPEG" : "PNG";

function fitImage(doc, dataUrl, maxW, maxH) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const aspect = props.width / props.height;
    let w = maxW, h = maxW / aspect;
    if (h > maxH) { h = maxH; w = maxH * aspect; }
    return { w, h };
  } catch (e) {
    return { w: maxW, h: maxH };
  }
}

export function drawSiteMap(doc, results, ctx) {
  const { W, H, margin, contentW } = PAGE;
  const { mapDataUrl, aerialCaptures, branding } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  const newPage = () => {
    doc.addPage();
    drawPageChrome(doc, { siteName, sectionTitle: "Site Map & Aerial Survey", branding });
  };

  drawPageChrome(doc, { siteName, sectionTitle: "Site Map & Aerial Survey", branding });

  const hasMap = !!mapDataUrl;
  const hasAerials = Array.isArray(aerialCaptures) && aerialCaptures.length > 0;
  const SAFE_BOTTOM = H - 18;

  let y = 30;

  if (hasMap) {
    y = sectionHeading(doc, "2D SITE MAP", margin, y);
    const { w, h } = fitImage(doc, mapDataUrl, contentW, 95);
    const mx = margin + (contentW - w) / 2;
    try {
      doc.addImage(mapDataUrl, imgFmt(mapDataUrl), mx, y, w, h, undefined, "FAST");
    } catch (e) {}
    doc.setDrawColor(...PALETTE.rule);
    doc.setLineWidth(0.3);
    doc.rect(mx, y, w, h);
    y += h + 12;
  }

  if (hasAerials) {
    y = sectionHeading(doc, "AERIAL SURVEY", margin, y);
    const slotW = contentW;
    const slotH = 60;
    aerialCaptures.forEach(({ label, dataUrl }, i) => {
      if (y + slotH > SAFE_BOTTOM) {
        newPage();
        y = 30;
        y = sectionHeading(doc, "AERIAL SURVEY (CONT.)", margin, y);
      }
      const { w, h } = fitImage(doc, dataUrl, slotW, slotH);
      const ax = margin + (slotW - w) / 2;
      try {
        doc.addImage(dataUrl, imgFmt(dataUrl), ax, y, w, h, undefined, "FAST");
      } catch (e) {}
      doc.setDrawColor(...PALETTE.rule);
      doc.setLineWidth(0.3);
      doc.rect(ax, y, w, h);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(TYPE.pageMeta.size);
      doc.setTextColor(...PALETTE.muted);
      doc.text(
        String(label || `View ${i + 1}`).toUpperCase(),
        margin, y + h + 4
      );

      y += h + 9;
    });
  }

  if (!hasMap && !hasAerials) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.muted);
    doc.text("Site map and aerial captures unavailable for this evaluation.", margin, y);
  }
}

function sectionHeading(doc, label, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h3.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(label, x, y);
  doc.setLineWidth(0.5);
  doc.setDrawColor(...PALETTE.accent);
  doc.line(x, y + 2, x + 14, y + 2);
  return y + 8;
}
