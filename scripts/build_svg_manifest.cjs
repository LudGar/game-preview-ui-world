const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const ROOT_DIR = path.resolve(__dirname, "..");
const CSV_FILE = path.join(ROOT_DIR, "afmg", "Praneland Burgs 2025-12-28-15-17.csv");
const EXPORTS_DIR = path.join(ROOT_DIR, "exports");
const OUT_MANIFEST = path.join(EXPORTS_DIR, "manifest.json");

const KM_PER_PX = 15;     // your rule: 1 world px = 15 km
const DENSITY = 3000;     // people per km² (tunable, see note below)

const START_ID = 1;
const PREFIX_ID = true;

fs.mkdirSync(EXPORTS_DIR, { recursive: true });

function parsePopFromRowOrUrl(row) {
  // Primary: CSV column
  const raw = row["Population"];
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(String(raw).trim().replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }

  // Fallback: generator URL (city: population, village: pop)
  const link = String(row["City Generator Link"] || "");
  try {
    const qs = link.split("?")[1] || "";
    const p = new URLSearchParams(qs);
    const v = p.get("population") ?? p.get("pop");
    if (!v) return null;
    const n = Number(String(v).trim().replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function popToDiameterKm(pop) {
  const area = Math.max(0, pop) / DENSITY;
  return 2 * Math.sqrt(area / Math.PI);
}

function safeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 120) || "Unnamed";
}

function toNumber(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function readCsvRows() {
  return await new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (row) => out.push(row))
      .on("end", () => resolve(out))
      .on("error", reject);
  });
}

// Parse width/height from <svg ...> (width/height or viewBox fallback)
function readSvgSize(svgPath) {
  try {
    const head = fs.readFileSync(svgPath, "utf8").slice(0, 4000);

    const wMatch = head.match(/\bwidth\s*=\s*"([^"]+)"/i);
    const hMatch = head.match(/\bheight\s*=\s*"([^"]+)"/i);
    const vbMatch = head.match(/\bviewBox\s*=\s*"([^"]+)"/i);

    const parseLen = (s) => {
      if (!s) return null;
      const m = String(s).trim().match(/^([0-9]*\.?[0-9]+)/);
      return m ? Number(m[1]) : null;
    };

    let w = wMatch ? parseLen(wMatch[1]) : null;
    let h = hMatch ? parseLen(hMatch[1]) : null;

    if ((w == null || h == null) && vbMatch) {
      const parts = vbMatch[1].trim().split(/\s+|,/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [, , vbW, vbH] = parts;
        if (w == null) w = vbW;
        if (h == null) h = vbH;
      }
    }

    // Reasonable fallback so frames still exist
    if (!Number.isFinite(w)) w = 1000;
    if (!Number.isFinite(h)) h = 1000;

    return { w, h };
  } catch {
    return { w: 1000, h: 1000 };
  }
}

(async () => {
  const rows = await readCsvRows();

  const items = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];

    const burg = row["Burg"] ?? "";
    const idNum = START_ID + rowIndex;
    const idStr = String(idNum).padStart(4, "0");

    const pop = parsePopFromRowOrUrl(row);    
    const diam_km = pop != null ? popToDiameterKm(pop) : null;
    const diam_px = diam_km != null ? (diam_km / KM_PER_PX) : null;

    const base = safeName(burg || `burg_${idStr}`);
    const fileName = PREFIX_ID ? `${idStr}_${base}.svg` : `${base}.svg`;
    const svgPath = path.join(EXPORTS_DIR, fileName);
    if (!fs.existsSync(svgPath)) continue;

    const x = toNumber(row["X"]);
    const y = toNumber(row["Y"]);
    const lat = toNumber(row["Latitude"]);
    const lon = toNumber(row["Longitude"]);
    if (x == null || y == null) continue;

    const { w, h } = readSvgSize(svgPath);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    items.push({
      id: idStr,
      burg,
      file: `exports/${fileName}`,
      x, y,
      lat, lon,
      w, h,
      pop,
      diam_km,
      diam_px
    });
  }

  if (!items.length) {
    console.error("No items written. Check SVG filenames and CSV X/Y values.");
    process.exit(1);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    csvFile: path.basename(CSV_FILE),
    count: items.length,
    bounds: { minX, minY, maxX, maxY },
    items,
  };

  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote: ${OUT_MANIFEST}`);
  console.log(`Items: ${items.length}`);
})();