// settings.js
function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mkBtn(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.padding = "12px 12px";
  b.style.borderRadius = "14px";
  b.style.border = "1px solid rgba(255,255,255,0.12)";
  b.style.background = "rgba(12,16,22,0.70)";
  b.style.color = "rgba(255,255,255,0.92)";
  b.style.font = "800 12px system-ui";
  b.style.letterSpacing = "0.06em";
  b.style.cursor = "pointer";
  b.onmouseenter = () => (b.style.borderColor = "rgba(255,255,255,0.22)");
  b.onmouseleave = () => (b.style.borderColor = "rgba(255,255,255,0.12)");
  return b;
}

function mkToggleRow({ label, checked, onChange }) {
  const row = document.createElement("label");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "12px";
  row.style.padding = "10px 12px";
  row.style.borderRadius = "12px";
  row.style.border = "1px solid rgba(255,255,255,0.10)";
  row.style.background = "rgba(8,10,13,0.45)";
  row.style.maxWidth = "380px";

  const text = document.createElement("span");
  text.textContent = label;
  text.style.font = "700 12px system-ui";
  text.style.letterSpacing = "0.05em";
  text.style.color = "rgba(255,255,255,0.9)";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.style.width = "18px";
  input.style.height = "18px";
  input.style.cursor = "pointer";

  input.addEventListener("change", () => onChange?.(input.checked));

  row.appendChild(text);
  row.appendChild(input);
  return row;
}

export function buildSettingsTab(panel, {
  seed,
  onQuit,
  onBackToMainMenu,
  onSwitchCharacter,
  worldRenderVisibility,
  onSetWorldRenderVisibility,
}) {
  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,0.10);
        font:800 14px system-ui;
        letter-spacing:0.08em;
        color:rgba(255,255,255,0.9);
        display:flex; align-items:center; justify-content:space-between;">
        <div>SETTINGS</div>
        <div style="font:600 12px system-ui; opacity:0.65;">seed: ${htmlEscape(seed)}</div>
      </div>

      <div style="flex:1; padding:16px; display:flex; flex-direction:column; gap:12px; overflow:auto;">
        <div style="color:rgba(255,255,255,0.70); font:600 13px system-ui;">
          World render layers.
        </div>

        <div id="settingsWorldToggles" style="display:flex; flex-direction:column; gap:8px;"></div>

        <div style="margin-top:6px; color:rgba(255,255,255,0.70); font:600 13px system-ui;">
          Actions.
        </div>

        <div id="settingsBtns" style="display:flex; flex-direction:column; gap:10px; max-width:380px;"></div>

        <div style="margin-top:auto; color:rgba(255,255,255,0.55); font:600 12px system-ui;">
          Quit returns to main flow (main menu → save files).
        </div>
      </div>
    </div>
  `;

  const togglesBox = panel.querySelector("#settingsWorldToggles");
  const box = panel.querySelector("#settingsBtns");

  const current = {
    terrain: worldRenderVisibility?.terrain ?? true,
    oceans: worldRenderVisibility?.oceans ?? true,
    roads: worldRenderVisibility?.roads ?? true,
    settlements: worldRenderVisibility?.settlements ?? true,
    rivers: worldRenderVisibility?.rivers ?? true,
    cells: worldRenderVisibility?.cells ?? false,
  };

  const toggleDefs = [
    ["terrain", "SHOW TERRAIN"],
    ["oceans", "SHOW OCEANS"],
    ["roads", "SHOW ROADS"],
    ["settlements", "SHOW SETTLEMENTS / BURGS"],
    ["rivers", "SHOW RIVERS"],
    ["cells", "SHOW CELL BORDERS"],
  ];

  for (const [key, label] of toggleDefs) {
    const row = mkToggleRow({
      label,
      checked: current[key],
      onChange: (checked) => {
        current[key] = checked;
        onSetWorldRenderVisibility?.({ ...current });
      },
    });
    togglesBox.appendChild(row);
  }

  const bQuit = mkBtn("QUIT");
  const bMain = mkBtn("BACK TO MAIN MENU");
  const bSwitch = mkBtn("SWITCH CHARACTER (SAVE FILES)");

  bQuit.addEventListener("click", () => onQuit?.());
  bMain.addEventListener("click", () => onBackToMainMenu?.());
  bSwitch.addEventListener("click", () => onSwitchCharacter?.());

  box.appendChild(bQuit);
  box.appendChild(bMain);
  box.appendChild(bSwitch);

  return () => {};
}
