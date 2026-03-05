const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const puppeteer = require("puppeteer");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT = path.resolve(__dirname, "..");
const AFMG_DIR = path.join(ROOT, "afmg");
const CSV_FILE = path.join(AFMG_DIR, "Praneland Burgs 2025-12-28-15-17.csv");

const OUT_DIR = path.join(ROOT, "exports", "dwellings");
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOCAL_VILLAGE_BASE = "http://localhost:3187/mfvg/";

function safeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 120) || "Unnamed";
}

function buildLocalVillageUrl(remoteUrl, burgName) {
  const urlStr = String(remoteUrl || "");
  const m = urlStr.match(/village-generator\/?(.*)$/i);
  if (!m) return null;

  let tail = m[1] || "";
  if (tail && !tail.startsWith("?")) tail = "?" + tail;

  const params = new URLSearchParams(tail.startsWith("?") ? tail.slice(1) : tail);

  // Ensure name is present for village URLs
  const name = params.get("name");
  if (!name || name.trim() === "") {
    if (burgName && String(burgName).trim() !== "") params.set("name", String(burgName).trim());
  }

  const qs = params.toString();
  return LOCAL_VILLAGE_BASE + (qs ? `?${qs}` : "");
}

async function readRows() {
  return await new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (row) => out.push(row))
      .on("end", () => resolve(out))
      .on("error", reject);
  });
}

async function waitForRegion(page, timeoutMs = 60000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate(() => {
      const isArray = window.__NATIVE_IS_ARRAY__;
      const r = window.__LAST_REGION__;
      return !!(r && isArray && typeof isArray === "function" && isArray(r.buildings));
    });
    if (ok) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function exportOneVillage(page, { idStr, burg, localUrl, overwrite }) {
  const outPath = path.join(OUT_DIR, `${idStr}_${safeName(burg)}.json`);
  if (!overwrite && fs.existsSync(outPath)) return { status: "skipped_exists", outPath };

  await page.goto(localUrl, { waitUntil: "domcontentloaded" });
  await sleep(500);

  const regionReady = await waitForRegion(page, 60000, 200);
  if (!regionReady) {
    const debugSnap = await page.evaluate(() => ({
      hasLastRegion: typeof window.__LAST_REGION__ !== "undefined",
      lastRegionType: typeof window.__LAST_REGION__,
      hasNativeIsArray: typeof window.__NATIVE_IS_ARRAY__ === "function"
    }));

    fs.writeFileSync(
      outPath,
      JSON.stringify(
        { id: idStr, burg, localUrl, error: "__LAST_REGION__ not captured within timeout", debugSnap },
        null,
        2
      ),
      "utf8"
    );
    return { status: "failed", outPath, error: "__LAST_REGION__ not captured within timeout" };
  }

  const result = await page.evaluate(async () => {
    console.log("[DWELLINGS] evaluate started (full buildings export)");

    function getLen(a) {
      try {
        const l = a && a.length;
        return typeof l === "number" && Number.isFinite(l) ? l : null;
      } catch {
        return null;
      }
    }

    function toRealArray(a) {
      const len = getLen(a);
      if (len == null) return [];
      const out = [];
      for (let i = 0; i < len; i++) {
        let v = null;
        try { v = a[i]; } catch {}
        out.push(v);
      }
      return out;
    }

    // Extract center position from your discovered keys:
    // - center {x,y} preferred
    // - pos {x,y} fallback
    // - bbox (minx/miny/maxx/maxy) fallback
    function extractXY(b) {
      try {
        if (b && b.center && typeof b.center === "object") {
          const x = Number(b.center.x);
          const y = Number(b.center.y);
          if (Number.isFinite(x) && Number.isFinite(y)) return { x, y, source: "center" };
        }
        if (b && b.pos && typeof b.pos === "object") {
          const x = Number(b.pos.x);
          const y = Number(b.pos.y);
          if (Number.isFinite(x) && Number.isFinite(y)) return { x, y, source: "pos" };
        }
        if (
          b &&
          Number.isFinite(b.minx) &&
          Number.isFinite(b.maxx) &&
          Number.isFinite(b.miny) &&
          Number.isFinite(b.maxy)
        ) {
          return { x: (b.minx + b.maxx) / 2, y: (b.miny + b.maxy) / 2, source: "bbox" };
        }
      } catch {}
      return { x: null, y: null, source: null };
    }

    function pickString(obj, keys) {
      for (const k of keys) {
        try {
          const v = obj?.[k];
          if (typeof v === "string" && v.trim() !== "") return v;
        } catch {}
      }
      return null;
    }

    const region = window.__LAST_REGION__;
    if (!region) return { ok: false, error: "__LAST_REGION__ missing" };

    const buildingsRaw = region.buildings;
    const buildingsLen = getLen(buildingsRaw);
    if (buildingsLen == null) {
      let keys = [];
      try { keys = Object.keys(region).slice(0, 120); } catch {}
      return { ok: false, error: "region.buildings has no usable length", regionKeys: keys };
    }

    const buildings = toRealArray(buildingsRaw);
    console.log("[DWELLINGS] buildings:", buildings.length);

    // Debug keys for first 3 buildings
    const debugKeys = [];
    for (let i = 0; i < Math.min(3, buildings.length); i++) {
      try {
        debugKeys.push({ i, keys: Object.keys(buildings[i] || {}).slice(0, 200) });
      } catch {
        debugKeys.push({ i, keys: [] });
      }
    }

    // Prepare output objects
    const out = buildings.map((b, i) => {
      const xy = extractXY(b);

      // Many buildings are unnamed; legend only shows a subset.
      // Try a few likely fields; if none, keep null.
      const name = pickString(b, ["name", "title", "label", "short"]);
      const kind = pickString(b, ["type", "kind", "category", "role"]); // best-effort
      const isGate = !!b?.gate;
      const isTower = !!b?.tower;
      const standalone = !!b?.standalone;

      // Rotation is not present in your debug keys; keep null.
      const rotation = null;

      const bounds =
        Number.isFinite(b?.minx) && Number.isFinite(b?.miny) && Number.isFinite(b?.maxx) && Number.isFinite(b?.maxy)
          ? {
              minx: b.minx,
              miny: b.miny,
              maxx: b.maxx,
              maxy: b.maxy,
              width: Number.isFinite(b?.width) ? b.width : null,
              depth: Number.isFinite(b?.depth) ? b.depth : null
            }
          : null;

      return {
        i,
        name,
        kind,
        x: xy.x,
        y: xy.y,
        xy_source: xy.source,
        rotation,
        bounds,
        radius: Number.isFinite(b?.radius) ? b.radius : null,
        height: Number.isFinite(b?.height) ? b.height : null,
        large: !!b?.large,
        short: !!b?.short,
        gate: isGate,
        tower: isTower,
        standalone,
        dwellingsUrl: null,
        hasOpen: !!(b && typeof b.open === "function")
      };
    });

    // Hook window.open and attach dwellings URLs by current building index
    let currentIndex = -1;
    const captured = new Set();
    let lastUrl = null;

    const origOpen = window.open;
    window.open = function (url) {
      try {
        if (typeof url === "string" && url.includes("watabou.github.io/dwellings/")) {
          captured.add(url);
          lastUrl = url;
          if (currentIndex >= 0 && out[currentIndex]) out[currentIndex].dwellingsUrl = url;
        }
      } catch {}
      return null;
    };

    try {
      let openable = 0;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b && typeof b.open === "function") {
          openable++;
          currentIndex = i;
          try { b.open(); } catch {}
          if (openable <= 5) console.log("[DWELLINGS] open() called for", i);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      currentIndex = -1;

      let withUrl = 0;
      for (const r of out) if (r.dwellingsUrl) withUrl++;

      console.log(
        "[DWELLINGS] urls:",
        captured.size,
        "withUrl:",
        withUrl,
        "lastUrl:",
        lastUrl
      );

      return {
        ok: true,
        buildingCount: buildings.length,
        openableCount: openable,
        dwellingsCount: withUrl,
        buildings: out,
        debugKeys,
        lastUrl
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e), debugKeys, lastUrl };
    } finally {
      window.open = origOpen;
    }
  });

  // Debug (optional)
  // console.log("NODE DEBUG keys:", Object.keys(result || {}));

  if (!result || !result.ok) {
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        { id: idStr, burg, localUrl, error: result?.error || "Unknown evaluate error", lastUrl: result?.lastUrl ?? null },
        null,
        2
      ),
      "utf8"
    );
    return { status: "failed", outPath, error: result?.error || "Unknown evaluate error" };
  }

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        id: idStr,
        burg,
        localUrl,
        buildingCount: result.buildingCount,
        openableCount: result.openableCount,
        dwellingsCount: result.dwellingsCount,
        lastUrl: result.lastUrl ?? null,
        buildings: result.buildings,
        debugKeys: result.debugKeys
      },
      null,
      2
    ),
    "utf8"
  );

  return { status: "ok", outPath, count: result.dwellingsCount ?? 0 };
}

async function main() {
  const rows = await readRows();
  const overwrite = process.argv.includes("--overwrite");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Hide warnings (e.g., the deprecated apple meta warning)
  page.on("console", (msg) => {
    if (msg.type() === "warning") return;
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture native Array.isArray before Watabou code can shadow Array
  await page.evaluateOnNewDocument(() => {
    window.__NATIVE_IS_ARRAY__ = (function () {
      try {
        return Array.isArray ? Array.isArray.bind(Array) : null;
      } catch {
        return null;
      }
    })();
  });

  let ok = 0, failed = 0, skipped = 0, processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const burg = row["Burg"] || `burg_${i + 1}`;
    const link = row["City Generator Link"] || "";
    const idStr = String(i + 1).padStart(4, "0");

    // Only village-generator rows
    if (!String(link).includes("village-generator")) continue;

    const localUrl = buildLocalVillageUrl(link, burg);
    if (!localUrl) continue;

    processed++;
    try {
      console.log(`→ [${idStr}] Dwellings export: ${burg}`);
      const r = await exportOneVillage(page, { idStr, burg, localUrl, overwrite });

      if (r.status === "ok") {
        ok++;
        console.log(`   ✓ ${r.count} dwellings → ${path.basename(r.outPath)}`);
      } else if (r.status === "skipped_exists") {
        skipped++;
        console.log(`   ↪ skipped (exists)`);
      } else {
        failed++;
        console.log(`   ⚠ failed: ${r.error}`);
      }
    } catch (e) {
      failed++;
      console.log(`   ⚠ exception: ${e?.message || e}`);
    }
  }

  await browser.close();
  console.log(`Done. processed=${processed} ok=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});