const express = require("express");
const path = require("path");

const app = express();
const ROOT = path.resolve(__dirname, "..");

// Silence Chromium devtools probe
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.type("application/json").send("{}");
});

// Optional: silence favicon 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

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