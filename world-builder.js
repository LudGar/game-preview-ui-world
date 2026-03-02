import * as THREE from "three";

function toWorldXY(x, y, { width, height, scale }) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  return new THREE.Vector2((x - cx) * scale, (cy - y) * scale);
}

function makeLandShape(feature, vertices, info) {
  const pts = [];
  for (const vi of feature.vertices || []) {
    const p = vertices?.[vi]?.p;
    if (!Array.isArray(p) || p.length < 2) continue;
    pts.push(toWorldXY(p[0], p[1], info));
  }
  if (pts.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
  shape.closePath();
  return { shape, pts };
}

export async function buildWorldFromAzgaar({ scene, url, layer = 0 }) {
  const res = await fetch(encodeURI(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`[WorldBuilder] Failed to load world JSON: ${res.status}`);

  const world = await res.json();
  const pack = world?.pack;
  const features = Array.isArray(pack?.features) ? pack.features : [];
  const vertices = Array.isArray(pack?.vertices) ? pack.vertices : [];
  const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];

  const info = {
    width: Number(world?.info?.width || 1400),
    height: Number(world?.info?.height || 900),
    scale: 0.02,
  };

  const worldRoot = new THREE.Group();
  worldRoot.name = "generatedWorld";
  worldRoot.layers.set(layer);

  const waterGeo = new THREE.PlaneGeometry(info.width * info.scale, info.height * info.scale);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0b1828,
    roughness: 0.9,
    metalness: 0.0,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.04;
  worldRoot.add(water);

  const landGroup = new THREE.Group();
  const coastGroup = new THREE.Group();
  const burgGroup = new THREE.Group();

  const landMat = new THREE.MeshStandardMaterial({ color: 0x1d3a22, roughness: 0.98, metalness: 0.02 });
  const coastMat = new THREE.LineBasicMaterial({ color: 0x8db59d, transparent: true, opacity: 0.6 });

  const landFeatures = features.filter((f) => f?.land && Array.isArray(f?.vertices) && f.vertices.length > 2).slice(0, 240);
  for (const f of landFeatures) {
    const built = makeLandShape(f, vertices, info);
    if (!built) continue;

    const landGeo = new THREE.ShapeGeometry(built.shape);
    const landMesh = new THREE.Mesh(landGeo, landMat);
    landMesh.rotation.x = -Math.PI / 2;
    landMesh.position.y = 0.0;
    landGroup.add(landMesh);

    const coastGeo = new THREE.BufferGeometry().setFromPoints(
      built.pts.map((p) => new THREE.Vector3(p.x, 0.01, p.y))
    );
    const coastLine = new THREE.LineLoop(coastGeo, coastMat);
    coastGroup.add(coastLine);
  }

  const capitalMat = new THREE.MeshStandardMaterial({ color: 0xffcf66, emissive: 0x442200, emissiveIntensity: 0.2 });
  const cityMat = new THREE.MeshStandardMaterial({ color: 0xa8d8ff });
  const townMat = new THREE.MeshStandardMaterial({ color: 0xb6c8a8 });

  const markerGeo = new THREE.SphereGeometry(0.07, 10, 8);
  for (const b of burgs) {
    if (!b || b.removed || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    const pos = toWorldXY(b.x, b.y, info);
    const pop = Number(b.population || 0);
    const mat = b.capital ? capitalMat : pop >= 5 ? cityMat : townMat;

    const marker = new THREE.Mesh(markerGeo, mat);
    marker.position.set(pos.x, 0.08, pos.y);
    burgGroup.add(marker);
  }

  worldRoot.add(landGroup);
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
