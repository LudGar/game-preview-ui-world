// cosmetics.js
import {
  COSMETIC_GROUPS,
  VARIANTS_BY_KEY,
  STARS,
  STYLE_GROUPS,
  RATING,
  WEAR_PROFILES,
} from "./data.js";

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearSvgNodes(svg) {
  svg.querySelectorAll("[data-node-id]").forEach((n) => n.remove());
}

function hashString(str) {
  // stable, deterministic (FNV-1a-ish)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFrom(arr, seed) {
  if (!arr || arr.length === 0) return null;
  return arr[seed % arr.length];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function starsToBaseRatingIndex(starsCount) {
  // Requirement you gave:
  // 5★ => SS (rating_6)
  // then walk downward.
  // So mapping: 1★=>C (rating_2), 2★=>B (rating_3), 3★=>A (rating_4), 4★=>S (rating_5), 5★=>SS (rating_6)
  return clamp(starsCount + 1, 1, 6);
}

function getStarsObjByCount(starsCount) {
  const id = `stars_${clamp(starsCount, 1, 5)}`;
  return STARS.find((s) => s.id === id) || STARS[0] || { id, label: "★☆☆☆☆", key: "Crude", color: "rgba(170,180,200,.55)" };
}

function getRatingObjByIndex(idx1to6) {
  const id = `rating_${clamp(idx1to6, 1, 6)}`;
  return RATING.find((r) => r.id === id) || RATING[0] || { id, label: "D", key: "Barely Present", color: "rgba(170,180,200,.55)" };
}

function getWearProfile(percent) {
  const p = clamp(Math.round(percent), 0, 100);
  for (const w of WEAR_PROFILES || []) {
    if (p >= w.min && p <= w.max) return { name: w.name, percent: p };
  }
  return { name: "Used", percent: p };
}

function buildNodesFromCosmeticGroups() {
  // Auto-layout groups into vertical bands, slots spread across band.
  const nodes = [];
  const groups = COSMETIC_GROUPS || [];
  const bands = Math.max(1, groups.length);

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const slots = g.slots || [];
    const t = (gi + 0.5) / bands;
    const y = 18 + t * 70;

    for (let si = 0; si < slots.length; si++) {
      const s = slots[si];
      const x = 18 + (slots.length === 1 ? 32 : (si / (slots.length - 1)) * 64);

      nodes.push({
        id: s.id,
        label: s.label,
        key: s.key,
        group: g.group,
        x,
        y,
        icon: s.icon || "",
      });
    }
  }
  return nodes;
}

function computeStyleRatings(seedStr, starsCount) {
  const styles = (STYLE_GROUPS || []).slice(0, 6);
  if (styles.length !== 6) {
    // If data changes later, fall back safely
    return {
      mainStyle: styles[0] || null,
      rows: styles.map((sg) => ({ style: sg, rating: getRatingObjByIndex(1) })),
    };
  }

  const seed = hashString(seedStr);
  const mainIdx = seed % 6;
  const mainStyle = styles[mainIdx];

  const base = starsToBaseRatingIndex(starsCount);
  const rMain = getRatingObjByIndex(base);
  const rMinus1 = getRatingObjByIndex(base - 1);
  const rMinus2 = getRatingObjByIndex(base - 2);

  // Pick 3 styles (excluding main) for -1, remaining 2 for -2, deterministic order.
  const others = styles.map((s, i) => ({ s, i })).filter((x) => x.i !== mainIdx);
  // Deterministic shuffle-ish:
  others.sort((a, b) => (hashString(seedStr + ":" + a.s.id) - hashString(seedStr + ":" + b.s.id)));

  const minus1 = new Set(others.slice(0, 3).map((x) => x.s.id));
  const rows = styles.map((sg) => {
    if (sg.id === mainStyle.id) return { style: sg, rating: rMain, isMain: true };
    if (minus1.has(sg.id)) return { style: sg, rating: rMinus1, isMain: false };
    return { style: sg, rating: rMinus2, isMain: false };
  });

  return { mainStyle, rows };
}

function makeCosmeticItem(slot, variant, idx) {
  // Deterministic cosmetic “meta” based on slot+variant
  const seedStr = `${slot.key}|${slot.id}|${variant}`;
  const seed = hashString(seedStr);

  const starsCount = (seed % 5) + 1; // 1..5
  const starsObj = getStarsObjByCount(starsCount);

  const wearPercent = 35 + (seed % 66); // 35..100, skewed away from "Broken" for nicer visuals
  const wear = getWearProfile(wearPercent);

  const { mainStyle, rows } = computeStyleRatings(seedStr, starsCount);

  // Use node group/label as "category lines" (matches your example layout)
  const itemName = variant; // keep raw, you can swap later to canonical item names
  const categoryLine = slot.label; // e.g. "Hair Accessories"
  const groupLine = slot.group; // e.g. "Beads" (depending on your COSMETIC_GROUPS.group)

  const description = `"Description"`; // placeholder until you add real item descriptions

  return {
    id: `${slot.id}:${variant}`,
    slotId: slot.id,
    slotKey: slot.key,
    slotLabel: slot.label,
    group: slot.group,
    variant,
    name: itemName,
    starsCount,
    starsObj,
    mainStyle,
    styleRows: rows,
    wear,
    description,
    categoryLine,
    groupLine,
  };
}

function tooltipCosmeticHtml(item) {
  // If no item equipped/hovered, keep it minimal
  if (!item) {
    return `
      <div style="
        padding:10px 10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(8,10,13,0.55);
        min-width:260px;
      ">
        <div style="font:900 12px system-ui; color:rgba(255,255,255,0.75);">Empty</div>
      </div>
    `;
  }

  const starsLine = item?.starsObj?.label || "—";
  const starsColor = item?.starsObj?.color || "rgba(255,255,255,0.55)";
  const mainStyle = item?.mainStyle;

  const styleRowsHtml =
    item?.styleRows?.length
      ? item.styleRows
          .map((r) => {
            const accent = r.style?.accent || "rgba(255,255,255,0.35)";
            const rating = r.rating;
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                  <div style="width:8px; height:8px; border-radius:999px; background:${accent}; box-shadow:0 0 0 6px rgba(255,255,255,0.04);"></div>
                  <div style="font:800 12px system-ui; color:rgba(255,255,255,0.86); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${htmlEscape(r.style?.label || r.style?.id || "—")}
                  </div>
                </div>
                <div style="font:900 12px system-ui; letter-spacing:0.08em; color:${rating?.color || "rgba(255,255,255,0.55)"};">
                  ${htmlEscape(rating?.label || "—")}
                </div>
              </div>
            `;
          })
          .join("")
      : `<div style="font:700 12px system-ui; color:rgba(255,255,255,0.60);">No style data.</div>`;

  const wearLine = item?.wear ? `${item.wear.name} (${item.wear.percent}%)` : "—";

  return `
    <div style="
      padding:10px 10px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.10);
      background:rgba(8,10,13,0.55);
      min-width:290px;
    ">
      <!-- Name + Stars INLINE -->
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px;">
        <div style="min-width:0; font:900 13px system-ui; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${htmlEscape(item.name)}
        </div>
        <div style="flex:0 0 auto; font:900 12px system-ui; letter-spacing:0.08em; color:${starsColor}; white-space:nowrap;">
          ${htmlEscape(starsLine)}
        </div>
      </div>

      <div style="margin-top:6px; font:800 12px system-ui; color:rgba(255,255,255,0.70);">
        ${htmlEscape(item.groupLine ?? "—")}
      </div>
      <div style="margin-top:2px; font:700 12px system-ui; color:rgba(255,255,255,0.62);">
        ${htmlEscape(item.categoryLine ?? "—")}
      </div>

      <div style="margin-top:10px; height:1px; background:rgba(255,255,255,0.10);"></div>

      <div style="margin-top:10px; font:900 12px system-ui; color:rgba(255,255,255,0.82);">
        ${htmlEscape(mainStyle?.label || "—")}
      </div>

      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        ${styleRowsHtml}
      </div>

      <div style="margin-top:10px; height:1px; background:rgba(255,255,255,0.10);"></div>

      <div style="margin-top:10px; font:700 12px system-ui; color:rgba(255,255,255,0.70);">
        ${htmlEscape(item.description ?? `"Description"`)}
      </div>

      <div style="margin-top:10px; height:1px; background:rgba(255,255,255,0.10);"></div>

      <div style="margin-top:10px; font:900 12px system-ui; color:rgba(255,255,255,0.82);">
        ${htmlEscape(wearLine)}
      </div>
    </div>
  `;
}

// ✅ Named export expected by app.js
export function buildCosmeticsTab(
  panel,
  { seed, db, activeSaveId, getUiState = null, setUiState = null, tooltip = null }
) {
  const nodes = buildNodesFromCosmeticGroups();
  let selectedId = nodes[0]?.id ?? null;

  let uiCache = {
    equippedCosmetics: {}, // { [slotId]: variant }
  };

  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:800 14px system-ui;
        letter-spacing:0.08em;
        color:rgba(255,255,255,0.9);
        display:flex; align-items:center; justify-content:space-between;">
        <div>COSMETICS</div>
        <div style="font:600 12px system-ui; opacity:0.65;">seed: ${htmlEscape(seed)}</div>
      </div>

      <div style="flex:1; display:grid; grid-template-columns: 1.15fr 0.85fr; gap:14px; padding:14px;">
        <div style="
          position:relative;
          border-radius:16px;
          background:rgba(5,7,10,0.40);
          border:1px solid rgba(255,255,255,0.10);
          overflow:hidden;
        ">
          <div style="position:absolute; inset:0; opacity:0.14;
            background-image:
              linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
            background-size:28px 28px;">
          </div>

          <svg id="cosNodeSvg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
               style="position:absolute; inset:0; width:100%; height:100%;">
            <path d="M50 10 C44 10 40 14 40 20 C40 26 44 30 50 30 C56 30 60 26 60 20 C60 14 56 10 50 10 Z"
                  fill="rgba(255,255,255,0.10)"/>
            <path d="M35 34 C35 28 65 28 65 34 L62 60 C61 68 39 68 38 60 Z"
                  fill="rgba(255,255,255,0.08)"/>
            <path d="M42 60 L58 60 L56 86 C56 92 44 92 44 86 Z"
                  fill="rgba(255,255,255,0.07)"/>
          </svg>

          <div style="
            position:absolute; left:12px; bottom:12px;
            font:700 12px system-ui; color:rgba(255,255,255,0.70);
            background:rgba(12,16,22,0.55); border:1px solid rgba(255,255,255,0.10);
            border-radius:12px; padding:8px 10px;
          ">
            Hover node = equipped preview • Click node = select slot • Click item = equip
          </div>
        </div>

        <div style="
          border-radius:16px;
          background:rgba(5,7,10,0.40);
          border:1px solid rgba(255,255,255,0.10);
          overflow:hidden;
          display:flex; flex-direction:column;
        ">
          <div id="cosNodeHeader" style="
            padding:12px 12px;
            border-bottom:1px solid rgba(255,255,255,0.10);
            font:800 12px system-ui; letter-spacing:0.08em;
            color:rgba(255,255,255,0.82);
            display:flex; align-items:center; justify-content:space-between;
            gap:10px;
          ">
            <div id="cosNodeHeaderLeft">—</div>
            <div id="cosNodeHeaderRight" style="font:800 11px system-ui; color:rgba(255,255,255,0.60); white-space:nowrap;"></div>
          </div>

          <div id="cosNodeItems" style="
            padding:12px;
            display:grid;
            grid-template-columns: 1fr 1fr;
            gap:10px;
            align-content:start;
            overflow:auto;
          "></div>
        </div>
      </div>
    </div>
  `;

  const svg = panel.querySelector("#cosNodeSvg");
  const headerLeft = panel.querySelector("#cosNodeHeaderLeft");
  const headerRight = panel.querySelector("#cosNodeHeaderRight");
  const itemsEl = panel.querySelector("#cosNodeItems");

  const getSlot = (slotId) => nodes.find((n) => n.id === slotId) || null;
  const equippedVariantFor = (slotId) => uiCache?.equippedCosmetics?.[slotId] || null;

  const getEquippedItemForSlot = (slot) => {
    const v = equippedVariantFor(slot.id);
    if (!v) return null;
    const variants = VARIANTS_BY_KEY?.[slot.key] || [];
    const idx = Math.max(0, variants.indexOf(v));
    return makeCosmeticItem(slot, v, idx);
  };

  const renderItems = (slot) => {
    itemsEl.innerHTML = "";
    if (!slot) {
      headerLeft.textContent = "—";
      headerRight.textContent = "";
      return;
    }

    headerLeft.textContent = slot.label;
    const equipped = equippedVariantFor(slot.id);
    headerRight.textContent = equipped ? `Equipped: ${equipped}` : "Equipped: —";

    const variants = VARIANTS_BY_KEY?.[slot.key] || [];
    if (!variants.length) {
      const empty = document.createElement("div");
      empty.style.gridColumn = "1 / -1";
      empty.style.color = "rgba(255,255,255,0.60)";
      empty.style.font = "600 12px system-ui";
      empty.textContent = "No variants for this key in data.js.";
      itemsEl.appendChild(empty);
      return;
    }

    variants.forEach((variant, idx) => {
      const it = makeCosmeticItem(slot, variant, idx);
      const isEquipped = equipped === variant;

      const card = document.createElement("div");
      card.style.borderRadius = "14px";
      card.style.background = "rgba(8,10,13,0.65)";
      card.style.border = isEquipped
        ? "1px solid rgba(255,255,255,0.55)"
        : "1px solid rgba(255,255,255,0.10)";
      card.style.boxShadow = isEquipped ? "0 0 0 2px rgba(255,255,255,0.12) inset" : "none";
      card.style.padding = "10px 10px";
      card.style.cursor = "pointer";

      const starsColor = it.starsObj?.color || "rgba(255,255,255,0.55)";

      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font:900 11px system-ui; letter-spacing:0.08em; color:${starsColor}; white-space:nowrap;">
            ${htmlEscape(it.starsObj?.label || "—")}
          </div>
          <div style="font:800 11px system-ui; color:rgba(255,255,255,0.62); white-space:nowrap;">
            ${htmlEscape(it.mainStyle?.label || "—")}
          </div>
        </div>

        <div style="margin-top:8px; font:900 12px system-ui; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${htmlEscape(variant)}
        </div>
        <div style="margin-top:6px; font:700 11px system-ui; color:rgba(255,255,255,0.55);">
          ${htmlEscape(it.wear?.name || "—")}
        </div>
      `;

      // Tooltip: single item (this item)
      card.addEventListener("mouseenter", (e) => {
        if (!tooltip?.show) return;
        tooltip.show({
          html: tooltipCosmeticHtml(
            it,
            slot.label,
            `Cosmetics > ${slot.group} > ${slot.label}`,
            isEquipped ? "Status: Equipped" : "Status: Available"
          ),
          clientX: e.clientX,
          clientY: e.clientY,
        });
      });
      card.addEventListener("mousemove", (e) => tooltip?.move?.({ clientX: e.clientX, clientY: e.clientY }));
      card.addEventListener("mouseleave", () => tooltip?.hide?.());

      // Equip on click
      card.addEventListener("click", async () => {
        uiCache.equippedCosmetics[slot.id] = variant;

        if (activeSaveId && typeof setUiState === "function") {
          await setUiState(db, activeSaveId, { equippedCosmetics: uiCache.equippedCosmetics });
        }

        renderItems(slot);
        renderNodes(); // updates bright/dim ring
      });

      itemsEl.appendChild(card);
    });
  };

  // Node hover tooltip: equipped only (or empty)
  let hoverCount = 0;
  const onDocMove = (e) => tooltip?.move?.({ clientX: e.clientX, clientY: e.clientY });

  const nodeTooltipEnter = (slot, e) => {
    if (!tooltip?.show) return;
    hoverCount++;
    if (hoverCount === 1) document.addEventListener("mousemove", onDocMove, { passive: true });

    const equippedItem = getEquippedItemForSlot(slot);
    tooltip.show({
      html: tooltipCosmeticHtml(
        equippedItem,
        slot.label,
        `Cosmetics > ${slot.group} > ${slot.label}`,
        equippedItem ? `Equipped: ${equippedItem.variant}` : "Equipped: —"
      ),
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const nodeTooltipLeave = () => {
    hoverCount = Math.max(0, hoverCount - 1);
    if (hoverCount === 0) document.removeEventListener("mousemove", onDocMove);
    tooltip?.hide?.();
  };

  const renderNodes = () => {
    clearSvgNodes(svg);

    for (const slot of nodes) {
      const equipped = !!equippedVariantFor(slot.id);

      // equipped = bright ring, empty = dim ring
      const strokeBase = equipped ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)";
      const dotBase = equipped ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.62)";

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", String(slot.x));
      ring.setAttribute("cy", String(slot.y));
      ring.setAttribute("r", "4.4");
      ring.setAttribute("fill", "rgba(0,0,0,0)");
      ring.setAttribute("stroke", strokeBase);
      ring.setAttribute("stroke-width", equipped ? "1.9" : "1.1");
      ring.setAttribute("data-node-id", slot.id);
      ring.style.cursor = "pointer";

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", String(slot.x));
      dot.setAttribute("cy", String(slot.y));
      dot.setAttribute("r", "2.3");
      dot.setAttribute("fill", dotBase);
      dot.setAttribute("data-node-id", slot.id);
      dot.style.cursor = "pointer";

      const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
      badge.setAttribute("x", String(slot.x));
      badge.setAttribute("y", String(slot.y));
      badge.setAttribute("fill", equipped ? "rgb(255, 178, 12)" : "rgb(255, 255, 255)");
      badge.setAttribute("font-size", "3");
      badge.setAttribute("font-family", "system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
      badge.setAttribute("font-weight", "900");
      badge.setAttribute("data-node-id", slot.id);
      badge.textContent = slot.icon || "";
      badge.style.cursor = "pointer";

      const isSelected = () => slot.id === selectedId;

      const setState = (hover) => {
        const selected = isSelected();

        const stroke = selected
          ? "rgba(255,255,255,0.75)"
          : hover
          ? equipped
            ? "rgba(255,255,255,0.65)"
            : "rgba(255,255,255,0.32)"
          : strokeBase;

        const strokeW = selected
          ? "2.4"
          : hover
          ? equipped
            ? "2.1"
            : "1.6"
          : equipped
          ? "1.9"
          : "1.1";

        ring.setAttribute("stroke", stroke);
        ring.setAttribute("stroke-width", strokeW);

        dot.setAttribute(
          "fill",
          selected
            ? "rgba(255,255,255,0.98)"
            : hover
            ? equipped
              ? "rgba(255,255,255,0.95)"
              : "rgba(255,255,255,0.78)"
            : dotBase
        );
      };

      const onEnter = (e) => {
        setState(true);
        nodeTooltipEnter(slot, e);
      };
      const onLeave = () => {
        setState(false);
        nodeTooltipLeave();
      };
      const onMove = (e) => tooltip?.move?.({ clientX: e.clientX, clientY: e.clientY });

      const onClick = async () => {
        selectedId = slot.id;

        if (activeSaveId && typeof setUiState === "function") {
          await setUiState(db, activeSaveId, { cosmeticsSelectedNode: selectedId });
        }

        renderNodes();
        renderItems(slot);
      };

      for (const el of [ring, dot, badge]) {
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        el.addEventListener("mousemove", onMove);
        el.addEventListener("click", onClick);
      }

      setState(false);
      svg.appendChild(ring);
      svg.appendChild(dot);
      svg.appendChild(badge);
    }
  };

  (async () => {
    if (db && activeSaveId && typeof getUiState === "function") {
      const ui = await getUiState(db, activeSaveId);

      if (ui?.equippedCosmetics && typeof ui.equippedCosmetics === "object") {
        uiCache.equippedCosmetics = { ...ui.equippedCosmetics };
      }
      if (ui?.cosmeticsSelectedNode && nodes.some((n) => n.id === ui.cosmeticsSelectedNode)) {
        selectedId = ui.cosmeticsSelectedNode;
      }
    }

    const selectedSlot = getSlot(selectedId) || nodes[0] || null;
    renderNodes();
    renderItems(selectedSlot);
  })();

  return () => {
    document.removeEventListener("mousemove", onDocMove);
    tooltip?.hide?.();
  };
}