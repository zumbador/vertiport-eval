// Texas controlled airspace data — shared between SiteMap.jsx and airspace scoring.
// Simplified FAA airspace boundaries for major Texas airports.
// Class B: multi-tier wedding-cake structure (simplified to key rings)
// Class C: two-tier (5nm inner, 10nm outer, SFC-4200 typical)
// Class D: single cylinder (typically 4-5nm radius, SFC-2500)
//
// Format: { id, name, class, lat, lon, tiers: [{ radius_nm, floor, ceiling }] }
// Radius in nautical miles, altitudes in feet MSL. floor: "SFC" or number.
// Sources: FAA Order 7400.11, current VFR sectional charts, AIM Ch. 3

export const NM_TO_M = 1852;

export const TX_AIRSPACE = [
  // ── Houston Class B ──
  { id: "IAH", name: "Houston Class B (IAH/HOU)", class: "B", lat: 29.9844, lon: -95.3414, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 15, floor: 3000,  ceiling: 10000 },
    { radius_nm: 20, floor: 4000,  ceiling: 10000 },
    { radius_nm: 30, floor: 6000,  ceiling: 10000 },
  ]},
  // ── Dallas-Fort Worth Class B ──
  { id: "DFW", name: "Dallas-Fort Worth Class B", class: "B", lat: 32.8998, lon: -97.0403, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 11000 },
    { radius_nm: 10, floor: 2000,  ceiling: 11000 },
    { radius_nm: 15, floor: 3000,  ceiling: 11000 },
    { radius_nm: 20, floor: 4000,  ceiling: 11000 },
    { radius_nm: 30, floor: 6000,  ceiling: 11000 },
  ]},
  // ── San Antonio Class B ──
  { id: "SAT", name: "San Antonio Class B", class: "B", lat: 29.5337, lon: -98.4698, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 4000,  ceiling: 8000 },
  ]},
  // ── Austin Class C ──
  { id: "AUS", name: "Austin-Bergstrom (Class C)", class: "C", lat: 30.1975, lon: -97.6664, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 4900 },
    { radius_nm: 10, floor: 1900,  ceiling: 4900 },
  ]},
  // ── El Paso Class C ──
  { id: "ELP", name: "El Paso International (Class C)", class: "C", lat: 31.8072, lon: -106.3778, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8500 },
    { radius_nm: 10, floor: 4600,  ceiling: 8500 },
  ]},
  // ── Corpus Christi Class C ──
  { id: "CRP", name: "Corpus Christi (Class C)", class: "C", lat: 27.7704, lon: -97.5012, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 4100 },
    { radius_nm: 10, floor: 1300,  ceiling: 4100 },
  ]},
  // ── Lubbock Class C ──
  { id: "LBB", name: "Lubbock Preston Smith (Class C)", class: "C", lat: 33.6636, lon: -101.8228, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 6700 },
    { radius_nm: 10, floor: 4200,  ceiling: 6700 },
  ]},
  // ── Midland Class C ──
  { id: "MAF", name: "Midland International (Class C)", class: "C", lat: 31.9425, lon: -102.2019, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 6600 },
    { radius_nm: 10, floor: 4100,  ceiling: 6600 },
  ]},
  // ── McAllen Class C ──
  { id: "MFE", name: "McAllen Miller (Class C)", class: "C", lat: 26.1758, lon: -98.2386, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 3800 },
    { radius_nm: 10, floor: 1700,  ceiling: 3800 },
  ]},
  // ── Amarillo Class C ──
  { id: "AMA", name: "Rick Husband Amarillo (Class C)", class: "C", lat: 35.2194, lon: -101.7059, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7600 },
    { radius_nm: 10, floor: 5300,  ceiling: 7600 },
  ]},
  // ── Brownsville Class C ──
  { id: "BRO", name: "Brownsville (Class C)", class: "C", lat: 25.9068, lon: -97.4259, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 3800 },
    { radius_nm: 10, floor: 1700,  ceiling: 3800 },
  ]},
  // ── Houston area Class D ──
  { id: "DWH", name: "David Wayne Hooks (Class D)",    class: "D", lat: 30.0618, lon: -95.5546, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2800 }] },
  { id: "EFD", name: "Ellington Field (Class D)",      class: "D", lat: 29.6073, lon: -95.1586, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "SGR", name: "Sugar Land Regional (Class D)",  class: "D", lat: 29.6223, lon: -95.6565, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2700 }] },
  { id: "IWS", name: "West Houston (Class D)",         class: "D", lat: 29.8182, lon: -95.6726, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "CXO", name: "Conroe-North Houston (Class D)", class: "D", lat: 30.3518, lon: -95.4144, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  // ── DFW area Class D ──
  { id: "DAL", name: "Dallas Love Field (Class D)",    class: "D", lat: 32.8471, lon: -96.8518, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3100 }] },
  { id: "ADS", name: "Addison Airport (Class D)",      class: "D", lat: 32.9686, lon: -96.8364, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "AFW", name: "Fort Worth Alliance (Class D)",  class: "D", lat: 32.9876, lon: -97.3188, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3200 }] },
  { id: "FTW", name: "Fort Worth Meacham (Class D)",   class: "D", lat: 32.8198, lon: -97.3624, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "GPM", name: "Grand Prairie Municipal (Class D)", class: "D", lat: 32.6986, lon: -97.0467, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2900 }] },
  { id: "RBD", name: "Dallas Executive (Class D)",     class: "D", lat: 32.6809, lon: -96.8682, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  // ── San Antonio area Class D ──
  { id: "RND", name: "Randolph AFB (Class D)",         class: "D", lat: 29.5297, lon: -98.2789, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2600 }] },
  { id: "SSF", name: "Stinson Municipal (Class D)",    class: "D", lat: 29.3370, lon: -98.4711, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2300 }] },
  // ── Austin area Class D ──
  { id: "GTU", name: "Georgetown Municipal (Class D)", class: "D", lat: 30.6788, lon: -97.6794, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },
];
