// app.js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { openDB, getAllSaves, createSave, getUiState, setUiState } from "./db.js";

import { createTooltip } from "./tooltip.js";
import { buildMapTab } from "./map.js";
import { buildInventoryTab } from "./inventory.js";
import { buildCharacterTab } from "./character.js";
import { buildCosmeticsTab } from "./cosmetics.js";
import { buildSettingsTab } from "./settings.js";
import { buildWorldFromAzgaar } from "./world-builder.js";

/* ===========================================================
   Tabs
=========================================================== */
const TABS = [
  { id: "map", label: "MAP", hotkey: "1" },
  { id: "inventory", label: "INVENTORY", hotkey: "2" },
  { id: "character", label: "CHARACTER", hotkey: "3" },
  { id: "cosmetics", label: "COSMETICS", hotkey: "4" },
  { id: "settings", label: "SETTINGS", hotkey: "5" },
];

const WORLD_LAYER = 0;
const UI_CHAR_LAYER = 3;

/* ===========================================================
   DOM helpers
=========================================================== */
function ensureDomTabsBar() {
  let wrap = document.getElementById("uiTabsBar");
  if (wrap) return wrap;

  wrap = document.createElement("div");
  wrap.id = "uiTabsBar";
  wrap.style.position = "fixed";
  wrap.style.left = "50%";
  wrap.style.top = "14px";
  wrap.style.transform = "translateX(-50%)";
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.zIndex = "9999";
  wrap.style.pointerEvents = "auto";
  wrap.style.userSelect = "none";
  wrap.style.padding = "6px 8px";
  wrap.style.borderRadius = "14px";
  wrap.style.background = "rgba(10,14,18,0.35)";
  wrap.style.backdropFilter = "blur(8px)";
  wrap.style.border = "1px solid rgba(255,255,255,0.10)";

  document.body.appendChild(wrap);
  return wrap;
}

function renderDomTabsBar({ activeTab, visible, onClickTab }) {
  const wrap = ensureDomTabsBar();
  wrap.style.opacity = visible ? "1" : "0";
  wrap.style.transform = visible
    ? "translateX(-50%) translateY(0)"
    : "translateX(-50%) translateY(-8px)";
  wrap.style.transition = "opacity 160ms ease, transform 160ms ease";
  wrap.style.pointerEvents = visible ? "auto" : "none";

  wrap.innerHTML = "";

  for (const t of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${t.hotkey}  ${t.label}`;
    btn.style.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    btn.style.letterSpacing = "0.06em";
    btn.style.padding = "10px 12px";
    btn.style.borderRadius = "12px";
    btn.style.cursor = "pointer";
    btn.style.border =
      t.id === activeTab
        ? "1px solid rgba(255,255,255,0.28)"
        : "1px solid rgba(255,255,255,0.12)";
    btn.style.background =
      t.id === activeTab ? "rgba(22,30,40,0.92)" : "rgba(12,16,22,0.70)";
    btn.style.color = "rgba(255,255,255,0.92)";

    btn.onmouseenter = () => (btn.style.borderColor = "rgba(255,255,255,0.22)");
    btn.onmouseleave = () => {
      btn.style.borderColor =
        t.id === activeTab ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)";
    };

    btn.addEventListener("click", () => onClickTab(t.id));
    wrap.appendChild(btn);
  }
}

function ensureUiPanel() {
  let panel = document.getElementById("uiPanel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "uiPanel";
  panel.style.position = "fixed";
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.width = "min(980px, 86vw)";
  panel.style.height = "min(620px, 70vh)";
  panel.style.zIndex = "9000";
  panel.style.pointerEvents = "auto";
  panel.style.borderRadius = "18px";
  panel.style.background = "rgba(8,10,13,0.72)";
  panel.style.backdropFilter = "blur(10px)";
  panel.style.border = "1px solid rgba(255,255,255,0.12)";
  panel.style.boxShadow = "0 24px 80px rgba(0,0,0,0.45)";
  panel.style.overflow = "hidden";
  panel.style.opacity = "0";
  panel.style.transition = "opacity 160ms ease";
  panel.style.userSelect = "none";

  document.body.appendChild(panel);
  return panel;
}

function setPanelVisible(panel, visible) {
  panel.style.opacity = visible ? "1" : "0";
  panel.style.pointerEvents = visible ? "auto" : "none";
}

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ===========================================================
   Main Menu + Save Files (always first)
=========================================================== */
function buildMainMenu(panel, { onStart }) {
  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:900 14px system-ui;
        letter-spacing:0.10em;
        color:rgba(255,255,255,0.9);">
        MAIN MENU
      </div>

      <div style="flex:1; padding:16px; display:flex; flex-direction:column; gap:12px;">
        <div style="color:rgba(255,255,255,0.70); font:600 13px system-ui;">
          Start always goes to Save Files.
        </div>

        <button id="mmStart" style="
          padding:12px 12px; border-radius:14px;
          border:1px solid rgba(255,255,255,0.12);
          background:rgba(12,16,22,0.70);
          color:rgba(255,255,255,0.92);
          font:900 12px system-ui; letter-spacing:0.06em; cursor:pointer;
          max-width:260px;">
          START
        </button>
      </div>
    </div>
  `;
  panel.querySelector("#mmStart")?.addEventListener("click", () => onStart?.());
  return () => {};
}

function buildSaveFiles(panel, { saves, onPickSave, onBack }) {
  const rows = saves
    .map(
      (s) => `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 12px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(8,10,13,0.45);
      ">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="font:900 12px system-ui; letter-spacing:0.06em; color:rgba(255,255,255,0.90);">
            ${htmlEscape(s.name ?? s.id)}
          </div>
          <div style="font:700 12px system-ui; color:rgba(255,255,255,0.55);">
            ${htmlEscape(s.id)}
          </div>
        </div>
        <button data-save-id="${htmlEscape(s.id)}" style="
          padding:10px 12px; border-radius:14px;
          border:1px solid rgba(255,255,255,0.12);
          background:rgba(12,16,22,0.70);
          color:rgba(255,255,255,0.92);
          font:900 12px system-ui; letter-spacing:0.06em; cursor:pointer;">
          SELECT
        </button>
      </div>
    `
    )
    .join("");

  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:900 14px system-ui;
        letter-spacing:0.10em;
        color:rgba(255,255,255,0.9);
        display:flex; align-items:center; justify-content:space-between;">
        <div>SAVE FILES</div>
        <button id="sfBack" style="
          padding:10px 12px; border-radius:14px;
          border:1px solid rgba(255,255,255,0.12);
          background:rgba(12,16,22,0.70);
          color:rgba(255,255,255,0.92);
          font:900 12px system-ui; letter-spacing:0.06em; cursor:pointer;">
          BACK
        </button>
      </div>

      <div style="flex:1; padding:14px; display:grid; gap:10px; overflow:auto;">
        ${rows || `<div style="color:rgba(255,255,255,0.70); font:600 13px system-ui;">No saves found.</div>`}
      </div>
    </div>
  `;

  panel.querySelector("#sfBack")?.addEventListener("click", () => onBack?.());
  panel.querySelectorAll("[data-save-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-id");
      if (id) onPickSave?.(id);
    });
  });

  return () => {};
}

/* ===========================================================
   THREE setup
=========================================================== */
const worldCanvas = document.getElementById("c");
if (!worldCanvas) throw new Error(`[App] Missing <canvas id="c">`);

const worldRenderer = new THREE.WebGLRenderer({ canvas: worldCanvas, antialias: true, alpha: false });
worldRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
worldRenderer.setSize(window.innerWidth, window.innerHeight);
worldRenderer.outputColorSpace = THREE.SRGBColorSpace;
worldRenderer.setClearColor(0x05070a, 1);

function ensureOverlayCanvas() {
  let c = document.getElementById("cOverlay");
  if (c) return c;

  c = document.createElement("canvas");
  c.id = "cOverlay";
  c.style.position = "fixed";
  c.style.inset = "0";
  c.style.width = "100vw";
  c.style.height = "100vh";
  c.style.zIndex = "9500";
  c.style.pointerEvents = "none";
  c.style.background = "transparent";
  document.body.appendChild(c);
  return c;
}
const overlayCanvas = ensureOverlayCanvas();

const overlayRenderer = new THREE.WebGLRenderer({ canvas: overlayCanvas, antialias: true, alpha: true });
overlayRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
overlayRenderer.setSize(window.innerWidth, window.innerHeight);
overlayRenderer.outputColorSpace = THREE.SRGBColorSpace;
overlayRenderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 20_000_000);
camera.position.set(0, 1.6, 4.25);
scene.add(camera);

const controls = new OrbitControls(camera, worldRenderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.05, 0);
controls.minDistance = 1.2;
controls.maxDistance = 100;
controls.minPolarAngle = 0.03;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.update();

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1b2430, 1.0);
const dir = new THREE.DirectionalLight(0xffffff, 1.25);
dir.position.set(5, 10, 6);
scene.add(hemi);
scene.add(dir);

hemi.layers.set(WORLD_LAYER);
dir.layers.set(WORLD_LAYER);

const fallbackGround = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 1 })
);
fallbackGround.rotation.x = -Math.PI / 2;
fallbackGround.layers.set(WORLD_LAYER);
scene.add(fallbackGround);

const fallbackGrid = new THREE.GridHelper(80, 80, 0xffffff, 0x5a6b7a);
fallbackGrid.position.y = 0.001;
fallbackGrid.layers.set(WORLD_LAYER);
scene.add(fallbackGrid);

let worldGrid = null;

function mountWorldGrid(worldWidth, worldHeight) {
  if (worldGrid) {
    scene.remove(worldGrid);
    worldGrid.geometry.dispose?.();
    worldGrid.material.dispose?.();
  }

  const span = Math.max(worldWidth, worldHeight);
  const divisions = THREE.MathUtils.clamp(Math.round(span / 150000), 40, 240);
  worldGrid = new THREE.GridHelper(span, divisions, 0xf4f8ff, 0x5c6d80);
  worldGrid.position.y = 0.02;
  worldGrid.layers.set(WORLD_LAYER);
  scene.add(worldGrid);
}

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(120, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0x070a10, side: THREE.BackSide })
);
sky.layers.set(WORLD_LAYER);
scene.add(sky);

const CHARACTER_DIAMETER_M = 2;
const CHARACTER_RADIUS_M = CHARACTER_DIAMETER_M / 2;
const CHARACTER_FLOAT_HEIGHT_M = 0.45;
const CHARACTER_CENTER_Y_M = CHARACTER_RADIUS_M + CHARACTER_FLOAT_HEIGHT_M;
const characterWorld = new THREE.Mesh(
  new THREE.SphereGeometry(CHARACTER_RADIUS_M, 32, 24),
  new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.55, metalness: 0.15 })
);
characterWorld.position.set(0, CHARACTER_CENTER_Y_M, 0);
characterWorld.layers.set(WORLD_LAYER);
scene.add(characterWorld);

const characterUi = new THREE.Mesh(characterWorld.geometry, characterWorld.material);
characterUi.layers.set(UI_CHAR_LAYER);
characterUi.visible = false;
scene.add(characterUi);

const planarMotion = {
  enabled: false,
  worldHalfWidth: 40,
  worldHalfHeight: 40,
  moveSpeedMps: 4.5,
  moveAccelMps2: 24,
  velocity: new THREE.Vector3(),
  lastTimeS: performance.now() / 1000,
  clampPosition: null,
  updateLod: null,
};

const movementInput = { w: false, a: false, s: false, d: false };

function ensureMotionHud() {
  let hud = document.getElementById("motionHud");
  if (hud) return hud;

  hud = document.createElement("div");
  hud.id = "motionHud";
  hud.style.position = "fixed";
  hud.style.right = "14px";
  hud.style.bottom = "14px";
  hud.style.padding = "10px 12px";
  hud.style.borderRadius = "12px";
  hud.style.background = "rgba(0,0,0,0.38)";
  hud.style.border = "1px solid rgba(255,255,255,0.14)";
  hud.style.color = "rgba(255,255,255,0.95)";
  hud.style.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  hud.style.letterSpacing = "0.03em";
  hud.style.zIndex = "9600";
  hud.style.pointerEvents = "none";
  hud.style.minWidth = "126px";
  hud.style.textAlign = "right";
  document.body.appendChild(hud);
  return hud;
}

const motionHud = ensureMotionHud();

function isMovementKeyActive() {
  return movementInput.w || movementInput.a || movementInput.s || movementInput.d;
}

function updateMotionHud() {
  const speedMps = planarMotion.enabled ? planarMotion.velocity.length() : 0;
  const active = isMovementKeyActive();
  if (active || speedMps > 0.03) {
    motionHud.style.opacity = "1";
    motionHud.textContent = `Speed ${speedMps.toFixed(2)} m/s`;
  } else {
    motionHud.style.opacity = "0.35";
    motionHud.textContent = "Speed 0.00 m/s";
  }
}

function enablePlanarCharacterMotion({ worldWidth, worldHeight, clampPosition, updateLod }) {
  planarMotion.enabled = true;
  planarMotion.worldHalfWidth = worldWidth / 2;
  planarMotion.worldHalfHeight = worldHeight / 2;
  planarMotion.velocity.set(0, 0, 0);
  planarMotion.lastTimeS = performance.now() / 1000;
  planarMotion.clampPosition = typeof clampPosition === "function" ? clampPosition : null;
  planarMotion.updateLod = typeof updateLod === "function" ? updateLod : null;
}

function updatePlanarCharacterMotion() {
  if (!planarMotion.enabled) return;

  const nowS = performance.now() / 1000;
  const dt = Math.min(0.05, Math.max(0.001, nowS - planarMotion.lastTimeS));
  planarMotion.lastTimeS = nowS;

  _moveDesired.set(0, 0, 0);
  if (movementInput.w) _moveDesired.z -= 1;
  if (movementInput.s) _moveDesired.z += 1;
  if (movementInput.a) _moveDesired.x -= 1;
  if (movementInput.d) _moveDesired.x += 1;

  _moveNormal.set(0, 1, 0);
  _moveForward.copy(camera.position).sub(characterWorld.position).setY(0);
  if (_moveForward.lengthSq() < 1e-6) {
    _moveForwardLocal.set(0, 0, -1).applyQuaternion(characterWorld.quaternion);
    _moveForward.copy(_moveForwardLocal).setY(0);
  }
  _moveForward.normalize();
  _moveRight.crossVectors(_moveNormal, _moveForward).normalize();

  if (_moveDesired.lengthSq() > 0) {
    _moveDesired.normalize();
    _moveTemp
      .copy(_moveForward)
      .multiplyScalar(-_moveDesired.z)
      .addScaledVector(_moveRight, _moveDesired.x)
      .normalize()
      .multiplyScalar(planarMotion.moveSpeedMps);

    _moveTangent.copy(planarMotion.velocity).setY(0);
    _moveTangent.lerp(_moveTemp, Math.min(1, planarMotion.moveAccelMps2 * dt / planarMotion.moveSpeedMps));
    planarMotion.velocity.copy(_moveTangent);
  } else {
    planarMotion.velocity.multiplyScalar(0.88);
  }

  planarMotion.velocity.y = 0;
  characterWorld.position.addScaledVector(planarMotion.velocity, dt);
  characterWorld.position.y = CHARACTER_CENTER_Y_M;
  if (planarMotion.clampPosition) planarMotion.clampPosition(characterWorld.position);
  else {
    characterWorld.position.x = THREE.MathUtils.clamp(characterWorld.position.x, -planarMotion.worldHalfWidth, planarMotion.worldHalfWidth);
    characterWorld.position.z = THREE.MathUtils.clamp(characterWorld.position.z, -planarMotion.worldHalfHeight, planarMotion.worldHalfHeight);
  }
  planarMotion.updateLod?.(characterWorld.position);
}


/* ===========================================================
   Camera staging per tab
=========================================================== */
const PRESENT = {
  default:  { camPos: new THREE.Vector3(0.0, 1.6, 4.25), fov: 60, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
  map:      { camPos: new THREE.Vector3(0.0, 14.0, 10.0), fov: 50, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
  inventory:{ camPos: new THREE.Vector3(0.25, 1.55, 4.05), fov: 58, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
  character:{ camPos: new THREE.Vector3(1.35, 1.55, 3.05), fov: 52, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
  cosmetics:{ camPos: new THREE.Vector3(-1.35, 1.55, 3.05), fov: 52, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
  settings: { camPos: new THREE.Vector3(0.0, 1.6, 4.25), fov: 60, charPos: new THREE.Vector3(0.0, CHARACTER_CENTER_Y_M, 0.0) },
};

const playerCamera = {
  followDistance: 40,
  cellOverviewEnabled: false,
  cellOverviewOffset: new THREE.Vector3(0, 1.6, 40),
};

const present = {
  camPos: camera.position.clone(),
  target: controls.target.clone(),
  fov: camera.fov,
  charPos: characterWorld.position.clone(),
  tCamPos: camera.position.clone(),
  tTarget: controls.target.clone(),
  tFov: camera.fov,
  tCharPos: characterWorld.position.clone(),
  camLerp: 0.10,
  targetLerp: 0.14,
  fovLerp: 0.10,
  charLerp: 0.12,
};

function applyPresentationForTab(tabId) {
  const p = PRESENT[tabId] ?? PRESENT.default;
  present.tCamPos.copy(worldPositionFromCharacterOffset(characterWorld.position, p.camPos));
  present.tFov = p.fov;
  if (!planarMotion.enabled) present.tCharPos.copy(p.charPos);
}

const _up = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _toChar = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _worldOffset = new THREE.Vector3();
const _moveForward = new THREE.Vector3();
const _moveRight = new THREE.Vector3();
const _moveDesired = new THREE.Vector3();
const _moveNormal = new THREE.Vector3();
const _moveForwardLocal = new THREE.Vector3();
const _moveTangent = new THREE.Vector3();
const _moveTemp = new THREE.Vector3();
const _aim = new THREE.Vector3();

function worldPositionFromCharacterOffset(characterPos, offset) {
  return _worldOffset.copy(characterPos).add(offset);
}

function computeAimTargetForCharacterNDC(camPos, charPos, nx, ny, fovDeg, aspect) {
  _forward.copy(charPos).sub(camPos).normalize();
  _right.crossVectors(_forward, _up).normalize();
  _camUp.crossVectors(_right, _forward).normalize();

  _toChar.copy(charPos).sub(camPos);
  const d = Math.max(0.001, _toChar.dot(_forward));

  const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5)) * d;
  const halfW = halfH * aspect;

  _offset.copy(_right).multiplyScalar(nx * halfW).add(_camUp.clone().multiplyScalar(ny * halfH));
  _aim.copy(charPos).sub(_offset);
  return _aim;
}

function desiredCharacterNdcForTab(tabId) {
  if (tabId === "map") return { nx: 0.0, ny: -0.72 };
  if (tabId === "character") return { nx: -0.58, ny: 0.0 };
  if (tabId === "cosmetics") return { nx: 0.58, ny: 0.0 };
  return { nx: 0.0, ny: 0.0 };
}

function setOverlayLightingEnabled(enabled) {
  if (enabled) {
    hemi.layers.enable(UI_CHAR_LAYER);
    dir.layers.enable(UI_CHAR_LAYER);
  } else {
    hemi.layers.disable(UI_CHAR_LAYER);
    dir.layers.disable(UI_CHAR_LAYER);
  }
}

function setUiMode(isOpen) {
  characterUi.visible = isOpen;
  setOverlayLightingEnabled(isOpen);
  overlayCanvas.style.opacity = isOpen ? "1" : "0";
  overlayCanvas.style.transition = "opacity 160ms ease";
  motionHud.style.display = isOpen || appState !== "game" ? "none" : "block";
}

/* ===========================================================
   App State
=========================================================== */
let db = null;
let savesCache = [];
let activeSaveId = null;

let uiOpen = true;

// Always main menu, then save files
let appState = "mainMenu"; // "mainMenu" | "saveFiles" | "game"
let activeTab = "map";

let uiCleanup = null;
let worldCleanup = null;
let worldMapToPlane = null;
let worldClampPlanePosition = null;
let worldSetLodFromPosition = null;
let worldGetCellViewFromPosition = null;

const tooltip = createTooltip();

/* ===========================================================
   UI render router
=========================================================== */
function cleanupPanel() {
  if (typeof uiCleanup === "function") uiCleanup();
  uiCleanup = null;
  tooltip.hide();
}

function renderHtmlPanel() {
  const panel = ensureUiPanel();
  setPanelVisible(panel, uiOpen);

  cleanupPanel();

  if (!uiOpen) {
    panel.innerHTML = "";
    renderDomTabsBar({ activeTab, visible: false, onClickTab: handleSetTab });
    return;
  }

  // Tabs only show in "game"
  renderDomTabsBar({ activeTab, visible: appState === "game", onClickTab: handleSetTab });

  // main flow
  if (appState === "mainMenu") {
    uiCleanup = buildMainMenu(panel, {
      onStart: () => {
        appState = "saveFiles";
        renderHtmlPanel();
      },
    });
    return;
  }

  if (appState === "saveFiles") {
    uiCleanup = buildSaveFiles(panel, {
      saves: savesCache,
      onPickSave: (id) => {
        activeSaveId = id;
        appState = "game";
        activeTab = "map";
        applyPresentationForTab(activeTab);
        renderHtmlPanel();
      },
      onBack: () => {
        appState = "mainMenu";
        renderHtmlPanel();
      },
    });
    return;
  }

  // game tabs
  const seed = activeSaveId ?? "seed";

  if (activeTab === "map") {
    uiCleanup = buildMapTab(panel, {
      seed,
      tooltip,
      db,
      activeSaveId,
      getUiState,
      setUiState,
      onNodeClick: (burg) => {
        if (!planarMotion.enabled || !worldMapToPlane) return;
        if (!Number.isFinite(burg?.x) || !Number.isFinite(burg?.y)) return;

        const nextPos = worldMapToPlane(burg.x, burg.y);
        nextPos.y = CHARACTER_CENTER_Y_M;
        worldClampPlanePosition?.(nextPos);

        characterWorld.position.copy(nextPos);
        planarMotion.velocity.set(0, 0, 0);
        worldSetLodFromPosition?.(nextPos);
        present.charPos.copy(nextPos);
        present.tCharPos.copy(nextPos);
        controls.target.copy(nextPos);
        present.target.copy(nextPos);
        present.tTarget.copy(nextPos);
      },
    });
  }
  else if (activeTab === "inventory") uiCleanup = buildInventoryTab(panel,  { seed, tooltip, db, activeSaveId});
  else if (activeTab === "character") uiCleanup = buildCharacterTab(panel,  { seed, tooltip, db, activeSaveId});
  else if (activeTab === "cosmetics") uiCleanup = buildCosmeticsTab(panel,  { seed, tooltip, db, activeSaveId});
  else if (activeTab === "settings") {
    uiCleanup = buildSettingsTab(panel, {
      seed,
      onQuit: () => {
        // Quit returns to main flow: main menu -> save files
        appState = "mainMenu";
        activeSaveId = null;
        activeTab = "map";
        applyPresentationForTab("default");
        renderHtmlPanel();
      },
      onBackToMainMenu: () => {
        appState = "mainMenu";
        renderHtmlPanel();
      },
      onSwitchCharacter: () => {
        appState = "saveFiles";
        renderHtmlPanel();
      },
    });
  } else {
    panel.innerHTML = `<div style="padding:16px; color:rgba(255,255,255,0.8); font:600 13px system-ui;">Unknown tab.</div>`;
    uiCleanup = () => {};
  }
}

async function handleSetTab(tabId) {
  if (appState !== "game") return;
  activeTab = tabId;
  applyPresentationForTab(activeTab);
  renderHtmlPanel();
}

/* ===========================================================
   Input
=========================================================== */
window.addEventListener("keydown", async (e) => {
  const moveKey = e.key.toLowerCase();
  if (moveKey in movementInput) {
    movementInput[moveKey] = true;
    e.preventDefault();
    return;
  }

  if (e.code === "KeyZ") {
    playerCamera.cellOverviewEnabled = !playerCamera.cellOverviewEnabled;
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    uiOpen = !uiOpen;
    controls.enabled = !uiOpen;

    if (uiOpen) applyPresentationForTab(appState === "game" ? activeTab : "default");
    else {
      applyPresentationForTab("default");
      controls.target.copy(characterWorld.position);
    }

    setUiMode(uiOpen);
    renderHtmlPanel();
    return;
  }

  // Hotkeys only work in game state
  if (appState === "game") {
    const tab = TABS.find((t) => t.hotkey === e.key);
    if (tab) {
      activeTab = tab.id;
      applyPresentationForTab(activeTab);
      renderHtmlPanel();
      return;
    }
  }

  if (e.key === "Escape") {
    // Escape returns to main menu if in game; or steps back if in save files
    if (!uiOpen) return;

    if (appState === "game") {
      appState = "mainMenu";
      activeSaveId = null;
      activeTab = "map";
      applyPresentationForTab("default");
      renderHtmlPanel();
      return;
    }

    if (appState === "saveFiles") {
      appState = "mainMenu";
      renderHtmlPanel();
      return;
    }
  }
});

window.addEventListener("keyup", (e) => {
  const moveKey = e.key.toLowerCase();
  if (!(moveKey in movementInput)) return;
  movementInput[moveKey] = false;
});

/* ===========================================================
   Init
=========================================================== */
async function init() {
  db = await openDB();

  try {
    const builtWorld = await buildWorldFromAzgaar({
      scene,
      url: "./afmg/Praneland Full 2025-12-28-23-09.json",
      layer: WORLD_LAYER,
    });
    worldCleanup = builtWorld.cleanup;
    fallbackGround.visible = false;
    fallbackGrid.visible = false;

    const worldPlane = builtWorld?.worldPlane;
    const mapSpace = builtWorld?.mapSpace;
    worldMapToPlane = mapSpace?.mapToPlane || null;
    worldClampPlanePosition = mapSpace?.clampPlanePosition || null;
    worldSetLodFromPosition = builtWorld?.setActiveCellFromPlanePosition || null;
    worldGetCellViewFromPosition = builtWorld?.getCellViewForPlanePosition || null;

    const settlements = Array.isArray(builtWorld?.settlementPositions) ? builtWorld.settlementPositions : [];
    const spawn = settlements.find((s) => s.isCapital) || settlements[0] || null;

    if (worldPlane && spawn?.position) {
      mountWorldGrid(worldPlane.widthMeters, worldPlane.heightMeters);
      const spawnPos = spawn.position.clone();
      spawnPos.y = CHARACTER_CENTER_Y_M;
      worldClampPlanePosition?.(spawnPos);

      characterWorld.position.copy(spawnPos);
      present.charPos.copy(spawnPos);
      present.tCharPos.copy(spawnPos);

      worldSetLodFromPosition?.(spawnPos);
      enablePlanarCharacterMotion({
        worldWidth: worldPlane.widthMeters,
        worldHeight: worldPlane.heightMeters,
        clampPosition: worldClampPlanePosition,
        updateLod: worldSetLodFromPosition,
      });

      playerCamera.followDistance = Math.max(40, CHARACTER_RADIUS_M * 4);
      PRESENT.default.camPos.set(0, 1.6, playerCamera.followDistance);

      const worldMaxSpan = Math.max(worldPlane.widthMeters, worldPlane.heightMeters);
      controls.maxDistance = Math.max(200, worldMaxSpan * 0.3);
      controls.maxPolarAngle = Math.PI / 2 - 0.02;

      controls.target.copy(spawnPos);
      present.target.copy(spawnPos);
      present.tTarget.copy(spawnPos);
    }
  } catch (err) {
    console.warn("[App] World build failed; using fallback plane/grid.", err);
    fallbackGround.visible = true;
    fallbackGrid.visible = true;
    motionHud.style.display = "none";
  }

  let saves = await getAllSaves(db);
  if (!saves.length) {
    await createSave(db, "Character 0001");
    saves = await getAllSaves(db);
  }
  savesCache = saves;

  // Always start in main menu, then save files
  uiOpen = true;
  controls.enabled = false;
  setUiMode(true);

  applyPresentationForTab("default");
  renderHtmlPanel();

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  if (appState === "game") {
    const cameraTab = uiOpen ? activeTab : "default";
    if (!uiOpen && playerCamera.cellOverviewEnabled && worldGetCellViewFromPosition) {
      const cellView = worldGetCellViewFromPosition(characterWorld.position);
      if (cellView) {
        const overviewDistance = Math.max(cellView.radius * 1.85, playerCamera.followDistance);
        playerCamera.cellOverviewOffset.set(0, overviewDistance * 1.05, overviewDistance);
        PRESENT.default.camPos.copy(playerCamera.cellOverviewOffset);
      }
    } else {
      PRESENT.default.camPos.set(0, 1.6, playerCamera.followDistance);
    }

    const pTab = PRESENT[cameraTab] ?? PRESENT.default;
    if (uiOpen) {
      present.tCamPos.copy(worldPositionFromCharacterOffset(characterWorld.position, pTab.camPos));
    }
    present.tFov = pTab.fov;

    if (planarMotion.enabled) updatePlanarCharacterMotion();

    if (uiOpen) present.camPos.lerp(present.tCamPos, present.camLerp);
    present.fov = THREE.MathUtils.lerp(present.fov, present.tFov, present.fovLerp);
    present.charPos.lerp(present.tCharPos, present.charLerp);

    if (uiOpen) camera.position.copy(present.camPos);
    if (Math.abs(camera.fov - present.fov) > 0.001) {
      camera.fov = present.fov;
      camera.updateProjectionMatrix();
    }

    if (!planarMotion.enabled) {
      characterWorld.position.copy(present.charPos);
    }

    const { nx, ny } = desiredCharacterNdcForTab(cameraTab);
    const aim = computeAimTargetForCharacterNDC(camera.position, characterWorld.position, nx, ny, camera.fov, camera.aspect);

    present.tTarget.copy(aim);
    present.target.lerp(present.tTarget, present.targetLerp);
    if (uiOpen) controls.target.copy(present.target);
    else {
      controls.target.copy(characterWorld.position);
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.minDistance = 4;
    }
  } else {
    // Keep a stable default target when not in game
    controls.target.lerp(new THREE.Vector3(0, 1.05, 0), 0.10);
  }

  updateMotionHud();

  present.charPos.copy(characterWorld.position);

  if (characterUi.visible) {
    characterUi.position.copy(characterWorld.position);
    characterUi.quaternion.copy(characterWorld.quaternion);
    characterUi.scale.copy(characterWorld.scale);
  }

  controls.update();

  camera.layers.set(WORLD_LAYER);
  worldRenderer.render(scene, camera);

  if (characterUi.visible) {
    camera.layers.set(UI_CHAR_LAYER);
    overlayRenderer.render(scene, camera);
  } else {
    overlayRenderer.clear(true, true, true);
  }

  camera.layers.set(WORLD_LAYER);
}

init();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  worldRenderer.setSize(window.innerWidth, window.innerHeight);
  overlayRenderer.setSize(window.innerWidth, window.innerHeight);
});
