// character.js
import { ARMOR_GROUPS, VARIANTS_BY_KEY, RARITIES } from "./data.js";

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

function rarityColor(rarityIdOrLabel) {
  const needle = String(rarityIdOrLabel || "").toLowerCase();
  const r =
    RARITIES.find((x) => String(x.id).toLowerCase() === needle) ||
    RARITIES.find((x) => String(x.label).toLowerCase() === needle);
  return r?.color || "rgba(255,255,255,0.75)";
}

function buildNodesFromArmorGroups() {
  const nodes = [];
  for (const g of ARMOR_GROUPS || []) {
    for (const s of g.slots || []) {
      nodes.push({
        id: s.id,
        label: s.label,
        key: s.key,
        group: g.group,
        x: s.x ?? 50,
        y: s.y ?? 50,
        icon: s.icon ?? "",
        basePoints: s.basePoints ?? null,
      });
    }
  }
  return nodes;
}

function makeVariantItem(slot, variant, idx) {
  const rarityCycle = [
    "consumer",
    "industrial",
    "mil_spec",
    "tactical",
    "restricted",
    "classified",
    "seraph",
    "ultra",
    "exotic",
    "extraordinary",
    "pearlescent",
    "effervescent",
  ];
  return {
    id: `${slot.id}:${variant}`,
    slotId: slot.id,
    slotKey: slot.key,
    slotLabel: slot.label,
    group: slot.group,
    variant,
    name: `${slot.label} • ${variant}`,
    rarity: rarityCycle[idx % rarityCycle.length],
  };
}

function tooltipSingleItemHtml({ title, subtitle, item, stateLine }) {
  const c = item?.rarity ? rarityColor(item.rarity) : "rgba(255,255,255,0.65)";
  const itemName = item?.name ? htmlEscape(item.name) : "Empty";
  const rarityLabel = item?.rarity ? htmlEscape(item.rarity) : "—";

  return `
    <div style="display:flex; flex-direction:column; gap:10px; min-width:260px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
        <div style="min-width:0;">
          <div style="font:900 13px system-ui; letter-spacing:0.06em; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${htmlEscape(title ?? "—")}
          </div>
          <div style="margin-top:6px; font:800 11px system-ui; letter-spacing:0.08em; color:rgba(255,255,255,0.68);">
            ${htmlEscape(subtitle ?? "")}
          </div>
          ${
            stateLine
              ? `<div style="margin-top:6px; font:800 11px system-ui; color:rgba(255,255,255,0.58);">
                  ${htmlEscape(stateLine)}
                </div>`
              : ""
          }
        </div>
        ${
          item
            ? `<div style="
                width:10px; height:10px; border-radius:999px;
                background:${c};
                box-shadow:0 0 0 6px rgba(255,255,255,0.06);
                flex:0 0 auto;
              "></div>`
            : ""
        }
      </div>

      <div style="height:1px; background:rgba(255,255,255,0.10);"></div>

      <div style="
        padding:10px 10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(8,10,13,0.55);
      ">
        <div style="font:900 12px system-ui; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${itemName}
        </div>
        <div style="margin-top:6px; font:900 10px system-ui; letter-spacing:0.08em; color:${c};">
          ${rarityLabel}
        </div>
      </div>

      ${
        !item
          ? `<div style="font:700 11px system-ui; color:rgba(255,255,255,0.55);">
              Select an item on the right to equip.
            </div>`
          : ""
      }
    </div>
  `;
}

// ✅ Named export expected by app.js
export function buildCharacterTab(
  panel,
  { seed, db, activeSaveId, getUiState = null, setUiState = null, tooltip = null }
) {
  const nodes = buildNodesFromArmorGroups();
  let selectedId = nodes[0]?.id ?? null;

  // Local in-memory (persisted if helpers exist)
  let uiCache = {
    equippedArmor: {}, // { [slotId]: variant }
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
        <div>CHARACTER</div>
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

          <svg id="charNodeSvg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
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
            Hover = equipped preview • Click = select slot • Click item = equip
          </div>
        </div>

        <div style="
          border-radius:16px;
          background:rgba(5,7,10,0.40);
          border:1px solid rgba(255,255,255,0.10);
          overflow:hidden;
          display:flex; flex-direction:column;
        ">
          <div id="charNodeHeader" style="
            padding:12px 12px;
            border-bottom:1px solid rgba(255,255,255,0.10);
            font:800 12px system-ui; letter-spacing:0.08em;
            color:rgba(255,255,255,0.82);
            display:flex; align-items:center; justify-content:space-between;
            gap:10px;
          ">
            <div id="charNodeHeaderLeft">—</div>
            <div id="charNodeHeaderRight" style="font:800 11px system-ui; color:rgba(255,255,255,0.60); white-space:nowrap;"></div>
          </div>

          <div id="charNodeItems" style="
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

  const svg = panel.querySelector("#charNodeSvg");
  const headerLeft = panel.querySelector("#charNodeHeaderLeft");
  const headerRight = panel.querySelector("#charNodeHeaderRight");
  const itemsEl = panel.querySelector("#charNodeItems");

  const getSlot = (slotId) => nodes.find((n) => n.id === slotId) || null;

  const equippedVariantFor = (slotId) => uiCache?.equippedArmor?.[slotId] || null;

  const getEquippedItemForSlot = (slot) => {
    const v = equippedVariantFor(slot.id);
    if (!v) return null;
    const variants = VARIANTS_BY_KEY?.[slot.key] || [];
    const idx = Math.max(0, variants.indexOf(v));
    return makeVariantItem(slot, v, idx);
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
      const it = makeVariantItem(slot, variant, idx);
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

      card.innerHTML = `
        <div style="font:900 10px system-ui; letter-spacing:0.08em; color:${rarityColor(it.rarity)};">
          ${htmlEscape(it.rarity)}
        </div>
        <div style="margin-top:6px; font:900 12px system-ui; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${htmlEscape(variant)}
        </div>
        <div style="margin-top:6px; font:700 11px system-ui; color:rgba(255,255,255,0.55);">
          key: ${htmlEscape(slot.key)}
        </div>
      `;

      card.addEventListener("mouseenter", (e) => {
        if (!tooltip?.show) return;
        tooltip.show({
          html: tooltipSingleItemHtml({
            title: slot.label,
            subtitle: `Armor > ${slot.group} > ${slot.label}`,
            item: it,
            stateLine: isEquipped ? "Status: Equipped" : "Status: Available",
          }),
          clientX: e.clientX,
          clientY: e.clientY,
        });
      });
      card.addEventListener("mousemove", (e) => tooltip?.move?.({ clientX: e.clientX, clientY: e.clientY }));
      card.addEventListener("mouseleave", () => tooltip?.hide?.());

      card.addEventListener("click", async () => {
        uiCache.equippedArmor[slot.id] = variant;

        if (activeSaveId && typeof setUiState === "function") {
          await setUiState(db, activeSaveId, { equippedArmor: uiCache.equippedArmor });
        }

        renderItems(slot);
        renderNodes(); // updates bright/dim ring
      });

      itemsEl.appendChild(card);
    });
  };

  // Tooltip wiring for node hover: show only equipped
  let hoverCount = 0;
  const onDocMove = (e) => tooltip?.move?.({ clientX: e.clientX, clientY: e.clientY });

  const nodeTooltipEnter = (slot, e) => {
    if (!tooltip?.show) return;
    hoverCount++;
    if (hoverCount === 1) document.addEventListener("mousemove", onDocMove, { passive: true });

    const equippedItem = getEquippedItemForSlot(slot);
    tooltip.show({
      html: tooltipSingleItemHtml({
        title: slot.label,
        subtitle: `Armor > ${slot.group} > ${slot.label}`,
        item: equippedItem,
        stateLine: equippedItem ? `Equipped: ${equippedItem.variant}` : "Equipped: —",
      }),
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
      badge.setAttribute("fill", equipped ? "rgb(0, 183, 255)" : "rgba(255, 255, 255, 0.62)");
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

        const strokeW = selected ? "2.4" : hover ? (equipped ? "2.1" : "1.6") : (equipped ? "1.9" : "1.1");

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
          await setUiState(db, activeSaveId, { characterSelectedNode: selectedId });
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

      if (ui?.equippedArmor && typeof ui.equippedArmor === "object") {
        uiCache.equippedArmor = { ...ui.equippedArmor };
      }
      if (ui?.characterSelectedNode && nodes.some((n) => n.id === ui.characterSelectedNode)) {
        selectedId = ui.characterSelectedNode;
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