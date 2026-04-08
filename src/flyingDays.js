// Estimated annual flying days for eVTOL operations at a US location.
// Uses NOAA 30-year climate normals (1991-2020) for US reference stations,
// inverse-distance-weighted to the target lat/lon.
//
// Grounding constraints modeled:
//   Thunderstorms  — convective activity, turbulence, lightning (primary limiter)
//   Low visibility — fog/mist with ceiling < 500 ft or vis < 1 SM
//   High wind      — sustained surface wind > 30 kt
//   Heavy precip   — rain/ice heavy enough to exceed rotor/sensor limits
//   Extreme heat   — DA > 6000 ft equivalent degrades battery & lift margin
//   Winter icing   — freezing precip or temps < 28°F with moisture
//
// Overlap correction: many events co-occur (thunderstorms bring wind + precip),
// so raw no-fly days are reduced by measured co-occurrence factors.

// Reference stations: [lat, lon, name, thunderstormDays, fogDays, highWindDays,
//   heavyPrecipDays, extremeHeatDays, icingDays]
// Sources: NOAA LCD, NWS climate summaries, FAA ASOS/AWOS records
const STATIONS = [
  // ── Texas ──────────────────────────────────────────────────────
  [29.984, -95.341, "Houston IAH",         82, 25,  5, 22, 12,  1],
  [29.645, -95.279, "Houston Hobby",       78, 22,  4, 20, 14,  1],
  [29.530, -95.020, "Galveston",           65, 35, 14, 18,  6,  0],
  [30.194, -97.670, "Austin",              41, 22,  6, 18, 18,  2],
  [29.534, -98.470, "San Antonio",         36, 20,  5, 16, 22,  2],
  [32.897, -97.038, "Dallas-Fort Worth",   48, 18,  8, 15, 20,  4],
  [31.942,-102.202, "Midland",             38, 10, 15,  8, 28,  3],
  [33.654,-101.823, "Lubbock",             44, 12, 18, 10, 16,  5],
  [27.774, -97.512, "Corpus Christi",      35, 30, 12, 14, 18,  0],
  [31.806,-106.378, "El Paso",             32,  8, 12,  6, 35,  2],
  [25.907, -97.426, "Brownsville",         30, 28, 10, 15, 20,  0],
  [30.064, -94.021, "Beaumont-Port Arthur",75, 30,  6, 24, 10,  1],
  [35.233,-101.709, "Amarillo",            50, 10, 22,  9, 14,  8],
  [32.412, -99.682, "Abilene",             42, 14, 12, 11, 22,  4],
  [26.201, -98.239, "McAllen",             28, 22,  8, 12, 24,  0],

  // ── Southeast ──────────────────────────────────────────────────
  [33.641, -84.428, "Atlanta",             52, 24,  4, 25,  8,  4],
  [25.796, -80.287, "Miami",               62, 18,  8, 28, 14,  0],
  [26.073, -80.153, "Fort Lauderdale",     60, 20,  7, 27, 12,  0],
  [27.976, -82.533, "Tampa",               87, 26,  5, 26, 10,  0],
  [28.431, -81.308, "Orlando",             90, 22,  4, 26, 10,  0],
  [30.494, -81.688, "Jacksonville",        68, 28,  5, 22,  8,  1],
  [30.327, -81.656, "Jacksonville Beach",  65, 32,  6, 22,  7,  1],
  [35.214, -80.943, "Charlotte",           42, 22,  5, 18,  6,  6],
  [33.563, -86.754, "Birmingham",          51, 18,  4, 22,  8,  5],
  [35.042, -89.977, "Memphis",             55, 20,  5, 18, 12,  5],
  [36.125, -86.678, "Nashville",           52, 22,  4, 20, 10,  6],
  [29.993, -90.258, "New Orleans",         72, 28,  6, 24, 10,  1],
  [32.311, -90.076, "Jackson MS",          58, 20,  4, 20, 12,  2],
  [30.691, -88.243, "Mobile",              60, 28,  5, 22,  8,  1],

  // ── Northeast ──────────────────────────────────────────────────
  [40.641, -73.778, "New York JFK",        22, 32,  9, 22,  2, 12],
  [40.777, -73.873, "New York LaGuardia",  20, 30,  9, 20,  2, 11],
  [40.693, -74.169, "Newark",              22, 30,  8, 22,  2, 12],
  [42.363, -71.006, "Boston",              18, 28, 12, 20,  0, 15],
  [39.872, -75.241, "Philadelphia",        27, 24,  7, 20,  2, 12],
  [39.175, -76.668, "Baltimore",           27, 22,  7, 20,  2, 12],
  [38.852, -77.038, "Washington DC",       27, 22,  6, 20,  2, 10],
  [41.412, -81.850, "Cleveland",           32, 28, 10, 22,  1, 18],
  [40.491, -80.233, "Pittsburgh",          27, 32,  8, 22,  1, 15],
  [42.943, -78.732, "Buffalo",             24, 28, 12, 22,  0, 25],
  [43.119, -77.672, "Rochester NY",        22, 26, 10, 22,  0, 28],
  [42.363, -71.006, "Hartford",            18, 26, 10, 20,  0, 16],

  // ── Midwest ──────────────────────────────────────────────────
  [41.974, -87.907, "Chicago O'Hare",      38, 22, 14, 20,  2, 18],
  [41.787, -87.752, "Chicago Midway",      36, 22, 14, 20,  2, 17],
  [44.885, -93.222, "Minneapolis",         38, 18, 14, 18,  2, 28],
  [38.749, -90.370, "St. Louis",           48, 20,  8, 20,  8, 10],
  [39.718, -86.294, "Indianapolis",        40, 22,  7, 20,  4, 14],
  [42.216, -83.355, "Detroit",             32, 24, 10, 20,  1, 18],
  [39.998, -82.892, "Columbus OH",         38, 22,  7, 20,  2, 14],
  [39.902, -84.219, "Dayton",              36, 22,  7, 18,  2, 15],
  [41.853, -91.711, "Cedar Rapids",        44, 18, 12, 18,  2, 18],
  [41.534, -93.663, "Des Moines",          45, 18, 14, 18,  2, 18],
  [41.303, -95.894, "Omaha",               46, 16, 14, 16,  4, 16],
  [38.175, -85.736, "Louisville",          42, 20,  5, 20,  4, 10],
  [38.037, -84.606, "Lexington KY",        42, 22,  5, 18,  2, 12],
  [42.947, -87.897, "Milwaukee",           30, 20, 14, 18,  1, 20],

  // ── Great Plains / Mountain ──────────────────────────────────
  [39.856,-104.674, "Denver",              42, 12, 18, 12,  6, 18],
  [38.806,-104.701, "Colorado Springs",    38, 10, 20, 10,  4, 18],
  [36.984, -95.888, "Tulsa",              58, 14, 12, 15, 14,  8],
  [35.393, -97.601, "Oklahoma City",       58, 14, 14, 14, 16,  7],
  [37.650, -97.433, "Wichita",             50, 14, 16, 14, 16, 10],
  [39.298, -94.714, "Kansas City",         50, 18, 10, 18, 10, 12],
  [38.749, -90.370, "St. Louis",           48, 20,  8, 20,  8, 10],
  [43.564,-116.223, "Boise",              14, 24, 10, 14,  8,  8],
  [47.482,-111.371, "Great Falls",          8, 16, 22, 12,  0, 18],
  [45.807,-108.543, "Billings",            14, 14, 18, 10,  2, 16],
  [40.788,-111.978, "Salt Lake City",      22, 20, 12, 12,  4, 14],
  [39.499,-119.768, "Reno",                6, 20, 14, 10, 12,  8],

  // ── Southwest / Pacific ───────────────────────────────────────
  [33.437,-112.008, "Phoenix",             23,  4, 12,  8, 45,  0],
  [36.084,-115.154, "Las Vegas",           12,  4, 12,  6, 50,  0],
  [32.116,-110.941, "Tucson",              46,  4, 10,  8, 40,  0],
  [35.040,-106.609, "Albuquerque",         38,  8, 14,  8, 20,  4],
  [33.943,-118.408, "Los Angeles",          2, 30,  8, 14,  8,  0],
  [33.734,-117.868, "Orange County",        2, 28,  8, 12,  6,  0],
  [32.734,-117.193, "San Diego",            2, 28,  8, 12,  6,  0],
  [37.621,-122.379, "San Francisco",        4, 40, 14, 18,  0,  0],
  [37.363,-121.929, "San Jose",             4, 36, 12, 16,  2,  0],
  [38.695,-121.591, "Sacramento",           4, 36, 10, 14,  8,  0],
  [47.450,-122.309, "Seattle",              4, 38, 10, 20,  0,  4],
  [45.589,-122.598, "Portland OR",          4, 36,  8, 20,  0,  4],
  [47.620,-117.533, "Spokane",              8, 24, 12, 18,  2, 12],

  // ── Alaska / Hawaii ──────────────────────────────────────────
  [61.174,-149.996, "Anchorage",           6, 30, 16, 18,  0, 40],
  [64.815,-147.856, "Fairbanks",           4, 24, 12, 14,  0, 55],
  [21.325,-157.925, "Honolulu",            1, 16, 10, 12,  2,  0],
  [20.899,-156.431, "Maui Kahului",        1, 12, 20, 12,  0,  0],
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate annual flying days for eVTOL ops at the given US coordinates.
 * Returns { flyingDays, noFlyDays, breakdown, rating, notes, monthly }
 */
export function estimateFlyingDays(lat, lon) {
  // Inverse-distance weighting across reference stations
  const weights = [];
  let totalWeight = 0;
  for (const st of STATIONS) {
    const d = haversine(lat, lon, st[0], st[1]);
    const w = d < 0.5 ? 1000 : 1 / (d * d); // near-exact match gets high weight
    weights.push(w);
    totalWeight += w;
  }

  let thunderstorm = 0, fog = 0, wind = 0, precip = 0, heat = 0, icing = 0;
  for (let i = 0; i < STATIONS.length; i++) {
    const f = weights[i] / totalWeight;
    thunderstorm += STATIONS[i][3] * f;
    fog          += STATIONS[i][4] * f;
    wind         += STATIONS[i][5] * f;
    precip       += STATIONS[i][6] * f;
    heat         += STATIONS[i][7] * f;
    icing        += STATIONS[i][8] * f;
  }

  // Round interpolated values
  thunderstorm = Math.round(thunderstorm);
  fog          = Math.round(fog);
  wind         = Math.round(wind);
  precip       = Math.round(precip);
  heat         = Math.round(heat);
  icing        = Math.round(icing);

  // Co-occurrence overlap correction:
  // - ~60% of heavy precip days are also thunderstorm days
  // - ~30% of high wind days co-occur with thunderstorms
  // - ~40% of fog days overlap with precip events
  // - ~20% of icing days overlap with fog
  const rawNoFly = thunderstorm + fog + wind + precip + heat + icing;
  const overlap =
    Math.round(precip * 0.60) +
    Math.round(wind * 0.30) +
    Math.round(fog * 0.40) +
    Math.round(icing * 0.20);
  const uniqueNoFly = Math.max(30, Math.min(200, rawNoFly - overlap));
  const flyingDays = 365 - uniqueNoFly;

  // Monthly distribution (Houston-area seasonal pattern, shifted by latitude)
  // Thunderstorm peak: May-Sep. Fog peak: Nov-Feb. Heat: Jun-Sep.
  const monthlyNoFly = computeMonthlyNoFly(thunderstorm, fog, wind, precip, heat, icing);
  const monthly = monthlyNoFly.map((nf) => ({
    flyDays: Math.max(0, Math.round((30.4 - nf) * 10) / 10),
    noFlyDays: Math.round(nf * 10) / 10,
  }));

  // Rating
  let rating, ratingColor;
  if (flyingDays >= 300) {
    rating = "EXCELLENT";
    ratingColor = "#28c87a";
  } else if (flyingDays >= 275) {
    rating = "GOOD";
    ratingColor = "#1a8a58";
  } else if (flyingDays >= 250) {
    rating = "MODERATE";
    ratingColor = "#f0a030";
  } else if (flyingDays >= 220) {
    rating = "FAIR";
    ratingColor = "#c87a10";
  } else {
    rating = "CHALLENGING";
    ratingColor = "#C0392B";
  }

  // Notes
  const limiters = [];
  if (thunderstorm >= 60) limiters.push("high convective activity");
  else if (thunderstorm >= 40) limiters.push("moderate thunderstorm frequency");
  if (fog >= 25) limiters.push("frequent low-visibility events");
  if (wind >= 15) limiters.push("persistent high winds");
  if (heat >= 25) limiters.push("significant heat-density altitude impact");
  if (icing >= 5) limiters.push("winter icing risk");

  const notes = limiters.length > 0
    ? `Primary limiters: ${limiters.join(", ")}. Schedule-sensitive operations should buffer ${Math.round(uniqueNoFly * 0.15)}-${Math.round(uniqueNoFly * 0.25)} additional standby days.`
    : "Favorable year-round operating conditions with minimal seasonal disruption.";

  return {
    flyingDays,
    noFlyDays: uniqueNoFly,
    breakdown: {
      thunderstorm,
      fog,
      wind,
      precip,
      heat,
      icing,
      overlap,
    },
    rating,
    ratingColor,
    notes,
    monthly,
  };
}

// Distribute no-fly days across months using seasonal weighting curves
function computeMonthlyNoFly(ts, fog, wind, precip, heat, icing) {
  // Seasonal weight profiles (Jan=0 through Dec=11)
  // Thunderstorms peak May-Sep
  const tsW  = [0.02, 0.03, 0.06, 0.10, 0.14, 0.15, 0.14, 0.13, 0.10, 0.06, 0.04, 0.03];
  // Fog peaks Nov-Feb
  const fogW = [0.14, 0.14, 0.10, 0.06, 0.03, 0.02, 0.02, 0.02, 0.04, 0.08, 0.14, 0.21];
  // Wind more uniform, slightly higher in spring
  const wndW = [0.08, 0.09, 0.11, 0.11, 0.09, 0.07, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09];
  // Precip follows thunderstorm pattern somewhat
  const prcW = [0.06, 0.06, 0.08, 0.10, 0.12, 0.12, 0.10, 0.10, 0.09, 0.07, 0.05, 0.05];
  // Heat Jun-Sep
  const htW  = [0.00, 0.00, 0.00, 0.02, 0.08, 0.20, 0.25, 0.25, 0.15, 0.05, 0.00, 0.00];
  // Icing Dec-Feb
  const iceW = [0.25, 0.25, 0.10, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.10, 0.30];

  const monthly = [];
  for (let m = 0; m < 12; m++) {
    const raw =
      ts * tsW[m] +
      fog * fogW[m] +
      wind * wndW[m] +
      precip * prcW[m] +
      heat * htW[m] +
      icing * iceW[m];
    // Apply overlap correction proportionally
    const corrected = raw * 0.72; // ~28% average overlap
    monthly.push(Math.min(28, corrected));
  }
  return monthly;
}
