import { PALETTE, PAGE, TYPE, verdictColor, sanitize } from "../tokens.js";
import { drawPageChrome } from "../primitives.js";

export function drawVerdict(doc, results, ctx) {
  const { W, H, margin, contentW } = PAGE;
  const { verdict, branding } = ctx;
  const siteName = (results?.geocode?.matched || "Site").split(",")[0].trim();

  drawPageChrome(doc, { siteName, sectionTitle: "Clearance Verdict", branding });

  const verdictLabel = verdict?.verdict || "PENDING";
  const vColor = verdictColor(verdictLabel);

  const bannerY = 32, bannerH = 36;
  doc.setFillColor(...vColor);
  doc.rect(margin, bannerY, contentW, bannerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PALETTE.white);
  doc.text(verdictLabel, W / 2, bannerY + bannerH / 2 + 1, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.caption.size);
  doc.text(verdictSubtitle(verdictLabel), W / 2, bannerY + bannerH / 2 + 9, { align: "center" });

  let y = bannerY + bannerH + 14;

  const reasons = pickReasons(verdict);
  if (reasons.items.length > 0) {
    y = drawSectionHeading(doc, reasons.heading, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.slate);
    reasons.items.forEach((item) => {
      const lines = doc.splitTextToSize(sanitize(item), contentW - 8);
      doc.setFillColor(...vColor);
      doc.circle(margin + 1.5, y - 1.5, 0.9, "F");
      doc.text(lines, margin + 6, y);
      y += lines.length * 4.5 + 3;
    });
    y += 6;
  }

  const actions = recommendedActions(verdictLabel, reasons.items.length);
  y = drawSectionHeading(doc, "RECOMMENDED NEXT STEPS", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(TYPE.body.size);
  doc.setTextColor(...PALETTE.slate);
  actions.forEach((step, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${step}`, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 3;
  });

  const signoffY = H - 50;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...PALETTE.rule);
  doc.line(margin, signoffY, W - margin, signoffY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TYPE.h3.size);
  doc.setTextColor(...PALETTE.ink);
  doc.text("EVALUATION SIGN-OFF", margin, signoffY + 8);

  const colW = contentW / 3;
  const fields = [
    { label: "FIRM",      value: branding?.firmName?.trim() || "LOWALTITUDEECONOMY.AERO" },
    { label: "EVALUATOR", value: branding?.evaluator?.trim() || "_______________________" },
    { label: "DATE",      value: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
  ];
  fields.forEach((f, i) => {
    const x = margin + i * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TYPE.pageMeta.size);
    doc.setTextColor(...PALETTE.muted);
    doc.text(f.label, x, signoffY + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TYPE.body.size);
    doc.setTextColor(...PALETTE.ink);
    doc.text(f.value, x, signoffY + 24, { maxWidth: colW - 4 });
  });
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

function verdictSubtitle(label) {
  if (label === "SITE CLEARED")          return "All hard-stop criteria pass. No conditions outstanding.";
  if (label === "CONDITIONAL CLEARANCE") return "Site is viable subject to resolution of the conditions below.";
  if (label === "SITE DISQUALIFIED")     return "One or more hard-stop criteria fail. Development is not recommended.";
  return "";
}

function pickReasons(verdict) {
  if (!verdict) return { heading: "", items: [] };
  if (verdict.hardStops?.length) {
    return { heading: "HARD STOPS", items: verdict.hardStops };
  }
  if (verdict.conditions?.length) {
    return { heading: "CONDITIONS REQUIRING RESOLUTION", items: verdict.conditions };
  }
  return { heading: "ASSESSMENT", items: ["All readiness criteria met. No outstanding conditions."] };
}

function recommendedActions(verdictLabel) {
  if (verdictLabel === "SITE CLEARED") {
    return [
      "Commission a Phase 1 site survey including ALTA boundary, geotechnical borings, and utility locates.",
      "Initiate FAA pre-application coordination for airspace and approach-path review (Form 7460-1).",
      "Engage local jurisdiction on land-use approvals and any conditional-use permits required.",
    ];
  }
  if (verdictLabel === "CONDITIONAL CLEARANCE") {
    return [
      "Resolve each condition listed above before advancing to detailed design.",
      "Commission a parcel boundary survey and geometry study to confirm DCA fit and FAA EB 105A compliance.",
      "Open early dialogue with FAA and the local planning authority to validate the resolution path.",
    ];
  }
  if (verdictLabel === "SITE DISQUALIFIED") {
    return [
      "This parcel is not recommended for fixed vertiport development.",
      "Identify alternate parcels within the same demand catchment that satisfy the failed criteria.",
      "If proceeding here is strategically required, plan for a Bankable Engineering Package to scope the mitigation cost and FAA waiver path.",
    ];
  }
  return [
    "Complete the evaluation before drafting next steps.",
  ];
}
