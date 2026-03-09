const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AFMG_DIR = path.join(ROOT, 'afmg');

const CITY_GENERATOR_BASE = 'https://watabou.github.io/city-generator/';

function pickMapFile(inputArg) {
  if (inputArg) {
    const full = path.isAbsolute(inputArg) ? inputArg : path.join(ROOT, inputArg);
    if (!fs.existsSync(full)) throw new Error(`Map file not found: ${full}`);
    return full;
  }

  const candidates = fs
    .readdirSync(AFMG_DIR)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  if (!candidates.length) throw new Error(`No .json files found in ${AFMG_DIR}`);
  return path.join(AFMG_DIR, candidates[0]);
}

function boolFlag(v) {
  return Number(v) > 0 ? 1 : 0;
}

function toSeaValue(coast) {
  return coast ? '0.2' : '0';
}

function buildCityUrl({ mapSeed, burg, cell }) {
  const burgId = Number(burg?.i || 0);
  const seed = `${mapSeed}${String(burgId).padStart(4, '0')}`;

  const coast = Number(burg?.port || 0) > 0;
  const river = Number(cell?.r || 0) > 0;

  const params = new URLSearchParams({
    size: '25',
    seed,
    citadel: String(boolFlag(burg?.citadel)),
    urban_castle: String(boolFlag(burg?.capital)),
    plaza: String(boolFlag(burg?.plaza)),
    temple: String(boolFlag(burg?.temple)),
    walls: String(boolFlag(burg?.walls)),
    shantytown: String(boolFlag(burg?.shanty)),
    coast: String(coast ? 1 : 0),
    river: String(river ? 1 : 0),
    greens: '1',
    gates: '-1',
    sea: toSeaValue(coast),
  });

  return `${CITY_GENERATOR_BASE}?${params.toString()}`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const mapPath = pickMapFile(process.argv[2]);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  const mapSeed = String(map?.info?.seed ?? '').trim();
  if (!/^\d+$/.test(mapSeed)) throw new Error(`Invalid map seed: ${mapSeed}`);

  const burgs = Array.isArray(map?.pack?.burgs) ? map.pack.burgs : [];
  const cells = Array.isArray(map?.pack?.cells) ? map.pack.cells : [];

  const rows = [];
  for (const burg of burgs) {
    if (!burg || burg.removed || !Number.isFinite(burg.x) || !Number.isFinite(burg.y)) continue;
    if (!Number.isInteger(burg.i) || burg.i <= 0) continue;

    const cell = Number.isInteger(burg.cell) ? cells[burg.cell] : null;
    const cityLink = buildCityUrl({ mapSeed, burg, cell });

    rows.push({
      Id: burg.i,
      Burg: burg.name || `burg_${burg.i}`,
      State: burg.state ?? '',
      Population: burg.population ?? '',
      X: burg.x,
      Y: burg.y,
      'City Generator Link': cityLink,
    });
  }

  rows.sort((a, b) => a.Id - b.Id);

  const outName = `${path.basename(mapPath, path.extname(mapPath))} Burgs.csv`;
  const outPath = path.join(AFMG_DIR, outName);

  const headers = ['Id', 'Burg', 'State', 'Population', 'X', 'Y', 'City Generator Link'];
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));

  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Map: ${mapPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Wrote: ${outPath}`);
}

main();
