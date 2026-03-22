import { TX_HELIPORTS } from './txHeliports.js';

// Haversine distance in meters
function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_MAP = {
  M: { status: 'active_medical',    site_boost: 14, demand_boost: 18 },
  I: { status: 'active_industrial', site_boost: 12, demand_boost: 12 },
  G: { status: 'active_ga',         site_boost: 10, demand_boost:  7 },
};

/**
 * Find the nearest registered heliport within radiusM meters.
 * Returns a heliport object ready for the modifier UI, or a "none" object.
 */
export function findNearestHeliport(lat, lon, radiusM = 500) {
  let best = null;
  let bestDist = Infinity;

  for (const [hLat, hLon, name, type] of TX_HELIPORTS) {
    const d = distanceM(lat, lon, hLat, hLon);
    if (d <= radiusM && d < bestDist) {
      bestDist = d;
      best = { name, type, dist: Math.round(d) };
    }
  }

  if (!best) return { status: 'none', site_boost: 0, demand_boost: 0, name: '', distance_m: 0, notes: '' };

  const { status, site_boost, demand_boost } = STATUS_MAP[best.type] || STATUS_MAP.G;
  return {
    status,
    site_boost,
    demand_boost,
    name: best.name,
    distance_m: best.dist,
    notes: `Registered FAA heliport ${best.dist}m from site. Airspace coordination, structural load rating, and operational demand already established.`,
  };
}
