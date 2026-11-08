// Bridge between the scene (classic script) and pixelfx (ES modules).
// Exposes window.PFX once loaded; scene.js checks for it and keeps working without it.
//
// Layers are named groups of live effects drawn onto one canvas in one composite pass.
// Coordinates are the target canvas' own units (1 effect pixel = 1 canvas unit).
// Effects with { fit: true } are drawn in their native frame and stretched over the whole canvas
// (used for full-screen effects authored at 320x180, like the impact frame and the god rays).

import { createFrame, clearFrame, createFx, composite } from "./lib/core/index.js";
import * as pow from "./lib/fx/explosions/cartoon-pow.js";
import * as impact from "./lib/fx/impacts/impact-frame.js";
import * as landing from "./lib/fx/impacts/heavy-landing.js";
import * as confetti from "./lib/fx/ui/confetti.js";
import * as combo from "./lib/fx/ui/combo-counter.js";
import * as jet from "./lib/fx/water/water-jet.js";
import * as rays from "./lib/fx/weather/god-rays.js";
import * as school from "./lib/fx/critters/fish-school.js";
import * as catchFx from "./lib/fx/pickups/collect-burst.js";

const MODS = { pow, impact, landing, confetti, combo, jet, rays, school, catch: catchFx };

// Sea-tinted palettes so borrowed effects sit in our underwater night
export const PALETTES = {
  seaLight: ["#06142a", "#0d2a52", "#1d4f92", "#3d7cc4", "#7fb6e8", "#cfe8ff", "#ffffff"],
  sand: ["#2a1e12", "#4e3a22", "#7a5c36", "#a8844e", "#d4b47a", "#f0dcae", "#fff6e0"],
  wrong: ["#140a1e", "#3a0f2a", "#7a1a2e", "#c8364a", "#ff6a5c", "#ffb0a0", "#ffffff"],
  gold: ["#1a1206", "#4a3210", "#8a6420", "#c89a34", "#f2c84a", "#ffe58a", "#fff6c8", "#ffffff"],
  combo: ["#0a1430", "#14285a", "#1d4f92", "#2f7fd0", "#4fb3ff", "#9fdcff", "#e0f6ff", "#ffffff"],
};

const layers = new Map();
function layer(name) {
  let L = layers.get(name);
  if (!L) layers.set(name, (L = { list: [], loops: new Map(), frame: null, img: null, cv: null, cx: null, w: 0, h: 0, last: 0, frozen: 0 }));
  return L;
}
function sizeTo(L, w, h) {
  if (L.w === w && L.h === h && L.frame) return;
  L.w = w; L.h = h;
  L.frame = createFrame(w, h);
  L.img = new ImageData(w, h);
  L.cv = document.createElement("canvas"); L.cv.width = w; L.cv.height = h;
  L.cx = L.cv.getContext("2d");
}
// one-off native-size frames for fit:true effects, cached by size
const fitCache = new Map();
function fitBuf(w, h) {
  const k = w + "x" + h;
  let b = fitCache.get(k);
  if (!b) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    fitCache.set(k, (b = { frame: createFrame(w, h), img: new ImageData(w, h), cv, cx: cv.getContext("2d") }));
  }
  return b;
}

/** Start a one-shot (or a loop you manage yourself). o: { x, y, angle, flip, palette, light, fit, ...effect options } */
function spawn(name, id, o = {}) {
  const mod = MODS[id]; if (!mod) return null;
  const L = layer(name);
  if (L.list.length > 24) L.list.shift();                  // hard cap: never pile up effects
  const h = { id, fit: !!o.fit, fx: createFx(mod, o) };
  L.list.push(h);
  return h;
}
/** A keyed loop: started once, its options can be updated every frame (x, y, angle...). */
function loop(name, key, id, o = {}) {
  const L = layer(name);
  let h = L.loops.get(key);
  if (h && !h.stopping) { Object.assign(h.fx.options, o); return h; }
  h = spawn(name, id, o); if (!h) return null;
  L.loops.set(key, h);
  return h;
}
function stopLoop(name, key) {
  const L = layer(name), h = L.loops.get(key);
  if (h) { h.fx.stop(); h.stopping = true; L.loops.delete(key); }
}
function clear(name) { const L = layer(name); L.list.length = 0; L.loops.clear(); }
function freeze(name, seconds) { layer(name).frozen = Math.max(layer(name).frozen, seconds); }
function live(name) { const L = layers.get(name); return L ? L.list.length : 0; }

/** Step and draw every effect of a layer onto ctx (w x h canvas units), offset by dy. */
function render(name, ctx, w, h, dy = 0) {
  const L = layers.get(name); if (!L || !L.list.length) { if (L) L.last = performance.now(); return; }
  const now = performance.now();
  let dt = L.last ? Math.min(0.05, (now - L.last) / 1000) : 1 / 60; L.last = now;
  if (L.frozen > 0) { L.frozen -= dt; dt = 0; }             // hit-stop: hold the picture
  L.list = L.list.filter((q) => !q.fx.done());
  if (!L.list.length) return;
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  let anyFlat = false;
  for (const q of L.list) { if (dt) q.fx.update(dt); if (!q.fit) anyFlat = true; }
  if (anyFlat) {
    sizeTo(L, w, h);
    clearFrame(L.frame);
    for (const q of L.list) if (!q.fit) q.fx.draw(L.frame);
    composite(L.frame, L.img.data, null);
    L.cx.putImageData(L.img, 0, 0);
    ctx.drawImage(L.cv, 0, Math.round(dy));
  }
  for (const q of L.list) {
    if (!q.fit) continue;
    const [fw, fh] = q.fx.meta.size || [320, 180], b = fitBuf(fw, fh);
    clearFrame(b.frame);
    const o = q.fx.options, ox = o.x, oy = o.y;
    o.x = (q.fx.meta.origin || [fw / 2, fh / 2])[0]; o.y = (q.fx.meta.origin || [fw / 2, fh / 2])[1];
    q.fx.draw(b.frame);
    o.x = ox; o.y = oy;
    composite(b.frame, b.img.data, null);
    b.cx.putImageData(b.img, 0, 0);
    ctx.drawImage(b.cv, 0, Math.round(dy), w, h);
  }
}

window.PFX = { spawn, loop, stopLoop, clear, freeze, render, live, PALETTES, ready: true };
window.dispatchEvent(new Event("pfx-ready"));
