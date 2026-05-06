import { PALETTE, PAGE, TYPE, sanitize } from "../tokens.js";
import { drawPageChrome, drawBadge } from "../primitives.js";

const URGENCY_COLOR = {
  critical:  PALETTE.red,
  important: PALETTE.amber,
  routine:   PALETTE.green,
};

export function drawRegulatoryChecklist(doc, results, ctx) {
  const { H, margin, contentW } = PAGE;
  const { branding, em = "passenger", regulatorySensitivity = [], designDValue } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  const items = results?.modes?.[em]?.regulatory || results?.regulatory || [];

  const newPage = () => {
    doc.addPage();
    drawPageChrome(doc, { siteName, sectionTitle: "Regulatory Checklist", branding });
  };

  drawPageChrome(doc, { siteName, sectionTitle: "Regulatory Checklist", branding });

  let y = 30;
  const SAFE_BOTTOM = H - 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h1.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text("Compliance Checklist", margin, y);
  y += 4;
  doc.setLineWidth(0.5);
  doc.setDrawColor(...PALETTE.accent);
  doc.line(margin, y, margin + 16, y);
  y += 6;

  const required = items.filter((r) => r.status === "required").length;
  const critical = items.filter((r) => r.urgency === "critical").length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.caption.size);
  doc.setTextColor(...PALETTE.steel);
  doc.text(
    `${items.length} items  ·  ${required} required  ·  ${critical} critical  ·  EB 105A Design D = ${designDValue ?? 50} ft`,
    margin, y
  );
  y += 8;

  if (regulatorySensitivity.length > 0) {
    const sensH = 8 + regulatorySensitivity.length * 6;
    if (y + sensH > SAFE_BOTTOM) { newPage(); y = 30; }
    doc.setFillColor(255, 248, 232);
    doc.setDrawColor(...PALETTE.amber);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, sensH, "FD");
    doc.setFillColor(...PALETTE.amber);
    doc.rect(margin, y, 2.5, sensH, "F");

    drawBadge(doc, {
      x: margin + 5, y: y + 1.5, w: 44, h: 5,
      label: "REGULATORY-SENSITIVE", color: PALETTE.amber, fontSize: 6,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.pageMeta.size);
    doc.setTextColor(...PALETTE.steel);
    doc.text(
      `${regulatorySensitivity.length} check${regulatorySensitivity.length === 1 ? "" : "s"} pass today within a buffer of failing — re-test if FAA EB 105A revises.`,
      margin + 52, y + 4.8
    );
    let sy = y + 9;
    regulatorySensitivity.forEach((s) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(TYPE.pageMeta.size);
      doc.setTextColor(...PALETTE.ink);
      doc.text(sanitize(s.check), margin + 5, sy + 2);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PALETTE.steel);
      const lines = doc.splitTextToSize(sanitize(s.message), contentW - 32);
      doc.text(lines.slice(0, 1), margin + 28, sy + 2);
      sy += 6;
    });
    y += sensH + 4;
  } else {
    y += 2;
  }

  if (items.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.muted);
    doc.text("Regulatory checklist not available for this evaluation.", margin, y);
    return;
  }

  const criticalItems = items.filter((r) => r.urgency === "critical");
  const otherItems    = items.filter((r) => r.urgency !== "critical");

  if (criticalItems.length > 0) {
    y = sectionHeading(doc, "CRITICAL ACTION ITEMS", margin, y, PALETTE.red);

    const cardH = 30;
    const cardGap = 4;
    criticalItems.forEach((it) => {
      if (y + cardH > SAFE_BOTTOM) {
        newPage();
        y = 30;
        y = sectionHeading(doc, "CRITICAL ACTION ITEMS (CONT.)", margin, y, PALETTE.red);
      }
      drawCriticalCard(doc, { x: margin, y, w: contentW, h: cardH, item: it });
      y += cardH + cardGap;
    });
    y += 4;
  }

  if (otherItems.length > 0) {
    if (y + 18 > SAFE_BOTTOM) {
      newPage();
      y = 30;
    }
    y = sectionHeading(doc, "ALL OTHER REQUIREMENTS", margin, y);

    const grouped = {};
    otherItems.forEach((it) => {
      const cat = it.category || "General";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(it);
    });

    const itemH = 10;
    const catHeaderH = 6;

    Object.entries(grouped).forEach(([cat, list]) => {
      if (y + catHeaderH + itemH > SAFE_BOTTOM) {
        newPage();
        y = 30;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(TYPE.pageMeta.size);
      doc.setTextColor(...PALETTE.muted);
      doc.text(cat.toUpperCase(), margin, y + 3.5);
      doc.setLineWidth(0.3);
      doc.setDrawColor(...PALETTE.rule);
      const tw = doc.getTextWidth(cat.toUpperCase()) + 2;
      doc.line(margin + tw, y + 3, margin + contentW, y + 3);
      y += catHeaderH;

      list.forEach((it) => {
        if (y + itemH > SAFE_BOTTOM) {
          newPage();
          y = 30;
        }

        const urgency = (it.urgency || "routine").toLowerCase();
        const stripeColor = URGENCY_COLOR[urgency] || PALETTE.muted;
        const isRequired = it.status === "required";

        doc.setFillColor(...stripeColor);
        doc.rect(margin, y, 1.5, itemH - 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(TYPE.h3.size);
        doc.setTextColor(...PALETTE.ink);
        doc.text(sanitize(it.item || ""), margin + 5, y + 3.8, { maxWidth: contentW - 32 });

        const statusLabel = (it.status || "").toUpperCase();
        const statusColor = isRequired ? PALETTE.red : PALETTE.green;
        drawBadge(doc, {
          x: margin + contentW - 22,
          y: y + 1.2,
          w: 20, h: 4.2,
          label: statusLabel || "—",
          color: statusColor,
          fontSize: 5.5,
        });

        if (it.notes) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(TYPE.pageMeta.size);
          doc.setTextColor(...PALETTE.muted);
          const lines = doc.splitTextToSize(sanitize(it.notes), contentW - 30);
          doc.text(lines.slice(0, 1), margin + 5, y + 7.6);
        }

        y += itemH;
      });
      y += 3;
    });
  }
}

function drawCriticalCard(doc, { x, y, w, h, item }) {
  doc.setFillColor(255, 247, 245);
  doc.setDrawColor(...PALETTE.red);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, "FD");

  doc.setFillColor(...PALETTE.red);
  doc.rect(x, y, 3, h, "F");

  drawBadge(doc, {
    x: x + w - 30, y: y + 3,
    w: 26, h: 5,
    label: (item.status || "REQUIRED").toUpperCase(),
    color: PALETTE.red,
    fontSize: 6,
  });

  if (item.category) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TYPE.pageMeta.size);
    doc.setTextColor(...PALETTE.red);
    doc.text(String(item.category).toUpperCase(), x + 7, y + 6.5);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h2.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(sanitize(item.item || ""), x + 7, y + 14, { maxWidth: w - 40 });

  if (item.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.slate);
    const lines = doc.splitTextToSize(sanitize(item.notes), w - 14);
    doc.text(lines.slice(0, 2), x + 7, y + 20);
  }
}

function sectionHeading(doc, label, x, y, accentColor = PALETTE.accent) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h3.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text(label, x, y);
  doc.setLineWidth(0.5);
  doc.setDrawColor(...accentColor);
  doc.line(x, y + 2, x + 14, y + 2);
  return y + 8;
}
