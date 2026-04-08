// US controlled airspace data — shared between SiteMap.jsx and airspace scoring.
// Covers all FAA Class B airports (39), major Class C airports (~120), and
// key Class D airports in major US metro areas.
// Class B: multi-tier wedding-cake structure (simplified to key rings)
// Class C: two-tier (5nm inner SFC, 10nm outer with elevated floor)
// Class D: single cylinder (typically 4-5nm radius, SFC-2500)
//
// Format: { id, name, class, lat, lon, tiers: [{ radius_nm, floor, ceiling }] }
// Radius in nautical miles, altitudes in feet MSL. floor: "SFC" or number.
// Sources: FAA Order 7400.11, current VFR sectional charts, AIM Ch. 3
// Note: Class B SFC scoring radius shrunk to 4nm in scoreAirspace() to account
// for irregular boundaries and geocoding offset.

export const NM_TO_M = 1852;

export const US_AIRSPACE = [

  // ═══════════════════════════════════════════════════════════
  // CLASS B — All 39 designated US Class B airports
  // ═══════════════════════════════════════════════════════════

  // ── Northeast ──
  { id: "BOS", name: "Boston Logan (Class B)", class: "B", lat: 42.3629, lon: -71.0064, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 10, floor: 1500,  ceiling: 7000 },
    { radius_nm: 15, floor: 4000,  ceiling: 7000 },
    { radius_nm: 22, floor: 5000,  ceiling: 7000 },
  ]},
  { id: "JFK", name: "New York Kennedy (Class B)", class: "B", lat: 40.6413, lon: -73.7781, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 10, floor: 1500,  ceiling: 7000 },
    { radius_nm: 15, floor: 2000,  ceiling: 7000 },
    { radius_nm: 20, floor: 3500,  ceiling: 7000 },
    { radius_nm: 25, floor: 5000,  ceiling: 7000 },
  ]},
  { id: "LGA", name: "New York LaGuardia (Class B)", class: "B", lat: 40.7772, lon: -73.8726, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 8,  floor: 1500,  ceiling: 7000 },
    { radius_nm: 12, floor: 2000,  ceiling: 7000 },
    { radius_nm: 18, floor: 3500,  ceiling: 7000 },
  ]},
  { id: "EWR", name: "Newark Liberty (Class B)", class: "B", lat: 40.6925, lon: -74.1687, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 10, floor: 1500,  ceiling: 7000 },
    { radius_nm: 15, floor: 3000,  ceiling: 7000 },
    { radius_nm: 20, floor: 5000,  ceiling: 7000 },
  ]},
  { id: "PHL", name: "Philadelphia International (Class B)", class: "B", lat: 39.8719, lon: -75.2411, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 1500,  ceiling: 8000 },
    { radius_nm: 15, floor: 3500,  ceiling: 8000 },
    { radius_nm: 20, floor: 6000,  ceiling: 8000 },
  ]},
  { id: "BWI", name: "Baltimore-Washington (Class B)", class: "B", lat: 39.1754, lon: -76.6684, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 10, floor: 2000,  ceiling: 7000 },
    { radius_nm: 15, floor: 4000,  ceiling: 7000 },
    { radius_nm: 20, floor: 6000,  ceiling: 7000 },
  ]},
  { id: "IAD", name: "Washington Dulles (Class B)", class: "B", lat: 38.9531, lon: -77.4565, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 15, floor: 4000,  ceiling: 8000 },
    { radius_nm: 20, floor: 6000,  ceiling: 8000 },
  ]},
  { id: "DCA", name: "Ronald Reagan Washington National (Class B)", class: "B", lat: 38.8521, lon: -77.0377, tiers: [
    { radius_nm: 3,  floor: "SFC", ceiling: 7000 },
    { radius_nm: 7,  floor: 1500,  ceiling: 7000 },
    { radius_nm: 12, floor: 3000,  ceiling: 7000 },
    { radius_nm: 18, floor: 5000,  ceiling: 7000 },
  ]},
  { id: "PIT", name: "Pittsburgh International (Class B)", class: "B", lat: 40.4915, lon: -80.2329, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "CLE", name: "Cleveland Hopkins (Class B)", class: "B", lat: 41.4117, lon: -81.8498, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},

  // ── Southeast ──
  { id: "CLT", name: "Charlotte Douglas (Class B)", class: "B", lat: 35.2141, lon: -80.9431, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2500,  ceiling: 10000 },
    { radius_nm: 15, floor: 5000,  ceiling: 10000 },
    { radius_nm: 20, floor: 7000,  ceiling: 10000 },
  ]},
  { id: "ATL", name: "Atlanta Hartsfield-Jackson (Class B)", class: "B", lat: 33.6407, lon: -84.4277, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 12500 },
    { radius_nm: 10, floor: 3000,  ceiling: 12500 },
    { radius_nm: 15, floor: 5500,  ceiling: 12500 },
    { radius_nm: 20, floor: 7000,  ceiling: 12500 },
    { radius_nm: 30, floor: 9000,  ceiling: 12500 },
  ]},
  { id: "MIA", name: "Miami International (Class B)", class: "B", lat: 25.7959, lon: -80.2870, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 1500,  ceiling: 8000 },
    { radius_nm: 15, floor: 3000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "FLL", name: "Fort Lauderdale-Hollywood (Class B)", class: "B", lat: 26.0726, lon: -80.1527, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 1200,  ceiling: 8000 },
    { radius_nm: 15, floor: 3000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "TPA", name: "Tampa International (Class B)", class: "B", lat: 27.9755, lon: -82.5332, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 1500,  ceiling: 8000 },
    { radius_nm: 20, floor: 4000,  ceiling: 8000 },
  ]},
  { id: "MCO", name: "Orlando International (Class B)", class: "B", lat: 28.4312, lon: -81.3081, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "BNA", name: "Nashville International (Class B)", class: "B", lat: 36.1245, lon: -86.6782, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "MEM", name: "Memphis International (Class B)", class: "B", lat: 35.0424, lon: -89.9767, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "MSY", name: "New Orleans Armstrong (Class B)", class: "B", lat: 29.9934, lon: -90.2580, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 4500,  ceiling: 8000 },
  ]},

  // ── Texas ──
  { id: "IAH", name: "Houston Class B (IAH/HOU)", class: "B", lat: 29.9844, lon: -95.3414, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 15, floor: 3000,  ceiling: 10000 },
    { radius_nm: 20, floor: 4000,  ceiling: 10000 },
    { radius_nm: 30, floor: 6000,  ceiling: 10000 },
  ]},
  { id: "DFW", name: "Dallas-Fort Worth (Class B)", class: "B", lat: 32.8998, lon: -97.0403, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 11000 },
    { radius_nm: 10, floor: 2000,  ceiling: 11000 },
    { radius_nm: 15, floor: 3000,  ceiling: 11000 },
    { radius_nm: 20, floor: 4000,  ceiling: 11000 },
    { radius_nm: 30, floor: 6000,  ceiling: 11000 },
  ]},
  { id: "SAT", name: "San Antonio (Class B)", class: "B", lat: 29.5337, lon: -98.4698, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 4000,  ceiling: 8000 },
  ]},

  // ── Midwest ──
  { id: "ORD", name: "Chicago O'Hare (Class B)", class: "B", lat: 41.9742, lon: -87.9073, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 15, floor: 3500,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
    { radius_nm: 30, floor: 7000,  ceiling: 10000 },
  ]},
  { id: "MDW", name: "Chicago Midway (Class B)", class: "B", lat: 41.7868, lon: -87.7522, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 9000 },
    { radius_nm: 10, floor: 1500,  ceiling: 9000 },
    { radius_nm: 15, floor: 3500,  ceiling: 9000 },
  ]},
  { id: "DTW", name: "Detroit Metropolitan (Class B)", class: "B", lat: 42.2162, lon: -83.3554, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "IND", name: "Indianapolis International (Class B)", class: "B", lat: 39.7173, lon: -86.2944, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "MSP", name: "Minneapolis-St. Paul (Class B)", class: "B", lat: 44.8848, lon: -93.2223, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "MCI", name: "Kansas City International (Class B)", class: "B", lat: 39.2976, lon: -94.7139, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "STL", name: "St. Louis Lambert (Class B)", class: "B", lat: 38.7487, lon: -90.3700, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},
  { id: "SDF", name: "Louisville Muhammad Ali (Class B)", class: "B", lat: 38.1744, lon: -85.7360, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2500,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},

  // ── Mountain / Southwest ──
  { id: "DEN", name: "Denver International (Class B)", class: "B", lat: 39.8561, lon: -104.6737, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 12500 },
    { radius_nm: 10, floor: 2000,  ceiling: 12500 },
    { radius_nm: 15, floor: 4000,  ceiling: 12500 },
    { radius_nm: 20, floor: 6000,  ceiling: 12500 },
    { radius_nm: 30, floor: 8000,  ceiling: 12500 },
  ]},
  { id: "PHX", name: "Phoenix Sky Harbor (Class B)", class: "B", lat: 33.4373, lon: -112.0078, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
    { radius_nm: 30, floor: 8000,  ceiling: 10000 },
  ]},
  { id: "LAS", name: "Las Vegas Harry Reid (Class B)", class: "B", lat: 36.0840, lon: -115.1537, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 3000,  ceiling: 10000 },
    { radius_nm: 20, floor: 6000,  ceiling: 10000 },
    { radius_nm: 30, floor: 8000,  ceiling: 10000 },
  ]},
  { id: "SLC", name: "Salt Lake City International (Class B)", class: "B", lat: 40.7884, lon: -111.9778, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2500,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
  ]},

  // ── Pacific ──
  { id: "LAX", name: "Los Angeles International (Class B)", class: "B", lat: 33.9425, lon: -118.4081, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2500,  ceiling: 10000 },
    { radius_nm: 15, floor: 4000,  ceiling: 10000 },
    { radius_nm: 20, floor: 6000,  ceiling: 10000 },
    { radius_nm: 25, floor: 8000,  ceiling: 10000 },
  ]},
  { id: "SAN", name: "San Diego International (Class B)", class: "B", lat: 32.7338, lon: -117.1933, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
  ]},
  { id: "SFO", name: "San Francisco International (Class B)", class: "B", lat: 37.6213, lon: -122.3790, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
    { radius_nm: 30, floor: 8000,  ceiling: 10000 },
  ]},
  { id: "SEA", name: "Seattle-Tacoma International (Class B)", class: "B", lat: 47.4502, lon: -122.3088, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000,  ceiling: 10000 },
    { radius_nm: 20, floor: 5000,  ceiling: 10000 },
    { radius_nm: 30, floor: 8000,  ceiling: 10000 },
  ]},
  { id: "PDX", name: "Portland International (Class B)", class: "B", lat: 45.5887, lon: -122.5975, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},

  // ── Hawaii / Pacific ──
  { id: "HNL", name: "Honolulu International (Class B)", class: "B", lat: 21.3245, lon: -157.9252, tiers: [
    { radius_nm: 5,  floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000,  ceiling: 8000 },
    { radius_nm: 20, floor: 5000,  ceiling: 8000 },
  ]},

  // ═══════════════════════════════════════════════════════════
  // CLASS C — Major US Class C airports
  // Standard structure: 5nm SFC shelf, 10nm outer shelf
  // ═══════════════════════════════════════════════════════════

  // ── Northeast ──
  { id: "ALB", name: "Albany International (Class C)",       class: "C", lat: 42.7483, lon: -73.8017, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4600 }, { radius_nm: 10, floor: 1600, ceiling: 4600 }] },
  { id: "BDL", name: "Hartford-Springfield (Class C)",       class: "C", lat: 41.9389, lon: -72.6832, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 1500, ceiling: 4900 }] },
  { id: "BTV", name: "Burlington International (Class C)",   class: "C", lat: 44.4720, lon: -73.1533, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4200 }, { radius_nm: 10, floor: 1800, ceiling: 4200 }] },
  { id: "BUF", name: "Buffalo Niagara (Class C)",            class: "C", lat: 42.9405, lon: -78.7322, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4800 }, { radius_nm: 10, floor: 2200, ceiling: 4800 }] },
  { id: "MHT", name: "Manchester-Boston Regional (Class C)", class: "C", lat: 42.9326, lon: -71.4357, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4100 }, { radius_nm: 10, floor: 1500, ceiling: 4100 }] },
  { id: "ORF", name: "Norfolk International (Class C)",      class: "C", lat: 36.8976, lon: -76.0181, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4200 }, { radius_nm: 10, floor: 1500, ceiling: 4200 }] },
  { id: "PWM", name: "Portland Jetport (Class C)",           class: "C", lat: 43.6462, lon: -70.3093, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3900 }, { radius_nm: 10, floor: 1900, ceiling: 3900 }] },
  { id: "RDU", name: "Raleigh-Durham (Class C)",             class: "C", lat: 35.8776, lon: -78.7875, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4800 }, { radius_nm: 10, floor: 1500, ceiling: 4800 }] },
  { id: "RIC", name: "Richmond International (Class C)",     class: "C", lat: 37.5052, lon: -77.3197, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4300 }, { radius_nm: 10, floor: 1300, ceiling: 4300 }] },
  { id: "ROC", name: "Rochester Greater (Class C)",          class: "C", lat: 43.1189, lon: -77.6724, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4600 }, { radius_nm: 10, floor: 1500, ceiling: 4600 }] },
  { id: "SYR", name: "Syracuse Hancock (Class C)",           class: "C", lat: 43.1112, lon: -76.1063, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4800 }, { radius_nm: 10, floor: 1700, ceiling: 4800 }] },

  // ── Southeast ──
  { id: "CAE", name: "Columbia Metropolitan (Class C)",      class: "C", lat: 33.9388, lon: -81.1195, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3900 }, { radius_nm: 10, floor: 1400, ceiling: 3900 }] },
  { id: "CHS", name: "Charleston International (Class C)",   class: "C", lat: 32.8986, lon: -80.0405, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4200 }, { radius_nm: 10, floor: 1200, ceiling: 4200 }] },
  { id: "DAB", name: "Daytona Beach International (Class C)",class: "C", lat: 29.1799, lon: -81.0581, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4100 }, { radius_nm: 10, floor: 1300, ceiling: 4100 }] },
  { id: "GNV", name: "Gainesville Regional (Class C)",       class: "C", lat: 29.6900, lon: -82.2718, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3900 }, { radius_nm: 10, floor: 1500, ceiling: 3900 }] },
  { id: "GSO", name: "Greensboro Piedmont Triad (Class C)",  class: "C", lat: 36.0978, lon: -79.9373, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4700 }, { radius_nm: 10, floor: 1500, ceiling: 4700 }] },
  { id: "GSP", name: "Greenville-Spartanburg (Class C)",     class: "C", lat: 34.8957, lon: -82.2190, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4600 }, { radius_nm: 10, floor: 1500, ceiling: 4600 }] },
  { id: "JAX", name: "Jacksonville International (Class C)", class: "C", lat: 30.4941, lon: -81.6879, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4200 }, { radius_nm: 10, floor: 1200, ceiling: 4200 }] },
  { id: "MYR", name: "Myrtle Beach International (Class C)", class: "C", lat: 33.6797, lon: -78.9283, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1300, ceiling: 3800 }] },
  { id: "PBI", name: "Palm Beach International (Class C)",   class: "C", lat: 26.6832, lon: -80.0956, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1200, ceiling: 3800 }] },
  { id: "RSW", name: "Fort Myers Southwest Florida (Class C)",class: "C", lat: 26.5362, lon: -81.7552, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1300, ceiling: 3800 }] },
  { id: "SAV", name: "Savannah Hilton Head (Class C)",       class: "C", lat: 32.1276, lon: -81.2021, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4200 }, { radius_nm: 10, floor: 1200, ceiling: 4200 }] },
  { id: "SRQ", name: "Sarasota-Bradenton (Class C)",         class: "C", lat: 27.3954, lon: -82.5544, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1200, ceiling: 3800 }] },
  { id: "TLH", name: "Tallahassee International (Class C)",  class: "C", lat: 30.3965, lon: -84.3503, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1300, ceiling: 3800 }] },
  { id: "TYS", name: "Knoxville McGhee Tyson (Class C)",     class: "C", lat: 35.8110, lon: -83.9941, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 1700, ceiling: 4900 }] },
  { id: "MLB", name: "Melbourne Orlando International (Class C)", class: "C", lat: 28.1028, lon: -80.6453, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1300, ceiling: 3800 }] },

  // ── South/Gulf ──
  { id: "BHM", name: "Birmingham-Shuttlesworth (Class C)",   class: "C", lat: 33.5629, lon: -86.7535, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2100, ceiling: 5000 }] },
  { id: "ECP", name: "Northwest Florida Beaches (Class C)",  class: "C", lat: 30.3581, lon: -85.7995, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1300, ceiling: 3800 }] },
  { id: "HRL", name: "Harlingen Valley (Class C)",           class: "C", lat: 26.2285, lon: -97.6545, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3600 }, { radius_nm: 10, floor: 1400, ceiling: 3600 }] },
  { id: "JAN", name: "Jackson-Medgar Wiley Evers (Class C)", class: "C", lat: 32.3112, lon: -90.0759, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4500 }, { radius_nm: 10, floor: 1700, ceiling: 4500 }] },
  { id: "LFT", name: "Lafayette Regional (Class C)",         class: "C", lat: 30.2053, lon: -91.9877, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3700 }, { radius_nm: 10, floor: 1300, ceiling: 3700 }] },
  { id: "LIT", name: "Bill and Hillary Clinton (Class C)",   class: "C", lat: 34.7294, lon: -92.2243, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4800 }, { radius_nm: 10, floor: 1700, ceiling: 4800 }] },
  { id: "MOB", name: "Mobile Regional (Class C)",            class: "C", lat: 30.6912, lon: -88.2428, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4000 }, { radius_nm: 10, floor: 1400, ceiling: 4000 }] },
  { id: "SHV", name: "Shreveport Regional (Class C)",        class: "C", lat: 32.4466, lon: -93.8256, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 1700, ceiling: 4900 }] },

  // ── Texas (Class C) ──
  { id: "AUS", name: "Austin-Bergstrom (Class C)",           class: "C", lat: 30.1975, lon: -97.6664, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 1900, ceiling: 4900 }] },
  { id: "ELP", name: "El Paso International (Class C)",      class: "C", lat: 31.8072, lon: -106.3778, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 8500 }, { radius_nm: 10, floor: 4600, ceiling: 8500 }] },
  { id: "CRP", name: "Corpus Christi International (Class C)",class: "C", lat: 27.7704, lon: -97.5012, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4100 }, { radius_nm: 10, floor: 1300, ceiling: 4100 }] },
  { id: "LBB", name: "Lubbock Preston Smith (Class C)",      class: "C", lat: 33.6636, lon: -101.8228, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 6700 }, { radius_nm: 10, floor: 4200, ceiling: 6700 }] },
  { id: "MAF", name: "Midland International (Class C)",      class: "C", lat: 31.9425, lon: -102.2019, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 6600 }, { radius_nm: 10, floor: 4100, ceiling: 6600 }] },
  { id: "MFE", name: "McAllen Miller (Class C)",             class: "C", lat: 26.1758, lon: -98.2386, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1700, ceiling: 3800 }] },
  { id: "AMA", name: "Rick Husband Amarillo (Class C)",      class: "C", lat: 35.2194, lon: -101.7059, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 7600 }, { radius_nm: 10, floor: 5300, ceiling: 7600 }] },
  { id: "BRO", name: "Brownsville (Class C)",                class: "C", lat: 25.9068, lon: -97.4259, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3800 }, { radius_nm: 10, floor: 1700, ceiling: 3800 }] },

  // ── Midwest ──
  { id: "CID", name: "Cedar Rapids (Class C)",               class: "C", lat: 41.8842, lon: -91.7108, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5100 }, { radius_nm: 10, floor: 2200, ceiling: 5100 }] },
  { id: "CMH", name: "Columbus John Glenn (Class C)",        class: "C", lat: 39.9980, lon: -82.8919, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 1800, ceiling: 5000 }] },
  { id: "DAY", name: "Dayton International (Class C)",       class: "C", lat: 39.9024, lon: -84.2194, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 1800, ceiling: 5000 }] },
  { id: "DSM", name: "Des Moines International (Class C)",   class: "C", lat: 41.5340, lon: -93.6630, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5400 }, { radius_nm: 10, floor: 2100, ceiling: 5400 }] },
  { id: "FSD", name: "Sioux Falls Regional (Class C)",       class: "C", lat: 43.5820, lon: -96.7419, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5600 }, { radius_nm: 10, floor: 2200, ceiling: 5600 }] },
  { id: "GRR", name: "Gerald R. Ford Grand Rapids (Class C)",class: "C", lat: 42.8808, lon: -85.5228, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 1800, ceiling: 5000 }] },
  { id: "ICT", name: "Wichita Dwight Eisenhower (Class C)",  class: "C", lat: 37.6499, lon: -97.4330, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5700 }, { radius_nm: 10, floor: 2200, ceiling: 5700 }] },
  { id: "LEX", name: "Lexington Blue Grass (Class C)",       class: "C", lat: 38.0365, lon: -84.6059, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 1800, ceiling: 4900 }] },
  { id: "MKE", name: "Milwaukee Mitchell (Class C)",         class: "C", lat: 42.9472, lon: -87.8966, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 2100, ceiling: 4900 }] },
  { id: "OMA", name: "Omaha Eppley (Class C)",               class: "C", lat: 41.3032, lon: -95.8941, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5600 }, { radius_nm: 10, floor: 2200, ceiling: 5600 }] },
  { id: "TUL", name: "Tulsa International (Class C)",        class: "C", lat: 36.1984, lon: -95.8881, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5800 }, { radius_nm: 10, floor: 2200, ceiling: 5800 }] },
  { id: "OKC", name: "Oklahoma City Will Rogers (Class C)",  class: "C", lat: 35.3931, lon: -97.6007, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5600 }, { radius_nm: 10, floor: 2200, ceiling: 5600 }] },

  // ── Mountain / Southwest ──
  { id: "ABQ", name: "Albuquerque Sunport (Class C)",        class: "C", lat: 35.0402, lon: -106.6090, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 8500 }, { radius_nm: 10, floor: 5200, ceiling: 8500 }] },
  { id: "BOI", name: "Boise Airport (Class C)",              class: "C", lat: 43.5644, lon: -116.2228, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5500 }, { radius_nm: 10, floor: 2500, ceiling: 5500 }] },
  { id: "COS", name: "Colorado Springs (Class C)",           class: "C", lat: 38.8059, lon: -104.7008, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 9500 }, { radius_nm: 10, floor: 6500, ceiling: 9500 }] },
  { id: "GEG", name: "Spokane International (Class C)",      class: "C", lat: 47.6199, lon: -117.5331, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4900 }, { radius_nm: 10, floor: 2300, ceiling: 4900 }] },
  { id: "GTF", name: "Great Falls International (Class C)",  class: "C", lat: 47.4820, lon: -111.3709, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5800 }, { radius_nm: 10, floor: 2800, ceiling: 5800 }] },
  { id: "MFR", name: "Medford Rogue Valley (Class C)",       class: "C", lat: 42.3742, lon: -122.8735, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5300 }, { radius_nm: 10, floor: 2200, ceiling: 5300 }] },
  { id: "RNO", name: "Reno-Tahoe International (Class C)",   class: "C", lat: 39.4991, lon: -119.7681, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 7500 }, { radius_nm: 10, floor: 4500, ceiling: 7500 }] },
  { id: "TUS", name: "Tucson International (Class C)",       class: "C", lat: 32.1161, lon: -110.9410, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 8800 }, { radius_nm: 10, floor: 5500, ceiling: 8800 }] },
  { id: "YUM", name: "Yuma International (Class C)",         class: "C", lat: 32.6566, lon: -114.6060, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4300 }, { radius_nm: 10, floor: 1200, ceiling: 4300 }] },

  // ── Pacific ──
  { id: "ANC", name: "Ted Stevens Anchorage (Class C)",      class: "C", lat: 61.1744, lon: -149.9964, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3500 }, { radius_nm: 10, floor: 1200, ceiling: 3500 }] },
  { id: "BUR", name: "Burbank Hollywood Burbank (Class C)",  class: "C", lat: 34.2007, lon: -118.3584, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2500, ceiling: 5000 }] },
  { id: "FAT", name: "Fresno Yosemite (Class C)",            class: "C", lat: 36.7762, lon: -119.7182, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5200 }, { radius_nm: 10, floor: 2200, ceiling: 5200 }] },
  { id: "LGB", name: "Long Beach Airport (Class C)",         class: "C", lat: 33.8177, lon: -118.1516, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2500, ceiling: 5000 }] },
  { id: "OAK", name: "Oakland Metropolitan (Class C)",       class: "C", lat: 37.7213, lon: -122.2208, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2500, ceiling: 5000 }] },
  { id: "OGG", name: "Maui Kahului (Class C)",               class: "C", lat: 20.8986, lon: -156.4305, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 4000 }, { radius_nm: 10, floor: 1600, ceiling: 4000 }] },
  { id: "ONT", name: "Ontario International (Class C)",      class: "C", lat: 34.0559, lon: -117.6007, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5500 }, { radius_nm: 10, floor: 2500, ceiling: 5500 }] },
  { id: "SJC", name: "San Jose International (Class C)",     class: "C", lat: 37.3626, lon: -121.9290, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2500, ceiling: 5000 }] },
  { id: "SMF", name: "Sacramento International (Class C)",   class: "C", lat: 38.6954, lon: -121.5908, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5500 }, { radius_nm: 10, floor: 2500, ceiling: 5500 }] },
  { id: "SNA", name: "Orange County John Wayne (Class C)",   class: "C", lat: 33.6757, lon: -117.8683, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5000 }, { radius_nm: 10, floor: 2500, ceiling: 5000 }] },

  // ═══════════════════════════════════════════════════════════
  // CLASS D — Key metro area airports
  // Standard: 4-5nm radius, SFC-2500 AGL
  // ═══════════════════════════════════════════════════════════

  // ── Texas (retained from Phase 1) ──
  { id: "DWH", name: "David Wayne Hooks (Class D)",         class: "D", lat: 30.0618, lon: -95.5546, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2800 }] },
  { id: "EFD", name: "Ellington Field (Class D)",           class: "D", lat: 29.6073, lon: -95.1586, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "SGR", name: "Sugar Land Regional (Class D)",       class: "D", lat: 29.6223, lon: -95.6565, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2700 }] },
  { id: "IWS", name: "West Houston (Class D)",              class: "D", lat: 29.8182, lon: -95.6726, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "CXO", name: "Conroe-North Houston (Class D)",      class: "D", lat: 30.3518, lon: -95.4144, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "DAL", name: "Dallas Love Field (Class D)",         class: "D", lat: 32.8471, lon: -96.8518, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3100 }] },
  { id: "ADS", name: "Addison Airport (Class D)",           class: "D", lat: 32.9686, lon: -96.8364, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "AFW", name: "Fort Worth Alliance (Class D)",       class: "D", lat: 32.9876, lon: -97.3188, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3200 }] },
  { id: "FTW", name: "Fort Worth Meacham (Class D)",        class: "D", lat: 32.8198, lon: -97.3624, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "GPM", name: "Grand Prairie Municipal (Class D)",   class: "D", lat: 32.6986, lon: -97.0467, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2900 }] },
  { id: "RBD", name: "Dallas Executive (Class D)",          class: "D", lat: 32.6809, lon: -96.8682, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3000 }] },
  { id: "RND", name: "Randolph AFB (Class D)",              class: "D", lat: 29.5297, lon: -98.2789, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2600 }] },
  { id: "SSF", name: "Stinson Municipal (Class D)",         class: "D", lat: 29.3370, lon: -98.4711, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2300 }] },
  { id: "GTU", name: "Georgetown Municipal (Class D)",      class: "D", lat: 30.6788, lon: -97.6794, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },

  // ── New York Metro ──
  { id: "HPN", name: "Westchester County (Class D)",        class: "D", lat: 41.0670, lon: -73.7076, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3500 }] },
  { id: "ISP", name: "Long Island MacArthur (Class D)",     class: "D", lat: 40.7952, lon: -73.1002, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3000 }] },
  { id: "TEB", name: "Teterboro (Class D)",                 class: "D", lat: 40.8501, lon: -74.0608, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 1500 }] },
  { id: "CDW", name: "Caldwell Essex County (Class D)",     class: "D", lat: 40.8752, lon: -74.2814, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2400 }] },

  // ── Washington DC Metro ──
  { id: "GAI", name: "Montgomery County (Class D)",         class: "D", lat: 39.1683, lon: -77.1660, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 1800 }] },
  { id: "ADW", name: "Andrews Field (Class D)",             class: "D", lat: 38.8108, lon: -76.8669, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3400 }] },

  // ── Chicago Metro ──
  { id: "PWK", name: "Chicago Executive (Class D)",         class: "D", lat: 42.1142, lon: -87.9015, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3200 }] },
  { id: "DPA", name: "DuPage Airport (Class D)",            class: "D", lat: 41.9078, lon: -88.2486, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3300 }] },
  { id: "CGX", name: "Chicago Meigs / Lakefront (Class D)", class: "D", lat: 41.8588, lon: -87.6090, tiers: [{ radius_nm: 3, floor: "SFC", ceiling: 2600 }] },
  { id: "ARR", name: "Aurora Municipal (Class D)",          class: "D", lat: 41.7719, lon: -88.4757, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3200 }] },

  // ── Los Angeles Metro ──
  { id: "SMO", name: "Santa Monica Municipal (Class D)",    class: "D", lat: 34.0158, lon: -118.4514, tiers: [{ radius_nm: 3, floor: "SFC", ceiling: 3500 }] },
  { id: "VNY", name: "Van Nuys Airport (Class D)",          class: "D", lat: 34.2098, lon: -118.4898, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },
  { id: "TOA", name: "Torrance/Zamperini Field (Class D)",  class: "D", lat: 33.8034, lon: -118.3396, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },
  { id: "HHR", name: "Hawthorne Municipal (Class D)",       class: "D", lat: 33.9228, lon: -118.3348, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },
  { id: "CMA", name: "Camarillo Airport (Class D)",         class: "D", lat: 34.2137, lon: -119.0944, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3300 }] },
  { id: "WHP", name: "Whiteman Airport (Class D)",          class: "D", lat: 34.2593, lon: -118.4134, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },

  // ── San Francisco Bay Area ──
  { id: "STS", name: "Sonoma County (Class D)",             class: "D", lat: 38.5090, lon: -122.8129, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2800 }] },
  { id: "SQL", name: "San Carlos Airport (Class D)",        class: "D", lat: 37.5119, lon: -122.2499, tiers: [{ radius_nm: 3, floor: "SFC", ceiling: 2500 }] },
  { id: "PAO", name: "Palo Alto Airport (Class D)",         class: "D", lat: 37.4611, lon: -122.1149, tiers: [{ radius_nm: 3, floor: "SFC", ceiling: 2500 }] },
  { id: "HWD", name: "Hayward Executive (Class D)",         class: "D", lat: 37.6589, lon: -122.1221, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },

  // ── Seattle Metro ──
  { id: "RNT", name: "Renton Municipal (Class D)",          class: "D", lat: 47.4931, lon: -122.2160, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "BFI", name: "Boeing Field King County (Class D)",  class: "D", lat: 47.5300, lon: -122.3017, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "PAE", name: "Snohomish County Paine Field (Class D)", class: "D", lat: 47.9063, lon: -122.2815, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3000 }] },

  // ── Denver Metro ──
  { id: "APA", name: "Centennial Airport (Class D)",        class: "D", lat: 39.5701, lon: -104.8492, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 7800 }] },
  { id: "BJC", name: "Rocky Mountain Metro (Class D)",      class: "D", lat: 39.9088, lon: -105.1167, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 6800 }] },

  // ── Phoenix Metro ──
  { id: "SDL", name: "Scottsdale Airport (Class D)",        class: "D", lat: 33.6229, lon: -111.9111, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 5500 }] },
  { id: "DVT", name: "Phoenix Deer Valley (Class D)",       class: "D", lat: 33.6883, lon: -112.0828, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 5400 }] },
  { id: "CHD", name: "Chandler Municipal (Class D)",        class: "D", lat: 33.2692, lon: -111.8109, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 5200 }] },
  { id: "IWA", name: "Phoenix-Mesa Gateway (Class D)",      class: "D", lat: 33.3078, lon: -111.6550, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 5200 }] },

  // ── Miami / South Florida ──
  { id: "OPF", name: "Opa-locka Executive (Class D)",       class: "D", lat: 25.9075, lon: -80.2783, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "TMB", name: "Kendall-Tamiami Executive (Class D)", class: "D", lat: 25.6479, lon: -80.4328, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "FXE", name: "Fort Lauderdale Executive (Class D)", class: "D", lat: 26.1973, lon: -80.1707, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },
  { id: "BCT", name: "Boca Raton (Class D)",                class: "D", lat: 26.3785, lon: -80.1077, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2500 }] },

  // ── Atlanta Metro ──
  { id: "PDK", name: "Dekalb-Peachtree (Class D)",          class: "D", lat: 33.8756, lon: -84.3021, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3800 }] },
  { id: "FTY", name: "Fulton County (Class D)",             class: "D", lat: 33.7790, lon: -84.5214, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3300 }] },
  { id: "RYY", name: "Cherokee County (Class D)",           class: "D", lat: 34.1573, lon: -84.7114, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3600 }] },

  // ── Orlando / Central FL ──
  { id: "SFB", name: "Orlando Sanford (Class D)",           class: "D", lat: 28.7776, lon: -81.2375, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 3000 }] },
  { id: "ISM", name: "Kissimmee Gateway (Class D)",         class: "D", lat: 28.2898, lon: -81.4371, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2800 }] },
  { id: "DAB", name: "Daytona Beach (Class D)",             class: "D", lat: 29.1799, lon: -81.0581, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 2600 }] },

  // ── Minneapolis Metro ──
  { id: "FCM", name: "Flying Cloud (Class D)",              class: "D", lat: 44.8272, lon: -93.4572, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3200 }] },
  { id: "ANE", name: "Anoka County Blaine (Class D)",       class: "D", lat: 45.1450, lon: -93.2114, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3400 }] },

  // ── Detroit Metro ──
  { id: "YIP", name: "Willow Run (Class D)",                class: "D", lat: 42.2379, lon: -83.5304, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2900 }] },
  { id: "PTK", name: "Oakland County Pontiac (Class D)",    class: "D", lat: 42.6655, lon: -83.4198, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2900 }] },

  // ── Denver / Colorado Springs ──
  { id: "FNL", name: "Northern Colorado Regional (Class D)",class: "D", lat: 40.4518, lon: -105.0111, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 6500 }] },
  { id: "GJT", name: "Grand Junction Regional (Class D)",   class: "D", lat: 39.1224, lon: -108.5268, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 5500 }] },

  // ── Las Vegas Metro ──
  { id: "HND", name: "Henderson Executive (Class D)",       class: "D", lat: 35.9728, lon: -115.1344, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3800 }] },
  { id: "VGT", name: "North Las Vegas (Class D)",           class: "D", lat: 36.2108, lon: -115.1943, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3800 }] },

  // ── Midwest / Plains ──
  { id: "LNK", name: "Lincoln Airport (Class D)",           class: "D", lat: 40.8510, lon: -96.7592, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 4400 }] },
  { id: "MHK", name: "Manhattan Regional (Class D)",        class: "D", lat: 39.1410, lon: -96.6708, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3800 }] },
  { id: "TOP", name: "Philip Billard Municipal (Class D)",  class: "D", lat: 39.0687, lon: -95.6632, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 3500 }] },

  // ── Pacific Northwest ──
  { id: "HIO", name: "Portland Hillsboro (Class D)",        class: "D", lat: 45.5404, lon: -122.9497, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2800 }] },
  { id: "TTD", name: "Portland Troutdale (Class D)",        class: "D", lat: 45.5494, lon: -122.4012, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2600 }] },
  { id: "GRF", name: "Gray Army Airfield (Class D)",        class: "D", lat: 47.0793, lon: -122.5806, tiers: [{ radius_nm: 5, floor: "SFC", ceiling: 2700 }] },
  { id: "OLM", name: "Olympia Regional (Class D)",          class: "D", lat: 46.9694, lon: -122.9026, tiers: [{ radius_nm: 4, floor: "SFC", ceiling: 2600 }] },
];
