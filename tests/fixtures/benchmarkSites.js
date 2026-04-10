// ── Validated benchmark sites — CLAUDE.md, Mar 30 2026 ───────────
// Expected scores are live-data baselines. Tolerance ±5 in regression tests.

export const BENCHMARK_SITES = [
  {
    id: "willClayton",
    name: "Will Clayton Pkwy",
    address: "8900 Will Clayton Pkwy, Humble TX",
    lat: 29.9774,
    lon: -95.2515,
    expected: { site: 74, demand: 54, pi: 66, quadrant: "INFRASTRUCTURE PLAY" },
    notes: "Parcel 1.17 ac → score 30. Class B outer 4.4nm IAH → airspace 45. Zone X minimal.",
    // HCAD live: 1.17 ac, commercial class F
    hcadMock: {
      features: [{ attributes: {
        HCAD_NUM: "0961470010001", land_sqft: 50965, acreage_1: 1.17,
        state_class: "F", site_str_num: "8900", site_str_name: "WILL CLAYTON PKWY",
      }}],
    },
    femaMock: {
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "", SFHA_TF: "F" } }],
    },
    usgsMock: { value: "62" },
    osmMock: { elements: [{ tags: { landuse: "commercial" } }] },
    nrelUtilityMock: { outputs: { utility_name: "CenterPoint Energy", commercial: 0.089, net_metering: true } },
    nrelSolarMock:   { outputs: { avg_ghi: { annual: 4.92 }, avg_dni: { annual: 5.31 } } },
    eiaMock: { response: { data: [{ period: "2024", sales: "4000000", sectorid: "ALL" }] } },
    // Expected component scores from live data
    expectedComponents: {
      parcel:   { score: 30, acreage: 1.17 },  // 0.5-1.5 ac tier
      airspace: { score: 45 },                  // Class B outer, 2000ft floor
      flood:    { score: 90 },                  // Zone X minimal
      zoning:   { score: 55 },                  // commercial landuse
    },
  },
  {
    id: "postOak",
    name: "Post Oak Blvd",
    address: "1400 Post Oak Blvd, Houston TX",
    lat: 29.7491,
    lon: -95.4621,
    expected: { site: 44, demand: 75, pi: 56, quadrant: "DEMAND WITHOUT SITE" },
    notes: "Parcel 11.56 ac → score 95. Class B outer 15.4nm IAH → airspace 60. Heliport +10/7.",
    hcadMock: {
      features: [{ attributes: {
        HCAD_NUM: "0660840000001", land_sqft: 503338, acreage_1: 11.56,
        state_class: "F", site_str_num: "1400", site_str_name: "POST OAK BLVD",
      }}],
    },
    femaMock: {
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "", SFHA_TF: "F" } }],
    },
    usgsMock: { value: "45" },
    osmMock: { elements: [{ tags: { landuse: "commercial" } }] },
    nrelUtilityMock: { outputs: { utility_name: "CenterPoint Energy", commercial: 0.089, net_metering: true } },
    nrelSolarMock:   { outputs: { avg_ghi: { annual: 4.92 }, avg_dni: { annual: 5.31 } } },
    eiaMock: { response: { data: [{ period: "2024", sales: "4000000", sectorid: "ALL" }] } },
    expectedComponents: {
      parcel:   { score: 95, acreage: 11.56 }, // >10 ac tier
      airspace: { score: 60 },                  // Class B outer, higher floor
      flood:    { score: 90 },                  // Zone X minimal
      zoning:   { score: 55 },                  // commercial
    },
  },
  {
    id: "tmc",
    name: "Texas Medical Center",
    lat: 29.7079,
    lon: -95.4010,
    expected: { site: 61, demand: 100, pi: 77, quadrant: "PRIME SITE" },
    notes: "Parcel 9.07 ac → score 85. Medical heliport +14/18. Zone X 500-yr.",
    hcadMock: {
      features: [{ attributes: {
        HCAD_NUM: "0660840000002", land_sqft: 395019, acreage_1: 9.07,
        state_class: "X", site_str_num: "6565", site_str_name: "FANNIN ST",
      }}],
    },
    femaMock: {
      // Zone X 500-yr subtype
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "0.2 PCT ANNUAL CHANCE FLOOD HAZARD", SFHA_TF: "F" } }],
    },
    usgsMock: { value: "50" },
    osmMock: { elements: [{ tags: { building: "hospital" } }] },
    nrelUtilityMock: { outputs: { utility_name: "CenterPoint Energy", commercial: 0.089, net_metering: true } },
    nrelSolarMock:   { outputs: { avg_ghi: { annual: 4.92 }, avg_dni: { annual: 5.31 } } },
    eiaMock: { response: { data: [{ period: "2024", sales: "4000000", sectorid: "ALL" }] } },
    expectedComponents: {
      parcel:   { score: 85, acreage: 9.07 },  // 5-10 ac tier
      flood:    { score: 72 },                  // Zone X 500-yr
      zoning:   { score: 55 },                  // hospital building
    },
  },
  {
    id: "willowWaterhole",
    name: "Willow Waterhole",
    lat: 29.6620,
    lon: -95.5200,
    expected: { site: 58, demand: 36, pi: 49, quadrant: "INFRASTRUCTURE PLAY" },
    notes: "Parcel 5.9 ac → score 85. Zone X minimal. Lower demand than LLM estimated.",
    hcadMock: {
      features: [{ attributes: {
        HCAD_NUM: "0660840000003", land_sqft: 257004, acreage_1: 5.9,
        state_class: "C", site_str_num: "", site_str_name: "WILLOW WATERHOLE GREENWAY",
      }}],
    },
    femaMock: {
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "", SFHA_TF: "F" } }],
    },
    usgsMock: { value: "55" },
    osmMock: { elements: [{ tags: { landuse: "recreation_ground" } }] },
    nrelUtilityMock: { outputs: { utility_name: "CenterPoint Energy", commercial: 0.089, net_metering: true } },
    nrelSolarMock:   { outputs: { avg_ghi: { annual: 4.92 }, avg_dni: { annual: 5.31 } } },
    eiaMock: { response: { data: [{ period: "2024", sales: "4000000", sectorid: "ALL" }] } },
    expectedComponents: {
      parcel:   { score: 85, acreage: 5.9 },  // 5-10 ac tier
      flood:    { score: 90 },                 // Zone X minimal
      zoning:   { score: 62 },                 // recreation_ground
    },
  },
  {
    id: "attStadium",
    name: "AT&T Stadium",
    address: "AT&T Stadium, Arlington TX",
    lat: 32.7479,
    lon: -97.0928,
    expected: { site: 71, demand: 78, pi: 74, quadrant: "PRIME SITE" },
    notes: "Outside Harris County (LLM parcel estimate). Cowboys heliport +10/7. Class B area DFW.",
    // HCAD throws (outside Harris County) — parcel falls back to LLM estimate
    hcadMock: { features: [] },
    femaMock: {
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "", SFHA_TF: "F" } }],
    },
    usgsMock: { value: "580" },
    osmMock: { elements: [{ tags: { building: "stadium" } }] },
    nrelUtilityMock: { outputs: { utility_name: "Oncor Electric Delivery", commercial: 0.072, net_metering: false } },
    nrelSolarMock:   { outputs: { avg_ghi: { annual: 5.12 }, avg_dni: { annual: 5.61 } } },
    eiaMock: { response: { data: [{ period: "2024", sales: "4000000", sectorid: "ALL" }] } },
    expectedComponents: {
      // HCAD throws, parcel from LLM — not asserted in component tests
      flood:    { score: 90 },  // Zone X minimal
      zoning:   { score: 65 },  // stadium building
    },
  },
];

// Lookup by id
export const SITES = Object.fromEntries(BENCHMARK_SITES.map(s => [s.id, s]));
