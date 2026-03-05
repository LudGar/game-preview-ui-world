const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const puppeteer = require("puppeteer");

const ROOT_DIR = path.resolve(__dirname, "..");
const CSV_FILE = path.join(ROOT_DIR, "mfcg", "Praneland Burgs 2025-12-28-15-17.csv");
const OUTPUT_DIR = path.join(ROOT_DIR, "exports");

// Local endpoints (served by your server.cjs)
const LOCAL_CITY_BASE = "http://localhost:3187/mfcg/";
const LOCAL_VILLAGE_BASE = "http://localhost:3187/mfvg/";

// Performance + behavior
const CONCURRENCY = 5;              // 4–6 recommended
const START_ID = 1;                 // start filenames at 0001
const PREFIX_ID = true;             // 0001_Burgname.svg
const OVERWRITE_EXISTING = false;   // true = overwrite, false = skip if exists

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function safeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 120) || "Unnamed";
}

function buildLocalUrlFromRemote(remoteUrl, burgName) {
  const urlStr = String(remoteUrl);

  const isVillage = /village-generator/i.test(urlStr);
  const base = isVillage ? LOCAL_VILLAGE_BASE : LOCAL_CITY_BASE;

  // Keep everything after "...city-generator" or "...village-generator"
  const m = urlStr.match(/(?:^|\/)(?:city-generator|village-generator)\/?(.*)$/i);
  if (!m) throw new Error("URL missing city-generator or village-generator");

  let tail = m[1] || "";
  if (tail && !tail.startsWith("?")) tail = "?" + tail;

  const params = new URLSearchParams(tail.startsWith("?") ? tail.slice(1) : tail);

  // ✅ Fix village missing name
  if (isVillage) {
    const name = params.get("name");
    if (!name || name.trim() === "") {
      if (burgName && String(burgName).trim() !== "") {
        params.set("name", String(burgName).trim());
      }
    }
  }

  // Ensure export=svg appended once
  if (!params.has("export") || params.get("export") !== "svg") {
    params.set("export", "svg");
  }

  const qs = params.toString();
  return base + (qs ? `?${qs}` : "");
}

async function setupPage(page) {
  await page.setViewport({ width: 1400, height: 900 });

  await page.evaluateOnNewDocument(() => {
    window.__EXPORTED_SVG__ = null;

    const setIfSvg = (text) => {
      try {
        const t = String(text || "");
        if (t.includes("<svg")) window.__EXPORTED_SVG__ = t;
      } catch {}
    };

    // Intercept FileSaver.js export (Exporter.saveText -> window.saveAs(blob,...))
    const patchSaveAs = () => {
      if (typeof window.saveAs !== "function" || window.saveAs.__patched) return;

      const orig = window.saveAs.bind(window);
      function wrappedSaveAs(blob, name, noAutoBOM) {
        try {
          // blob is a Blob([svgString], {type:"image/svg+xml"}) in your generator :contentReference[oaicite:1]{index=1}
          if (blob && typeof blob.text === "function") {
            blob.text().then((txt) => setIfSvg(txt)).catch(() => {});
          }
        } catch {}
        // IMPORTANT: block the real download in automation (we save ourselves)
        return;
        // If you ever want the real browser download too, use: return orig(blob, name, noAutoBOM);
      }

      wrappedSaveAs.__patched = true;
      window.saveAs = wrappedSaveAs;
    };

    // saveAs may be defined after scripts load; keep trying briefly.
    patchSaveAs();
    const t0 = Date.now();
    const timer = setInterval(() => {
      patchSaveAs();
      if (typeof window.saveAs === "function" && window.saveAs.__patched) clearInterval(timer);
      if (Date.now() - t0 > 10000) clearInterval(timer);
    }, 25);
  });
}

async function exportOne(page, job) {
  const { rowIndex, row } = job;

  const remoteUrl = row["City Generator Link"];
  if (!remoteUrl) return;

  const burg = row["Burg"];

  // ID starts at 0001
  const idNum = START_ID + rowIndex;
  const idStr = String(idNum).padStart(4, "0");

  const baseName = safeName(burg || `burg_${idStr}`);
  const fileName = PREFIX_ID ? `${idStr}_${baseName}.svg` : `${baseName}.svg`;
  const outPath = path.join(OUTPUT_DIR, fileName);

  if (!OVERWRITE_EXISTING && fs.existsSync(outPath)) {
    console.log(`↪ [${idStr}] Skipped (exists): ${fileName}`);
    return;
  }

  const localUrl = buildLocalUrlFromRemote(remoteUrl, burg);
  
  console.log(`\n→ [${idStr}] Exporting: ${fileName}`);
  console.log(`   Burg:   ${burg || "(none)"}`);
  console.log(`   Remote: ${remoteUrl}`);
  console.log(`   Local:  ${localUrl}`);

  // Reset capture per run
  await page.evaluate(() => {
    window.__EXPORTED_SVG__ = null;
  });

  const t0 = Date.now();

  // Navigate
  await page.goto(localUrl, { waitUntil: "networkidle0" });

  const tLoaded = Date.now();
  console.log(`   Loaded in ${(tLoaded - t0) / 1000}s, waiting for export…`);

  // Wait for SVG payload to be captured
  await page.waitForFunction(
    () => window.__EXPORTED_SVG__ && String(window.__EXPORTED_SVG__).includes("<svg"),
    { timeout: 60000 } // give slow exports more time
  );

  const tExported = Date.now();
  console.log(`   Export captured in ${(tExported - tLoaded) / 1000}s (total ${(tExported - t0) / 1000}s)`);

  const svg = await page.evaluate(() => window.__EXPORTED_SVG__);
  fs.writeFileSync(outPath, svg, "utf8");

  console.log(`   Saved: ${outPath}`);
}

(async () => {
  const rows = await new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (row) => out.push(row))
      .on("end", () => resolve(out))
      .on("error", reject);
  });

  const queue = rows.map((row, rowIndex) => ({ row, rowIndex }));
  let cursor = 0;

  const browser = await puppeteer.launch({ headless: "new" });

  async function worker(id) {
    const page = await browser.newPage();
    await setupPage(page);

    while (true) {
      if (cursor >= queue.length) break;
      const job = queue[cursor++];

      try {
        await exportOne(page, job);
      } catch (err) {
        const burg = job.row?.["Burg"] || "no Burg";
        console.warn(`⚠️ Worker ${id} failed row ${job.rowIndex} (${burg}): ${err.message}`);
      }
    }

    await page.close();
  }

  console.log(
    `Starting export with ${CONCURRENCY} workers | overwrite=${OVERWRITE_EXISTING}`
  );

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  await browser.close();
  console.log("All exports completed ✅");
})();