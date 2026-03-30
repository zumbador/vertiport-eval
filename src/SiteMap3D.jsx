import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// ── Geometry helpers ─────────────────────────────────────────────

const LAT_M = 111320;

function lonM(lat) {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

function makeCircle(cx, cy, radiusM, steps = 64) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([cx + (radiusM * Math.sin(a)) / lonM(cy), cy + (radiusM * Math.cos(a)) / LAT_M]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

function makeApproach(cx, cy, bearing, startM, lengthM, nearW, farW) {
  const toRad = Math.PI / 180;
  const lm = lonM(cy);
  function offset(dist, brg, sideM) {
    const fLat = cy + (dist * Math.cos(brg * toRad)) / LAT_M;
    const fLon = cx + (dist * Math.sin(brg * toRad)) / lm;
    const sLat = (sideM * Math.cos((brg + 90) * toRad)) / LAT_M;
    const sLon = (sideM * Math.sin((brg + 90) * toRad)) / lm;
    return [[fLon + sLon, fLat + sLat], [fLon - sLon, fLat - sLat]];
  }
  const [nL, nR] = offset(startM, bearing, nearW);
  const [fL, fR] = offset(lengthM, bearing, farW);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[nL, fL, fR, nR, nL]] },
    properties: { bearing },
  };
}

/** Build the GeoJSON FeatureCollection for approach + slope bands at a given bearing */
function buildApproachData(lon, lat, brg) {
  return {
    type: "FeatureCollection",
    features: [
      makeApproach(lon, lat, brg,       30, 430, 30, 150),
      makeApproach(lon, lat, brg + 180, 30, 430, 30, 150),
    ],
  };
}

function buildSlopeBands(lon, lat, brg) {
  const toRad = Math.PI / 180;
  const lm = lonM(lat);
  function offset(dist, b, sideM) {
    const fLat = lat + (dist * Math.cos(b * toRad)) / LAT_M;
    const fLon = lon + (dist * Math.sin(b * toRad)) / lm;
    const sLat = (sideM * Math.cos((b + 90) * toRad)) / LAT_M;
    const sLon = (sideM * Math.sin((b + 90) * toRad)) / lm;
    return [[fLon + sLon, fLat + sLat], [fLon - sLon, fLat - sLat]];
  }
  const bands = [];
  for (let i = 0; i < 5; i++) {
    const d0 = 30 + i * 80;
    const d1 = 30 + (i + 1) * 80;
    const w0 = 30 + i * 24;
    const w1 = 30 + (i + 1) * 24;
    const h = parseFloat((d0 / 12.5).toFixed(1));
    const base = Math.max(0, h - 8);
    [brg, brg + 180].forEach((b) => {
      const [nL, nR] = offset(d0, b, w0);
      const [fL, fR] = offset(d1, b, w1);
      bands.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[nL, fL, fR, nR, nL]] },
        properties: { height: h, base },
      });
    });
  }
  return { type: "FeatureCollection", features: bands };
}

// ── Component ───────────────────────────────────────────────────

export default function SiteMap3D({ geocode, airspace, approachBearing = 0 }) {
  const mapRef  = useRef(null);
  const containerRef = useRef(null);
  const loadedRef = useRef(false);

  const lat = geocode?.lat;
  const lon = geocode?.lon;

  // ── Create / destroy map when site changes ──
  useEffect(() => {
    if (!lat || !lon || !containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    loadedRef.current = false;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [lon, lat],
      zoom: 15.5,
      pitch: 52,
      bearing: -18,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: true, maxWidth: "240px" });

    map.on("load", () => {
      loadedRef.current = true;

      // TLOF
      map.addSource("tlof", { type: "geojson", data: makeCircle(lon, lat, 15) });
      map.addLayer({ id: "tlof-fill",    type: "fill", source: "tlof", paint: { "fill-color": "#28c87a", "fill-opacity": 0.45 } });
      map.addLayer({ id: "tlof-outline", type: "line", source: "tlof", paint: { "line-color": "#28c87a", "line-width": 2 } });

      // FATO
      map.addSource("fato", { type: "geojson", data: makeCircle(lon, lat, 30) });
      map.addLayer({ id: "fato-fill",    type: "fill", source: "fato", paint: { "fill-color": "#1a8a58", "fill-opacity": 0.25 } });
      map.addLayer({ id: "fato-outline", type: "line", source: "fato", paint: { "line-color": "#1a8a58", "line-width": 2 } });

      // Safety area
      map.addSource("safety", { type: "geojson", data: makeCircle(lon, lat, 75) });
      map.addLayer({ id: "safety-fill",    type: "fill", source: "safety", paint: { "fill-color": "#c87a10", "fill-opacity": 0.08 } });
      map.addLayer({ id: "safety-outline", type: "line", source: "safety", paint: { "line-color": "#c87a10", "line-width": 1.5, "line-dasharray": [5, 3] } });

      // OLS boundary — white glow + blue line for satellite contrast
      map.addSource("ols", { type: "geojson", data: makeCircle(lon, lat, 200) });
      map.addLayer({ id: "ols-glow",    type: "line", source: "ols", paint: { "line-color": "#FFFFFF", "line-width": 4, "line-opacity": 0.35 } });
      map.addLayer({ id: "ols-outline", type: "line", source: "ols", paint: { "line-color": "#5B9BD5", "line-width": 2, "line-dasharray": [8, 4] } });

      // Approach surfaces (dynamic — bearing-dependent)
      map.addSource("approaches", { type: "geojson", data: buildApproachData(lon, lat, approachBearing) });
      map.addLayer({ id: "approach-fill",    type: "fill", source: "approaches", paint: { "fill-color": "#5B9BD5", "fill-opacity": 0.20 } });
      map.addLayer({ id: "approach-outline", type: "line", source: "approaches", paint: { "line-color": "#5B9BD5", "line-width": 1.5, "line-dasharray": [6, 3] } });

      // Slope bands 3D extrusion
      map.addSource("slope-bands", { type: "geojson", data: buildSlopeBands(lon, lat, approachBearing) });
      map.addLayer({
        id: "slope-3d",
        type: "fill-extrusion",
        source: "slope-bands",
        paint: {
          "fill-extrusion-color": "#5B9BD5",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.32,
        },
      });

      // Vertiport structure extrusion
      map.addSource("structure", { type: "geojson", data: makeCircle(lon, lat, 10, 8) });
      map.addLayer({
        id: "structure-3d",
        type: "fill-extrusion",
        source: "structure",
        paint: {
          "fill-extrusion-color": "#5B9BD5",
          "fill-extrusion-height": 6,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.85,
        },
      });

      // Site marker with popup
      const el = document.createElement("div");
      el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#5B9BD5;border:3px solid #fff;box-shadow:0 0 14px rgba(91,155,213,0.9);cursor:pointer;";
      new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 14, maxWidth: "220px" }).setHTML(
            `<div style="font-family:monospace;font-size:11px;line-height:1.5;">
              <strong>${geocode.matched || "Evaluation Site"}</strong><br/>
              ${lat.toFixed(5)}°N, ${Math.abs(lon).toFixed(5)}°W<br/>
              ${airspace ? `<span style="color:#5B9BD5;">Airspace: ${airspace.status || "N/A"}</span>` : ""}
            </div>`
          )
        )
        .addTo(map);

      // Hover info
      const hoverInfo = {
        "tlof-fill":     "TLOF — Touchdown & Liftoff Area · 15m radius · Aircraft operating surface",
        "fato-fill":     "FATO — Final Approach and Takeoff Area · 30m radius · Clear of obstacles to ≥35 ft",
        "safety-fill":   "Safety Area · 75m radius · No obstacles above 3 inches",
        "approach-fill": "Approach/Departure Surface · 12.5:1 slope · 400m extent · Rotate bearing in controls above",
        "slope-3d":      "3D slope surface — 12.5:1 obstacle clearance per FAA EB 105A draft",
      };
      Object.keys(hoverInfo).forEach((layer) => {
        map.on("mouseenter", layer, (e) => {
          map.getCanvas().style.cursor = "pointer";
          popup.setLngLat(e.lngLat)
            .setHTML(`<div style="font-family:monospace;font-size:10px;line-height:1.5;">${hoverInfo[layer]}</div>`)
            .addTo(map);
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      });
    });

    return () => {
      loadedRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [lat, lon]);

  // ── Update approach surfaces when bearing changes (no map recreation) ──
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current || !lat || !lon) return;
    const map = mapRef.current;
    // Wait for style to be loaded (handles rapid changes)
    if (!map.isStyleLoaded()) return;
    map.getSource("approaches")?.setData(buildApproachData(lon, lat, approachBearing));
    map.getSource("slope-bands")?.setData(buildSlopeBands(lon, lat, approachBearing));
  }, [approachBearing, lat, lon]);

  if (!lat || !lon) return null;

  return (
    <div style={{ marginBottom: 0 }}>
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9,
          color: "#7db0b5",
          letterSpacing: "0.2em",
          marginBottom: 10,
        }}
      >
        3D OBSTACLE SURFACES — FAA EB 105A · ILLUSTRATIVE BEARINGS
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #d0dce8", borderRadius: 8, overflow: "hidden" }}>
        <div ref={containerRef} style={{ height: 440, width: "100%" }} />
        <div style={{ display: "flex", gap: 14, padding: "10px 16px", borderTop: "1px solid #d0dce8", flexWrap: "wrap", alignItems: "center" }}>
          <LegendItem color="#28c87a" label="TLOF (15m)" />
          <LegendItem color="#1a8a58" label="FATO (30m)" />
          <LegendItem color="#c87a10" label="Safety area (75m)" dashed />
          <LegendItem color="#5B9BD5" label="Approach surfaces" />
          <LegendItem color="#5B9BD5" label="OLS boundary (200m)" dashed />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: "#999999", marginLeft: "auto" }}>
            Hover surfaces for info · FAA EB 105A
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {dashed
        ? <div style={{ width: 18, height: 0, borderTop: `2px dashed ${color}` }} />
        : <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, opacity: 0.85 }} />
      }
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#444444" }}>{label}</span>
    </div>
  );
}
