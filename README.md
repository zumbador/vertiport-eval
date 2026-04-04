# Vertiport Evaluation System (VES)

A dual-axis site feasibility scoring tool for prospective vertiport and advanced air mobility (AAM) infrastructure. Given any address or GPS coordinates, VES returns a **Site Score**, **Demand Score**, and **Priority Index** drawn from live public data — with a full PDF report, 2D/3D airspace map, investment viability model, and regulatory checklist.

Built as a Phase 1 Houston prototype. Nationwide support is on the roadmap.

---

## What It Does

Most vertiport site evaluations ask only whether a location can hold the infrastructure. VES asks two questions:

1. **Can the site support operations?** — parcel dimensions, FAA airspace classification, power grid capacity, flood zone, zoning, and distributed energy resources
2. **Why would anyone need to fly here?** — employment density, destination volume, medical and institutional anchors, cargo logistics activity, and transit gaps

Each site lands in one of four quadrants: **PRIME SITE**, **INFRASTRUCTURE PLAY**, **DEMAND WITHOUT SITE**, or **LOW PRIORITY**. The Priority Index is weighted toward cargo, the use case with the clearest near-term economics.

---

## Tech Stack

- **Frontend:** React 18 + Vite
- **Maps:** Leaflet (2D) + Mapbox GL JS (3D obstacle surface)
- **PDF:** jsPDF
- **Data:** Live public APIs (see below)

---

## Data Sources

| Criterion | Source |
|-----------|--------|
| Parcel acreage + land class | Harris County Appraisal District (HCAD) ArcGIS |
| Flood zone | FEMA National Flood Hazard Layer (NFHL) |
| Elevation | USGS 3DEP |
| FAA airspace | FAA NASR — TX Class B/C/D airports + 833 TX heliports |
| Zoning | OpenStreetMap / Overpass API |
| Power grid | EIA Open Data API |
| Distributed energy | NREL RE Atlas API |
| Flying days | NOAA Climate Normals |

---

## Prerequisites

Node.js 18+ and npm are required.

You will need API keys for the following services:

| Variable | Service | Notes |
|----------|---------|-------|
| `VITE_EIA_API_KEY` | [EIA Open Data](https://www.eia.gov/opendata/) | Free registration |
| `VITE_NREL_API_KEY` | [NREL Developer Network](https://developer.nrel.gov/) | Free registration |
| `VITE_MAPBOX_TOKEN` | [Mapbox](https://www.mapbox.com/) | Free tier available |
| `ANTHROPIC_API_KEY` | [Anthropic](https://www.anthropic.com/) | Used for zoning LLM fallback |

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/zumbador/vertiport-eval.git
cd vertiport-eval

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Add your API keys to .env

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Building for Production

```bash
npm run build
npm run preview
```

The production build outputs to `dist/`.

---

## Usage

1. Enter a street address or GPS coordinates in the search field
2. Select an evaluation mode: **Cargo**, **Passenger**, or **Combined**
3. Click **Evaluate Site** — the tool queries live APIs and scores the location
4. Review the Site Score, Demand Score, Priority Index, and quadrant placement
5. Download a full PDF report or explore the 2D/3D airspace map

**Note:** The free tier is limited to 10 evaluations per day with a 30-second cooldown between runs. This limit is enforced client-side and should be replaced with server-side rate limiting before any public deployment.

---

## Project Structure

```
vertiport-eval/
├── src/
│   ├── vertiport-eval.jsx      # Main application
│   ├── SiteMap.jsx             # 2D Leaflet map
│   ├── SiteMap3D.jsx           # 3D Mapbox obstacle surface map
│   ├── flyingDays.js           # NOAA climate normals
│   ├── investmentViability.js  # CAPEX / OPEX / NPV model
│   ├── regulatoryChecklist.js  # FAA and local compliance checklist
│   ├── txAirspace.js           # TX Class B/C/D airport data
│   ├── txHeliports.js          # 833 TX heliport records
│   └── heliportLookup.js       # Haversine proximity + type scoring
├── docs/
│   └── api-notes.md            # API integration notes
├── data/                       # Static reference data
├── tests/
└── index.html
```

---

## Scoring Methodology

The scoring model is documented internally and versioned separately from the codebase. The API returns scores, quadrant labels, and narrative outputs only — intermediate calculations, weights, and thresholds are not exposed.

---

## Roadmap

- [ ] Save evaluated sites (localStorage persistence)
- [ ] Nationwide support — ~500 US airports, national heliport layer, national NOAA stations
- [ ] Multi-site / network view — corridor demand mapping between scored sites
- [ ] Pro tier — demand criterion weight sliders
- [ ] Beta landing page + HubSpot email gate
- [ ] Parcel APIs for Dallas, Tarrant, Travis, and Bexar counties

---

## License

MIT — see [LICENSE](LICENSE) for details.

The scoring methodology, weighting model, and proprietary data layers used in the production deployment are not covered by this license and remain the intellectual property of the author.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.
