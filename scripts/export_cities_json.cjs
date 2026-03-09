const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const AFMG_DIR = path.join(ROOT_DIR, "afmg");

function boolFlag(v) {
  return Number(v) > 0 ? 1 : 0;
}

function toSeaValue(coast) {
  return coast ? "0.2" : "0";
}

function buildMfcgCityUrl({ mapSeed, burg, cell, cityBaseUrl }) {
  const safeSeed = /^\d+$/.test(String(mapSeed || "").trim()) ? String(mapSeed).trim() : "0000";
  const burgId = Number(burg?.i || 0);
  const seed = `${safeSeed}${String(burgId).padStart(4, "0")}`;

  const coast = Number(burg?.port || 0) > 0;
  const river = Number(cell?.r || 0) > 0;
  const burgName = String(burg?.name || `Burg ${burgId}`);

  const params = new URLSearchParams([
    ["size", "25"],
    ["seed", seed],
    ["name", burgName],
    ["citadel", String(boolFlag(burg?.citadel))],
    ["urban_castle", String(boolFlag(burg?.capital))],
    ["plaza", String(boolFlag(burg?.plaza))],
    ["temple", String(boolFlag(burg?.temple))],
    ["walls", String(boolFlag(burg?.walls))],
    ["shantytown", String(boolFlag(burg?.shanty))],
    ["coast", String(coast ? 1 : 0)],
    ["river", String(river ? 1 : 0)],
    ["greens", "1"],
    ["gates", "-1"],
    ["sea", toSeaValue(coast)],
  ]);

  const base = String(cityBaseUrl || "").trim() || "http://localhost:3187/mfcg/index.html";
  return `${base}?${params.toString()}`;
}

async function findDefaultMapPath() {
  const entries = await fs.readdir(AFMG_DIR, { withFileTypes: true });
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  if (jsonFiles.length === 0) {
    throw new Error(`No .json map files found in ${AFMG_DIR}`);
  }

  const stats = await Promise.all(
    jsonFiles.map(async (entry) => ({
      name: entry.name,
      stat: await fs.stat(path.join(AFMG_DIR, entry.name)),
    }))
  );

  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return path.join(AFMG_DIR, stats[0].name);
}

async function loadMapJson(mapPath) {
  const selectedPath = mapPath ? path.resolve(ROOT_DIR, mapPath) : await findDefaultMapPath();
  const raw = await fs.readFile(selectedPath, "utf8");
  const map = JSON.parse(raw);
  return { map, mapPath: selectedPath };
}

function normalizeCity({ mapSeed, burg, cell, cityBaseUrl }) {
  return {
    id: Number.isInteger(burg?.i) ? burg.i : null,
    cell: Number.isInteger(burg?.cell) ? burg.cell : null,
    name: burg?.name || null,
    state: Number.isInteger(burg?.state) ? burg.state : null,
    population: Number.isFinite(Number(burg?.population)) ? Number(burg.population) : null,
    x: Number.isFinite(Number(burg?.x)) ? Number(burg.x) : null,
    y: Number.isFinite(Number(burg?.y)) ? Number(burg.y) : null,
    cityUrl: buildMfcgCityUrl({ mapSeed, burg, cell, cityBaseUrl }),
  };
}

function buildCitiesPayload({ map, cityBaseUrl }) {
  const pack = map && typeof map === "object" ? map.pack : null;
  const burgs = Array.isArray(pack?.burgs)
    ? pack.burgs.filter((burg) => burg && Number.isInteger(burg.i) && Number.isInteger(burg.cell))
    : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const mapSeed = String(map?.seed || "0000");

  const cities = burgs.map((burg) => {
    const cell = Number.isInteger(burg.cell) ? cells[burg.cell] : null;
    return normalizeCity({ mapSeed, burg, cell, cityBaseUrl });
  });

  return {
    generatedAt: new Date().toISOString(),
    mapSeed,
    total: cities.length,
    cities,
  };
}

function buildSingleCityPayload({ map, cellId, cityBaseUrl }) {
  const pack = map && typeof map === "object" ? map.pack : null;
  const burgs = Array.isArray(pack?.burgs) ? pack.burgs : [];
  const cells = Array.isArray(pack?.cells) ? pack.cells : [];
  const mapSeed = String(map?.seed || "0000");

  const burg = burgs.find((entry) => entry && Number.isInteger(entry.cell) && entry.cell === cellId);
  if (!burg) return null;

  const cell = Number.isInteger(burg.cell) ? cells[burg.cell] : null;
  return {
    generatedAt: new Date().toISOString(),
    mapSeed,
    city: normalizeCity({ mapSeed, burg, cell, cityBaseUrl }),
  };
}

module.exports = {
  buildCitiesPayload,
  buildSingleCityPayload,
  loadMapJson,
};

if (require.main === module) {
  (async () => {
    const mapArg = process.argv[2];
    const outArg = process.argv[3] || path.join(ROOT_DIR, "exports", "cities.json");
    const { map } = await loadMapJson(mapArg);
    const payload = buildCitiesPayload({ map });
    await fs.mkdir(path.dirname(outArg), { recursive: true });
    await fs.writeFile(outArg, JSON.stringify(payload, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(`Exported ${payload.total} cities to ${outArg}`);
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  });
}
