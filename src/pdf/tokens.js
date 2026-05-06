export const PALETTE = {
  paper:    [249, 249, 249],
  white:    [255, 255, 255],
  paleBlue: [234, 244, 252],

  ink:      [34, 34, 34],
  steel:    [85, 85, 85],
  slate:    [60, 60, 60],
  muted:    [136, 136, 136],

  accent:   [163, 209, 198],
  accent2:  [125, 176, 181],

  blue:     [91, 155, 213],
  red:      [192, 57, 43],
  green:    [74, 124, 89],
  amber:    [197, 139, 14],

  rule:     [221, 221, 221],
};

export const TYPE = {
  display:  { size: 28, weight: "bold" },
  h1:       { size: 18, weight: "bold" },
  h2:       { size: 12, weight: "bold" },
  h3:       { size: 9,  weight: "bold" },
  body:     { size: 9,  weight: "normal" },
  caption:  { size: 7,  weight: "normal" },
  mono:     { size: 8,  weight: "normal" },
  pageMeta: { size: 6,  weight: "normal" },
};

export const PAGE = {
  W: 210,
  H: 297,
  margin: 18,
  contentW: 174,
  headerH: 18,
  footerH: 12,
};

export const scoreColor = (s) =>
  s >= 75 ? PALETTE.accent2 : s >= 45 ? PALETTE.amber : PALETTE.red;

export const verdictColor = (label) => {
  if (label === "SITE CLEARED")          return PALETTE.accent2;
  if (label === "CONDITIONAL CLEARANCE") return PALETTE.blue;
  if (label === "SITE DISQUALIFIED")     return PALETTE.red;
  return PALETTE.muted;
};

export const sanitize = (s) =>
  String(s ?? "")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/×/g, "x")
    .replace(/→/g, "->")
    .replace(/…/g, "...");

export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
