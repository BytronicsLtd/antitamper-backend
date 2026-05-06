/**
 * KTDA factories + regions seed.
 *
 * - Idempotent: looks up by name, updates in place; safe to re-run.
 * - Region polygons are convex hulls of their factory points, padded slightly,
 *   so factories sit inside their region for $geoIntersects queries.
 * - Coordinates are sub-county/town-level approximations (±2-5 km from the
 *   actual factory site). Refine via the dashboard polygon picker as needed.
 *
 * Usage:
 *   node src/scripts/seed-ktda.js
 *   MONGODB_URI=mongodb://... node src/scripts/seed-ktda.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const RegionModel = require('../models/region.model');
const FactoryModel = require('../models/factory');

const MONGODB_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/antitamper';

// --- KTDA factory data --------------------------------------------------------
// Source: https://victormatara.com/list-of-all-ktda-factories-per-region-in-kenya/
// + Wikipedia + KTDA company brochure. Coordinates are sub-county centroids.
const FACTORIES = [
  // Region 1 — Kiambu / Murang'a South (Thika sub-region)
  { region: 'Region 1', name: 'Kambaa',     location: 'Lari, Kiambu',           lat: -1.05,  lng: 36.75 },
  { region: 'Region 1', name: 'Mataara',    location: 'Gatundu, Kiambu',        lat: -1.12,  lng: 36.85 },
  { region: 'Region 1', name: 'Kagwe',      location: 'Lari, Kiambu',           lat: -1.04,  lng: 36.70 },
  { region: 'Region 1', name: 'Theta',      location: 'Gatundu, Kiambu',        lat: -1.05,  lng: 36.85 },
  { region: 'Region 1', name: 'Ngere',      location: 'Kangema, Murang\'a',     lat: -0.78,  lng: 37.00 },
  { region: 'Region 1', name: 'Ikumbi',     location: 'Kiharu, Murang\'a',      lat: -0.85,  lng: 37.00 },
  { region: 'Region 1', name: 'Ndarugu',    location: 'Gatundu, Kiambu',        lat: -1.10,  lng: 36.95 },
  { region: 'Region 1', name: 'Gachege',    location: 'Kandara, Murang\'a',     lat: -0.93,  lng: 37.00 },
  { region: 'Region 1', name: 'Njunu',      location: 'Kandara, Murang\'a',     lat: -0.92,  lng: 36.98 },
  { region: 'Region 1', name: 'Nduti',      location: 'Kangari, Murang\'a',     lat: -0.92,  lng: 36.95 },
  { region: 'Region 1', name: 'Makomboki',  location: 'Kigumo, Murang\'a',      lat: -0.78,  lng: 36.85 },
  { region: 'Region 1', name: 'Gacharage',  location: 'Kandara, Murang\'a',     lat: -0.95,  lng: 36.95 },

  // Region 2 — Murang'a North / Nyeri
  { region: 'Region 2', name: 'Githambo',     location: 'Kahuro, Murang\'a',     lat: -0.65,  lng: 37.00 },
  { region: 'Region 2', name: 'Kanyenyaini',  location: 'Kangema, Murang\'a',    lat: -0.70,  lng: 36.90 },
  { region: 'Region 2', name: 'Kiru',         location: 'Kiharu, Murang\'a',     lat: -0.66,  lng: 37.02 },
  { region: 'Region 2', name: 'Gatunguru',    location: 'Kahuro, Murang\'a',     lat: -0.65,  lng: 36.95 },
  { region: 'Region 2', name: 'Chinga',       location: 'Othaya, Nyeri',         lat: -0.55,  lng: 36.95 },
  { region: 'Region 2', name: 'Iriaini',      location: 'Othaya, Nyeri',         lat: -0.50,  lng: 37.00 },
  { region: 'Region 2', name: 'Gitugi',       location: 'Mathioya, Murang\'a',   lat: -0.65,  lng: 36.93 },
  { region: 'Region 2', name: 'Gathuthi',     location: 'Tetu, Nyeri',           lat: -0.45,  lng: 36.95 },
  { region: 'Region 2', name: 'Ragati',       location: 'Mathira, Nyeri',        lat: -0.40,  lng: 36.95 },

  // Region 3 — Kirinyaga / Embu
  { region: 'Region 3', name: 'Ndima',         location: 'Kerugoya, Kirinyaga',  lat: -0.48,  lng: 37.30 },
  { region: 'Region 3', name: 'Kangaita',      location: 'Kerugoya, Kirinyaga',  lat: -0.50,  lng: 37.30 },
  { region: 'Region 3', name: 'Mununga',       location: 'Kerugoya, Kirinyaga',  lat: -0.50,  lng: 37.35 },
  { region: 'Region 3', name: 'Kimunye',       location: 'Kerugoya, Kirinyaga',  lat: -0.49,  lng: 37.36 },
  { region: 'Region 3', name: 'Thumaita',      location: 'Kianyaga, Kirinyaga',  lat: -0.45,  lng: 37.35 },
  { region: 'Region 3', name: 'Kathangariri',  location: 'Embu',                  lat: -0.55,  lng: 37.55 },
  { region: 'Region 3', name: 'Mungania',      location: 'Manyatta, Embu',        lat: -0.55,  lng: 37.45 },
  { region: 'Region 3', name: 'Rukuriri',      location: 'Runyenjes, Embu',       lat: -0.50,  lng: 37.55 },

  // Region 4 — Meru / Tharaka-Nithi
  { region: 'Region 4', name: 'Weru',          location: 'Muthambi, Tharaka-Nithi', lat: -0.30, lng: 37.55 },
  { region: 'Region 4', name: 'Kinoro',        location: 'Imenti South, Meru',      lat:  0.00, lng: 37.65 },
  { region: 'Region 4', name: 'Kionyo',        location: 'Imenti South, Meru',      lat:  0.00, lng: 37.66 },
  { region: 'Region 4', name: 'Imenti',        location: 'Imenti Central, Meru',    lat:  0.05, lng: 37.65 },
  { region: 'Region 4', name: 'Githongo',      location: 'Imenti, Meru',            lat:  0.10, lng: 37.70 },
  { region: 'Region 4', name: 'Igembe',        location: 'Igembe South, Meru',      lat:  0.30, lng: 37.85 },
  { region: 'Region 4', name: 'Michimikuru',   location: 'Tigania East, Meru',      lat:  0.40, lng: 37.85 },
  { region: 'Region 4', name: 'Kiegoi',        location: 'Igembe, Meru',            lat:  0.30, lng: 37.86 },

  // Region 5 — Kericho / Bomet / Nakuru / Narok
  { region: 'Region 5', name: 'Toror',         location: 'Kericho',                 lat: -0.40, lng: 35.20 },
  { region: 'Region 5', name: 'Tegat',         location: 'Bureti, Kericho',         lat: -0.40, lng: 35.30 },
  { region: 'Region 5', name: 'Momul',         location: 'Bureti, Kericho',         lat: -0.41, lng: 35.30 },
  { region: 'Region 5', name: 'Litein',        location: 'Bureti, Kericho',         lat: -0.45, lng: 35.30 },
  { region: 'Region 5', name: 'Chelal',        location: 'Kericho',                 lat: -0.40, lng: 35.21 },
  { region: 'Region 5', name: 'Olenguruone',   location: 'Kuresoi, Nakuru',         lat: -0.55, lng: 35.70 },
  { region: 'Region 5', name: 'Kapkatet',      location: 'Bureti, Kericho',         lat: -0.50, lng: 35.30 },
  { region: 'Region 5', name: 'Tirgaga',       location: 'Bomet',                   lat: -0.85, lng: 35.35 },
  { region: 'Region 5', name: 'Kapkoros',      location: 'Bureti, Kericho',         lat: -0.50, lng: 35.31 },
  { region: 'Region 5', name: 'Tebesonik',     location: 'Kericho',                 lat: -0.50, lng: 35.32 },
  { region: 'Region 5', name: 'Motigo',        location: 'Bomet',                   lat: -0.85, lng: 35.30 },
  { region: 'Region 5', name: 'Boito',         location: 'Konoin, Bomet',           lat: -0.55, lng: 35.30 },
  { region: 'Region 5', name: 'Mogogosiek',    location: 'Konoin, Bomet',           lat: -0.55, lng: 35.31 },
  { region: 'Region 5', name: 'Kobel',         location: 'Kericho',                 lat: -0.45, lng: 35.20 },
  { region: 'Region 5', name: 'Kapset',        location: 'Kericho',                 lat: -0.45, lng: 35.25 },
  { region: 'Region 5', name: 'Rorok',         location: 'Kericho',                 lat: -0.40, lng: 35.31 },

  // Region 6 — Kisii / Nyamira
  { region: 'Region 6', name: 'Sanganyi',      location: 'Nyamira',                  lat: -0.55, lng: 34.85 },
  { region: 'Region 6', name: 'Tombe',         location: 'Nyamira',                  lat: -0.55, lng: 34.95 },
  { region: 'Region 6', name: 'Sombogo',       location: 'Nyamira',                  lat: -0.56, lng: 34.85 },
  { region: 'Region 6', name: 'Gianchore',     location: 'Nyamira',                  lat: -0.55, lng: 34.86 },
  { region: 'Region 6', name: 'Nyansiongo',    location: 'Borabu, Nyamira',          lat: -0.65, lng: 35.10 },
  { region: 'Region 6', name: 'Matunwa',       location: 'Nyamira',                  lat: -0.55, lng: 34.87 },
  { region: 'Region 6', name: 'Kebirigo',      location: 'West Mugirango, Nyamira',  lat: -0.65, lng: 34.95 },
  { region: 'Region 6', name: 'Nyankoba',      location: 'Keroka, Kisii',            lat: -0.75, lng: 34.85 },
  { region: 'Region 6', name: 'Itumbe',        location: 'Kisii',                    lat: -0.75, lng: 34.86 },
  { region: 'Region 6', name: 'Nyamache',      location: 'Bobasi, Kisii',            lat: -0.80, lng: 34.85 },
  { region: 'Region 6', name: 'Ogembo',        location: 'South Mugirango, Kisii',   lat: -0.80, lng: 34.75 },
  { region: 'Region 6', name: 'Eberege',       location: 'South Mugirango, Kisii',   lat: -0.85, lng: 34.75 },
  { region: 'Region 6', name: 'Kiamokama',     location: 'Keroka, Kisii',            lat: -0.65, lng: 34.95 },
  { region: 'Region 6', name: 'Rianyamwamu',   location: 'Keroka, Kisii',            lat: -0.75, lng: 34.86 },

  // Region 7 — Nandi / Kakamega / Vihiga / Trans-Nzoia
  { region: 'Region 7', name: 'Chebut',        location: 'Nandi East, Nandi',        lat:  0.10, lng: 35.10 },
  { region: 'Region 7', name: 'Kaptumo',       location: 'Nandi South, Nandi',       lat:  0.05, lng: 35.05 },
  { region: 'Region 7', name: 'Mudete',        location: 'Vihiga',                   lat:  0.05, lng: 34.70 },
  { region: 'Region 7', name: 'Kapsara',       location: 'Trans-Nzoia',              lat:  1.00, lng: 35.00 },
];

/** Andrew's monotone chain convex hull. Input/output: [lng, lat] points. */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = pts.length;
  if (n <= 1) return pts.slice();
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Inflate a hull outward by `padDeg` degrees from its centroid. Crude but
 *  good enough to ensure factory points sit strictly inside the polygon. */
function padHull(hull, padDeg) {
  const n = hull.length;
  if (n === 0) return hull;
  const cx = hull.reduce((s, p) => s + p[0], 0) / n;
  const cy = hull.reduce((s, p) => s + p[1], 0) / n;
  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * padDeg, y + (dy / d) * padDeg];
  });
}

/** A single point becomes a small square; two points become a rectangular strip. */
function fallbackHull(points) {
  if (points.length === 0) return [];
  const lats = points.map((p) => p[1]);
  const lngs = points.map((p) => p[0]);
  const minLat = Math.min(...lats) - 0.1;
  const maxLat = Math.max(...lats) + 0.1;
  const minLng = Math.min(...lngs) - 0.1;
  const maxLng = Math.max(...lngs) + 0.1;
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
  ];
}

function regionPolygon(factories) {
  const points = factories.map((f) => [f.lng, f.lat]);
  let hull = convexHull(points);
  if (hull.length < 3) hull = fallbackHull(points);
  else hull = padHull(hull, 0.08);
  // Close the ring per GeoJSON spec.
  return [...hull, [hull[0][0], hull[0][1]]];
}

async function run() {
  console.log(`[seed-ktda] connecting to ${MONGODB_URI.replace(/:\/\/[^@]*@/, '://***@')}`);
  await mongoose.connect(MONGODB_URI);

  // Group by region.
  const byRegion = FACTORIES.reduce((acc, f) => {
    (acc[f.region] = acc[f.region] || []).push(f);
    return acc;
  }, {});

  // 1. Upsert regions with computed polygons.
  for (const [name, factories] of Object.entries(byRegion)) {
    const ring = regionPolygon(factories);
    const centroidLat = factories.reduce((s, f) => s + f.lat, 0) / factories.length;
    const centroidLng = factories.reduce((s, f) => s + f.lng, 0) / factories.length;

    await RegionModel.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          isTest: false,
          coordinates: { lat: centroidLat, lng: centroidLng },
          boundary: { type: 'Polygon', coordinates: [ring] },
          soft_deleted: false,
        },
      },
      { upsert: true, new: true, collation: { locale: 'en', strength: 2 } },
    );
    console.log(`[seed-ktda] region ${name}: ${factories.length} factories, ${ring.length - 1} hull vertices`);
  }

  // 2. Upsert factories.
  for (const f of FACTORIES) {
    await FactoryModel.findOneAndUpdate(
      { name: f.name, location: f.location },
      {
        $set: {
          name: f.name,
          location: f.location,
          region: f.region,
          status: 'active',
          coordinates: { lat: f.lat, lng: f.lng },
          soft_deleted: false,
        },
      },
      { upsert: true, new: true },
    );
  }
  console.log(`[seed-ktda] upserted ${FACTORIES.length} factories`);

  await mongoose.disconnect();
  console.log('[seed-ktda] done');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[seed-ktda] failed:', err);
    process.exit(1);
  });
}

module.exports = { FACTORIES, run };
