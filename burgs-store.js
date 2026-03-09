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

export async function loadAllCachedBurgs() {
  const payload = await readJson("/api/burgs", { burgs: [] });
  const burgs = Array.isArray(payload?.burgs) ? payload.burgs : [];
  return burgs
    .map((b) => sanitizeBurgPayload(b))
    .filter(Boolean);
}

export async function loadCachedBurgForCell(cellId) {
  if (!Number.isInteger(cellId) || cellId < 0) return null;
  const payload = await readJson(`/api/burgs/${cellId}`, null);
  return sanitizeBurgPayload(payload?.burg || payload, cellId);
}

export async function saveCachedBurgForCell(cellId, burg) {
  if (!Number.isInteger(cellId) || cellId < 0) return false;
  const payload = sanitizeBurgPayload(burg, cellId);
  if (!payload) return false;

  try {
    const res = await fetch(`/api/burgs/${cellId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return !!res.ok;
  } catch {
    return false;
  }
}
