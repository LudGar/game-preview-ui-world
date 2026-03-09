const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const ROOT = path.resolve(__dirname, "..");
const BURGS_DIR = path.join(ROOT, "afmg", "burgs");

// Silence Chromium devtools probe
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.type("application/json").send("{}");
});

// Optional: silence favicon 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

async function ensureBurgsDir() {
  await fs.mkdir(BURGS_DIR, { recursive: true });
}

function burgPathForCell(cellId) {
  return path.join(BURGS_DIR, `${cellId}.json`);
}

app.get("/api/burgs", async (req, res) => {
  try {
    await ensureBurgsDir();
    const files = (await fs.readdir(BURGS_DIR)).filter((f) => f.endsWith(".json"));
    const burgs = [];
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(BURGS_DIR, file), "utf8");
        const burg = JSON.parse(raw);
        if (burg && typeof burg === "object") burgs.push(burg);
      } catch {
        // ignore invalid records
      }
    }
    res.json({ burgs });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list burgs" });
  }
});

app.get("/api/burgs/:cellId", async (req, res) => {
  const cellId = Number.parseInt(req.params.cellId, 10);
  if (!Number.isInteger(cellId) || cellId < 0) return res.status(400).json({ error: "Invalid cell id" });
  try {
    await ensureBurgsDir();
    const raw = await fs.readFile(burgPathForCell(cellId), "utf8");
    res.json({ burg: JSON.parse(raw) });
  } catch (err) {
    if (err && err.code === "ENOENT") return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: err.message || "Failed to load burg" });
  }
});

app.post("/api/burgs/:cellId", express.json({ limit: "256kb" }), async (req, res) => {
  const cellId = Number.parseInt(req.params.cellId, 10);
  if (!Number.isInteger(cellId) || cellId < 0) return res.status(400).json({ error: "Invalid cell id" });
  const payload = req.body;
  if (!payload || typeof payload !== "object") return res.status(400).json({ error: "Invalid payload" });

  const normalized = {
    ...payload,
    cell: cellId,
    i: Number.isInteger(payload.i) ? payload.i : 100000 + cellId,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : `Burg ${cellId}`,
    x: Number(payload.x),
    y: Number(payload.y),
    population: Number.isFinite(Number(payload.population)) ? Number(payload.population) : 0.8,
    capital: !!payload.capital,
    state: Number.isInteger(payload.state) ? payload.state : 0,
    culture: Number.isInteger(payload.culture) ? payload.culture : 0,
    type: typeof payload.type === "string" && payload.type.trim() ? payload.type.trim() : "Settlement",
  };
  if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    await ensureBurgsDir();
    await fs.writeFile(burgPathForCell(cellId), JSON.stringify(normalized, null, 2), "utf8");
    res.json({ ok: true, burg: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to save burg" });
  }
});

// --- AZGAAR FMG DATA (map json + csv) ---
app.use(
  "/afmg",
  express.static(path.join(ROOT, "afmg"), {
    index: false,
    redirect: false
  })
);

// --- CITY GENERATOR ---
app.get(["/mfcg", "/mfcg/"], (req, res) => {
  res.sendFile(path.join(ROOT, "mfcg", "index.html"));
});
app.use("/mfcg", express.static(path.join(ROOT, "mfcg"), { index: false, redirect: false }));

// --- VILLAGE GENERATOR ---
app.get(["/mfvg", "/mfvg/"], (req, res) => {
  res.sendFile(path.join(ROOT, "mfvg", "index.html"));
});
app.use("/mfvg", express.static(path.join(ROOT, "mfvg"), { index: false, redirect: false }));

// --- EXPORTS (manifest.json + svg files) ---
app.use("/exports", express.static(path.join(ROOT, "exports"), { index: false, redirect: false }));

// --- VIEWER ---
app.get(["/viewer", "/viewer/"], (req, res) => {
  res.sendFile(path.join(ROOT, "viewer", "index.html"));
});
app.use("/viewer", express.static(path.join(ROOT, "viewer"), { index: false, redirect: false }));

const PORT = 3187;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`City:    http://localhost:${PORT}/mfcg/`);
  console.log(`Village: http://localhost:${PORT}/mfvg/`);
  console.log(`Viewer:  http://localhost:${PORT}/viewer/`);
  console.log(`Exports: http://localhost:${PORT}/exports/manifest.json`);
});
