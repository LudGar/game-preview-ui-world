import * as THREE from "three";

/* ── visual palette ────────────────────────────────────── */
const PALETTE = {
  earth:     0xd4c2a0,
  water:     0x4a8fbf,
  fields:    0x8aaa5e,
  greens:    0x5e9448,
  squares:   0xb0a480,
  buildings: 0xbcac9a,
  prisms:    0x9a8878,   // citadel / important structures
  roads:     0x7a6e5e,
  walls:     0x9e9080,
  rivers:    0x4a8fbf,
};

/* ── terrain lift ────────────────────────────────────────
   Lifts the city group above terrain surface.
   With depthTest:false all city layers unconditionally overdraw
   terrain, so only a small lift is needed to stay above the mesh. */
const CITY_TERRAIN_LIFT = 0.5;

/* ── Y offsets (within group) ───────────────────────────
   Small steps suffice — depthTest:false + renderOrder handles
   layer ordering without needing large physical separation. */
const LAYER_Y = {
  water:      0.00,
  earth:      0.04,
  fields:     0.08,
  greens:     0.12,
  squares:    0.16,
  buildings:  0.20,
  prisms:     0.28,
  rivers:     0.02,
  roads:      0.24,
  walls:      0.32,
};

/* ── geometry helpers ────────────────────────────────── */

/** MFCG (x, y) → world (wx, wz).  Y-axis is unchanged here;
    the group itself sits on the XZ plane so Y becomes Z. */
function mfcgToWorld(x, y, scale) {
  return [x * scale, y * scale];
}

/** Triangulate a single closed ring [[x,y]…] into flat positions. */
function triRing(ring, scale, yOff) {
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const pts = ring.map(([x, y]) => {
    const [wx, wz] = mfcgToWorld(x, y, scale);
    return new THREE.Vector2(wx, wz);
  });
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(pts, []);
  } catch {
    return [];
  }
  const pos = [];
  for (const [a, b, c] of tris) {
    pos.push(pts[a].x, yOff, pts[a].y);
    pos.push(pts[b].x, yOff, pts[b].y);
    pos.push(pts[c].x, yOff, pts[c].y);
  }
  return pos;
}

/** Triangulate a MultiPolygon (outer rings only for now). */
function triMultiPoly(multiCoords, scale, yOff) {
  const pos = [];
  for (const rings of multiCoords) {
    if (Array.isArray(rings[0])) pos.push(...triRing(rings[0], scale, yOff));
  }
  return pos;
}

/** Extrude a LineString [[x,y]…] into a flat quad strip of given half-width. */
function extrudeLine(coords, halfWidth, scale, yOff) {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const pts = coords.map(([x, y]) => {
    const [wx, wz] = mfcgToWorld(x, y, scale);
    return { x: wx, z: wz };
  });
  const hw = halfWidth * scale;
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) continue;
    const nx = -dz / len, nz = dx / len;
    const aL = { x: a.x + nx * hw, z: a.z + nz * hw };
    const aR = { x: a.x - nx * hw, z: a.z - nz * hw };
    const bL = { x: b.x + nx * hw, z: b.z + nz * hw };
    const bR = { x: b.x - nx * hw, z: b.z - nz * hw };
    pos.push(
      aL.x, yOff, aL.z,  aR.x, yOff, aR.z,  bL.x, yOff, bL.z,
      aR.x, yOff, aR.z,  bR.x, yOff, bR.z,  bL.x, yOff, bL.z,
    );
  }
  return pos;
}

/* renderOrder for each layer — city always overdraws terrain (depthTest:false),
   order here determines which city layer wins at overlapping pixels. */
const RENDER_ORDER = {
  water:      5,
  rivers:     6,
  earth:      7,
  fields:     8,
  greens:     9,
  squares:   10,
  buildings: 11,
  roads:     12,
  prisms:    13,
  walls:     14,
};

function makeMesh(positions, color, layer, renderOrder = 5) {
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.90,
    metalness: 0.00,
    side: THREE.DoubleSide,
    depthTest: false,   // always overdraw terrain regardless of depth precision
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(layer);
  mesh.renderOrder = renderOrder;
  return mesh;
}

/* ── main export ─────────────────────────────────────── */

/**
 * Build a Three.js Group from an MFCG GeoJSON city export.
 *
 * @param {object}        cityJson         - Parsed JSON from MFCG JsonExporter
 * @param {object}        opts
 * @param {THREE.Vector3} opts.worldPos    - Burg world-space position (XZ plane)
 * @param {number}       [opts.scale=1]   - MFCG units → world metres (1:1 default)
 * @param {number}       [opts.baseY=0.35]- Ground Y at the burg (terrain height)
 * @param {number}       [opts.layer=0]   - THREE.Layers value
 * @returns {{ group: THREE.Group, cleanup: () => void }}
 */
export function buildCityFromMfcgJson(cityJson, {
  worldPos,
  scale  = 1.0,
  baseY  = 0.35,
  layer  = 0,
} = {}) {
  // Index features by id
  const feat = {};
  for (const f of (cityJson?.features ?? [])) {
    if (f.id) feat[f.id] = f;
  }
  if (window.__cityDebug) window.__cityDebug.featIds = Object.keys(feat);

  const group = new THREE.Group();
  group.name = "mfcgCity";
  group.position.set(worldPos.x, baseY + CITY_TERRAIN_LIFT, worldPos.z);
  group.layers.set(layer);

  /* helper: add a Polygon / MultiPolygon layer.
     Handles both bare geometry objects and GeoJSON Feature wrappers. */
  function addPoly(id) {
    const f = feat[id];
    if (!f) return;
    const geom = (f.type === "Feature" && f.geometry) ? f.geometry : f;
    const yOff = LAYER_Y[id] ?? 0.10;
    let pos = [];
    if (geom.type === "Polygon") {
      pos = triRing(geom.coordinates[0], scale, yOff);
    } else if (geom.type === "MultiPolygon") {
      pos = triMultiPoly(geom.coordinates, scale, yOff);
    }
    const mesh = makeMesh(pos, PALETTE[id] ?? 0x888888, layer, RENDER_ORDER[id] ?? 5);
    if (mesh) group.add(mesh);
  }

  /* helper: add a GeometryCollection of LineStrings / Polygons.
     For line features (roads, rivers) Polygon sub-geometries are filled.
     For wall features, Polygon rings are extruded as closed line strips
     so the wall appears as an outline rather than a filled disc. */
  function addLines(id, polygonAsLine = false) {
    const f = feat[id];
    if (!f) return;
    const geom = (f.type === "Feature" && f.geometry) ? f.geometry : f;
    const geometries = geom.geometries ?? [];
    if (!geometries.length) return;
    const yOff = LAYER_Y[id] ?? 0.10;
    const pos = [];
    for (const g of geometries) {
      if (g.type === "LineString") {
        pos.push(...extrudeLine(g.coordinates, (g.width ?? 8) / 2, scale, yOff));
      } else if (g.type === "Polygon") {
        if (polygonAsLine) {
          // Extrude each ring as a closed line strip (e.g. wall outline)
          for (const ring of g.coordinates) {
            if (ring.length >= 2) {
              pos.push(...extrudeLine([...ring, ring[0]], (g.width ?? 8) / 2, scale, yOff));
            }
          }
        } else {
          pos.push(...triRing(g.coordinates[0], scale, yOff));
        }
      }
    }
    const mesh = makeMesh(pos, PALETTE[id] ?? 0x888888, layer, RENDER_ORDER[id] ?? 5);
    if (mesh) group.add(mesh);
  }

  // Render back-to-front (lower Y layers first)
  addPoly("water");
  addPoly("earth");
  addPoly("fields");
  addPoly("greens");
  addPoly("squares");
  addPoly("buildings");
  addPoly("prisms");
  addLines("rivers");
  addLines("roads");
  addLines("walls", true);  // walls are ring outlines, not filled polygons

  if (window.__cityDebug) {
    window.__cityDebug.meshCount = group.children.length;
    window.__cityDebug.groupPos = { x: group.position.x, y: group.position.y, z: group.position.z };
  }

  return {
    group,
    cleanup() {
      group.traverse((obj) => {
        obj.geometry?.dispose();
        if (obj.material) {
          Array.isArray(obj.material)
            ? obj.material.forEach((m) => m.dispose?.())
            : obj.material.dispose?.();
        }
      });
    },
  };
}
