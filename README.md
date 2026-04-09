# Vertiport Evaluation System (VES)

A dual-axis site feasibility scoring tool for prospective vertiport and advanced air mobility (AAM) infrastructure. Given any US address or GPS coordinates, VES returns a **Site Score**, **Demand Score**, and **Priority Index** drawn from live public data — with a full PDF report, 2D/3D airspace map, investment viability model, and regulatory checklist.

---

## What It Does

Most vertiport site evaluations ask only whether a location can hold the infrastructure. VES asks two questions:

1. **Can the site support operations?** — parcel dimensions, FAA airspace classification, power grid capacity, flood zone, zoning, and distributed energy resources
2. **Why would anyone need to fly here?** — employment density, destination volume, medical and institutional anchors, cargo logistics activity, and transit gaps

Each site lands in one of four quadrants: **PRIME SITE**, **INFRASTRUCTURE PLAY**, **DEMAND WITHOUT SITE**, or **LOW PRIORITY**. The Priority Index is weighted toward cargo, the use case with the clearest near-term economics.

---

## Distribution Model

VES is open source (MIT). You bring your own AI API key — nothing is sent to any server except the AI provider you choose.

| Tier | What you get |
|------|-------------|
| **Open source** | Full desktop app, BYOK (Anthropic / OpenAI / Gemini), community scoring weights |
| **Private fork** | Proprietary scoring methodology tuned against validated real sites |
| **Setup service** | One-time setup for non-technical users (see [LowAltitudeEconomy.aero](https://lowaltitudeeconomy.aero)) |

---

## Tech Stack

- **Shell:** Electron desktop app — BYOK, no backend required
- **Frontend:** React 18 + Vite
- **Maps:** Leaflet (2D) + Mapbox GL JS (3D obstacle surface, FAA EB 105A)
- **PDF:** jsPDF
- **Data:** Live public APIs (see below)

---

## Data Sources

| Criterion | Source |
|-----------|--------|
| Parcel acreage + land class | Harris County Appraisal District (HCAD) ArcGIS |
| Flood zone | FEMA National Flood Hazard Layer (NFHL) |
| Elevation | USGS 3DEP |
| FAA airspace | FAA NASR — 39 Class B + ~85 Class C + ~65 Class D airports nationwide |
| Heliports | FAA NASR — 8,211 national heliports (medical/industrial/general classified) |
| Zoning | OpenStreetMap / Overpass API |
| Power grid | EIA Open Data API v2 |
| Distributed energy | NREL RE Atlas API |
| Flying days | NOAA 30-year Climate Normals (80+ stations, IDW interpolation) |
| LLM demand scoring | User-supplied key — Anthropic, OpenAI, or Google Gemini |

---

## Prerequisites

- Node.js 18+
- Free API keys for EIA, NREL, and Mapbox (see `.env.example`)
- An AI provider key — set via the in-app BYOK screen on first launch

---

## Setup

```bash
git clone https://github.com/zumbador/vertiport-eval.git
cd vertiport-eval
npm install
cp .env.example .env
# Edit .env — add your EIA, NREL, and Mapbox keys
```

### Development (browser)
```bash
npm run dev
# Opens at http://localhost:5173
```

### Electron desktop (dev mode)
```bash
npm run electron:dev
# Starts Vite dev server + Electron window together
```

On first launch, the BYOK setup screen will prompt for your AI provider and API key. The key is stored in your OS user data directory — never transmitted.

---

## Building Packages

### Linux (build locally)
```bash
npm run dist:linux      # .deb + .AppImage → release/
npm run dist:deb        # .deb only
npm run dist:appimage   # .AppImage only
```

### Windows and macOS
Windows and macOS builds must run on their native OS. Use the included GitHub Actions workflow to build all platforms via CI — push a version tag to trigger it:

```bash
git tag v0.1.0
git push origin v0.1.0
# Builds Linux (.deb + .AppImage), Windows (.exe), macOS (.dmg) automatically
```

Or build locally on the target OS:
```bash
npm run dist:win    # Windows only
npm run dist:mac    # macOS only
```

---

## Scoring Model

| Axis | What it measures | Max |
|------|-----------------|-----|
| Site Score | Infrastructure viability (parcel, airspace, zoning, flood, grid) | 75 |
| Demand Score | Operational demand (employment, destinations, medical, cargo, transit) | 100 |
| Priority Index | Site × 0.60 + Demand × 0.40 | 100 |

Quadrants: **PRIME SITE** / **INFRASTRUCTURE PLAY** / **DEMAND WITHOUT SITE** / **LOW PRIORITY**

Live API data overrides LLM estimates for parcel (HCAD), flood zone (FEMA), airspace (FAA), zoning (OSM), power grid (EIA), and distributed energy (NREL) when available.

---

## Project Structure

```
vertiport-eval/
├── electron/
│   ├── main.cjs            # Electron main process, IPC, key storage
│   └── preload.cjs         # contextBridge — window.electronAPI
├── src/
│   ├── vertiport-eval.jsx  # Main application component
│   ├── SetupScreen.jsx     # BYOK first-launch screen
│   ├── SiteMap.jsx         # 2D Leaflet map + FAA airspace overlay
│   ├── SiteMap3D.jsx       # 3D Mapbox obstacle surface map
│   ├── usAirspace.js       # FAA Class B/C/D airport dataset (nationwide)
│   ├── usHeliports.js      # 8,211 FAA NASR heliport records
│   ├── flyingDays.js       # NOAA climate normals + IDW interpolation
│   ├── investmentViability.js  # CAPEX / OPEX / NPV model
│   ├── regulatoryChecklist.js  # FAA and local compliance checklist
│   └── heliportLookup.js   # Haversine proximity + type scoring
├── build/
│   └── icon.png            # App icon (512×512)
├── .env.example            # Required environment variables
└── .github/workflows/
    └── build.yml           # Cross-platform CI builds
```

---

## Scoring Methodology

Scoring weights, thresholds, and LLM rubrics are documented internally. Users see scores, quadrant placement, and narrative outputs only — intermediate calculations are not exposed. The open source version uses community default weights; a private fork retains methodology tuned against validated real sites.

---

## Roadmap

- [ ] Multi-site / network view — corridor demand mapping between scored sites
- [ ] Pro tier — demand criterion weight sliders (free tier gets defaults)
- [ ] Parcel APIs for Dallas, Tarrant, Travis, and Bexar counties

---

## License

MIT — see [LICENSE](LICENSE)

The scoring methodology, weighting model, and proprietary data layers used in the private fork are not covered by this license and remain the intellectual property of the author.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
