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

export function buildSettingsTab(panel, { seed, onQuit, onBackToMainMenu, onSwitchCharacter }) {
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

      <div style="flex:1; padding:16px; display:flex; flex-direction:column; gap:12px;">
        <div style="color:rgba(255,255,255,0.70); font:600 13px system-ui;">
          Actions (placeholder).
        </div>

        <div id="settingsBtns" style="display:flex; flex-direction:column; gap:10px; max-width:380px;"></div>

        <div style="margin-top:auto; color:rgba(255,255,255,0.55); font:600 12px system-ui;">
          Quit returns to main flow (main menu → save files).
        </div>
      </div>
    </div>
  `;

  const box = panel.querySelector("#settingsBtns");

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