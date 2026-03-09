function sanitizeBurgPayload(burg, fallbackCell = -1) {
  if (!burg || typeof burg !== "object") return null;
  const cell = Number.isInteger(burg.cell) ? burg.cell : fallbackCell;
  if (!Number.isInteger(cell) || cell < 0) return null;

  return {
    i: Number.isInteger(burg.i) ? burg.i : 100000 + cell,
    cell,
    name: typeof burg.name === "string" && burg.name.trim() ? burg.name.trim() : `Burg ${cell}`,
    x: Number(burg.x),
    y: Number(burg.y),
    population: Number.isFinite(Number(burg.population)) ? Number(burg.population) : 0.8,
    capital: !!burg.capital,
    state: Number.isInteger(burg.state) ? burg.state : 0,
    culture: Number.isInteger(burg.culture) ? burg.culture : 0,
    type: typeof burg.type === "string" && burg.type.trim() ? burg.type.trim() : "Settlement",
  };
}

async function readJson(url, fallback = null) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

const LOCAL_STORAGE_KEY = "gpuiw:burg-preview-cache:v1";

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readLocalCache() {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCache(cache) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore write issues (quota, private browsing, etc.)
  }
}

function getLocalBurgForCell(cellId) {
  const cache = readLocalCache();
  const candidate = cache[String(cellId)];
  return sanitizeBurgPayload(candidate, cellId);
}

function setLocalBurgForCell(cellId, burg) {
  const payload = sanitizeBurgPayload(burg, cellId);
  if (!payload) return false;

  const cache = readLocalCache();
  cache[String(cellId)] = payload;
  writeLocalCache(cache);
  return true;
}

async function loadBurgFromAfmgDir(cellId) {
  const payload = await readJson(`/afmg/burgs/${cellId}.json`, null);
  return sanitizeBurgPayload(payload?.burg || payload, cellId);
}

export async function loadAllCachedBurgs() {
  const localCache = readLocalCache();
  const mergedByCell = new Map();

  for (const [cellKey, burg] of Object.entries(localCache)) {
    const cellId = Number.parseInt(cellKey, 10);
    const normalized = sanitizeBurgPayload(burg, cellId);
    if (normalized) mergedByCell.set(normalized.cell, normalized);
  }

  const payload = await readJson("/api/burgs", { burgs: [] });
  const fileBurgs = Array.isArray(payload?.burgs) ? payload.burgs : [];
  for (const burg of fileBurgs) {
    const normalized = sanitizeBurgPayload(burg);
    if (normalized) mergedByCell.set(normalized.cell, normalized);
  }

  return [...mergedByCell.values()];
}

export async function loadCachedBurgForCell(cellId) {
  if (!Number.isInteger(cellId) || cellId < 0) return null;

  const fromFile = await loadBurgFromAfmgDir(cellId);
  if (fromFile) {
    setLocalBurgForCell(cellId, fromFile);
    return fromFile;
  }

  return getLocalBurgForCell(cellId);
}

export async function saveCachedBurgForCell(cellId, burg) {
  if (!Number.isInteger(cellId) || cellId < 0) return false;
  return setLocalBurgForCell(cellId, burg);
}
