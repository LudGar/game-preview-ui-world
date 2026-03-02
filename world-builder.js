import * as THREE from "three";

function mapToSphere(x, y, { width, height, radius, center }) {
  const u = x / width;
  const v = y / height;

  const lon = (u - 0.5) * Math.PI * 2;
  const lat = (0.5 - v) * Math.PI;

  const cosLat = Math.cos(lat);
  const px = center.x + radius * cosLat * Math.cos(lon);
  const py = center.y + radius * Math.sin(lat);
  const pz = center.z + radius * cosLat * Math.sin(lon);
  return new THREE.Vector3(px, py, pz);
}

function polygonPointsFromFeature(feature, vertices) {
  const points = [];
  for (const vi of feature.vertices || []) {
    const p = vertices?.[vi]?.p;
    if (!Array.isArray(p) || p.length < 2) continue;
    points.push(new THREE.Vector2(p[0], p[1]));
  }
  return points.length >= 3 ? points : null;
}

function polygonPointsFromCell(cell, vertices) {
  const points = [];
  for (const vi of cell.v || []) {
    const p = vertices?.[vi]?.p;
    if (!Array.isArray(p) || p.length < 2) continue;
    points.push(new THREE.Vector2(p[0], p[1]));
  }
  return points.length >= 3 ? points : null;
}

function buildSphericalLandGeometry(points2D, info, elevation = 0.08) {
  const triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
  if (!triangles.length) return null;

  const radius = info.radius + elevation;
  const positions = [];
  const normals = [];

  for (const tri of triangles) {
    for (const idx of tri) {
      const p = points2D[idx];
      const v = mapToSphere(p.x, p.y, { ...info, radius });
      positions.push(v.x, v.y, v.z);

      const n = v.clone().sub(info.center).normalize();
      normals.push(n.x, n.y, n.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export async function buildWorldFromAzgaar({ scene, url, layer = 0 }) {
  const res = await fetch(encodeURI(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`[WorldBuilder] Failed to load world JSON: ${res.status}`);

  const world = await res.json();
  const pack = world?.pack;
  const features = Array.isArray(pack?.features) ? pack.features : [];
  const vertices = Array.isArray(pack?.vertices) ? pack.vertices : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];

  const info = {
    width: Number(world?.info?.width || 1400),
    height: Number(world?.info?.height || 900),
    radius: 12,
    center: new THREE.Vector3(0, -12.5, 0),
  };

  const worldRoot = new THREE.Group();
  worldRoot.name = "generatedWorld";
  worldRoot.layers.set(layer);

  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0b1d36,
    roughness: 0.9,
    metalness: 0.05,
  });
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(info.radius, 96, 64), oceanMat);
  ocean.position.copy(info.center);
  worldRoot.add(ocean);

  const landGroup = new THREE.Group();
  const coastGroup = new THREE.Group();
  const cellGroup = new THREE.Group();
  const burgGroup = new THREE.Group();

  const landMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2f, roughness: 0.96, metalness: 0.03 });
  const coastMat = new THREE.LineBasicMaterial({ color: 0xc8e5cf, transparent: true, opacity: 0.7 });
  const cellLandMat = new THREE.LineBasicMaterial({ color: 0x91b29a, transparent: true, opacity: 0.25 });
  const cellWaterMat = new THREE.LineBasicMaterial({ color: 0x6ea9d3, transparent: true, opacity: 0.12 });

  const landFeatures = features
    .filter((f) => f?.land && Array.isArray(f?.vertices) && f.vertices.length > 2)
    .slice(0, 320);

  for (const f of landFeatures) {
    const points2D = polygonPointsFromFeature(f, vertices);
    if (!points2D) continue;

    const landGeo = buildSphericalLandGeometry(points2D, info, 0.09);
    if (!landGeo) continue;
    landGroup.add(new THREE.Mesh(landGeo, landMat));

    const coastPoints = points2D.map((p) => mapToSphere(p.x, p.y, { ...info, radius: info.radius + 0.12 }));
    const coastGeo = new THREE.BufferGeometry().setFromPoints(coastPoints);
    coastGroup.add(new THREE.LineLoop(coastGeo, coastMat));
  }

  for (const cell of cells) {
    if (!cell || !Array.isArray(cell.v) || cell.v.length < 3) continue;

    const points2D = polygonPointsFromCell(cell, vertices);
    if (!points2D) continue;

    const elev = Number(cell.h || 0) > 19 ? 0.11 : 0.05;
    const cellPoints = points2D.map((p) => mapToSphere(p.x, p.y, { ...info, radius: info.radius + elev }));
    const cellGeo = new THREE.BufferGeometry().setFromPoints(cellPoints);
    const cellIsLand = Number(cell.h || 0) > 19;
    cellGroup.add(new THREE.LineLoop(cellGeo, cellIsLand ? cellLandMat : cellWaterMat));
  }

  const capitalMat = new THREE.MeshStandardMaterial({ color: 0xffcf66, emissive: 0x442200, emissiveIntensity: 0.25 });
  const cityMat = new THREE.MeshStandardMaterial({ color: 0xa8d8ff });
  const townMat = new THREE.MeshStandardMaterial({ color: 0xb6c8a8 });

  const markerGeo = new THREE.SphereGeometry(0.08, 10, 8);
  for (const b of burgs) {
    if (!b || b.removed || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;

    const pop = Number(b.population || 0);
    const mat = b.capital ? capitalMat : pop >= 5 ? cityMat : townMat;
    const base = mapToSphere(b.x, b.y, { ...info, radius: info.radius + 0.2 });

    const marker = new THREE.Mesh(markerGeo, mat);
    marker.position.copy(base);
    burgGroup.add(marker);
  }

  worldRoot.add(landGroup);
  worldRoot.add(cellGroup);
  worldRoot.add(coastGroup);
  worldRoot.add(burgGroup);
  scene.add(worldRoot);

  return {
    world,
    cleanup() {
      scene.remove(worldRoot);
      worldRoot.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    },
  };
}
