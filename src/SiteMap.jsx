import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TX_HELIPORTS } from "./txHeliports.js";

const HELIPORT_COLORS = {
  M: "#28c87a",
  I: "#20c0b0",
  G: "#f0a030",
};
const HELIPORT_LABELS = {
  M: "Medical",
  I: "Industrial",
  G: "General Aviation",
};

function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeCircleIcon(color, radius) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${radius * 2}px;height:${radius * 2}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color}88;"></div>`,
    iconSize: [radius * 2, radius * 2],
    iconAnchor: [radius, radius],
  });
}

const SITE_ICON = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#5B9BD5;border:3px solid #fff;box-shadow:0 0 12px rgba(91,155,213,0.6);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ── Texas Airspace Data ─────────────────────────────────────────
// Simplified FAA airspace boundaries for major Texas airports.
// Class B: multi-tier wedding-cake structure (simplified to key rings)
// Class C: two-tier (5nm inner, 10nm outer, SFC-4200 typical)
// Class D: single cylinder (typically 4-5nm radius, SFC-2500)
//
// Format: { id, name, class, lat, lon, tiers: [{ radius_nm, floor, ceiling }] }
// Radius in nautical miles, altitudes in feet MSL.
// Sources: FAA Order 7400.11, current VFR sectional charts, AIM Ch. 3

const NM_TO_M = 1852;

const TX_AIRSPACE = [
  // ── Houston Class B ──
  { id: "IAH", name: "Houston Class B (IAH/HOU)", class: "B", lat: 29.9844, lon: -95.3414, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 10000 },
    { radius_nm: 10, floor: 2000, ceiling: 10000 },
    { radius_nm: 15, floor: 3000, ceiling: 10000 },
    { radius_nm: 20, floor: 4000, ceiling: 10000 },
    { radius_nm: 30, floor: 6000, ceiling: 10000 },
  ]},
  // ── Dallas-Fort Worth Class B ──
  { id: "DFW", name: "Dallas-Fort Worth Class B", class: "B", lat: 32.8998, lon: -97.0403, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 11000 },
    { radius_nm: 10, floor: 2000, ceiling: 11000 },
    { radius_nm: 15, floor: 3000, ceiling: 11000 },
    { radius_nm: 20, floor: 4000, ceiling: 11000 },
    { radius_nm: 30, floor: 6000, ceiling: 11000 },
  ]},
  // ── San Antonio Class B ──
  { id: "SAT", name: "San Antonio Class B", class: "B", lat: 29.5337, lon: -98.4698, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 8000 },
    { radius_nm: 10, floor: 2000, ceiling: 8000 },
    { radius_nm: 20, floor: 4000, ceiling: 8000 },
  ]},
  // ── Austin Class C ──
  { id: "AUS", name: "Austin-Bergstrom (Class C)", class: "C", lat: 30.1975, lon: -97.6664, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 4900 },
    { radius_nm: 10, floor: 1900, ceiling: 4900 },
  ]},
  // ── El Paso Class C ──
  { id: "ELP", name: "El Paso International (Class C)", class: "C", lat: 31.8072, lon: -106.3778, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 8500 },
    { radius_nm: 10, floor: 4600, ceiling: 8500 },
  ]},
  // ── Corpus Christi Class C ──
  { id: "CRP", name: "Corpus Christi (Class C)", class: "C", lat: 27.7704, lon: -97.5012, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 4100 },
    { radius_nm: 10, floor: 1300, ceiling: 4100 },
  ]},
  // ── Lubbock Class C ──
  { id: "LBB", name: "Lubbock Preston Smith (Class C)", class: "C", lat: 33.6636, lon: -101.8228, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 6700 },
    { radius_nm: 10, floor: 4200, ceiling: 6700 },
  ]},
  // ── Midland Class C ──
  { id: "MAF", name: "Midland International (Class C)", class: "C", lat: 31.9425, lon: -102.2019, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 6600 },
    { radius_nm: 10, floor: 4100, ceiling: 6600 },
  ]},
  // ── McAllen Class C ──
  { id: "MFE", name: "McAllen Miller (Class C)", class: "C", lat: 26.1758, lon: -98.2386, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 3800 },
    { radius_nm: 10, floor: 1700, ceiling: 3800 },
  ]},
  // ── Amarillo Class C ──
  { id: "AMA", name: "Rick Husband Amarillo (Class C)", class: "C", lat: 35.2194, lon: -101.7059, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 7600 },
    { radius_nm: 10, floor: 5300, ceiling: 7600 },
  ]},
  // ── Brownsville Class C ──
  { id: "BRO", name: "Brownsville (Class C)", class: "C", lat: 25.9068, lon: -97.4259, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 3800 },
    { radius_nm: 10, floor: 1700, ceiling: 3800 },
  ]},
  // ── Houston area Class D ──
  { id: "DWH", name: "David Wayne Hooks (Class D)", class: "D", lat: 30.0618, lon: -95.5546, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2800 },
  ]},
  { id: "EFD", name: "Ellington Field (Class D)", class: "D", lat: 29.6073, lon: -95.1586, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2500 },
  ]},
  { id: "SGR", name: "Sugar Land Regional (Class D)", class: "D", lat: 29.6223, lon: -95.6565, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2700 },
  ]},
  { id: "IWS", name: "West Houston (Class D)", class: "D", lat: 29.8182, lon: -95.6726, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2500 },
  ]},
  { id: "CXO", name: "Conroe-North Houston (Class D)", class: "D", lat: 30.3518, lon: -95.4144, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3000 },
  ]},
  // ── DFW area Class D ──
  { id: "DAL", name: "Dallas Love Field (Class D)", class: "D", lat: 32.8471, lon: -96.8518, tiers: [
    { radius_nm: 5, floor: "SFC", ceiling: 3100 },
  ]},
  { id: "ADS", name: "Addison Airport (Class D)", class: "D", lat: 32.9686, lon: -96.8364, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3000 },
  ]},
  { id: "AFW", name: "Fort Worth Alliance (Class D)", class: "D", lat: 32.9876, lon: -97.3188, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3200 },
  ]},
  { id: "FTW", name: "Fort Worth Meacham (Class D)", class: "D", lat: 32.8198, lon: -97.3624, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3000 },
  ]},
  { id: "GPM", name: "Grand Prairie Municipal (Class D)", class: "D", lat: 32.6986, lon: -97.0467, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2900 },
  ]},
  { id: "RBD", name: "Dallas Executive (Class D)", class: "D", lat: 32.6809, lon: -96.8682, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3000 },
  ]},
  // ── San Antonio area Class D ──
  { id: "RND", name: "Randolph AFB (Class D)", class: "D", lat: 29.5297, lon: -98.2789, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2600 },
  ]},
  { id: "SSF", name: "Stinson Municipal (Class D)", class: "D", lat: 29.3370, lon: -98.4711, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 2300 },
  ]},
  // ── Austin area Class D ──
  { id: "GTU", name: "Georgetown Municipal (Class D)", class: "D", lat: 30.6788, lon: -97.6794, tiers: [
    { radius_nm: 4, floor: "SFC", ceiling: 3500 },
  ]},
];

// Airspace class styling
const AIRSPACE_STYLES = {
  B: {
    color: "#1a5fb4",
    fillColor: "#3584e4",
    fillOpacity: 0.08,
    weight: 2,
    dashArray: null,
    label: "Class B",
    tierOpacityScale: [0.12, 0.08, 0.06, 0.04, 0.03],
  },
  C: {
    color: "#9141ac",
    fillColor: "#c061cb",
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: null,
    label: "Class C",
    tierOpacityScale: [0.10, 0.06],
  },
  D: {
    color: "#1a5fb4",
    fillColor: "#3584e4",
    fillOpacity: 0.05,
    weight: 1.5,
    dashArray: "6,4",
    label: "Class D",
    tierOpacityScale: [0.06],
  },
};

function buildAirspaceLayer(map, siteLat, siteLon) {
  const airspaceGroup = L.layerGroup();

  // Only show airspace within ~80nm of the site to avoid clutter
  const maxRangeM = 80 * NM_TO_M;

  for (const ap of TX_AIRSPACE) {
    const distToSite = distanceM(siteLat, siteLon, ap.lat, ap.lon);
    if (distToSite > maxRangeM) continue;

    const style = AIRSPACE_STYLES[ap.class];
    if (!style) continue;

    // Draw tiers from outermost to innermost so inner tiers layer on top
    const tiersReversed = [...ap.tiers].reverse();
    tiersReversed.forEach((tier, idx) => {
      const tierIdx = ap.tiers.length - 1 - idx;
      const radiusM = tier.radius_nm * NM_TO_M;
      const opacity = style.tierOpacityScale[tierIdx] || style.fillOpacity;
      const floorLabel = tier.floor === "SFC" ? "SFC" : `${tier.floor}'`;

      const circle = L.circle([ap.lat, ap.lon], {
        radius: radiusM,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: opacity,
        weight: tierIdx === 0 ? style.weight : style.weight * 0.6,
        dashArray: style.dashArray,
        interactive: true,
      });

      circle.bindPopup(
        `<div style="font-family:monospace;font-size:11px;">
          <strong style="color:${style.color};">${ap.name}</strong><br/>
          <span style="color:${style.color};font-weight:600;">Class ${ap.class}</span> airspace<br/>
          Tier: ${tier.radius_nm} NM radius<br/>
          Floor: ${floorLabel} · Ceiling: ${tier.ceiling}'<br/>
          ${distToSite < radiusM
            ? `<strong style="color:#C0392B;">Site is INSIDE this tier</strong>`
            : `Site is ${(distToSite / NM_TO_M).toFixed(1)} NM from center`
          }
        </div>`
      );

      airspaceGroup.addLayer(circle);
    });

    // Airport label marker at center
    const labelIcon = L.divIcon({
      className: "",
      html: `<div style="
        font-family:'IBM Plex Mono',monospace;
        font-size:10px;
        font-weight:600;
        color:${style.color};
        text-shadow:0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;
        white-space:nowrap;
        pointer-events:none;
      ">${ap.id}<span style="font-size:8px;opacity:0.7;margin-left:2px;">${ap.class}</span></div>`,
      iconSize: [60, 16],
      iconAnchor: [30, 8],
    });
    airspaceGroup.addLayer(L.marker([ap.lat, ap.lon], { icon: labelIcon, interactive: false }));
  }

  return airspaceGroup;
}

// ── Component ───────────────────────────────────────────────────

export default function SiteMap({ geocode, heliport, airspace }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  const lat = geocode?.lat;
  const lon = geocode?.lon;

  useEffect(() => {
    if (!lat || !lon || !containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    // Base layers
    const street = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }
    );
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri", maxZoom: 18 }
    );
    street.addTo(map);

    // Heliport layer
    const heliportGroup = L.layerGroup();
    const nearbyHeliports = [];
    for (const [hLat, hLon, name, type] of TX_HELIPORTS) {
      const d = distanceM(lat, lon, hLat, hLon);
      if (d <= 15000) {
        nearbyHeliports.push({ lat: hLat, lon: hLon, name, type, dist: d });
      }
    }
    nearbyHeliports.forEach((h) => {
      const color = HELIPORT_COLORS[h.type] || HELIPORT_COLORS.G;
      const label = HELIPORT_LABELS[h.type] || "General Aviation";
      const isNearest = heliport?.name && h.name === heliport.name;
      const radius = isNearest ? 8 : 6;
      const marker = L.marker([h.lat, h.lon], { icon: makeCircleIcon(color, radius) });
      marker.bindPopup(
        `<div style="font-family:monospace;font-size:12px;">
          <strong>${h.name}</strong><br/>
          Type: ${label}<br/>
          Distance: ${h.dist < 1000 ? `${Math.round(h.dist)}m` : `${(h.dist / 1000).toFixed(1)}km`}
          ${isNearest ? "<br/><strong style='color:#28c87a;'>Nearest heliport (score modifier applied)</strong>" : ""}
        </div>`
      );
      heliportGroup.addLayer(marker);
    });
    heliportGroup.addTo(map);

    // Airspace overlay
    const airspaceLayer = buildAirspaceLayer(map, lat, lon);
    airspaceLayer.addTo(map);

    // Site marker (added last so it's on top)
    L.marker([lat, lon], { icon: SITE_ICON })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:monospace;font-size:12px;">
          <strong>${geocode.matched || "Evaluation Site"}</strong><br/>
          ${lat.toFixed(5)}°N, ${Math.abs(lon).toFixed(5)}°W
          ${airspace ? `<br/>Airspace: ${airspace.status || "N/A"}` : ""}
        </div>`
      );

    // 500m heliport search radius
    L.circle([lat, lon], {
      radius: 500,
      color: "#5B9BD5",
      fillColor: "#5B9BD5",
      fillOpacity: 0.06,
      weight: 1,
      dashArray: "5,5",
    }).addTo(map);

    // 5km context radius
    L.circle([lat, lon], {
      radius: 5000,
      color: "#d0dce8",
      fillColor: "transparent",
      fillOpacity: 0,
      weight: 1,
      dashArray: "8,6",
    }).addTo(map);

    // Layer control
    L.control
      .layers(
        { Street: street, Satellite: satellite },
        {
          "FAA Airspace": airspaceLayer,
          "Heliports": heliportGroup,
        },
        { position: "topright", collapsed: false }
      )
      .addTo(map);

    // Hint below layer control
    const hint = L.control({ position: "topright" });
    hint.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.style.cssText = "background:rgba(255,255,255,0.92);padding:4px 10px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:8px;color:#888;line-height:1.4;max-width:150px;box-shadow:0 1px 3px rgba(0,0,0,0.1);margin-top:2px;";
      div.innerHTML = "Click any airspace ring, heliport, or marker for details";
      return div;
    };
    hint.addTo(map);

    // Fit bounds
    if (nearbyHeliports.length > 0) {
      const points = [[lat, lon], ...nearbyHeliports.map((h) => [h.lat, h.lon])];
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon]);

  if (!lat || !lon) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9,
          color: "#7db0b5",
          letterSpacing: "0.2em",
          marginBottom: 10,
        }}
      >
        SITE MAP — GROUND LEVEL & AIRSPACE CLASSIFICATION
      </div>
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #d0dce8",
          borderRadius: 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div ref={containerRef} style={{ height: 440, width: "100%" }} />
        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 16px",
            borderTop: "1px solid #d0dce8",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <LegendItem color="#5B9BD5" label="Evaluation Site" shape="circle" />
          <LegendSep />
          <LegendItem color="#28c87a" label="Medical Heliport" shape="circle" />
          <LegendItem color="#20c0b0" label="Industrial Heliport" shape="circle" />
          <LegendItem color="#f0a030" label="General Aviation" shape="circle" />
          <LegendSep />
          <LegendItem color="#1a5fb4" label="Class B" shape="ring" />
          <LegendItem color="#9141ac" label="Class C" shape="ring" />
          <LegendItem color="#1a5fb4" label="Class D" shape="ring-dashed" />
          <span
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 8,
              color: "#999999",
              marginLeft: "auto",
            }}
          >
            Source: FAA Order 7400.11 · Simplified boundaries
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendSep() {
  return <div style={{ width: 1, height: 14, background: "#d0dce8" }} />;
}

function LegendItem({ color, label, shape }) {
  let shapeEl;
  if (shape === "ring") {
    shapeEl = (
      <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${color}`, background: `${color}18` }} />
    );
  } else if (shape === "ring-dashed") {
    shapeEl = (
      <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px dashed ${color}`, background: `${color}10` }} />
    );
  } else {
    shapeEl = (
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, border: "1.5px solid #fff", boxShadow: `0 0 4px ${color}66` }} />
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {shapeEl}
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#444444" }}>
        {label}
      </span>
    </div>
  );
}
