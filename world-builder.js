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

function pushCellTriangles({ positions, colors, polygon, y, color }) {
  if (!Array.isArray(polygon) || polygon.length < 3) return;
  const triangles = THREE.ShapeUtils.triangulateShape(polygon, []);
  for (const tri of triangles) {
    for (const vertIndex of tri) {
      const p = polygon[vertIndex];
      positions.push(p.x, y, p.y);
      colors.push(color.r, color.g, color.b);
    }
  }
}

function makeTerrainMesh({ positions, colors, material }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function pushRoadSegmentQuad({ positions, start, end, halfWidth, y }) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.001) return;

  const nx = -dz / length;
  const nz = dx / length;

  const sLeft = { x: start.x + nx * halfWidth, z: start.z + nz * halfWidth };
  const sRight = { x: start.x - nx * halfWidth, z: start.z - nz * halfWidth };
  const eLeft = { x: end.x + nx * halfWidth, z: end.z + nz * halfWidth };
  const eRight = { x: end.x - nx * halfWidth, z: end.z - nz * halfWidth };

  positions.push(
    sLeft.x,
    y,
    sLeft.z,
    sRight.x,
    y,
    sRight.z,
    eLeft.x,
    y,
    eLeft.z,
    sRight.x,
    y,
    sRight.z,
    eRight.x,
    y,
    eRight.z,
    eLeft.x,
    y,
    eLeft.z
  );
}

function getRoadPointHeightMeters(point, cells) {
  if (!Array.isArray(point)) return 1.8;

  const cellIndex = Number.isInteger(point[2]) ? point[2] : -1;
  const cell = cellIndex >= 0 ? cells?.[cellIndex] : null;
  if (!cell) return 1.8;

  const isLand = Number(cell.h || 0) > 19;
  return yForCell({
    isLand,
    elevation: Number(cell.h || 0),
  }) + 0.75;
}

function makeRoadMesh({ routes, cells, converters, widthMeters = 12 }) {
  if (!Array.isArray(routes) || routes.length === 0) return null;

  const positions = [];
  const halfWidth = Math.max(1, widthMeters * 0.5);
  const roadY = 1.4;

  for (const route of routes) {
    if (!route || route.group !== "roads" || !Array.isArray(route.points) || route.points.length < 2) continue;
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const a = route.points[i];
      const b = route.points[i + 1];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const start = converters.mapToPlane(Number(a[0]), Number(a[1]));
      const end = converters.mapToPlane(Number(b[0]), Number(b[1]));
      const segmentY = Math.max(getRoadPointHeightMeters(a, cells), getRoadPointHeightMeters(b, cells), roadY);
      pushRoadSegmentQuad({ positions, start, end, halfWidth, y: segmentY });
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x685f56,
    roughness: 0.97,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

function getRiverPointHeightMeters(cell) {
  if (!cell) return 0.4;
  const isLand = Number(cell.h || 0) > 19;
  return yForCell({
    isLand,
    elevation: Number(cell.h || 0),
  }) + 0.45;
}

function makeRiverMesh({ rivers, cells, converters }) {
  if (!Array.isArray(rivers) || rivers.length === 0) return null;

  const positions = [];

  for (const river of rivers) {
    if (!river || !Array.isArray(river.cells) || river.cells.length < 2) continue;

    const riverWidthKm = Number(river.width || 0.08);
    const widthMeters = THREE.MathUtils.clamp(riverWidthKm * METERS_PER_KM, 40, 850);
    const halfWidth = widthMeters * 0.5;

    for (let i = 0; i < river.cells.length - 1; i += 1) {
      const aCell = cells?.[river.cells[i]];
      const bCell = cells?.[river.cells[i + 1]];
      const aPos = aCell?.p;
      const bPos = bCell?.p;
      if (!Array.isArray(aPos) || !Array.isArray(bPos)) continue;

      const start = converters.mapToPlane(Number(aPos[0]), Number(aPos[1]));
      const end = converters.mapToPlane(Number(bPos[0]), Number(bPos[1]));
      const segmentY = Math.max(getRiverPointHeightMeters(aCell), getRiverPointHeightMeters(bCell));
      pushRoadSegmentQuad({ positions, start, end, halfWidth, y: segmentY });
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x4fa9df,
    roughness: 0.3,
    metalness: 0.02,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export async function buildWorldFromAzgaar({ scene, url, layer = 0 }) {
  const res = await fetch(encodeURI(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`[WorldBuilder] Failed to load world JSON: ${res.status}`);

  const world = await res.json();
  const pack = world?.pack;
  const vertices = Array.isArray(pack?.vertices) ? pack.vertices : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];
  const routes = Array.isArray(pack?.routes) ? pack.routes : [];
  const rivers = Array.isArray(pack?.rivers) ? pack.rivers : [];
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

  let activeCellIndex = -1;

  const terrainMaterials = {
    land: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
    }),
    water: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.02,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    }),
  };

  const borderMaterials = {
    land: new THREE.LineBasicMaterial({ color: 0xe2f5de, transparent: true, opacity: 0.38 }),
  };

  const landPositions = [];
  const landColors = [];
  const waterPositions = [];
  const waterColors = [];
  for (let idx = 0; idx < cellData.length; idx += 1) {
    const data = cellData[idx];
    if (!data) continue;

    const color = colorForCell({
      isLand: data.isLand,
      biomeColor: biomePalette.get(data.biome) || null,
      elevation: data.elevation,
    });

    if (data.isLand) {
      pushCellTriangles({
        positions: landPositions,
        colors: landColors,
        polygon: data.planePolygon,
        y: yForCell(data),
        color,
      });
    } else {
      pushCellTriangles({
        positions: waterPositions,
        colors: waterColors,
        polygon: data.planePolygon,
        y: yForCell(data),
        color,
      });
      continue;
    }

    const borderHeight = yForCell(data) + (data.isLand ? 0.4 : 0.25);
    const ringPoints = data.planePolygon.map((p) => new THREE.Vector3(p.x, borderHeight, p.y));
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      borderMaterials.land
    );
    loadedCellGroup.add(border);

    const localBurgs = settlementByCell.get(idx) || [];
    for (const b of localBurgs) {
      const pop = Number(b.population || 0);
      const mat = b.capital ? mats.capital : pop >= 5 ? mats.city : mats.town;
      const pos = converters.mapToPlane(b.x, b.y);
      const marker = new THREE.Mesh(markerGeo, mat);
      marker.position.set(pos.x, 1200, pos.z);
      loadedCellGroup.add(marker);
    }
  }

  if (landPositions.length > 0) {
    loadedCellGroup.add(makeTerrainMesh({ positions: landPositions, colors: landColors, material: terrainMaterials.land }));
  }
  if (waterPositions.length > 0) {
    loadedCellGroup.add(makeTerrainMesh({ positions: waterPositions, colors: waterColors, material: terrainMaterials.water }));
  }

  const riversMesh = makeRiverMesh({ rivers, cells, converters });
  if (riversMesh) loadedCellGroup.add(riversMesh);

  const roadsMesh = makeRoadMesh({ routes, cells, converters, widthMeters: 12 });
  if (roadsMesh) loadedCellGroup.add(roadsMesh);

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
      terrainMaterials.land.dispose();
      terrainMaterials.water.dispose();
      borderMaterials.land.dispose();
    },
  };
}
