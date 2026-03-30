# API Integration Notes

## Harris County Parcel API (HCAD)

**Endpoint:** `https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query`
**Auth:** None (public)
**Coverage:** Harris County, TX only. Fails gracefully elsewhere — LLM estimate used as fallback.

### Key fields

| Field | Type | Notes |
|-------|------|-------|
| `HCAD_NUM` | String | Parcel account number |
| `land_sqft` | Double | Land area in sq ft |
| `acreage_1` | Double | Numeric acreage (preferred over derived sq ft) |
| `state_class` | String | State property classification code |
| `land_use` | String | 4-char land use code |
| `site_str_num` | String | Street number |
| `site_str_name` | String | Street name |

### State class codes (first character)

| Code | Type |
|------|------|
| A | Single family residential |
| B | Multifamily residential |
| C | Vacant land |
| D | Farm/ranch |
| E | Agricultural |
| F | Commercial |
| I | Industrial |
| J | Utilities |
| L | Commercial retail |
| S | Special purpose |
| X | Exempt (government/institutional) |

### Scoring thresholds (mirrors LLM prompt for consistency)

| Acreage | Score |
|---------|-------|
| >= 10 ac | 95 |
| 5–10 ac | 85 |
| 2–5 ac | 67 |
| 1.5–2 ac | 40 |
| 0.5–1.5 ac | 30 |
| < 0.5 ac | 12 |

Flag triggered at < 1.5 ac: "Below NREL 1.5-ac minimum"

### Known limitation: single-parcel queries

The API returns individual parcel records, not assemblages. A large commercial complex
frequently spans multiple parcels under the same ownership. The query uses a 100m buffer
and returns the largest parcel found within that radius — which handles road easements and
tiny sub-lots landing on the geocoded point, but will still undercount a multi-parcel campus.

**Example:** 8900 Will Clayton Pkwy, Humble TX returns 3.78 ac (score 67). The full
logistics campus is larger but split across adjacent parcels. The 3.78 ac figure reflects
the largest single parcel, not the total developable footprint.

**Future fix:** Query all parcels within the buffer that share the same owner
(`owner_name_1`) and sum their acreage. Implement when multi-parcel sites become a
consistent edge case in beta testing.

---

## FAA Airspace Scoring (static data, no API)

**Source:** `src/txAirspace.js` — shared data module (also used by the map overlay)
**Method:** Haversine distance against TX Class B/C/D airport list, tier-radius lookup
**Coverage:** Texas only (Phase 1). Circular tier model is a simplification — real Class B
has irregular legs and cutouts. Scores near outer-ring boundaries may differ slightly
from actual airspace.

### Scoring thresholds

| Scenario | Score | LAANC |
|----------|-------|-------|
| Class B SFC-floor tier (< 5nm) | 15 | Required |
| Class B outer tier (floor 2000ft) | 45 | Required |
| Class B outer tier (floor 3000ft+) | 60 | Required |
| Class C SFC-floor (< 5nm) | 42 | Required |
| Class C outer (5–10nm) | 65 | Required |
| Class D (< 4–5nm) | 65 | Required |
| Class G, < 5nm to nearest airport | 72 | Required |
| Class G, 5–10nm | 78 | Self-auth |
| Class G, 10–20nm | 83 | Self-auth |
| Class G, 20–40nm | 90 | Self-auth |
| Class G, > 40nm | 95 | Not required |

### Key limitation

The real Class B "wedding cake" has directional cutouts. A site geometrically inside
the 10nm ring may be in Class G if the actual boundary doesn't extend that direction.
Will Clayton (~10nm NE of IAH) is a known example — real Class B does not extend that
far northeast, so the LLM scores it Class G while the circular model may over-penalize.
Scores within outer Class B rings should be read as conservative estimates.

---

## FEMA NFHL — Flood Hazard Zones

**Endpoint:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query`
**Auth:** None (public)
**Coverage:** Nationwide

### Key fields

| Field | Notes |
|-------|-------|
| `FLD_ZONE` | Flood zone code: X, AE, A, VE, AO, AH, D |
| `ZONE_SUBTY` | Subtype: "0.2 PCT ANNUAL CHANCE…" = 500-yr, "PROTECTED BY LEVEE", etc. |
| `SFHA_TF` | T = Special Flood Hazard Area |

### Scoring thresholds

| Zone | Score | Notes |
|------|-------|-------|
| Zone X (minimal) | 90 | Standard TX result |
| Zone X (500-yr / 0.2%) | 72 | Moderate risk |
| Zone X (behind levee) | 60 | Flag: verify levee accreditation |
| Zone AE (100-yr SFHA) | 25 | Fill permit + LOMA required |
| Zone A (no BFE) | 22 | SFHA, no base flood elevation data |
| Zone AO/AH (shallow) | 20 | Drainage engineering critical |
| Zone VE (coastal) | 15 | Wave action, VE restrictions |
| Zone D (undetermined) | 55 | Commission survey |
| FEMA unavailable | 65 | Conservative baseline |

---

## USGS 3DEP — Point Elevation

**Endpoint:** `https://epqs.nationalmap.gov/v1/json`
**Auth:** None (public)
**Coverage:** Nationwide
**Parameters:** `x={lon}&y={lat}&wkid=4326&units=Feet`
**Returns:** `{ value: "45.12" }` — elevation in feet

Runs in parallel with FEMA query inside `fetchFEMAFloodScore()`. Result populates `elevation_ft` in the soil card. Failure does not affect the flood zone score.

---

## OSM/Overpass — Zoning (Land Use)

**Endpoint:** `https://overpass-api.de/api/interpreter` (POST)
**Auth:** None (public)
**Coverage:** Worldwide where OSM contributors have mapped landuse polygons.
TX coverage is good in urban cores (Houston downtown, Galleria, TMC, DFW urban area)
and sparse in suburban business parks and rural areas — LLM estimate used as fallback.

### Query strategy

Two queries run in parallel:
1. `is_in` — finds the landuse polygon that actually contains the point (authoritative)
2. `around:100m` — finds nearby landuse and building tags (fallback for unmapped areas)

`is_in` result is used if it contains landuse data; otherwise the `around` result is used.
If neither returns usable tags, the LLM estimate stands.

### Scoring — landuse tags

| OSM `landuse=` | Score | Label |
|----------------|-------|-------|
| industrial | 90 | Industrial |
| logistics | 88 | Logistics |
| port | 85 | Port/logistics |
| depot | 68 | Transport depot |
| railway | 60 | Railway/transport corridor |
| office | 58 | Office |
| commercial | 55 | Commercial |
| recreation_ground / grass / meadow | 58–62 | Open land |
| farmland / farm | 48–50 | Agricultural |
| retail | 45 | Retail |
| forest | 40 | Forest |
| military | 30 | Military |
| allotments | 28 | Allotments |
| cemetery | 20 | Cemetery |
| residential | 15 | Residential |

### Scoring — building tags (fallback)

| OSM `building=` | Score |
|-----------------|-------|
| warehouse | 88 |
| industrial | 85 |
| stadium | 65 |
| office / sports_hall | 60 |
| commercial / hospital / civic / yes | 50–55 |
| retail | 45 |
| church | 25 |
| residential / apartments / house / detached | 12–15 |

---

## EIA Open Data API

**Endpoint:** `https://api.eia.gov/v2/electricity/retail-sales/data/`
**Auth:** API key — `VITE_EIA_API_KEY` in `.env`
**Scope:** Texas statewide retail electricity sales (ERCOT territory assumed for all TX sites)

---

## NREL RE Atlas

**Endpoints:**
- Utility rates: `https://developer.nrel.gov/api/utility_rates/v3.json`
- Solar resource: `https://developer.nrel.gov/api/solar/solar_resource/v1.json`

**Auth:** API key — `VITE_NREL_API_KEY` in `.env`

**Scoring components (max 100):**
- Solar GHI: 0–30 pts
- Utility type / grid access: 0–30 pts
- Commercial electricity rate: 0–25 pts
- Net metering availability: 0–15 pts

Both endpoints run in `Promise.allSettled()` — a failure on one does not zero the score.
Texas baseline values are used when the API is unavailable.
