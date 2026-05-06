import { PALETTE, PAGE, TYPE, fmtMoney, sanitize } from "../tokens.js";
import { drawPageChrome, drawCard } from "../primitives.js";

const GRADE_COLOR = {
  A: PALETTE.green,
  B: PALETTE.accent2,
  C: PALETTE.amber,
  D: PALETTE.red,
};

export function drawInvestmentViability(doc, results, ctx) {
  const { W, margin, contentW } = PAGE;
  const { investment, branding, em = "passenger" } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, { siteName, sectionTitle: "Investment & Viability", branding });

  let y = 30;

  if (!investment) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.muted);
    doc.text("Investment summary not available for this evaluation.", margin, y);
    return;
  }

  const inv = investment;
  const grade = inv.grade?.grade || "—";
  const gColor = GRADE_COLOR[grade] || PALETTE.muted;

  doc.setFillColor(...gColor);
  doc.rect(margin, y, contentW, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...PALETTE.white);
  doc.text(grade, margin + 12, y + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h2.size);
  doc.setTextColor(...PALETTE.white);
  doc.text(inv.grade?.gradeLabel || inv.grade?.label || "INVESTMENT GRADE", margin + 28, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.body.size);
  if (inv.grade?.description) {
    doc.text(sanitize(inv.grade.description), margin + 28, y + 16, { maxWidth: contentW - 32 });
  } else if (inv.scenarioLabel) {
    doc.text(sanitize(inv.scenarioLabel), margin + 28, y + 16, { maxWidth: contentW - 32 });
  }
  y += 32;

  const tiles = [
    { label: "CAPEX",        value: fmtMoney(inv.capex?.mid) },
    { label: "OPEX/YR",      value: fmtMoney(inv.opex?.mid) },
    { label: "10YR NPV",     value: fmtMoney(inv.npv), color: inv.npv != null && inv.npv < 0 ? PALETTE.red : PALETTE.green },
    { label: "PAYBACK",      value: inv.paybackYears != null ? `${inv.paybackYears} yr` : "—" },
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
    doc.setTextColor(...(t.color || PALETTE.ink));
    doc.text(String(t.value), tx + 4, y + 19);
  });
  y += tileH + 12;

  if (inv.capex?.breakdown?.length) {
    y = sectionHeading(doc, "CAPEX BREAKDOWN", margin, y);
    inv.capex.breakdown.forEach((row) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(TYPE.body.size);
      doc.setTextColor(...PALETTE.steel);
      doc.text(sanitize(row.label || row.item || "—"), margin + 2, y + 3.5);
      doc.setFont("courier", "normal");
      doc.setFontSize(TYPE.mono.size);
      doc.setTextColor(...PALETTE.ink);
      doc.text(fmtMoney(row.value ?? row.amount ?? row.mid), margin + contentW - 2, y + 3.5, { align: "right" });
      doc.setLineWidth(0.2);
      doc.setDrawColor(...PALETTE.rule);
      doc.line(margin, y + 5.5, margin + contentW, y + 5.5);
      y += 7;
    });
    y += 4;
  }

  if (inv.revenue && inv.movements) {
    y = sectionHeading(doc, "REVENUE PROJECTION", margin, y);
    const colW = (contentW - 6) / 4;
    const rows = [
      { label: "YEAR 1",       rev: inv.revenue.yr1, mov: inv.movements.yr1 },
      { label: "YEAR 3",       rev: inv.revenue.yr3, mov: inv.movements.yr3 },
      { label: "YEAR 5",       rev: inv.revenue.yr5, mov: inv.movements.yr5 },
      { label: "STEADY STATE", rev: null,            mov: inv.movements.steadyState },
    ];
    rows.forEach((r, i) => {
      const cx = margin + i * (colW + 2);
      drawCard(doc, { x: cx, y, w: colW, h: 22 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(TYPE.pageMeta.size);
      doc.setTextColor(...PALETTE.muted);
      doc.text(r.label, cx + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(TYPE.h2.size);
      doc.setTextColor(...PALETTE.ink);
      doc.text(r.rev != null ? fmtMoney(r.rev) : `${Math.round((r.mov || 0) / 1000)}K mov`, cx + 3, y + 13);
      if (r.mov != null && r.rev != null) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(TYPE.pageMeta.size);
        doc.setTextColor(...PALETTE.muted);
        doc.text(`${Math.round(r.mov / 1000)}K mov`, cx + 3, y + 18);
      }
    });
    y += 28;
  }

  if (inv.timeline?.phases?.length) {
    y = sectionHeading(doc, `DEVELOPMENT TIMELINE — ${inv.timeline.totalMonths} MONTHS`, margin, y);
    const totalMo = inv.timeline.totalMonths || 1;
    let cx = margin;
    inv.timeline.phases.forEach((p, i) => {
      const w = ((p.months || 0) / totalMo) * contentW;
      const colors = [PALETTE.accent2, PALETTE.blue, PALETTE.amber, PALETTE.green];
      const col = colors[i % colors.length];
      doc.setFillColor(...col);
      doc.rect(cx, y, w, 6, "F");
      cx += w;
    });
    y += 8;
    cx = margin;
    inv.timeline.phases.forEach((p, i) => {
      const w = ((p.months || 0) / totalMo) * contentW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(TYPE.pageMeta.size);
      doc.setTextColor(...PALETTE.steel);
      doc.text(sanitize(p.label || p.name || `Phase ${i + 1}`), cx + 1, y + 3, { maxWidth: w - 2 });
      doc.setTextColor(...PALETTE.muted);
      doc.text(`${p.months || 0}mo`, cx + 1, y + 6);
      cx += w;
    });
    y += 12;
  }

  if (inv.risks?.length) {
    y = sectionHeading(doc, "KEY RISKS", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.slate);
    inv.risks.slice(0, 4).forEach((r) => {
      const txt = typeof r === "string" ? r : sanitize(r.label || r.text || r.risk || "");
      const lines = doc.splitTextToSize(txt, contentW - 6);
      doc.setFillColor(...PALETTE.red);
      doc.circle(margin + 1.5, y - 1.5, 0.9, "F");
      doc.text(lines, margin + 5, y);
      y += lines.length * 4.5 + 2;
    });
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
