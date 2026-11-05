// In-mission HUD (shield, cargo, timer, alert, resources, deploy bar) and the radar minimap
// ("Moonlit Toybox" sticker HUD, docs/ART_STYLE.md §3, §6 damage feedback, §7 HUD / minimap / deploy bar).
import { G } from '../game/state';
import { RES } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS } from '../data/units';
import { canAfford } from '../data/balance';
import { fmtTime, clamp, reducedMotion } from '../core/util';
import { $, UI, ICON, numHTML, replayClass } from './dom';
import { alertLevel } from '../world/combat';

// ---------------- meters ----------------
// The meter markup (label, .bar > i, .val) is built once in index.html; we only move the fill and change the
// value, so the CSS shake / wobble animations on the bars are never restarted by a re-render.
interface MeterRef { fill: HTMLElement; val: HTMLElement; f: number; v: string }
const meters: Record<string, MeterRef> = {};
function meter(id: string, digits: number): MeterRef {
  let m = meters[id];
  if (!m) {
    const el = $(id); let fill = el.querySelector('.bar i') as HTMLElement, val = el.querySelector('.val') as HTMLElement;
    if (!fill || !val) { el.innerHTML = `<span>${el.firstChild?.textContent || ''}</span><div class="bar"><i></i></div><b class="val"></b>`; fill = el.querySelector('.bar i'); val = el.querySelector('.val'); }
    fill.style.transformOrigin = 'left center'; fill.style.width = '100%';
    val.classList.add('num'); val.style.setProperty('--n', String(digits));
    m = meters[id] = { fill, val, f: -1, v: null };
  }
  return m;
}
function setMeter(id: string, frac: number, value: string, digits = 3) {
  const m = meter(id, digits), f = Math.round(clamp(frac, 0, 1) * 400) / 400;
  if (m.f !== f) { m.f = f; m.fill.style.transform = `scaleX(${f})`; }   // transform only: no layout
  if (m.v !== value) { m.v = value; m.val.textContent = value; }
}

// ---------------- timer (one .d span per character so it never jitters, §3) ----------------
let timerText: string = null;
/** Show a timer value or a counter: digits and the colon get their own fixed-width cells, words stay plain. */
export function setTimer(text: string) {
  if (timerText === text) return; timerText = text;
  const m = /^([\d:]+)(.*)$/.exec(text);
  $('timer').innerHTML = m
    ? Array.from(m[1]).map(ch => `<span class="d${ch === ':' ? ' c' : ''}">${ch}</span>`).join('') + (m[2] ? `<small class="unit">${m[2]}</small>` : '')
    : text;
}

// ---------------- alert pips ----------------
// The five pips are built once (index.html, or here as a fallback) and only toggled; no per-frame DOM queries.
let alertLvl = -1, pips: HTMLElement[] = null;
function setAlert(lvl: number) {
  const el = $('alert');
  if (!pips) {
    if (el.querySelectorAll('i').length !== 5) el.innerHTML = `<span>Alert</span>${'<i></i>'.repeat(5)}`;
    pips = Array.from(el.querySelectorAll('i')); alertLvl = -1;
  }
  if (alertLvl === lvl) return; alertLvl = lvl;
  pips.forEach((pip, i) => pip.classList.toggle('on', i < lvl));
  el.classList.toggle('flash', lvl >= 4);
}

// ---------------- resource chips ----------------
const chipVal: Record<string, number> = {};
let hudPlayer: any = null, lastShield = 0, hitTimer: ReturnType<typeof setTimeout> = null;

export function updateHUD() {
  const P = G.player; if (!P) return;
  const fresh = hudPlayer !== P;   // a new mission / invasion: no gain pops or hit flashes for the first frame
  if (fresh) { hudPlayer = P; lastShield = P.shield; timerText = null; alertLvl = -1; for (const r of RES) chipVal[r] = NaN; }

  // shield: tomato + shake below 25 %, a ±3 px shake and a red edge flash on every hit (§6, §7)
  const sh = P.shield / P.maxShield, low = sh < 0.25 && !P.dead;
  setMeter('m-shield', sh, String(Math.ceil(P.shield)));
  $('m-shield').classList.toggle('low', low);
  if (P.shield < lastShield - 0.01) {
    // ±3 px shake for 0.25 s; the class comes off again so the low-shield shake (an earlier rule) can resume
    const el = $('m-shield'); replayClass(el, 'hit'); clearTimeout(hitTimer); hitTimer = setTimeout(() => el.classList.remove('hit'), 260);
    UI.hurt(clamp(0.45 + (lastShield - P.shield) / P.maxShield * 4, 0.45, 1));
  }
  lastShield = P.shield;
  UI.hurtPulse(low && !$('hud').hidden);

  // cargo: wobbles and shows a "FULL!" tag when full (CSS)
  const cap = P.stats.cargoCap, cm = G.cargo.mass;
  setMeter('m-cargo', cm / cap, P.sending > 0 ? 'SENDING' : `${Math.round(cm * 10) / 10}/${cap}`, 5);
  $('m-cargo').classList.toggle('full', cm >= cap - 0.29);
  setMeter('m-boost', P.boost, '', 0);

  // resource chips: pending cargo rides as the small poster tag (em); banked gains pop the chip + "+N"
  for (const r of RES) {
    const row = document.querySelector(`#res .${r}`) as HTMLElement; if (!row) continue;
    const v = Math.floor(G.save.res[r]), n = String(v), add = G.cargo[r] > 0 ? `+${G.cargo[r]}` : '';
    if (row.dataset.n !== n) {
      row.dataset.n = n;
      const b = row.querySelector('b'); b.classList.add('num'); b.style.setProperty('--n', String(Math.max(2, n.length))); b.textContent = n;
      if (v > chipVal[r]) UI.popChip(row, v - chipVal[r]);
    }
    chipVal[r] = v;
    if (row.dataset.a !== add) { row.dataset.a = add; row.querySelector('em').textContent = add; }
  }

  if (G.mode === 'mission') {
    const tut = G.night.tutorial;
    setTimer(tut ? 'Training' : fmtTime(G.nightT));
    $('timer').classList.toggle('urgent', !tut && G.nightT <= 10);   // tomato + 1 Hz pulse in the last 10 s
    setAlert(alertLevel());
  } else $('timer').classList.remove('urgent');
}

// ---------------- invasion deploy bar ----------------
/** Unit cards (§7): number-key badge, unit name, cost row of fixed-width numbers. Disabled when unaffordable. */
export function renderDeployBar() {
  UI.set('deploy', 'html', UNIT_KEYS.map(k => {
    const T = UNIT_TYPES[k], ok = canAfford(G.save.res, T.cost);
    const cost = RES.filter(r => T.cost[r]).map(r => `<span class="${r}" title="${r}">${ICON(r)}${numHTML(T.cost[r], 2)}</span>`).join('');
    return `<button data-deploy="${k}" ${ok ? '' : 'disabled'} aria-label="${T.name} (key ${T.key})"><kbd>${T.key}</kbd><span class="u-name">${T.name}</span><span class="cost">${cost}</span></button>`;
  }).join(''));
}

// ---------------- radar minimap (§7) ----------------
// Centred on the saucer, rotated so "up" is the way the camera faces. The ink frame and the slime ring are the
// canvas' CSS border / box-shadow; inside we draw the map at 0.8 alpha, a slime sweep at 0.25 rev/s, and dots
// with a 1 px ink ring in the guide's colours.
export const MINI = { ctx: null as CanvasRenderingContext2D, bg: null as HTMLCanvasElement, half: 175, range: 110, cssW: 0, cssT: -1 };
const DOT = {
  player: '#9cff3f', enemy: '#ff5a4f', loot: '#ffd23f', animal: '#c6f04a', human: '#ffb38a', alien: '#e2d2ff', wreck: '#77707a', ink: '#1a1033',
};
/** Entity radar colours are set by the world builders; map the legacy shades onto the §7 dot palette. */
const RECOLOR: Record<string, string> = {
  '#ff6a5a': DOT.enemy, '#ff7a6a': DOT.enemy, '#ff5a4a': DOT.enemy, '#ff4a3a': DOT.enemy, '#ff4a8a': DOT.enemy,
  '#ffd65c': DOT.loot, '#d8c070': DOT.loot,
  '#9ee86a': DOT.animal,
  '#ffe6d2': DOT.human, '#9fe0ff': DOT.human,
  '#d2b0ff': DOT.alien,
};
function dotColor(e: any): string {
  if (e.team === 'earth' && e.hp > 0 && !e.structure && e.mini !== DOT.wreck) return DOT.enemy;
  return RECOLOR[e.mini] || e.mini;
}
function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring: number) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  c.lineWidth = ring; c.strokeStyle = DOT.ink; c.stroke();
}
export function drawMinimap() {
  if (!MINI.ctx) MINI.ctx = ($('minimap') as HTMLCanvasElement).getContext('2d');
  const c = MINI.ctx, W = c.canvas.width, P = G.player; if (!P) return;
  // canvas pixels per CSS pixel (150 px desktop, 100 px touch); re-measured every 2 s instead of every frame
  if (!MINI.cssW || G.time - MINI.cssT > 2 || G.time < MINI.cssT) { MINI.cssW = c.canvas.clientWidth || W / 2; MINI.cssT = G.time; }
  const k = W / MINI.cssW, s = (W / 2) / MINI.range, h = W / 2;
  const cos = Math.cos(G.camYaw), sin = Math.sin(G.camYaw);

  c.clearRect(0, 0, W, W); c.save();
  c.beginPath(); c.arc(h, h, h, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#10203a'; c.fillRect(0, 0, W, W);
  if (MINI.bg) {
    c.save(); c.translate(h, h); c.rotate(G.camYaw); c.scale(s, s); c.translate(-P.pos.x, -P.pos.z);
    c.globalAlpha = 0.8; c.drawImage(MINI.bg, -MINI.half, -MINI.half, MINI.half * 2, MINI.half * 2); c.restore();
  }
  // range rings
  c.globalAlpha = 1; c.lineWidth = k; c.strokeStyle = 'rgba(156,255,63,.18)';
  c.beginPath(); c.arc(h, h, h * 0.5, 0, Math.PI * 2); c.stroke();
  // sweep: a slime wedge turning at 0.25 rev/s (off under reduced motion, §9)
  if (!reducedMotion) {
    const a = (G.time * 0.25 % 1) * Math.PI * 2 - Math.PI / 2;
    c.fillStyle = 'rgba(156,255,63,.22)'; c.beginPath(); c.moveTo(h, h); c.arc(h, h, h, a - 0.55, a); c.closePath(); c.fill();
  }

  // dots, drawn in screen space so every ring is exactly 1 CSS px
  const blink = (G.time * 4) % 2 < 1, ring = k, minR = 1.6 * k;
  let tut: { x: number; y: number } = null;
  for (const e of G.ents) {
    if (e.dead || !e.mini) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
    if (Math.abs(dx) > MINI.range * 1.5 || Math.abs(dz) > MINI.range * 1.5) continue;
    const x = h + (dx * cos - dz * sin) * s, y = h + (dx * sin + dz * cos) * s;
    let col = dotColor(e);
    if (e.lootable && e.team === 'earth' && e.hp <= 0) col = blink ? DOT.loot : col;   // wrecks you can beam up
    if (e.tutTarget) { tut = { x, y }; col = DOT.loot; }
    dot(c, x, y, Math.max(minR, e.miniR * 1.1 * k), col, ring);
  }
  // tutorial target: pulsing poster ring with an ink outline
  if (tut) {
    const p = reducedMotion ? 0.5 : (Math.sin(G.time * 6) + 1) / 2, r = (4 + 3 * p) * k;
    c.beginPath(); c.arc(tut.x, tut.y, r, 0, Math.PI * 2);
    c.lineWidth = 3.5 * k; c.strokeStyle = DOT.ink; c.stroke();
    c.lineWidth = 2 * k; c.strokeStyle = DOT.loot; c.stroke();
  }
  // the saucer: 8 px slime dot
  dot(c, h, h, 4 * k, DOT.player, ring);
  c.restore();
}
