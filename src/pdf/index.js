import { jsPDF } from "jspdf";
import { drawCover } from "./pages/cover.js";
import { drawExecutiveSummary } from "./pages/executiveSummary.js";
import { drawVerdict } from "./pages/verdict.js";
import { drawSiteCriteria } from "./pages/siteCriteria.js";
import { drawDemandCriteria } from "./pages/demandCriteria.js";
import { drawSiteMap } from "./pages/siteMap.js";
import { drawRegulatoryChecklist } from "./pages/regulatoryChecklist.js";
import { drawInvestmentViability } from "./pages/investmentViability.js";
import { drawRoadmap } from "./pages/roadmap.js";

export function generatePDFv2(results, ctx = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawCover(doc, results, ctx);
  doc.addPage(); drawExecutiveSummary(doc, results, ctx);
  doc.addPage(); drawVerdict(doc, results, ctx);
  doc.addPage(); drawSiteCriteria(doc, results, ctx);
  doc.addPage(); drawDemandCriteria(doc, results, ctx);
  doc.addPage(); drawSiteMap(doc, results, ctx);
  doc.addPage(); drawRegulatoryChecklist(doc, results, ctx);
  doc.addPage(); drawInvestmentViability(doc, results, ctx);
  doc.addPage(); drawRoadmap(doc, results, ctx);

  const slug = (results?.geocode?.matched || "site")
    .split(",")[0]
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`vertiport-report-${slug}.pdf`);
}
