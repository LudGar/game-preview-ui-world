import * as THREE from "three";

const WORLD_WIDTH_KM = 42315;
const WORLD_HEIGHT_KM = 18855;
const DEFAULT_KM_PER_PX = 15;
const METERS_PER_KM = 1000;

function getDistanceScaleKmPerPx(world) {
  const scale = Number(world?.settings?.distanceScale);
  return Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_KM_PER_PX;
}

function getWorldSizePxFromKm(world) {
  const kmPerPx = getDistanceScaleKmPerPx(world);
  return {
    width: Math.round(WORLD_WIDTH_KM / kmPerPx),
    height: Math.round(WORLD_HEIGHT_KM / kmPerPx),
  };
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

function computeBbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function makeMapSpaceConverters({ widthPx, heightPx, widthMeters, heightMeters }) {
  const halfWidth = widthMeters / 2;
  const halfHeight = heightMeters / 2;

  return {
    mapToPlane(x, y) {
      const px = (x / widthPx - 0.5) * widthMeters;
      const pz = (0.5 - y / heightPx) * heightMeters;
      return new THREE.Vector3(px, 0, pz);
    },
    planeToMap(x, z) {
      const mapX = ((x + halfWidth) / widthMeters) * widthPx;
      const mapY = ((halfHeight - z) / heightMeters) * heightPx;
      return {
        x: THREE.MathUtils.clamp(mapX, 0, widthPx),
        y: THREE.MathUtils.clamp(mapY, 0, heightPx),
      };
    },
    clampPlanePosition(v) {
      v.x = THREE.MathUtils.clamp(v.x, -halfWidth, halfWidth);
      v.z = THREE.MathUtils.clamp(v.z, -halfHeight, halfHeight);
      return v;
    },
  };
}

function parseBiomePalette(world) {
  const colors = Array.isArray(world?.biomesData?.color) ? world.biomesData.color : [];
  const palette = new Map();
  colors.forEach((hex, index) => {
    if (typeof hex !== "string") return;
    const color = new THREE.Color(hex);
    if (!Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) return;
    palette.set(index, color);
  });
  return palette;
}

function colorForCell({ isLand, biomeColor, elevation }) {
  const base = biomeColor ? biomeColor.clone() : new THREE.Color(isLand ? 0x2a5a2f : 0x18436a);
  const normalizedElevation = THREE.MathUtils.clamp((elevation - 18) / 82, 0, 1);
  const lightenFactor = isLand ? 0.20 + normalizedElevation * 0.35 : 0.12 + normalizedElevation * 0.15;
  return base.lerp(new THREE.Color(0xffffff), lightenFactor);
}

function yForCell({ isLand, elevation }) {
  if (!isLand) return -1.2 + THREE.MathUtils.clamp((elevation - 5) * 0.03, -0.8, 0.3);
  const normalizedElevation = THREE.MathUtils.clamp((elevation - 20) / 80, 0, 1);
  return 0.35 + normalizedElevation * 3.2;
}

export async function buildWorldFromAzgaar({ scene, url, layer = 0 }) {
  const res = await fetch(encodeURI(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`[WorldBuilder] Failed to load world JSON: ${res.status}`);

  const world = await res.json();
  const pack = world?.pack;
  const vertices = Array.isArray(pack?.vertices) ? pack.vertices : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];
  const biomePalette = parseBiomePalette(world);

  const fallbackSize = getWorldSizePxFromKm(world);
  const widthPx = Number(world?.info?.width || fallbackSize.width);
  const heightPx = Number(world?.info?.height || fallbackSize.height);

  const kmPerPx = getDistanceScaleKmPerPx(world);
  const metersPerPx = kmPerPx * METERS_PER_KM;
  const mapWidthMeters = widthPx * metersPerPx;
  const mapHeightMeters = heightPx * metersPerPx;

  const converters = makeMapSpaceConverters({
    widthPx,
    heightPx,
    widthMeters: mapWidthMeters,
    heightMeters: mapHeightMeters,
  });

  const worldRoot = new THREE.Group();
  worldRoot.name = "generatedWorld";
  worldRoot.layers.set(layer);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(mapWidthMeters, mapHeightMeters, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0b1d36, roughness: 0.92, metalness: 0.04 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -2;
  worldRoot.add(ocean);

  const loadedCellGroup = new THREE.Group();
  worldRoot.add(loadedCellGroup);

  const cellData = [];

  for (let idx = 0; idx < cells.length; idx += 1) {
    const cell = cells[idx];
    if (!cell || !Array.isArray(cell.v) || cell.v.length < 3) continue;

    const mapPolygon = polygonPointsFromCell(cell, vertices);
    if (!mapPolygon) continue;

    const planePolygon = mapPolygon.map((p) => {
      const plane = converters.mapToPlane(p.x, p.y);
      return new THREE.Vector2(plane.x, plane.z);
    });

    const center = converters.mapToPlane(Number(cell.p?.[0] || mapPolygon[0].x), Number(cell.p?.[1] || mapPolygon[0].y));

    const planeBbox = computeBbox(planePolygon);

    cellData[idx] = {
      index: idx,
      mapPolygon,
      planePolygon,
      bbox: computeBbox(mapPolygon),
      planeBbox,
      neighbors: Array.isArray(cell.c) ? cell.c.filter((c) => Number.isInteger(c) && c >= 0) : [],
      isLand: Number(cell.h || 0) > 19,
      biome: Number.isInteger(cell.biome) ? cell.biome : -1,
      elevation: Number(cell.h || 0),
      center,
    };
  }

  const settlementByCell = new Map();
  const settlementPositions = [];
  for (const b of burgs) {
    if (!b || b.removed || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    const cellIndex = Number.isInteger(b.cell) ? b.cell : null;
    if (cellIndex == null || cellIndex < 0) continue;

    const list = settlementByCell.get(cellIndex) || [];
    list.push(b);
    settlementByCell.set(cellIndex, list);

    const pos = converters.mapToPlane(b.x, b.y);
    settlementPositions.push({
      name: b.name || "Settlement",
      isCapital: !!b.capital,
      population: Number(b.population || 0),
      position: new THREE.Vector3(pos.x, 0, pos.z),
    });
  }

  const markerGeo = new THREE.SphereGeometry(1000, 12, 12);
  const mats = {
    capital: new THREE.MeshStandardMaterial({ color: 0xffcf66, emissive: 0x442200, emissiveIntensity: 0.25 }),
    city: new THREE.MeshStandardMaterial({ color: 0xa8d8ff }),
    town: new THREE.MeshStandardMaterial({ color: 0xb6c8a8 }),
  };

  function createCellVisual(cellIndex) {
    const data = cellData[cellIndex];
    if (!data) return null;

    const shape = new THREE.Shape(data.planePolygon);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);

    const fill = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: colorForCell({
          isLand: data.isLand,
          biomeColor: biomePalette.get(data.biome) || null,
          elevation: data.elevation,
        }),
        transparent: true,
        opacity: data.isLand ? 0.94 : 0.74,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    fill.position.y = yForCell(data);

    const borderHeight = fill.position.y + (data.isLand ? 0.4 : 0.25);
    const ringPoints = data.planePolygon.map((p) => new THREE.Vector3(p.x, borderHeight, p.y));
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      new THREE.LineBasicMaterial({ color: data.isLand ? 0xe2f5de : 0x84bddf, transparent: true, opacity: 0.38 })
    );

    const node = new THREE.Group();
    node.add(fill);
    node.add(border);

    const localBurgs = settlementByCell.get(cellIndex) || [];
    for (const b of localBurgs) {
      const pop = Number(b.population || 0);
      const mat = b.capital ? mats.capital : pop >= 5 ? mats.city : mats.town;
      const pos = converters.mapToPlane(b.x, b.y);
      const marker = new THREE.Mesh(markerGeo, mat);
      marker.position.set(pos.x, 1200, pos.z);
      node.add(marker);
    }

    return { node, geometry: geo, borderGeometry: border.geometry };
  }

  let activeCellIndex = -1;

  for (let idx = 0; idx < cellData.length; idx += 1) {
    const visual = createCellVisual(idx);
    if (!visual) continue;
    loadedCellGroup.add(visual.node);
  }

  function findCellByMapPoint(x, y) {
    const tryIndices = [];
    if (activeCellIndex >= 0) {
      tryIndices.push(activeCellIndex);
      const active = cellData[activeCellIndex];
      if (active) tryIndices.push(...active.neighbors);
    }

    for (const index of tryIndices) {
      const data = cellData[index];
      if (!data) continue;
      if (x < data.bbox.minX || x > data.bbox.maxX || y < data.bbox.minY || y > data.bbox.maxY) continue;
      if (pointInPolygon({ x, y }, data.mapPolygon)) return index;
    }

    for (let idx = 0; idx < cellData.length; idx += 1) {
      const data = cellData[idx];
      if (!data) continue;
      if (x < data.bbox.minX || x > data.bbox.maxX || y < data.bbox.minY || y > data.bbox.maxY) continue;
      if (pointInPolygon({ x, y }, data.mapPolygon)) return idx;
    }

    return -1;
  }

  function setActiveCellFromPlanePosition(position) {
    const map = converters.planeToMap(position.x, position.z);
    const nextActive = findCellByMapPoint(map.x, map.y);
    if (nextActive < 0) return;

    activeCellIndex = nextActive;
  }

  function getCellViewForPlanePosition(position) {
    const map = converters.planeToMap(position.x, position.z);
    const index = findCellByMapPoint(map.x, map.y);
    if (index < 0) return null;

    const cell = cellData[index];
    if (!cell) return null;

    const spanX = Math.max(1, cell.planeBbox.maxX - cell.planeBbox.minX);
    const spanZ = Math.max(1, cell.planeBbox.maxY - cell.planeBbox.minY);

    return {
      index,
      center: cell.center.clone(),
      spanX,
      spanZ,
      radius: Math.hypot(spanX, spanZ) * 0.5,
    };
  }

  scene.add(worldRoot);

  return {
    world,
    worldPlane: {
      widthMeters: mapWidthMeters,
      heightMeters: mapHeightMeters,
      metersPerPx,
    },
    mapSpace: {
      width: widthPx,
      height: heightPx,
      mapToPlane: converters.mapToPlane,
      planeToMap: converters.planeToMap,
      clampPlanePosition: converters.clampPlanePosition,
    },
    getActiveCellIndex: () => activeCellIndex,
    setActiveCellFromPlanePosition,
    getCellViewForPlanePosition,
    settlementPositions,
    cleanup() {
      scene.remove(worldRoot);
      worldRoot.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      markerGeo.dispose();
      mats.capital.dispose();
      mats.city.dispose();
      mats.town.dispose();
    },
  };
}
