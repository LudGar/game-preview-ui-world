// tooltip.js
export function createTooltip() {
  let el = document.getElementById("uiTooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "uiTooltip";
    el.style.position = "fixed";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.zIndex = "999999";
    el.style.pointerEvents = "none";
    el.style.transform = "translate(-9999px, -9999px)";
    el.style.opacity = "0";
    el.style.transition = "opacity 70ms linear";
    el.style.maxWidth = "360px";
    document.body.appendChild(el);
  }

  let lastX = 0, lastY = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const position = (clientX, clientY) => {
    lastX = clientX;
    lastY = clientY;

    const pad = 14;
    const w = el.offsetWidth || 320;
    const h = el.offsetHeight || 160;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Offset away from cursor
    let x = clientX + 18;
    let y = clientY + 18;

    // Keep inside viewport
    x = clamp(x, pad, vw - w - pad);
    y = clamp(y, pad, vh - h - pad);

    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  const show = (payload) => {
    // Preferred API: { html, clientX, clientY }
    if (payload?.html) {
      el.innerHTML = payload.html;
    } else {
      // Back-compat: { title, meta, desc } -> minimal block (no "header chrome")
      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      el.innerHTML = `
        <div style="
          padding:10px 10px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.10);
          background:rgba(8,10,13,0.55);
          backdrop-filter: blur(8px);
          color:rgba(255,255,255,0.92);
          font:600 12px system-ui;
          min-width:240px;
        ">
          ${payload?.title ? `<div style="font:900 13px system-ui;">${esc(payload.title)}</div>` : ""}
          ${payload?.meta ? `<div style="margin-top:6px; opacity:0.75;">${esc(payload.meta)}</div>` : ""}
          ${payload?.desc ? `<div style="margin-top:8px; opacity:0.72;">${esc(payload.desc)}</div>` : ""}
        </div>
      `;
    }

    el.style.opacity = "1";
    const x = payload?.clientX ?? lastX;
    const y = payload?.clientY ?? lastY;
    position(x, y);
  };

  const move = ({ clientX, clientY }) => {
    position(clientX, clientY);
  };

  const hide = () => {
    el.style.opacity = "0";
    el.style.transform = "translate(-9999px, -9999px)";
  };

  return { show, move, hide };
}