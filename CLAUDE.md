# Vertiport Evaluation System — Project Brief

## What This Tool Does

A site feasibility scoring tool for prospective vertiport locations. The user enters a single address. The tool queries multiple public data sources, computes a weighted feasibility score from 0 to 100, and returns a structured report with a score breakdown and key findings.

Target users: commercial property owners, real estate portfolio managers, brokers, and logistics operators evaluating sites for eVTOL infrastructure.

---

## Geographic Scope

**Phase 1 — Houston Metro** (prototype and validation)
**Phase 2 — Statewide Texas** (beta launch)
**Phase 3 — Nationwide** (post-traction expansion)

Texas-first is a deliberate choice. ERCOT provides cleaner, more accessible energy grid data than multi-utility patchwork in other states. Texas parcel data is a defined, solvable coverage problem across 254 counties. Houston gives immediate network access for in-person demos and beta user recruitment.

---

## Scoring Criteria (Six Layers + Heliport Modifier)

| # | Criterion | Data Source | Weight |
|---|-----------|-------------|--------|
| 1 | Parcel size and contours | Census TIGER / County assessor APIs | High |
| 2 | Zoning compliance | OpenStreetMap land use classifications | Medium |
| 3 | FAA airspace obstacles | FAA B4UFLY API / LAANC data | High |
| 4 | Power grid capacity and DER | ERCOT (Texas) / EIA API / NREL RE Atlas | High |
| 5 | Soil stability | USGS 3DEP elevation / FEMA flood zone API | Medium |
| 6 | Community support for DER | NREL distributed energy project counts | Low |

**Heliport Modifier (post-composite, applied to both axes):**

| Heliport Status | Site Boost | Demand Boost |
|-----------------|-----------|--------------|
| Active medical heliport, multiple pads | +14 | +18 |
| Active offshore / industrial staging | +12 | +12 |
| Active general aviation heliport | +10 | +7 |
| Inactive but structurally intact helipad | +6 | +3 |
| No heliport within 500m | 0 | 0 |

The heliport modifier is a two-axis boost, not a standalone criterion. Active heliports simultaneously prove FAA airspace coordination, structural load rating, existing electrical infrastructure, and live trip demand. Data source: FAA NASR heliport registry (free, public, no API key). In the current build, Claude identifies heliport status from training knowledge; production build will query NASR directly. Base composites are returned without the boost; code applies it and displays the delta.

**Scoring philosophy:** Cargo-weighted. Airspace clearance and parcel size carry more weight than community sentiment metrics. Weights are configurable by the user in future versions.

---

## Input / Output

**Input:** Single address string (that is all the user provides)

**Output:**
- Composite feasibility score (0-100)
- Per-criterion score breakdown
- Key findings summary (acreage, slope, airspace status, DER projects)
- Flag list for issues requiring further investigation

---

## API Stack

| API | Purpose | Auth Required |
|-----|---------|---------------|
| Census Geocoder | Address to lat/lon | None |
| Census TIGER | Parcel boundary approximation | None |
| OpenStreetMap / Nominatim | Zoning and land use | None |
| FAA B4UFLY | Airspace classification | None |
| USGS 3DEP | Elevation and slope | None |
| FEMA Flood Map | Soil/flood risk | None |
| ERCOT API | Texas grid capacity | None (public) |
| EIA API | Utility service territory | Free registration |
| NREL RE Atlas | Distributed energy project counts | Free registration |

Note: County assessor parcel data varies by county. Start with Harris County (Houston) which has a public API. Expand county coverage progressively through Phase 2.

---

## Technical Decisions

- **Build environment:** Claude Code (terminal-based, full filesystem access, MCP-ready)
- **Prototype:** React artifact in Claude.ai for UI/scoring logic validation
- **Production stack:** To be determined during Claude Code build phase
- **Parcel data fallback:** Use Census TIGER boundary approximation when county assessor API is unavailable. Flag the score as "estimated parcel" in the report.
- **Energy layer placeholder:** Render EIA/NREL scoring as a placeholder until API keys are registered. Do not silently omit — show the gap in the report.

---

## Scoring Reference — FAA/NREL Standards

From the FAA Vertiport Electrical Infrastructure Study (NREL, stored in /research):

- NREL recommends vertiports plan for 1 MW peak DC charging capacity (potentially higher)
- Minimum parcel size considerations: existing sites studied include 1.5 acres (garage rooftop minimum) up to full airport parcels
- Power capacity upgrade costs are heavily influenced by distance between electrical panel and charger — proximity to existing three-phase power is a positive scoring signal
- Mobile charging is feasible but not economically competitive at current costs — fixed infrastructure proximity scores higher
- eVTOL OEMs report peak DC charging loads of 300 kW to 1 MW per aircraft

---

## Key Decisions Already Made

1. Address-only input — no other user data required at intake
2. Texas-first geographic scope, Houston metro prototype
3. Cargo-weighted scoring (airspace + parcel size are top-weighted criteria)
4. Claude Code for production build, Claude.ai artifact for prototype
5. Score displayed as X/100 with full criterion breakdown
6. EIA/NREL energy layer requires free API key registration before activation
7. County assessor parcel data integrated progressively, starting with Harris County

---

## Files in This Repository

```
vertiport-eval/
├── CLAUDE.md              ← this file — read at start of every session
├── /src                   ← application code
├── /data                  ← sample parcels, Houston test addresses
├── /docs                  ← API documentation, scoring methodology notes
├── /tests                 ← test cases with known expected score ranges
└── /research              ← FAA Vertiport Electrical Infrastructure Study (NREL)
                              and other reference documents
```

---

## Next Build Steps

1. Build React prototype in Claude.ai — validate scoring logic and UI layout
2. Register EIA API key (free): https://www.eia.gov/opendata/
3. Register NREL API key (free): https://developer.nrel.gov/signup/
4. Set up Harris County parcel API integration
5. Move to Claude Code for production build with full API wiring
6. Expand parcel coverage to remaining major Texas metros (Dallas, San Antonio, Austin)

---

## Contacts and Context

- Project owner based in Houston, TX
- Primary use case: cargo logistics and commercial property evaluation
- Secondary use case: medical/hospital helipad conversion analysis (Houston Medical Center proximity)
- Tool is intended as a beta product offered free to commercial property owners, portfolio managers, and brokers during launch phase
