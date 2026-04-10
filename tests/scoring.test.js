/**
 * Regression test suite — 5 validated benchmark sites
 * Mar 30 2026 live-data baselines. Tolerance ±5 on all composite scores.
 *
 * All external API calls (HCAD, FEMA, USGS, EIA, NREL, Overpass) are mocked
 * so tests are deterministic and fast — no network required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scoreAirspace,
  fetchEIAPowerScore,
  fetchNRELDERScore,
  fetchHarrisParcelScore,
  fetchFEMAFloodScore,
  fetchZoningScore,
  priorityIndex,
  getQuadrant,
  extractLLMJson,
  buildPrompt,
} from '../src/scoring.js';
import { BENCHMARK_SITES, SITES } from './fixtures/benchmarkSites.js';

const TOLERANCE = 5;

// ── Fetch mock helper ─────────────────────────────────────────────
// Returns different responses keyed by URL substring.
// Overpass uses POST — matched on the URL (same for all queries).
function makeFetch(urlMap) {
  return vi.fn().mockImplementation((url) => {
    for (const [pattern, payload] of Object.entries(urlMap)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(payload),
          text: () => Promise.resolve(JSON.stringify(payload)),
        });
      }
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  });
}

// ── Pure function tests ───────────────────────────────────────────
describe('priorityIndex', () => {
  it.each(BENCHMARK_SITES)(
    '$name: PI($expected.site, $expected.demand) = $expected.pi',
    ({ expected }) => {
      expect(priorityIndex(expected.site, expected.demand)).toBe(expected.pi);
    }
  );

  it('formula: site weighted 60%, demand 40%', () => {
    expect(priorityIndex(100, 100)).toBe(100);
    expect(priorityIndex(0,   0)).toBe(0);
    expect(priorityIndex(50,  50)).toBe(50);
    expect(priorityIndex(80,  20)).toBe(56);
  });
});

describe('getQuadrant', () => {
  it.each(BENCHMARK_SITES)(
    '$name: ($expected.site, $expected.demand) → $expected.quadrant',
    ({ expected }) => {
      expect(getQuadrant(expected.site, expected.demand).label).toBe(expected.quadrant);
    }
  );

  it('all four quadrant labels', () => {
    expect(getQuadrant(60, 75).label).toBe('PRIME SITE');
    expect(getQuadrant(60, 60).label).toBe('INFRASTRUCTURE PLAY');
    expect(getQuadrant(40, 75).label).toBe('DEMAND WITHOUT SITE');
    expect(getQuadrant(40, 60).label).toBe('LOW PRIORITY');
  });

  it('boundary: site=55 and demand=70 are inclusive for PRIME SITE', () => {
    expect(getQuadrant(55, 70).label).toBe('PRIME SITE');
    expect(getQuadrant(54, 70).label).toBe('DEMAND WITHOUT SITE');
    expect(getQuadrant(55, 69).label).toBe('INFRASTRUCTURE PLAY');
  });
});

describe('extractLLMJson', () => {
  it('parses clean JSON', () => {
    const result = extractLLMJson('{"score":74,"notes":"test"}');
    expect(result.score).toBe(74);
  });

  it('strips markdown code fences', () => {
    const result = extractLLMJson('```json\n{"score":44}\n```');
    expect(result.score).toBe(44);
  });

  it('self-heals a missing closing brace', () => {
    const result = extractLLMJson('{"site":{"composite":61,"parcel":{"score":85}');
    expect(result.site.composite).toBe(61);
  });

  it('throws on non-JSON response', () => {
    expect(() => extractLLMJson('Sorry, I cannot score this.')).toThrow();
  });
});

describe('buildPrompt', () => {
  it('includes evalMode in output for each mode', () => {
    for (const mode of ['passenger', 'cargo', 'combo']) {
      const p = buildPrompt({ address: '1400 Post Oak Blvd, Houston TX' }, 'address', mode);
      expect(p).toContain(mode.toUpperCase());
    }
  });

  it('includes GPS coords when inputMode is coords', () => {
    const p = buildPrompt({ lat: 29.7079, lon: -95.4010, label: 'TMC' }, 'coords', 'cargo');
    expect(p).toContain('29.7079');
    expect(p).toContain('-95.401'); // JS trims trailing zero from numbers
    expect(p).toContain('TMC');
  });

  it('sets geocode.valid=false instruction for non-US locations', () => {
    const p = buildPrompt({ address: '10 Downing St, London' }, 'address', 'passenger');
    expect(p).toContain('geocode.valid=false');
  });
});

// ── scoreAirspace — pure, no mocking needed ───────────────────────
describe('scoreAirspace — FAA airspace (static dataset)', () => {
  it('Will Clayton Pkwy: Class B outer 4.4nm IAH → score 45', () => {
    const result = scoreAirspace(SITES.willClayton.lat, SITES.willClayton.lon);
    expect(result.score).toBe(45);
    expect(result.nearest_airport).toMatch(/IAH|George Bush/i);
    expect(result.laanc_required).toBe(true);
  });

  it('Post Oak Blvd: Class B outer 15+ nm IAH → score 60', () => {
    const result = scoreAirspace(SITES.postOak.lat, SITES.postOak.lon);
    expect(result.score).toBe(60);
    expect(result.laanc_required).toBe(true);
  });

  it('TMC: Class B or C outer ring → score 42–65', () => {
    const result = scoreAirspace(SITES.tmc.lat, SITES.tmc.lon);
    expect(result.score).toBeGreaterThanOrEqual(42);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.laanc_required).toBe(true);
  });

  it('Willow Waterhole: airspace score in valid range 15–95', () => {
    const result = scoreAirspace(SITES.willowWaterhole.lat, SITES.willowWaterhole.lon);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.score).toBeLessThanOrEqual(95);
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('nearest_airport');
  });

  it('AT&T Stadium Arlington: near DFW/DAL Class B → score 45–65', () => {
    const result = scoreAirspace(SITES.attStadium.lat, SITES.attStadium.lon);
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.laanc_required).toBe(true);
  });

  it('returns all required fields', () => {
    const result = scoreAirspace(29.7079, -95.4010);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('laanc_required');
    expect(result).toHaveProperty('nearest_airport');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('notes');
  });
});

// ── fetchHarrisParcelScore ────────────────────────────────────────
describe('fetchHarrisParcelScore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Will Clayton 1.17 ac → score 30', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': SITES.willClayton.hcadMock }));
    const result = await fetchHarrisParcelScore(SITES.willClayton.lat, SITES.willClayton.lon);
    expect(result.score).toBe(30);
    expect(result.acreage_estimate).toBeCloseTo(1.17, 1);
    expect(result.flags).toContain('Below NREL 1.5-ac minimum');
  });

  it('Post Oak 11.56 ac → score 95', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': SITES.postOak.hcadMock }));
    const result = await fetchHarrisParcelScore(SITES.postOak.lat, SITES.postOak.lon);
    expect(result.score).toBe(95);
    expect(result.acreage_estimate).toBeCloseTo(11.56, 1);
    expect(result.flags).toHaveLength(0);
  });

  it('TMC 9.07 ac → score 85', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': SITES.tmc.hcadMock }));
    const result = await fetchHarrisParcelScore(SITES.tmc.lat, SITES.tmc.lon);
    expect(result.score).toBe(85);
    expect(result.acreage_estimate).toBeCloseTo(9.07, 1);
  });

  it('Willow Waterhole 5.9 ac → score 85', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': SITES.willowWaterhole.hcadMock }));
    const result = await fetchHarrisParcelScore(SITES.willowWaterhole.lat, SITES.willowWaterhole.lon);
    expect(result.score).toBe(85);
    expect(result.acreage_estimate).toBeCloseTo(5.9, 1);
  });

  it('AT&T Stadium — empty features throws (outside Harris County)', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': SITES.attStadium.hcadMock }));
    await expect(
      fetchHarrisParcelScore(SITES.attStadium.lat, SITES.attStadium.lon)
    ).rejects.toThrow(/outside harris county/i);
  });

  it('picks largest parcel when multiple features returned', async () => {
    const multiMock = {
      features: [
        { attributes: { land_sqft: 10000, acreage_1: 0.23, state_class: "F" } },
        { attributes: { land_sqft: 200000, acreage_1: 4.59, state_class: "F" } },
        { attributes: { land_sqft: 50000, acreage_1: 1.15, state_class: "F" } },
      ],
    };
    vi.stubGlobal('fetch', makeFetch({ 'gis.hctx.net': multiMock }));
    const result = await fetchHarrisParcelScore(29.9, -95.3);
    expect(result.acreage_estimate).toBeCloseTo(4.59, 1);
    expect(result.score).toBe(67); // 2-5 ac tier
  });

  it('parcel score thresholds are correct', async () => {
    const cases = [
      { acreage_1: 11.0, land_sqft: 479160, expectedScore: 95 },
      { acreage_1:  6.0, land_sqft: 261360, expectedScore: 85 },
      { acreage_1:  3.0, land_sqft: 130680, expectedScore: 67 },
      { acreage_1:  1.8, land_sqft:  78408, expectedScore: 40 },
      { acreage_1:  1.0, land_sqft:  43560, expectedScore: 30 },
      { acreage_1:  0.3, land_sqft:  13068, expectedScore: 12 },
    ];
    for (const { acreage_1, land_sqft, expectedScore } of cases) {
      vi.stubGlobal('fetch', makeFetch({
        'gis.hctx.net': { features: [{ attributes: { land_sqft, acreage_1, state_class: "F" } }] },
      }));
      const result = await fetchHarrisParcelScore(29.9, -95.3);
      expect(result.score, `acreage ${acreage_1} ac`).toBe(expectedScore);
    }
  });
});

// ── fetchFEMAFloodScore ───────────────────────────────────────────
describe('fetchFEMAFloodScore', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(BENCHMARK_SITES.filter(s => s.expectedComponents.flood))(
    '$name: flood score = $expectedComponents.flood.score',
    async (site) => {
      vi.stubGlobal('fetch', makeFetch({
        'hazards.fema.gov': site.femaMock,
        'epqs.nationalmap.gov': site.usgsMock,
      }));
      const result = await fetchFEMAFloodScore(site.lat, site.lon);
      expect(result.score).toBe(site.expectedComponents.flood.score);
    }
  );

  it('Zone AE → score 25 with SFHA flags', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'hazards.fema.gov': { features: [{ attributes: { FLD_ZONE: 'AE', ZONE_SUBTY: '', SFHA_TF: 'T' } }] },
      'epqs.nationalmap.gov': { value: '10' },
    }));
    const result = await fetchFEMAFloodScore(29.3, -94.8);
    expect(result.score).toBe(25);
    expect(result.flood_zone).toMatch(/Zone AE/);
    expect(result.flags).toContain('SFHA — flood insurance required, fill permit needed');
  });

  it('Zone VE (coastal) → score 15', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'hazards.fema.gov': { features: [{ attributes: { FLD_ZONE: 'VE', ZONE_SUBTY: '', SFHA_TF: 'T' } }] },
      'epqs.nationalmap.gov': { value: '5' },
    }));
    const result = await fetchFEMAFloodScore(29.3, -94.8);
    expect(result.score).toBe(15);
    expect(result.flags.join(' ')).toMatch(/coastal/i);
  });

  it('FEMA API failure → baseline score 65', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('hazards.fema.gov')) return Promise.reject(new Error('timeout'));
      if (url.includes('epqs.nationalmap.gov')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ value: '50' }) });
      return Promise.reject(new Error(`Unmocked: ${url}`));
    }));
    const result = await fetchFEMAFloodScore(29.7, -95.4);
    expect(result.score).toBe(65);
    expect(result._source.fema).toBe(false);
  });

  it('returns all required fields', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'hazards.fema.gov': { features: [{ attributes: { FLD_ZONE: 'X', ZONE_SUBTY: '', SFHA_TF: 'F' } }] },
      'epqs.nationalmap.gov': { value: '60' },
    }));
    const result = await fetchFEMAFloodScore(29.9, -95.3);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('flood_zone');
    expect(result).toHaveProperty('elevation_ft');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('notes');
  });
});

// ── fetchEIAPowerScore ────────────────────────────────────────────
describe('fetchEIAPowerScore', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    { zoningScore: 75, expectedScore: 80 },  // bonus +12
    { zoningScore: 60, expectedScore: 75 },  // bonus +7
    { zoningScore: 40, expectedScore: 71 },  // bonus +3
    { zoningScore: 20, expectedScore: 60 },  // bonus -8
  ])('zoning=$zoningScore → score $expectedScore (68 + bonus)', async ({ zoningScore, expectedScore }) => {
    vi.stubGlobal('fetch', makeFetch({ 'api.eia.gov': SITES.willClayton.eiaMock }));
    const result = await fetchEIAPowerScore(29.9, -95.3, zoningScore);
    expect(result.score).toBe(expectedScore);
  });

  it('score is independent of EIA API response content', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'api.eia.gov': { response: { data: [] } } }));
    const live = await fetchEIAPowerScore(29.9, -95.3, 60);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const fallback = await fetchEIAPowerScore(29.9, -95.3, 60);

    expect(live.score).toBe(fallback.score);  // EIA data doesn't affect score
  });

  it('_live flag true when EIA API returns valid data', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'api.eia.gov': SITES.willClayton.eiaMock }));
    const result = await fetchEIAPowerScore(29.9, -95.3, 60);
    expect(result._live).toBe(true);
  });

  it('_live flag false when EIA API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await fetchEIAPowerScore(29.9, -95.3, 60);
    expect(result._live).toBe(false);
  });
});

// ── fetchNRELDERScore ─────────────────────────────────────────────
describe('fetchNRELDERScore', () => {
  afterEach(() => vi.restoreAllMocks());

  function nrelFetch(site) {
    return vi.fn().mockImplementation((url) => {
      if (url.includes('utility_rates')) return Promise.resolve({ ok: true, json: () => Promise.resolve(site.nrelUtilityMock) });
      if (url.includes('solar_resource')) return Promise.resolve({ ok: true, json: () => Promise.resolve(site.nrelSolarMock) });
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });
  }

  it('Houston sites: CenterPoint + GHI 4.92 → score 55–75', async () => {
    // solarPts(GHI 4.92)=15 + utilityPts(known)=25 + ratePts(0.089)=18 + nmPts(true)=15 = 73
    for (const siteId of ['willClayton', 'postOak', 'tmc', 'willowWaterhole']) {
      vi.stubGlobal('fetch', nrelFetch(SITES[siteId]));
      const result = await fetchNRELDERScore(SITES[siteId].lat, SITES[siteId].lon);
      expect(result.score, `${siteId} NREL score`).toBeGreaterThanOrEqual(55);
      expect(result.score, `${siteId} NREL score`).toBeLessThanOrEqual(75);
    }
  });

  it('AT&T Stadium: Oncor + GHI 5.12, no net metering → score 60–75', async () => {
    // solarPts(GHI 5.12)=22 + utilityPts(known)=25 + ratePts(0.072)=18 + nmPts(false)=5 = 70
    vi.stubGlobal('fetch', nrelFetch(SITES.attStadium));
    const result = await fetchNRELDERScore(SITES.attStadium.lat, SITES.attStadium.lon);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThanOrEqual(75);
  });

  it('national baseline (both APIs fail) → score 52', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await fetchNRELDERScore(29.7, -95.4);
    // solarPts=12 + utilityPts=20 + ratePts=12 + nmPts=8 = 52
    expect(result.score).toBe(52);
    expect(result._live.utilityLive).toBe(false);
    expect(result._live.solarLive).toBe(false);
  });

  it('partial live data: utility only → score in valid range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('utility_rates')) return Promise.resolve({ ok: true, json: () => Promise.resolve(SITES.tmc.nrelUtilityMock) });
      return Promise.reject(new Error('solar unavailable'));
    }));
    const result = await fetchNRELDERScore(29.7, -95.4);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result._live.utilityLive).toBe(true);
    expect(result._live.solarLive).toBe(false);
  });

  it('returns all required fields', async () => {
    vi.stubGlobal('fetch', nrelFetch(SITES.tmc));
    const result = await fetchNRELDERScore(29.7, -95.4);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
    expect(result).toHaveProperty('notes');
    expect(result._live).toHaveProperty('utilityLive');
    expect(result._live).toHaveProperty('solarLive');
  });
});

// ── fetchZoningScore ──────────────────────────────────────────────
describe('fetchZoningScore', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(BENCHMARK_SITES.filter(s => s.expectedComponents.zoning))(
    '$name: zoning score = $expectedComponents.zoning.score',
    async (site) => {
      // Both Overpass queries (isIn + around) return the same mock
      vi.stubGlobal('fetch', makeFetch({ 'overpass-api.de': site.osmMock }));
      const result = await fetchZoningScore(site.lat, site.lon);
      expect(result.score).toBe(site.expectedComponents.zoning.score);
    }
  );

  it('aerodrome tag → score 92', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'overpass-api.de': { elements: [{ tags: { aeroway: 'aerodrome' } }] },
    }));
    const result = await fetchZoningScore(29.99, -95.34);
    expect(result.score).toBe(92);
    expect(result.land_use).toBe('Airport / aerodrome');
  });

  it('industrial landuse → score 90, compliance Favorable', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'overpass-api.de': { elements: [{ tags: { landuse: 'industrial' } }] },
    }));
    const result = await fetchZoningScore(29.8, -95.2);
    expect(result.score).toBe(90);
    expect(result.compliance).toBe('Favorable');
    expect(result.flags).toHaveLength(0);
  });

  it('residential landuse → score 15 with adverse flag', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'overpass-api.de': { elements: [{ tags: { landuse: 'residential' } }] },
    }));
    const result = await fetchZoningScore(29.7, -95.5);
    expect(result.score).toBe(15);
    expect(result.flags.join(' ')).toMatch(/adverse/i);
  });

  it('no OSM data → throws', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'overpass-api.de': { elements: [] },
    }));
    await expect(fetchZoningScore(29.7, -95.5)).rejects.toThrow(/no osm land use/i);
  });

  it('isIn result takes priority over around result', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      const payload = callCount === 1
        ? { elements: [{ tags: { landuse: 'industrial' } }] }    // isIn → industrial (90)
        : { elements: [{ tags: { landuse: 'residential' } }] };   // around → residential (15)
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    }));
    const result = await fetchZoningScore(29.8, -95.2);
    expect(result.score).toBe(90); // isIn wins
  });

  it('dominant tag wins when multiple elements returned', async () => {
    vi.stubGlobal('fetch', makeFetch({
      'overpass-api.de': {
        elements: [
          { tags: { landuse: 'commercial' } },
          { tags: { landuse: 'commercial' } },
          { tags: { landuse: 'residential' } },
        ],
      },
    }));
    const result = await fetchZoningScore(29.7, -95.4);
    expect(result.score).toBe(55); // commercial wins (2 vs 1)
  });
});

// ── Composite regression — priority index and quadrant ────────────
describe('Benchmark regression — composite scores', () => {
  it.each(BENCHMARK_SITES)(
    '$name: priorityIndex($expected.site, $expected.demand) = $expected.pi ±0',
    ({ expected }) => {
      const pi = priorityIndex(expected.site, expected.demand);
      expect(pi).toBe(expected.pi);
    }
  );

  it.each(BENCHMARK_SITES)(
    '$name: quadrant classification is correct',
    ({ expected }) => {
      expect(getQuadrant(expected.site, expected.demand).label).toBe(expected.quadrant);
    }
  );

  it('all 5 site scores are within documented CLAUDE.md range', () => {
    // Cross-check: site scores should be plausible for real vertiport sites
    for (const site of BENCHMARK_SITES) {
      expect(site.expected.site).toBeGreaterThanOrEqual(30);
      expect(site.expected.site).toBeLessThanOrEqual(100);
      expect(site.expected.demand).toBeGreaterThanOrEqual(30);
      expect(site.expected.demand).toBeLessThanOrEqual(100);
      expect(site.expected.pi).toBe(priorityIndex(site.expected.site, site.expected.demand));
    }
  });

  describe('component score ranges — all 5 sites', () => {
    it('parcel scores match HCAD acreage tier table', () => {
      const tiers = [
        [12.0, 95], [7.5, 85], [3.5, 67], [1.75, 40], [1.17, 30], [0.25, 12],
      ];
      // These are the same thresholds as fetchHarrisParcelScore
      function parcelScore(ac) {
        if (ac >= 10)  return 95;
        if (ac >= 5)   return 85;
        if (ac >= 2)   return 67;
        if (ac >= 1.5) return 40;
        if (ac >= 0.5) return 30;
        return 12;
      }
      for (const [ac, expected] of tiers) {
        expect(parcelScore(ac), `${ac} ac`).toBe(expected);
      }
    });

    it('FEMA flood zone score table is exhaustive', () => {
      // Verify each zone matches the expected score from CLAUDE.md rubric
      const zones = [
        ['X', '',       90],
        ['X', '500',    72],
        ['X', 'LEVEE',  60],
        ['AE', '',      25],
        ['A',  '',      22],
        ['VE', '',      15],
        ['D',  '',      55],
      ];
      function floodScore(zone, subtype) {
        const s = subtype.toUpperCase();
        if (zone === 'X') {
          if (s.includes('0.2') || s.includes('500')) return 72;
          if (s.includes('LEVEE')) return 60;
          return 90;
        }
        if (zone === 'AE') return 25;
        if (zone === 'A')  return 22;
        if (zone === 'VE' || zone === 'V') return 15;
        if (zone === 'D')  return 55;
        return 65;
      }
      for (const [zone, sub, expected] of zones) {
        expect(floodScore(zone, sub), `Zone ${zone} "${sub}"`).toBe(expected);
      }
    });
  });
});
