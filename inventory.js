// inventory.js
import { createTooltip } from "./tooltip.js";

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rarityColor(r) {
  if (r === "Exotic") return "rgba(255,210,110,0.90)";
  if (r === "Legendary") return "rgba(170,140,255,0.90)";
  if (r === "Rare") return "rgba(110,180,255,0.90)";
  if (r === "Uncommon") return "rgba(120,220,170,0.90)";
  return "rgba(255,255,255,0.75)";
}

function makeDemoItems(seed) {
  const s = String(seed ?? "seed");
  const base = s.split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 1337;

  const names = [
    "Field Ration", "Polymer Plate", "Cipher Key", "Ion Cell", "Med Patch",
    "Nano Fiber", "Alloy Shard", "Signal Relic", "Data Spike", "Plasma Fuse",
    "Holo Tag", "Arc Coil", "Riveted Strap", "Lens Kit", "Circuit Bloom",
  ];

  const items = [];
  for (let i = 0; i < 48; i++) {
    const n = names[(base + i * 7) % names.length];
    const qty = ((base + i * 13) % 19) + 1;
    const rarity = ["Common", "Uncommon", "Rare", "Legendary", "Exotic"][(base + i * 3) % 5];
    items.push({
      id: `it_${i}`,
      name: n,
      qty,
      rarity,
      desc: `Placeholder item description for ${n}.`,
    });
  }
  return items;
}

export function buildInventoryTab(panel, { seed, tooltip }) {
  const tip = tooltip ?? createTooltip();
  const items = makeDemoItems(seed);

  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:800 14px system-ui;
        letter-spacing:0.08em;
        color:rgba(255,255,255,0.9);
        display:flex; align-items:center; justify-content:space-between;">
        <div>INVENTORY</div>
        <div style="font:600 12px system-ui; opacity:0.65;">seed: ${htmlEscape(seed)}</div>
      </div>

      <div id="invGrid" style="
        flex:1;
        padding:14px;
        display:grid;
        grid-template-columns:repeat(8, 1fr);
        gap:10px;
        align-content:start;
        overflow:auto;
      "></div>
    </div>
  `;

  const grid = panel.querySelector("#invGrid");

  // We attach a single move listener while hovering any cell
  let hoverCount = 0;
  const onMove = (e) => tip.move({ clientX: e.clientX, clientY: e.clientY });

  for (const it of items) {
    const cell = document.createElement("div");
    cell.style.aspectRatio = "1 / 1";
    cell.style.borderRadius = "14px";
    cell.style.background = "rgba(8,10,13,0.65)";
    cell.style.border = "1px solid rgba(255,255,255,0.10)";
    cell.style.boxShadow = "0 10px 30px rgba(0,0,0,0.22)";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.padding = "10px";
    cell.style.cursor = "default";

    cell.innerHTML = `
      <div style="font:800 11px system-ui; letter-spacing:0.06em; color:${rarityColor(it.rarity)};">
        ${htmlEscape(it.rarity)}
      </div>
      <div style="margin-top:auto; font:800 12px system-ui; color:rgba(255,255,255,0.90); line-height:1.15;">
        ${htmlEscape(it.name)}
      </div>
      <div style="margin-top:6px; font:800 12px system-ui; color:rgba(255,255,255,0.65);">
        x${it.qty}
      </div>
    `;

    cell.addEventListener("mouseenter", (e) => {
      hoverCount++;
      if (hoverCount === 1) document.addEventListener("mousemove", onMove, { passive: true });

      tip.show({
        title: it.name,
        meta: `${it.rarity} • Qty ${it.qty}`,
        desc: it.desc,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    cell.addEventListener("mouseleave", () => {
      hoverCount = Math.max(0, hoverCount - 1);
      if (hoverCount === 0) document.removeEventListener("mousemove", onMove);
      tip.hide();
    });

    // Extra: keep it tight even if mousemove is throttled
    cell.addEventListener("mousemove", (e) => tip.move({ clientX: e.clientX, clientY: e.clientY }));

    grid.appendChild(cell);
  }

  return () => {
    document.removeEventListener("mousemove", onMove);
    tip.hide();
  };
}