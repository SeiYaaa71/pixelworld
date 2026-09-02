/* ==========================================================================
   ui.js — binôme 2, branche feat/ui-interaction
   --------------------------------------------------------------------------
   Tâche 2.1  sélection des couleurs (input color + raccourcis) et coordonnées
   Tâche 2.2  clic gauche -> émission Socket.io PLACE_PIXEL { x, y, color }
   Tâche 2.3  cooldown visuel : clic bloqué + compte à rebours et barre

   --- CONTRAT DOM (à faire figurer dans index.html) -------------------------
     <canvas id="board"></canvas>
     <div id="cursor-coords" hidden></div>
     <div class="hud">
       <span class="hud-item">pos <b id="hud-coords">—</b></span>
       <span class="hud-item">zoom <b id="hud-zoom">1×</b></span>
     </div>
     <div class="dock">
       <div class="swatches" id="swatches" role="group" aria-label="Couleurs"></div>
       <span class="picker">
         <input type="color" id="color-picker" value="#222222" aria-label="Couleur libre">
         <span class="picker-face" id="picker-face"></span>
       </span>
       <div class="dock-sep"></div>
       <div class="cooldown" id="cooldown">
         <span class="cooldown-label" id="cooldown-label">Prêt</span>
         <div class="cooldown-track"><div class="cooldown-fill" id="cooldown-fill"></div></div>
       </div>
     </div>
     <div class="toast" id="toast"></div>

     Charger socket.io AVANT ce fichier :
       <script src="/socket.io/socket.io.js"></script>
       <script src="/ui.js"></script>

   --- CONTRAT RÉSEAU (binôme serveur) ---------------------------------------
     sortant   PLACE_PIXEL   { x, y, color }   x,y entiers 0..999 ; color "#rrggbb"
     entrant   PIXEL_PLACED  { x, y, color }   un pixel posé par quelqu'un
     entrant   CANVAS_STATE  Uint8Array/ArrayBuffer de 1000*1000*3 octets (RVB)
                             ou tableau [{x, y, color}]
     entrant   PLACE_REJECTED { reason }       pose refusée : on annule l'affichage

   Le module tourne sans serveur : si io() est absent, les poses restent
   locales et un avertissement part en console. Ça permet de bosser l'UI
   avant que le backend soit prêt.
   ========================================================================== */

"use strict";

(() => {

/* ==========================================================================
   1. Configuration
   ========================================================================== */

const GRID = 1000;              // grille carrée, coordonnées 0..999
const COOLDOWN_MS = 1500;       // consigne : 1 à 2 s
const MIN_SCALE = 0.05;
const MAX_SCALE = 48;
const GRID_LINES_FROM = 10;     // zoom à partir duquel on trace le quadrillage
const DRAG_THRESHOLD = 3;       // px avant qu'un appui devienne un déplacement

const EVENTS = {
  place:    "PLACE_PIXEL",
  placed:   "PIXEL_PLACED",
  state:    "CANVAS_STATE",
  rejected: "PLACE_REJECTED",
};

// Raccourcis. Le sélecteur libre reste la source de vérité de la couleur.
const PALETTE = [
  "#ffffff", "#e4e4e4", "#888888", "#222222",
  "#ffa7d1", "#e50000", "#e59500", "#a06a42",
  "#e5d900", "#94e044", "#02be01", "#00d3dd",
  "#0083c7", "#0000ea", "#cf6ee4", "#820080",
];

/* ==========================================================================
   2. État
   ========================================================================== */

const state = {
  color: "#222222",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  hover: null,          // { x, y } en coordonnées grille, ou null
  cooldownUntil: 0,
};

const $ = (id) => document.getElementById(id);

const canvas   = $("board");
const ctx      = canvas.getContext("2d");
const elCursor = $("cursor-coords");
const elCoords = $("hud-coords");
const elZoom   = $("hud-zoom");
const elFill   = $("cooldown-fill");
const elLabel  = $("cooldown-label");
const elCool   = $("cooldown");
const elPicker = $("color-picker");
const elFace   = $("picker-face");
const elToast  = $("toast");

// Tampon 1:1 : un pixel de grille = un pixel de ce canevas, agrandi au rendu.
// Repeindre un pixel dessus coûte la même chose quel que soit le zoom.
const buffer = document.createElement("canvas");
buffer.width = GRID;
buffer.height = GRID;
const bctx = buffer.getContext("2d", { willReadFrequently: true });
bctx.fillStyle = "#ffffff";
bctx.fillRect(0, 0, GRID, GRID);

/* ==========================================================================
   3. Socket.io
   ========================================================================== */

let socket = null;

if (typeof io === "function") {
  socket = io();

  socket.on(EVENTS.placed, ({ x, y, color }) => {
    paint(x, y, color);
    requestRender();
  });

  socket.on(EVENTS.state, loadCanvasState);

  socket.on(EVENTS.rejected, ({ reason } = {}) => {
    // Le serveur fait autorité : on relâche le cooldown et on prévient.
    state.cooldownUntil = 0;
    toast(reason || "Pose refusée par le serveur");
  });
} else {
  console.warn("[ui] socket.io absent — mode local, aucune pose n'est envoyée.");
}

/**
 * Applique un état complet du canevas.
 * Accepte soit GRID*GRID*3 octets RVB, soit un tableau [{x, y, color}].
 */
function loadCanvasState(payload) {
  if (Array.isArray(payload)) {
    for (const p of payload) paint(p.x, p.y, p.color);
    requestRender();
    return;
  }

  const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload;
  if (!bytes || bytes.length !== GRID * GRID * 3) {
    console.warn("[ui] CANVAS_STATE de taille inattendue :", bytes && bytes.length);
    return;
  }

  const img = bctx.createImageData(GRID, GRID);
  for (let i = 0, n = GRID * GRID; i < n; i++) {
    img.data[i * 4]     = bytes[i * 3];
    img.data[i * 4 + 1] = bytes[i * 3 + 1];
    img.data[i * 4 + 2] = bytes[i * 3 + 2];
    img.data[i * 4 + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  requestRender();
}

/* ==========================================================================
   4. Rendu
   ========================================================================== */

let needsRender = true;
const requestRender = () => { needsRender = true; };

function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < GRID && y < GRID;
}

function paint(x, y, color) {
  if (!inBounds(x, y) || !isHex(color)) return;
  bctx.fillStyle = color;
  bctx.fillRect(x, y, 1, 1);
}

function isHex(c) {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  requestRender();
}

function render() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const s = state.scale;
  const ox = Math.round(state.offsetX);
  const oy = Math.round(state.offsetY);

  ctx.fillStyle = "#16171b";
  ctx.fillRect(0, 0, w, h);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, ox, oy, GRID * s, GRID * s);

  // Quadrillage seulement quand un pixel est assez large pour qu'il serve.
  if (s >= GRID_LINES_FROM) {
    const x0 = Math.max(0, Math.floor(-ox / s));
    const x1 = Math.min(GRID, Math.ceil((w - ox) / s));
    const y0 = Math.max(0, Math.floor(-oy / s));
    const y1 = Math.min(GRID, Math.ceil((h - oy) / s));
    ctx.strokeStyle = "rgba(0,0,0,.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      ctx.moveTo(ox + x * s + .5, oy + y0 * s);
      ctx.lineTo(ox + x * s + .5, oy + y1 * s);
    }
    for (let y = y0; y <= y1; y++) {
      ctx.moveTo(ox + x0 * s, oy + y * s + .5);
      ctx.lineTo(ox + x1 * s, oy + y * s + .5);
    }
    ctx.stroke();
  }

  // Cible : double liseré pour rester lisible sur n'importe quelle couleur.
  if (state.hover) {
    const cooling = isCooling();
    const px = ox + state.hover.x * s;
    const py = oy + state.hover.y * s;
    ctx.globalAlpha = cooling ? .4 : 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 1, py - 1, s + 2, s + 2);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 2.5, py - 2.5, s + 5, s + 5);
    ctx.globalAlpha = 1;
  }
}

function frame() {
  if (needsRender) { needsRender = false; render(); }
  updateCooldownUI();
  requestAnimationFrame(frame);
}

/* ==========================================================================
   5. Navigation : conversion écran -> grille, zoom, déplacement
   ========================================================================== */

/** Tâche 2.1 — position souris vers coordonnées grille (0..999). */
function screenToGrid(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.floor((clientX - r.left - state.offsetX) / state.scale),
    y: Math.floor((clientY - r.top  - state.offsetY) / state.scale),
  };
}

/** Zoome en gardant fixe le point de l'écran visé. */
function zoomAt(clientX, clientY, factor) {
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor));
  if (next === state.scale) return;
  const r = canvas.getBoundingClientRect();
  const px = clientX - r.left;
  const py = clientY - r.top;
  state.offsetX = px - (px - state.offsetX) * (next / state.scale);
  state.offsetY = py - (py - state.offsetY) * (next / state.scale);
  state.scale = next;
  elZoom.textContent = formatZoom(next);
  requestRender();
}

function formatZoom(s) {
  return s >= 1 ? `${s.toFixed(1)}×` : `${s.toFixed(2)}×`;
}

function fitToScreen() {
  state.scale = Math.min(canvas.clientWidth, canvas.clientHeight) / GRID;
  state.offsetX = (canvas.clientWidth  - GRID * state.scale) / 2;
  state.offsetY = (canvas.clientHeight - GRID * state.scale) / 2;
  elZoom.textContent = formatZoom(state.scale);
  requestRender();
}

/* ==========================================================================
   6. Entrées pointeur
   ========================================================================== */

const pointers = new Map();
let moved = false;
let pinchDist = 0;

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
  moved = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});

canvas.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);

  if (prev && pointers.size === 1) {
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      moved = true;
      canvas.classList.add("is-panning");
      state.offsetX += dx;
      state.offsetY += dy;
      requestRender();
    }
  }
  if (prev) pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    moved = true;
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
    pinchDist = d;
  }

  updateHover(e.clientX, e.clientY);
});

canvas.addEventListener("pointerup", (e) => {
  const entry = pointers.get(e.pointerId);
  const single = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  canvas.classList.remove("is-panning");

  if (!single || moved || !entry) return;

  const { x, y } = screenToGrid(e.clientX, e.clientY);
  if (!inBounds(x, y)) return;

  if (entry.button === 0) {
    tryPlace(x, y);                 // Tâche 2.2 — clic gauche uniquement
  } else if (entry.button === 2) {
    pickColorAt(x, y);              // clic droit : pipette
  }
});

canvas.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  canvas.classList.remove("is-panning");
});

canvas.addEventListener("pointerleave", () => {
  state.hover = null;
  elCursor.hidden = true;
  elCoords.textContent = "—";
  requestRender();
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

/** Tâche 2.1 — affichage des coordonnées, sous le curseur et dans le HUD. */
function updateHover(clientX, clientY) {
  const p = screenToGrid(clientX, clientY);
  const next = inBounds(p.x, p.y) ? p : null;

  if (next) {
    elCursor.hidden = false;
    elCursor.style.left = `${clientX}px`;
    elCursor.style.top  = `${clientY}px`;
    elCursor.textContent = `${next.x}, ${next.y}`;
  } else {
    elCursor.hidden = true;
  }

  if (next?.x === state.hover?.x && next?.y === state.hover?.y) return;
  state.hover = next;
  elCoords.textContent = next ? `${next.x}, ${next.y}` : "—";
  requestRender();
}

/* ==========================================================================
   7. Couleurs — Tâche 2.1
   ========================================================================== */

function buildSwatches() {
  const host = $("swatches");
  PALETTE.forEach((hex, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = hex;
    b.dataset.color = hex;
    b.title = i < 10 ? `${hex} — touche ${(i + 1) % 10}` : hex;
    b.setAttribute("aria-label", `Couleur ${hex}`);
    b.addEventListener("click", () => setColor(hex));
    host.appendChild(b);
  });
}

function setColor(hex) {
  if (!isHex(hex)) return;
  state.color = hex.toLowerCase();
  elPicker.value = state.color;
  elFace.style.background = state.color;
  for (const el of $("swatches").children) {
    el.setAttribute("aria-pressed", String(el.dataset.color === state.color));
  }
}

/** Pipette : reprend la couleur déjà posée à cet endroit. */
function pickColorAt(x, y) {
  const [r, g, b] = bctx.getImageData(x, y, 1, 1).data;
  const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  setColor(hex);
}

elPicker.addEventListener("input", (e) => setColor(e.target.value));

// Touches 1..9 puis 0 pour les dix premiers raccourcis.
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key >= "0" && e.key <= "9") {
    const i = e.key === "0" ? 9 : Number(e.key) - 1;
    if (PALETTE[i]) setColor(PALETTE[i]);
  } else if (e.key === "f") {
    fitToScreen();
  }
});

/* ==========================================================================
   8. Pose et cooldown — Tâches 2.2 et 2.3
   ========================================================================== */

const isCooling = () => Date.now() < state.cooldownUntil;

function tryPlace(x, y) {
  if (isCooling()) {
    toast("Attends la fin du délai");
    return;
  }

  const previous = bctx.getImageData(x, y, 1, 1).data;
  const color = state.color;

  // Rendu optimiste : le pixel apparaît tout de suite, on annule si refus.
  paint(x, y, color);
  startCooldown();
  requestRender();

  if (!socket) return;

  socket.emit(EVENTS.place, { x, y, color }, (ack) => {
    // Ack optionnel. Si le serveur n'en renvoie pas, PLACE_REJECTED sert de secours.
    if (ack && ack.ok === false) {
      bctx.fillStyle = `rgb(${previous[0]},${previous[1]},${previous[2]})`;
      bctx.fillRect(x, y, 1, 1);
      state.cooldownUntil = 0;
      requestRender();
      toast(ack.reason || "Pose refusée");
    }
  });
}

function startCooldown() {
  state.cooldownUntil = Date.now() + COOLDOWN_MS;
  canvas.classList.add("is-cooling");
}

/** Barre + compte à rebours, rafraîchis à chaque frame. */
function updateCooldownUI() {
  const left = state.cooldownUntil - Date.now();

  if (left > 0) {
    const ratio = left / COOLDOWN_MS;
    elFill.style.width = `${ratio * 100}%`;
    elLabel.textContent = `${(left / 1000).toFixed(1)} s`;
    elCool.classList.remove("is-ready");
    canvas.classList.add("is-cooling");
  } else if (!elCool.classList.contains("is-ready")) {
    elFill.style.width = "100%";
    elLabel.textContent = "Prêt";
    elCool.classList.add("is-ready");
    canvas.classList.remove("is-cooling");
    requestRender();          // pour redessiner la cible en pleine opacité
  }
}

let toastTimer = null;
function toast(message) {
  elToast.textContent = message;
  elToast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove("is-visible"), 1600);
}

/* ==========================================================================
   9. Démarrage et API publique
   ========================================================================== */

window.addEventListener("resize", resize);

setColor(state.color);
buildSwatches();
resize();
fitToScreen();
frame();

// Pour les autres binômes : permet d'injecter des pixels sans toucher à ce fichier.
window.UI = {
  applyPixel: (x, y, color) => { paint(x, y, color); requestRender(); },
  loadCanvasState,
  setColor,
  fitToScreen,
  getColor: () => state.color,
  GRID,
  COOLDOWN_MS,
};

})();
