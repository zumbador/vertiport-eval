# Vertiport Evaluation System — Project Brief

---

## ⚠️ CODING RULE — READ FIRST

**ALL development for this project happens in Claude Code CLI only.**

Do NOT write or iterate on application code in Claude.ai chat. Code written there
runs in a sandboxed browser environment that blocks government APIs (CORS), has no
access to .env files or API keys, and behaves differently from the real Vite/React
dev server in ways that are hard to debug.

Claude.ai / Cowork is for: planning, architecture, scoring logic discussions, Notion
project management, article writing, reviewing results.

Claude Code CLI is for: all actual code — API integration, UI changes, testing,
running the dev server, git commits.

To start a coding session:
  cd ~/Projects/vertiport-eval
  code .       # open VS Code
  claude       # start Claude Code CLI

---

## What This Tool Does

A site feasibility scoring tool for prospective vertiport locations. The user enters
a single address or GPS coordinates. The tool queries multiple public data sources,
computes a two-axis feasibility score, and returns a structured report with PDF export.

Target users: commercial property owners, real estate portfolio managers, brokers,
and logistics operators evaluating sites for eVTOL infrastructure.

---

## Geographic Scope

Phase 1 — All of Texas (expanded from Houston metro — validated scoring model)
Phase 2 — Nationwide
Phase 3 — Geographic batch query (find all qualifying sites in an area — deferred)

---

## Two-Axis Scoring Model

| Axis           | What It Measures                                          | Max Score        |
|----------------|-----------------------------------------------------------|------------------|
| Site Score     | Infrastructure viability (parcel, airspace, zoning, etc.) | 75 / 100 w/ keys |
| Demand Score   | Why fly here (employment, medical, cargo, etc.)           | 100              |
| Priority Index | Site x 0.60 + Demand x 0.40 (cargo-first default)        | 100              |

Quadrants: PRIME SITE / INFRASTRUCTURE PLAY / DEMAND WITHOUT SITE / LOW PRIORITY

---

## Site Score Criteria

| # | Criterion                  | Data Source                          | Weight |
|---|----------------------------|--------------------------------------|--------|
| 1 | Parcel size and contours   | Census TIGER / Harris County API     | 25%    |
| 2 | FAA airspace               | FAA B4UFLY / LAANC                   | 25%    |
| 3 | Power grid and DER         | EIA API / NREL RE Atlas              | 20%    |
| 4 | Zoning compliance          | OpenStreetMap / Nominatim            | 15%    |
| 5 | Soil stability / flood     | USGS 3DEP / FEMA NFHL                | 10%    |
| 6 | Community DER support      | NREL distributed energy counts       | 5%     |

Heliport layer: FAA NASR registry — boosts both axes when active heliport found
within 500m. Medical heliports: +15-18 site, +18-22 demand.
Files: txHeliports.js (833 TX heliports), heliportLookup.js (Haversine + type boosts)

---

## Demand Score Criteria

| # | Criterion                  | Weight |
|---|----------------------------|--------|
| 1 | Employment density         | 30%    |
| 2 | Destinations / attractions | 25%    |
| 3 | Medical and institutional  | 20%    |
| 4 | Cargo and logistics        | 15%    |
| 5 | Transit gap                | 10%    |

---

## API Stack

| API                   | Purpose                        | Auth         | Status           |
|-----------------------|--------------------------------|--------------|------------------|
| Census Geocoder       | Address to lat/lon             | None         | Active           |
| OpenStreetMap         | Zoning and land use            | None         | Active           |
| FAA B4UFLY / LAANC    | Airspace classification        | None         | Active           |
| USGS 3DEP             | Elevation and slope            | None         | Active           |
| FEMA NFHL             | Flood zone                     | None         | Active           |
| FAA NASR              | Heliport registry              | None         | Done             |
| EIA Open Data         | Grid capacity / utility        | Key in .env  | Done             |
| NREL RE Atlas         | Distributed energy counts      | Key in .env  | Done             |
| Harris County         | Real parcel data               | None/public  | Pending          |

API keys stored in: ~/Projects/vertiport-eval/.env — never commit to source code.

---

## FAA/NREL Scoring Standards

From the FAA Vertiport Electrical Infrastructure Study (NREL) in /research:
- NREL minimum parcel: 1.5 acres for fixed vertiport infrastructure
- Plan for 1 MW peak DC charging capacity (potentially higher)
- eVTOL OEM peak loads: 300 kW to 1 MW per aircraft
- Three-phase power proximity is a positive scoring signal
- Mobile charging not economically competitive vs fixed infrastructure

---

## Validated Test Sites

Live-data baseline as of Mar 29, 2026. Scores reflect HCAD parcel, FEMA flood,
FAA airspace (Haversine), EIA, and NREL live APIs. LLM estimates only for zoning
and demand sub-criteria.

| Site                              | Site | Demand | PI  | Quadrant             | Notes |
|-----------------------------------|------|--------|-----|----------------------|-------|
| 8900 Will Clayton Pkwy, Humble TX | 74   | 54     | 66  | Infrastructure Play  | Parcel 1.17 ac (30), airspace 45 (Class B outer 4.4nm IAH) |
| 1400 Post Oak Blvd, Houston TX    | 44   | 75     | 56  | Demand Without Site  | Parcel 11.56 ac (95), heliport +10/7, airspace 60 (Class B outer 15.4nm) |
| TMC (29.7079, -95.4010)           | 61   | 100    | 77  | PRIME SITE           | Medical heliport +14/18, parcel 9.07 ac, Zone X 500-yr flood |
| Willow Waterhole (29.6620,-95.52) | 58   | 36     | 49  | Infrastructure Play  | Parcel 5.9 ac, Zone X minimal, demand lower than LLM estimated |
| AT&T Stadium, Arlington TX        | 71   | 78     | 74  | PRIME SITE           | Cowboys heliport +10/7, outside Harris County (parcel = LLM est.) |

---

## Current Build Status

Done:
- React prototype validated — scoring logic and UI confirmed
- Two-axis model (Site + Demand + Priority Index) validated
- GPS coordinate input working
- PDF report export working (jsPDF)
- EIA and NREL API keys registered and stored in .env
- Vite/React project initialized in /app
- FAA NASR heliport layer complete (txHeliports.js — 833 TX heliports, heliportLookup.js)
- Interactive Leaflet map — ground-level view + FAA airspace overlay (Class B/C/D,
  25 TX airports, toggleable layers, click-for-detail popups) [Mar 28]
- Estimated flying days per year — NOAA 30-year climate normals, 20 TX reference
  stations, IDW interpolation, 6 grounding constraints, monthly chart [Mar 28]
- Regulatory checklist — context-aware, 22-25 items, 6 categories, auto-classified
  by airspace / zoning / flood / heliport proximity [Mar 28]
- Investment / viability summary — scenario classification, CAPEX/OPEX/revenue model,
  6-factor risk matrix, development timeline, investment grade A-D, 10-year NPV [Mar 28]
- All Mar 28 features integrated into web UI and PDF report export
- GitHub repo initialized — github.com/zumbador/vertiport-eval (private) [Mar 29]
- EIA Open Data API wired — fetchEIAPowerScore(), ERCOT territory, TX retail sales
  data, live scoring for Power Grid & DER layer [Mar 29]
- NREL RE Atlas API wired — fetchNRELDERScore(), 4 components: solar GHI, utility
  type, commercial rate, net metering; Promise.allSettled() graceful fallback [Mar 29]
- Harris County parcel API wired — fetchHarrisParcelScore(), HCAD ArcGIS public REST,
  live acreage + state class code, score overrides LLM estimate, composite recalculated,
  graceful fallback outside Harris County [Mar 29]
- FEMA NFHL flood zone wired — fetchFEMAFloodScore(), layer 28, Zone X/AE/VE/A/D
  scoring, USGS 3DEP elevation in parallel, graceful fallback [Mar 29]
- FAA airspace scoring wired — scoreAirspace(), Haversine against TX_AIRSPACE data
  (extracted to txAirspace.js, shared with SiteMap), Class B/C/D tier lookup,
  Class B SFC radius tuned to 4nm to account for irregular boundaries [Mar 29]
- OSM/Overpass zoning wired — fetchZoningScore(), is_in + around:100m parallel queries,
  landuse and building tag scoring, LLM fallback for unmapped suburban areas [Mar 29]
- Validated benchmarks recalibrated against live data — all 5 test sites re-run [Mar 29]

Next up (do in Claude Code):
- Replace remaining knowledge-base scoring estimates with live API calls
- 3D map view — Mapbox GL JS, FAA EB 105A obstacle surfaces, approach/departure paths
- Style PDF report to match site aesthetic
- Multi-site / network view (quadrant chart supports multiple points)
- Rate limiting for beta launch
- Beta landing page and email signup (HubSpot integration — free tier creates contact)

---

## Key Decisions

1. Address-only input plus GPS coordinate toggle
2. Texas-first scope, expanded to all of Texas (Phase 1 scope change, Mar 22)
3. Cargo-weighted scoring (airspace + parcel top-weighted)
4. Two-axis output: Site Score + Demand Score + Priority Index
5. Claude Code for production build, Claude.ai for planning/prototype
6. EIA and NREL API keys registered and wired — live scoring active
7. Harris County parcel API as first county integration
8. Priority Index = (Site × 0.60) + (Demand × 0.40) for cargo-first default
9. **Scoring methodology is proprietary** — weights, thresholds, and normalization
   logic are NEVER exposed to users or published. Users see scores, quadrant
   placement, and pass/fail indicators only.
10. **Business model** — Software qualifies and scopes consulting engagements.
    The free report is the top of a professional services funnel, not standalone SaaS.
11. **Revenue sequencing** — Free email-gated beta → Freemium at Phase 1 launch
    ($49/month Pro) → Per-report tiers ($300–600 Desktop, $4k–8k Field Audit,
    $15k–30k Engineering Package) → B2B API licensing (Phase 2+)
12. Subcontract field work for premium tiers (drone surveys, acoustic baselines,
    utility inquiries) — build in-house only when volume justifies it
13. 3D map planned — Mapbox GL JS for obstacle surfaces and approach/departure paths

---

## Revenue Tiers

| Tier                        | Price        | Delivery   | What's Included                                                              |
|-----------------------------|--------------|------------|------------------------------------------------------------------------------|
| Free                        | $0           | Instant    | Site + Demand scores, quadrant, basic report. Email gate + role field. HubSpot contact created. |
| Desktop Analyst Report      | $300–600     | Same day   | Full PDF: demand forecasting, investment viability, multi-site comparison. Software only, ~100% margin. |
| Physical Field Audit        | $4,000–8,000 | 5–7 days   | Drone obstacle survey, 24-hr acoustic baseline, utility interconnection inquiry. Subcontracted. |
| Bankable Engineering Package| $15,000–30,000| 3–4 weeks | Stamped engineering drawings, micro-weather + wind shear, preliminary FAA airspace submission. |

---

## Repository Structure

vertiport-eval/
├── CLAUDE.md              <- this file — read at start of every session
├── .env                   <- API keys — NEVER commit to git
├── /app                   <- Vite/React production app
│   └── /src/App.jsx       <- main application
├── /src                   <- prototype source files
├── /data                  <- sample parcels, Houston test addresses
├── /docs                  <- API docs, scoring methodology notes
├── /tests                 <- test cases with known score ranges
└── /research              <- FAA/NREL Vertiport Electrical Infrastructure Study

---

## Project Context

- Owner: Houston, TX
- Machine: Linux Mint NUC
- Primary use case: cargo logistics and commercial property evaluation
- Secondary use case: medical/hospital helipad conversion analysis
- Beta: free access for property owners, portfolio managers, brokers
- Notion project: https://www.notion.so/32b7112e57b981009421d9f2168fdcd7
- GitHub: https://github.com/zumbador/vertiport-eval (private)
