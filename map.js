import { createTooltip } from "./tooltip.js";
import { loadAllCachedBurgs } from "./burgs-store.js";

function htmlEscape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ── City overlay helpers (module-level, pure) ─────────────────────────────

/** Collect all [x,y] points from a GeoJSON geometry (Polygon/MultiPolygon/GeometryCollection). */
function collectPolyPoints(geom) {
  const type = geom?.type;
  if (type === "Polygon")      return (geom.coordinates ?? []).flat(1);
  if (type === "MultiPolygon") return (geom.coordinates ?? []).flat(2);
  if (type === "GeometryCollection") {
    const pts = [];
    for (const g of (geom.geometries ?? [])) pts.push(...collectPolyPoints(g));
    return pts;
  }
  return [];
}

/** Convert a GeoJSON ring [[x,y]...] to an SVG path fragment.
 *  Coords are MFCG metres; converted to Azgaar pixels via bx + x/mpp. */
function cityRingToD(ring, bx, by, mpp) {
  if (!ring || ring.length < 3) return "";
  return ring.map((p, i) =>
    `${i === 0 ? "M" : "L"}${(bx + p[0] / mpp).toFixed(4)},${(by + p[1] / mpp).toFixed(4)}`
  ).join(" ") + " Z";
}

/** Polygon or MultiPolygon geometry -> SVG path d attribute string. */
function cityPolyToD(geom, bx, by, mpp) {
  const type = geom?.type;
  if (type === "Polygon") {
    return (geom.coordinates ?? []).map(r => cityRingToD(r, bx, by, mpp)).join(" ");
  }
  if (type === "MultiPolygon") {
    return (geom.coordinates ?? []).flatMap(poly =>
      poly.map(r => cityRingToD(r, bx, by, mpp))
    ).join(" ");
  }
  return "";
}

/** LineString coords array -> SVG path d attribute string (open, no Z). */
function cityLineToD(coords, bx, by, mpp) {
  if (!coords || coords.length < 2) return "";
  return coords.map((p, i) =>
    `${i === 0 ? "M" : "L"}${(bx + p[0] / mpp).toFixed(4)},${(by + p[1] / mpp).toFixed(4)}`
  ).join(" ");
}

/** Unwrap GeoJSON Feature to its geometry, or return bare geometry as-is. */
function cityFeatGeom(f) {
  return (f?.type === "Feature" && f.geometry) ? f.geometry : f;
}

/** Build a {id -> feature} lookup from a city GeoJSON FeatureCollection. */
function indexCityFeatures(cityJson) {
  const feat = {};
  for (const f of (cityJson?.features ?? [])) {
    if (f.id) feat[f.id] = f;
  }
  return feat;
}

const CITY_PALETTE = {
  water:     "#4a8fbf",
  rivers:    "#5a9fca",
  earth:     "#d4c2a0",
  fields:    "#8aaa5e",
  greens:    "#5e9448",
  squares:   "#b0a480",
  buildings: "#bcac9a",
  prisms:    "#9a8878",
  roads:     "#7a6e5e",
  walls:     "#9e9080",
};

const CITY_FILL_IDS  = new Set(["water", "earth", "fields", "greens", "squares", "buildings", "prisms"]);
const CITY_DRAW_ORDER = ["water", "rivers", "earth", "fields", "greens", "squares", "buildings", "prisms", "roads", "walls"];

const WORLD_WIDTH_KM = 42315;
const WORLD_HEIGHT_KM = 18855;
const DEFAULT_KM_PER_PX = 15;

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

function cityTooltipHtml(burg, stateName = null, cultureName = null) {
  const name = burg?.name ?? "Settlement";
  const type = burg?.capital ? "Capital" : (burg?.type ?? "Settlement");
  const pop = typeof burg?.population === "number" ? burg.population : null;

  return `
    <div style="
      padding:10px 10px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.10);
      background:rgba(8,10,13,0.55);
      backdrop-filter: blur(8px);
      min-width:260px;
    ">
      <div style="font:900 13px system-ui; color:rgba(255,255,255,0.92);">
        ${htmlEscape(name)}
      </div>
      <div style="margin-top:6px; font:800 11px system-ui; letter-spacing:0.08em; color:rgba(255,255,255,0.65);">
        ${htmlEscape(type)}
      </div>

      <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        ${stateName ? `<div style="font:700 12px system-ui; color:rgba(255,255,255,0.72);">State: <span style="font-weight:900;">${htmlEscape(stateName)}</span></div>` : ""}
        ${cultureName ? `<div style="font:700 12px system-ui; color:rgba(255,255,255,0.72);">Culture: <span style="font-weight:900;">${htmlEscape(cultureName)}</span></div>` : ""}
        ${pop !== null ? `<div style="font:700 12px system-ui; color:rgba(255,255,255,0.72);">Population: <span style="font-weight:900;">${htmlEscape(pop.toFixed(3))}</span></div>` : ""}
      </div>
    </div>
  `;
}

function outlineSvgFromWorld(world) {
  const pack = world?.pack;
  const features = pack?.features;
  const vertices = pack?.vertices;
  const fallbackSize = getWorldSizePxFromKm(world);
  const w = world?.info?.width || fallbackSize.width;
  const h = world?.info?.height || fallbackSize.height;

  if (!pack || !Array.isArray(features) || !Array.isArray(vertices)) {
    return `<svg viewBox="0 0 ${w} ${h}" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;"></svg>`;
  }

  const landFeatures = features.filter(
    (f) => f && typeof f === "object" && f.land && Array.isArray(f.vertices) && f.vertices.length > 2
  );

  const paths = landFeatures.map((f) => {
    const pts = f.vertices
      .map((vi) => vertices[vi]?.p)
      .filter((p) => Array.isArray(p) && p.length === 2);
    if (pts.length < 3) return "";

    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + " Z";
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.25" />`;
  }).join("");

  return `<svg viewBox="0 0 ${w} ${h}" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">${paths}</svg>`;
}


function linePathFromPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ");
}

function roadsSvgFromWorld(world) {
  const pack = world?.pack;
  const routes = Array.isArray(pack?.routes) ? pack.routes : [];
  const fallbackSize = getWorldSizePxFromKm(world);
  const w = world?.info?.width || fallbackSize.width;
  const h = world?.info?.height || fallbackSize.height;

  const roadPaths = [];

  for (const route of routes) {
    if (!route || typeof route !== "object") continue;
    if (route.group !== "roads") continue;
    if (!Array.isArray(route.points) || route.points.length < 2) continue;

    const pts = route.points
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null))
      .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));

    if (pts.length < 2) continue;

    const d = linePathFromPoints(pts);
    if (!d) continue;

    // Approximate render width for 10–15 m roads (wider than "2 car widths" visual)
    const roadWidthPx = 2.8;
    roadPaths.push(`<path d="${d}" fill="none" stroke="rgba(196,169,120,0.82)" stroke-width="${roadWidthPx}" stroke-linecap="round" stroke-linejoin="round" />`);
  }

  return `<svg viewBox="0 0 ${w} ${h}" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">${roadPaths.join("")}</svg>`;
}

function riversSvgFromWorld(world) {
  const pack = world?.pack;
  const rivers = Array.isArray(pack?.rivers) ? pack.rivers : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const fallbackSize = getWorldSizePxFromKm(world);
  const w = world?.info?.width || fallbackSize.width;
  const h = world?.info?.height || fallbackSize.height;

  const riverPaths = [];

  for (const river of rivers) {
    if (!river || typeof river !== "object") continue;
    if (!Array.isArray(river.cells) || river.cells.length < 2) continue;

    const pts = [];
    for (const cellId of river.cells) {
      const p = cells[cellId]?.p;
      if (!Array.isArray(p) || p.length < 2) continue;
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const prev = pts[pts.length - 1];
      if (!prev || prev[0] !== x || prev[1] !== y) pts.push([x, y]);
    }

    if (pts.length < 2) continue;

    const d = linePathFromPoints(pts);
    if (!d) continue;

    const widthScale = Number(river.widthFactor) || 1;
    const width = Number(river.width) || Number(river.sourceWidth) || 0.04;
    const riverWidthPx = clamp(width * widthScale * 6, 0.8, 11);

    riverPaths.push(`<path d="${d}" fill="none" stroke="rgba(116,178,236,0.74)" stroke-width="${riverWidthPx.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`);
  }

  return `<svg viewBox="0 0 ${w} ${h}" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">${riverPaths.join("")}</svg>`;
}

function classifyBurg(burg, cityPopThreshold) {
  if (burg?.capital) return "capital";
  const pop = typeof burg?.population === "number" ? burg.population : 0;
  return pop >= cityPopThreshold ? "city" : "town";
}


export function buildMapTab(
  panel,
  {
    seed,
    tooltip,
    db = null,
    activeSaveId = null,
    getUiState = null,
    setUiState = null,
    activeCityData = null,
    getCharacterMapPos = null,
    onNodeClick = null,
  }
) {
  const tip = tooltip ?? createTooltip();

  const WORLD_URL = "./afmg/Praneland Full 2025-12-28-23-09.json";

  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:800 14px system-ui;
        letter-spacing:0.08em;
        color:rgba(255,255,255,0.9);
        display:flex; align-items:center; justify-content:space-between;">
        <div>MAP</div>
        <div style="font:600 12px system-ui; opacity:0.65;">seed: ${htmlEscape(seed)}</div>
      </div>

      <div style="flex:1; position:relative; overflow:hidden;">
        <div id="mapViewport" style="position:absolute; inset:0; cursor:grab; background:rgba(5,7,10,0.6);">
          <div id="mapCanvas" style="
            position:absolute; left:50%; top:50%;
            width:${getWorldSizePxFromKm(null).width}px; height:${getWorldSizePxFromKm(null).height}px;
            transform:translate(-50%,-50%);
            border:1px solid rgba(255,255,255,0.10);
            border-radius:14px;
            box-shadow:0 18px 60px rgba(0,0,0,0.35);
            background:
              radial-gradient(1200px 600px at 50% 45%, rgba(255,255,255,0.06), transparent 70%),
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
            background-size: auto, 40px 40px, 40px 40px;
            overflow:hidden;
            touch-action:none;
          ">
            <div style="
              position:absolute; left:18px; top:18px;
              font:800 12px system-ui; letter-spacing:0.08em;
              color:rgba(255,255,255,0.85);
              padding:8px 10px;
              border:1px solid rgba(255,255,255,0.10);
              border-radius:12px;
              background:rgba(12,16,22,0.65);
              z-index:6;
            ">SETTLEMENTS</div>

            <!-- Filter UI -->
            <div id="mapFilters" style="
              position:absolute; left:18px; top:56px;
              display:flex; flex-direction:column; gap:8px;
              padding:10px 10px;
              border:1px solid rgba(255,255,255,0.10);
              border-radius:14px;
              background:rgba(12,16,22,0.65);
              z-index:6;
              min-width:240px;
            ">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="font:900 11px system-ui; letter-spacing:0.10em; color:rgba(255,255,255,0.82);">FILTER</div>
                <div id="filterCount" style="font:800 11px system-ui; color:rgba(255,255,255,0.62); white-space:nowrap;">—</div>
              </div>

              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <label style="display:flex; align-items:center; gap:8px; font:700 12px system-ui; color:rgba(255,255,255,0.78);">
                  <input id="fltCapitals" type="checkbox" checked />
                  Capitals
                </label>
                <label style="display:flex; align-items:center; gap:8px; font:700 12px system-ui; color:rgba(255,255,255,0.78);">
                  <input id="fltCities" type="checkbox" checked />
                  Cities
                </label>
                <label style="display:flex; align-items:center; gap:8px; font:700 12px system-ui; color:rgba(255,255,255,0.78);">
                  <input id="fltTowns" type="checkbox" checked />
                  Towns
                </label>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="font:800 11px system-ui; color:rgba(255,255,255,0.70);">City pop ≥</div>
                <div id="popVal" style="font:900 11px system-ui; color:rgba(255,255,255,0.82);">1.00</div>
              </div>
              <input id="popSlider" type="range" min="0" max="500" value="100" step="5" />
              <div style="font:700 10px system-ui; color:rgba(255,255,255,0.58); line-height:1.25;">
                Slider is scaled: value/100. (So 100 = 1.00)
              </div>
            </div>

            <div id="mapOutline" style="position:absolute; inset:0; z-index:1;"></div>
            <div id="mapRivers" style="position:absolute; inset:0; z-index:2;"></div>
            <div id="mapRoads" style="position:absolute; inset:0; z-index:2;"></div>
            <svg id="mapCitySvg" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2;"></svg>
            <div id="mapMarkers" style="position:absolute; inset:0; z-index:3;"></div>

            <!-- Player position marker -->
            <div id="mapPlayerMarker" style="
              position:absolute;
              width:12px; height:12px;
              border-radius:50%;
              background:#4fc3f7;
              border:2px solid rgba(255,255,255,0.95);
              transform:translate(-50%,-50%);
              pointer-events:none;
              z-index:5;
              display:none;
              box-shadow:0 0 0 5px rgba(79,195,247,0.22), 0 0 14px rgba(79,195,247,0.70);
            "></div>

            <div id="mapStatus" style="
              position:absolute; left:18px; bottom:18px;
              font:700 12px system-ui; color:rgba(255,255,255,0.70);
              background:rgba(12,16,22,0.55); border:1px solid rgba(255,255,255,0.10);
              border-radius:12px; padding:8px 10px;
              z-index:6;
            ">Loading world…</div>

            <div id="mapZoomBadge" style="
              position:absolute; right:18px; top:18px;
              font:800 11px system-ui; letter-spacing:0.10em;
              color:rgba(255,255,255,0.78);
              padding:8px 10px;
              border:1px solid rgba(255,255,255,0.10);
              border-radius:12px;
              background:rgba(12,16,22,0.65);
              z-index:6;
            ">ZOOM</div>
          </div>
        </div>

        <div style="
          position:absolute; right:14px; bottom:14px;
          font:600 12px system-ui; color:rgba(255,255,255,0.75);
          background:rgba(12,16,22,0.60); border:1px solid rgba(255,255,255,0.10);
          border-radius:12px; padding:8px 10px;
        ">
          Drag: pan • Wheel: zoom
        </div>
      </div>
    </div>
  `;

  const viewport      = panel.querySelector("#mapViewport");
  const mapCanvas     = panel.querySelector("#mapCanvas");
  const outlineEl     = panel.querySelector("#mapOutline");
  const riversEl      = panel.querySelector("#mapRivers");
  const roadsEl       = panel.querySelector("#mapRoads");
  const citySvg       = panel.querySelector("#mapCitySvg");
  const markersEl     = panel.querySelector("#mapMarkers");
  const playerMarker  = panel.querySelector("#mapPlayerMarker");
  const statusEl      = panel.querySelector("#mapStatus");
  const zoomBadgeEl   = panel.querySelector("#mapZoomBadge");

  const elCap = panel.querySelector("#fltCapitals");
  const elCity = panel.querySelector("#fltCities");
  const elTown = panel.querySelector("#fltTowns");
  const elPop = panel.querySelector("#popSlider");
  const elPopVal = panel.querySelector("#popVal");
  const elFilterCount = panel.querySelector("#filterCount");

  // Pan/zoom state (persisted)
  let isDown = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let scale = 1.0;

  // Filter state (persisted)
  let showCapitals = true;
  let showCities = true;
  let showTowns = true;
  let cityPopThreshold = 1.0;

  const onDocMove = (e) => tip.move({ clientX: e.clientX, clientY: e.clientY });

  let world = null;
  let markers = []; // { el, labelEl, burg, pop, isCapital, category }

  // City overlay state
  let cityBurg = activeCityData?.burg ?? null;
  let cityJson  = activeCityData?.cityJson ?? null;
  let metersPerPx = DEFAULT_KM_PER_PX * 1000;   // updated once world loads
  let cityEarthWidthAzgaar = 0;                  // cached bounding-box width
  let cityOverlayDirty = true;                   // rebuild SVG paths when true
  const markerByKey = new Map();
  let selectedKey = null;
  let stateNameById = new Map();
  let cultureNameById = new Map();

  const keyForBurg = (b) => String(b?.i ?? b?.name ?? "");

  async function persistUi(patch) {
    if (!db || !activeSaveId || typeof setUiState !== "function") return;
    await setUiState(db, activeSaveId, patch);
  }

  function updateStatus() {
    if (!world) return;

    const info = world?.info || {};
    const selected = selectedKey ? markers.find((m) => keyForBurg(m.burg) === selectedKey)?.burg : null;

    if (!selected) {
      statusEl.textContent = `Loaded settlements • ${info.mapName || "World"} • v${info.version || "?"}`;
      return;
    }

    const sName = stateNameById.get(selected.state) || "—";
    const cName = cultureNameById.get(selected.culture) || "—";
    const type = selected.capital ? "Capital" : (selected.type ?? "Settlement");
    statusEl.textContent = `Current Location: ${selected.name} • ${type} • State: ${sName} • Culture: ${cName}`;
  }

  function updateSelectionStyles() {
    for (const m of markers) {
      const isSel = selectedKey && keyForBurg(m.burg) === selectedKey;

      if (isSel) {
        m.el.style.boxShadow = "0 0 0 10px rgba(255,255,255,0.18), 0 0 26px rgba(255,255,255,0.22)";
        m.el.style.background = "rgba(255,255,255,0.98)";
      } else {
        m.el.style.background = "rgba(255,255,255,0.88)";
        m.el.style.boxShadow = m.isCapital
          ? "0 0 0 9px rgba(255,255,255,0.14), 0 0 18px rgba(255,255,255,0.16)"
          : "0 0 0 7px rgba(255,255,255,0.12)";
      }

      if (m.labelEl) {
        m.labelEl.style.fontWeight = isSel ? "900" : "800";
        m.labelEl.style.opacity = isSel ? "1" : "0.85";
      }
    }
  }

  function updateFiltersBadge() {
    const enabled = [
      showCapitals ? "Capitals" : null,
      showCities ? "Cities" : null,
      showTowns ? "Towns" : null,
    ].filter(Boolean);
    elFilterCount.textContent = enabled.length ? enabled.join(" • ") : "None";
  }

  function upsertMarkerForBurg(b) {
    if (!b || typeof b !== "object") return;
    if (!b.name || typeof b.x !== "number" || typeof b.y !== "number") return;
    const key = keyForBurg(b);
    if (markerByKey.has(key)) return;

    const isCapital = !!b.capital;
    const pop = typeof b.population === "number" ? b.population : 0;
    const size = clamp((isCapital ? 9 : 6) + Math.sqrt(Math.max(0, pop)) * 0.8, 6, 16);

    const marker = document.createElement("div");
    marker.className = "mapMarker";
    marker.dataset.burg = key;
    marker.style.position = "absolute";
    marker.style.left = `${b.x}px`;
    marker.style.top = `${b.y}px`;
    marker.style.width = `${size}px`;
    marker.style.height = `${size}px`;
    marker.style.borderRadius = "999px";
    marker.style.transform = "translate(-50%,-50%)";
    marker.style.background = "rgba(255,255,255,0.88)";
    marker.style.boxShadow = isCapital
      ? "0 0 0 9px rgba(255,255,255,0.14), 0 0 18px rgba(255,255,255,0.16)"
      : "0 0 0 7px rgba(255,255,255,0.12)";
    marker.style.cursor = "pointer";
    marker.addEventListener("pointerdown", (e) => e.stopPropagation());

    const label = document.createElement("div");
    label.className = "mapLabel";
    label.style.position = "absolute";
    label.style.left = `${b.x}px`;
    label.style.top = `${b.y}px`;
    label.style.transform = "translate(10px, -50%)";
    label.style.padding = "4px 6px";
    label.style.borderRadius = "999px";
    label.style.border = "1px solid rgba(255,255,255,0.10)";
    label.style.background = "rgba(12,16,22,0.55)";
    label.style.backdropFilter = "blur(8px)";
    label.style.color = "rgba(255,255,255,0.88)";
    label.style.font = "800 10px system-ui";
    label.style.letterSpacing = "0.05em";
    label.style.whiteSpace = "nowrap";
    label.style.pointerEvents = "none";
    label.textContent = b.name;

    marker.addEventListener("mouseenter", (e) => {
      document.addEventListener("mousemove", onDocMove, { passive: true });
      const sName = stateNameById.get(b.state) || null;
      const cName = cultureNameById.get(b.culture) || null;
      tip.show({ html: cityTooltipHtml(b, sName, cName), clientX: e.clientX, clientY: e.clientY });
    });
    marker.addEventListener("mouseleave", () => {
      document.removeEventListener("mousemove", onDocMove);
      tip.hide();
    });
    marker.addEventListener("mousemove", (e) => tip.move({ clientX: e.clientX, clientY: e.clientY }));

    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      setSelected(b);
      if (typeof onNodeClick === "function") onNodeClick(b);
    });

    markersEl.appendChild(marker);
    markersEl.appendChild(label);

    const m = { el: marker, labelEl: label, burg: b, pop, isCapital, category: classifyBurg(b, cityPopThreshold) };
    markers.push(m);
    markerByKey.set(key, m);
  }

  function passesFilter(m) {
    if (m.isCapital) return showCapitals;

    if (m.category === "city") return showCities;
    return showTowns;
  }

  function updateVisibility() {
    // Labels always small; show only if selected (for now) or if zoomed in enough
    const showLabelsByZoom = scale >= 1.45;

    zoomBadgeEl.textContent = `ZOOM ${scale.toFixed(2)}`;

    let visibleCount = 0;
    for (const m of markers) {
      const isSel = selectedKey && keyForBurg(m.burg) === selectedKey;
      const visible = isSel ? true : passesFilter(m);

      m.el.style.display = visible ? "block" : "none";
      if (m.labelEl) {
        const labelVisible = isSel ? true : (visible && showLabelsByZoom);
        m.labelEl.style.display = labelVisible ? "block" : "none";
      }
      if (visible) visibleCount++;
    }

    updateFiltersBadge();
  }

  // ── City SVG overlay ─────────────────────────────────────────────────────

  function drawCityOverlay() {
    if (!citySvg) return;

    if (!cityJson || !cityBurg) {
      if (citySvg.childElementCount > 0) citySvg.innerHTML = "";
      return;
    }

    // Lazy-compute earth bounding-box width in Azgaar pixels
    if (cityEarthWidthAzgaar <= 0 && metersPerPx > 0) {
      const feat = indexCityFeatures(cityJson);
      const ef   = feat["earth"];
      if (ef) {
        const pts = collectPolyPoints(cityFeatGeom(ef));
        if (pts.length >= 2) {
          const xs = pts.map(p => p[0]);
          cityEarthWidthAzgaar = (Math.max(...xs) - Math.min(...xs)) / metersPerPx;
        }
      }
    }

    // Visibility gate: hide when city footprint < 2 CSS pixels at current zoom
    if (cityEarthWidthAzgaar > 0 && cityEarthWidthAzgaar * scale < 2) {
      if (citySvg.style.display !== "none") citySvg.style.display = "none";
      return;
    }
    citySvg.style.display = "";

    // Skip expensive path rebuild unless data changed
    if (!cityOverlayDirty && citySvg.childElementCount > 0) return;
    cityOverlayDirty = false;

    citySvg.innerHTML = "";

    const bx   = Number(cityBurg.x);
    const by   = Number(cityBurg.y);
    const mpp  = metersPerPx;
    const feat = indexCityFeatures(cityJson);
    const ns   = "http://www.w3.org/2000/svg";

    for (const id of CITY_DRAW_ORDER) {
      const f = feat[id];
      if (!f) continue;
      const geom  = cityFeatGeom(f);
      if (!geom)  continue;
      const color = CITY_PALETTE[id] ?? "#888";
      const el    = document.createElementNS(ns, "path");

      if (CITY_FILL_IDS.has(id)) {
        // Polygon / MultiPolygon - filled area
        const d = cityPolyToD(geom, bx, by, mpp);
        if (!d.trim()) continue;
        el.setAttribute("d", d);
        el.setAttribute("fill", color);
        el.setAttribute("fill-opacity", id === "water" ? "0.70" : "0.65");
        el.setAttribute("stroke", "none");

      } else if (id === "rivers") {
        // GeometryCollection of LineStrings
        let d = "";
        const subGeoms = geom.type === "GeometryCollection" ? (geom.geometries ?? []) : [geom];
        for (const g of subGeoms) {
          if (g?.type === "LineString") d += cityLineToD(g.coordinates, bx, by, mpp) + " ";
        }
        if (!d.trim()) continue;
        const sw = ((subGeoms[0]?.width ?? 10) / mpp).toFixed(6);
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", color);
        el.setAttribute("stroke-width", sw);
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");

      } else if (id === "roads") {
        // GeometryCollection of LineStrings, each may have own width
        let d = "";
        const subGeoms = geom.type === "GeometryCollection" ? (geom.geometries ?? []) : [geom];
        for (const g of subGeoms) {
          if (g?.type === "LineString") d += cityLineToD(g.coordinates, bx, by, mpp) + " ";
        }
        if (!d.trim()) continue;
        // Default road width ~8m
        const sw = (8 / mpp).toFixed(6);
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", color);
        el.setAttribute("stroke-width", sw);
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");

      } else if (id === "walls") {
        // GeometryCollection of Polygons rendered as closed outlines
        let d = "";
        const subGeoms = geom.type === "GeometryCollection" ? (geom.geometries ?? []) : [geom];
        for (const g of subGeoms) {
          if (g?.type === "Polygon") {
            for (const ring of (g.coordinates ?? [])) d += cityRingToD(ring, bx, by, mpp) + " ";
          }
        }
        if (!d.trim()) continue;
        const sw = ((subGeoms[0]?.width ?? 6) / mpp).toFixed(6);
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", color);
        el.setAttribute("stroke-width", sw);
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");

      } else {
        continue;
      }

      citySvg.appendChild(el);
    }
  }

  /** Animate (or snap) pan+zoom so the city fills ~70% of the viewport width. */
  function autoZoomToCity(burg, cJson, animate = true) {
    if (!burg || !cJson) return;

    const feat    = indexCityFeatures(cJson);
    const ef      = feat["earth"];
    if (!ef) return;
    const pts     = collectPolyPoints(cityFeatGeom(ef));
    if (pts.length < 2) return;

    const xs      = pts.map(p => p[0]);
    const earthWidthM       = Math.max(...xs) - Math.min(...xs);
    const earthWidthAzgaar  = earthWidthM / metersPerPx;
    if (earthWidthAzgaar <= 0) return;

    const vpW      = viewport.clientWidth  || 800;
    const vpH      = viewport.clientHeight || 600;
    const canvasW  = parseFloat(mapCanvas.style.width)  || getWorldSizePxFromKm(world).width;
    const canvasH  = parseFloat(mapCanvas.style.height) || getWorldSizePxFromKm(world).height;

    const targetScale = clamp(vpW * 0.7 / earthWidthAzgaar, 1, 2500);
    // Pan so the burg sits at the viewport center
    const targetPanX  = (canvasW / 2 - burg.x) * targetScale;
    const targetPanY  = (canvasH / 2 - burg.y) * targetScale;

    if (!animate) {
      scale = targetScale;
      panX  = targetPanX;
      panY  = targetPanY;
      void apply(true);
      return;
    }

    const startScale = scale;
    const startPanX  = panX;
    const startPanY  = panY;
    const t0         = performance.now();
    const DURATION   = 600;

    const tick = (now) => {
      const t    = Math.min((now - t0) / DURATION, 1.0);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out quad
      scale = startScale + (targetScale - startScale) * ease;
      panX  = startPanX  + (targetPanX  - startPanX)  * ease;
      panY  = startPanY  + (targetPanY  - startPanY)  * ease;
      apply(false);
      if (t < 1.0) requestAnimationFrame(tick);
      else         void apply(true);
    };
    requestAnimationFrame(tick);
  }

  const apply = async (shouldPersist = false) => {
    mapCanvas.style.transform =
      `translate(-50%,-50%) translate(${panX}px, ${panY}px) scale(${scale})`;

    drawCityOverlay();
    updateVisibility();

    if (shouldPersist) {
      await persistUi({
        mapView: { panX, panY, scale },
        mapFilters: { showCapitals, showCities, showTowns, cityPopThreshold },
        mapSelectedBurgKey: selectedKey,
      });
    }
  };

  const onWorldBurgDiscovered = (ev) => {
    const burg        = ev?.detail;
    const newCityJson = ev?.detail?.cityJson ?? null;
    if (!burg) return;
    upsertMarkerForBurg(burg);
    updateStatus();
    updateSelectionStyles();

    if (newCityJson) {
      cityBurg             = burg;
      cityJson             = newCityJson;
      cityEarthWidthAzgaar = 0;
      cityOverlayDirty     = true;
      autoZoomToCity(burg, newCityJson, true);
    } else {
      // Burg has no saved city yet - clear any stale overlay from a previous burg.
      cityBurg             = null;
      cityJson             = null;
      cityEarthWidthAzgaar = 0;
      cityOverlayDirty     = true;
    }

    void apply(true);
  };

  window.addEventListener("world:burg-discovered", onWorldBurgDiscovered);

  // Fired by app.js when MFCG finishes generating a city for a burg that had no saved data.
  const onCityReady = (ev) => {
    const newBurg     = ev?.detail?.burg;
    const newCityJson = ev?.detail?.cityJson ?? null;
    if (!newBurg || !newCityJson) return;
    cityBurg             = newBurg;
    cityJson             = newCityJson;
    cityEarthWidthAzgaar = 0;
    cityOverlayDirty     = true;
    autoZoomToCity(newBurg, newCityJson, true);
    void apply(true);
  };
  window.addEventListener("world:city-ready", onCityReady);

  const onDown = (e) => {
    isDown = true;
    viewport.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    viewport.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    panX += dx;
    panY += dy;
    apply(false);
  };

  const onUp = async (e) => {
    isDown = false;
    viewport.style.cursor = "grab";
    viewport.releasePointerCapture?.(e.pointerId);
    await apply(true);
  };

  const onWheel = async (e) => {
    e.preventDefault();

    const rect = mapCanvas.getBoundingClientRect();
    const mx = e.clientX - (rect.left + rect.width / 2);
    const my = e.clientY - (rect.top + rect.height / 2);

    const prevScale = scale;
    const delta = Math.sign(e.deltaY);
    const next = scale * (delta > 0 ? 0.92 : 1.08);
    scale = clamp(next, 0.45, 2500);

    // Mouse-centered zoom
    const k = scale / prevScale;
    panX = panX - mx * (k - 1);
    panY = panY - my * (k - 1);

    await apply(true);
  };

  viewport.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  viewport.addEventListener("wheel", onWheel, { passive: false });

  // Filters wiring
  const syncFiltersFromUi = async () => {
    showCapitals = !!elCap.checked;
    showCities = !!elCity.checked;
    showTowns = !!elTown.checked;

    const v = Number(elPop.value || 100);
    cityPopThreshold = clamp(v / 100, 0, 5);
    elPopVal.textContent = cityPopThreshold.toFixed(2);

    // Reclassify city/town based on threshold
    for (const m of markers) {
      if (!m.isCapital) m.category = classifyBurg(m.burg, cityPopThreshold);
    }

    await apply(true);
  };

  elCap.addEventListener("change", syncFiltersFromUi);
  elCity.addEventListener("change", syncFiltersFromUi);
  elTown.addEventListener("change", syncFiltersFromUi);
  elPop.addEventListener("input", syncFiltersFromUi);

  function setSelected(burg) {
    selectedKey = burg ? keyForBurg(burg) : null;
    updateSelectionStyles();
    updateStatus();
    apply(true);
  }

  // Load + render
  (async () => {
    try {
      // Restore UI state (map view + filters + selection)
      if (db && activeSaveId && typeof getUiState === "function") {
        const ui = await getUiState(db, activeSaveId);

        if (ui?.mapView) {
          if (typeof ui.mapView.panX === "number") panX = ui.mapView.panX;
          if (typeof ui.mapView.panY === "number") panY = ui.mapView.panY;
          if (typeof ui.mapView.scale === "number") scale = ui.mapView.scale;
        }
        if (ui?.mapFilters) {
          showCapitals = ui.mapFilters.showCapitals ?? showCapitals;
          showCities = ui.mapFilters.showCities ?? showCities;
          showTowns = ui.mapFilters.showTowns ?? showTowns;
          cityPopThreshold = typeof ui.mapFilters.cityPopThreshold === "number" ? ui.mapFilters.cityPopThreshold : cityPopThreshold;
        }
        if (typeof ui?.mapSelectedBurgKey === "string") {
          selectedKey = ui.mapSelectedBurgKey;
        }
      }

      // Reflect restored filter state in UI
      elCap.checked = showCapitals;
      elCity.checked = showCities;
      elTown.checked = showTowns;
      elPop.value = String(Math.round(cityPopThreshold * 100));
      elPopVal.textContent = cityPopThreshold.toFixed(2);

      const res = await fetch(encodeURI(WORLD_URL), { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch world JSON: ${res.status}`);
      world = await res.json();

      // Update metersPerPx from actual world data and invalidate cached earth width
      metersPerPx          = getDistanceScaleKmPerPx(world) * 1000;
      cityEarthWidthAzgaar = 0; // force re-compute with correct scale

      const info = world?.info || {};
      const pack = world?.pack || {};
      const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];

      // Resize canvas
      const fallbackSize = getWorldSizePxFromKm(world);
      const w = info.width || fallbackSize.width;
      const h = info.height || fallbackSize.height;
      mapCanvas.style.width = `${w}px`;
      mapCanvas.style.height = `${h}px`;

      outlineEl.innerHTML = outlineSvgFromWorld(world);
      riversEl.innerHTML = riversSvgFromWorld(world);
      roadsEl.innerHTML = roadsSvgFromWorld(world);

      // Lookups
      stateNameById = new Map();
      for (const s of (Array.isArray(pack?.states) ? pack.states : [])) {
        if (s && typeof s === "object" && typeof s.i === "number") stateNameById.set(s.i, s.name || null);
      }
      cultureNameById = new Map();
      for (const c of (Array.isArray(pack?.cultures) ? pack.cultures : [])) {
        if (c && typeof c === "object" && typeof c.i === "number") cultureNameById.set(c.i, c.name || null);
      }

      // Markers
      markersEl.innerHTML = "";
      markers = [];

      let count = 0;
      for (const b of burgs) {
        if (!b || typeof b !== "object") continue;
        if (!b.name || typeof b.x !== "number" || typeof b.y !== "number") continue;

        upsertMarkerForBurg(b);
        count++;
      }

      const cachedBurgs = await loadAllCachedBurgs();
      for (const b of cachedBurgs) upsertMarkerForBurg(b);

      // Click empty space to clear selection
      mapCanvas.addEventListener("click", () => setSelected(null));

      // Restore selection if possible
      if (selectedKey) {
        const found = markers.find((m) => keyForBurg(m.burg) === selectedKey)?.burg || null;
        if (found) setSelected(found);
        else selectedKey = null;
      }

      // If still none selected: pick first capital as default (and persist)
      if (!selectedKey) {
        const cap = markers.find((m) => m.isCapital)?.burg || null;
        if (cap) setSelected(cap);
      }

      statusEl.textContent = `Loaded: ${count} settlements • ${info.mapName || "World"} • v${info.version || "?"}`;

      await syncFiltersFromUi(); // applies visibility + persists

      // If city data was pre-loaded (player already in a burg) and there is no
      // meaningful persisted zoom, snap straight to the city view.
      if (cityBurg && cityJson && scale <= 1.5) {
        autoZoomToCity(cityBurg, cityJson, false); // snap, no animation; calls apply(true)
      } else {
        await apply(true);       // applies map view + persists
      }

      updateStatus();
      updateSelectionStyles();
    } catch (err) {
      statusEl.textContent = `World load failed. Check WORLD_URL in map.js.`;
      console.error(err);
    }
  })();

  // ── Character position indicator ─────────────────────────────
  // Poll the character's world-plane position each frame and move
  // the player marker to the corresponding Azgaar map pixel coords.
  let charRafId = null;
  if (playerMarker && typeof getCharacterMapPos === "function") {
    const tickCharMarker = () => {
      const pos = getCharacterMapPos();
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        playerMarker.style.left    = `${pos.x}px`;
        playerMarker.style.top     = `${pos.y}px`;
        playerMarker.style.display = "block";
      } else {
        playerMarker.style.display = "none";
      }
      charRafId = requestAnimationFrame(tickCharMarker);
    };
    charRafId = requestAnimationFrame(tickCharMarker);
  }

  return () => {
    if (charRafId !== null) cancelAnimationFrame(charRafId);
    document.removeEventListener("mousemove", onDocMove);
    viewport.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    viewport.removeEventListener("wheel", onWheel);
    tip.hide();
    window.removeEventListener("world:burg-discovered", onWorldBurgDiscovered);
    window.removeEventListener("world:city-ready", onCityReady);
  };
}
