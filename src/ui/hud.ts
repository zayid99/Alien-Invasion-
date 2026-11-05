// In-mission HUD (shield, cargo, timer, alert, resources) and the radar minimap.
import { G } from '../game/state';
import { RES } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS } from '../data/units';
import { canAfford } from '../data/balance';
import { fmtTime, clamp } from '../core/util';
import { $, UI, costHTML } from './dom';
import { alertLevel } from '../world/combat';

export function updateHUD() {
  const P = G.player; if (!P) return;
  const sh = P.shield / P.maxShield;
  UI.set('m-shield', 'html', `<span>Shield</span><div class="bar"><i style="width:${(sh * 100).toFixed(1)}%"></i></div><b class="val">${Math.ceil(P.shield)}</b>`);
  $('m-shield').classList.toggle('low', sh < 0.3);
  const cap = P.stats.cargoCap, cm = G.cargo.mass;
  UI.set('m-cargo', 'html', `<span>Cargo</span><div class="bar"><i style="width:${(clamp(cm / cap, 0, 1) * 100).toFixed(1)}%"></i></div><b class="val">${P.sending > 0 ? 'SENDING' : `${Math.round(cm * 10) / 10}/${cap}`}</b>`);
  $('m-cargo').classList.toggle('full', cm >= cap - 0.29);
  UI.set('m-boost', 'html', `<span>Boost</span><div class="bar"><i style="width:${(P.boost * 100).toFixed(0)}%"></i></div><b class="val"></b>`);
  for (const r of RES) {
    const row = document.querySelector(`#res .${r}`) as HTMLElement;
    const n = String(Math.floor(G.save.res[r])), add = G.cargo[r] > 0 ? `+${G.cargo[r]}` : '';
    if (row.dataset.n !== n) { row.dataset.n = n; row.querySelector('b').textContent = n; }
    if (row.dataset.a !== add) { row.dataset.a = add; row.querySelector('em').textContent = add; }
  }
  if (G.mode === 'mission') {
    UI.set('timer', 'text', G.night.tutorial ? 'Training' : fmtTime(G.nightT));
    $('timer').classList.toggle('urgent', !G.night.tutorial && G.nightT < 20);
    const lvl = alertLevel();
    UI.set('alert', 'html', `<span>Alert</span>` + [0, 1, 2, 3, 4].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join(''));
    $('alert').classList.toggle('flash', lvl >= 4);
  }
}
export function renderDeployBar() {
  UI.set('deploy', 'html', UNIT_KEYS.map(k => { const T = UNIT_TYPES[k]; return `<button data-deploy="${k}" ${canAfford(G.save.res, T.cost) ? '' : 'disabled'}><span><kbd>${T.key}</kbd> ${T.name}</span><span class="cost">${costHTML(T.cost)}</span></button>`; }).join(''));
}

// Radar: centred on the saucer, rotated so "up" is the way the camera faces.
export const MINI = { ctx: null as CanvasRenderingContext2D, bg: null as HTMLCanvasElement, half: 175, range: 110 };
export function drawMinimap() {
  if (!MINI.ctx) MINI.ctx = ($('minimap') as HTMLCanvasElement).getContext('2d');
  const c = MINI.ctx, W = c.canvas.width, P = G.player; if (!P) return;
  const s = (W / 2) / MINI.range;
  c.clearRect(0, 0, W, W); c.save();
  c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#0d1020'; c.fillRect(0, 0, W, W);
  c.translate(W / 2, W / 2); c.rotate(G.camYaw); c.scale(s, s); c.translate(-P.pos.x, -P.pos.z);
  if (MINI.bg) { c.globalAlpha = 0.85; c.drawImage(MINI.bg, -MINI.half, -MINI.half, MINI.half * 2, MINI.half * 2); c.globalAlpha = 1; }
  const blink = (G.time * 4) % 2 < 1;
  for (const e of G.ents) {
    if (e.dead || !e.mini) continue;
    if (Math.abs(e.pos.x - P.pos.x) > MINI.range * 1.5 || Math.abs(e.pos.z - P.pos.z) > MINI.range * 1.5) continue;
    let col = e.mini; if (e.lootable && e.team === 'earth' && e.hp <= 0) col = blink ? '#ffd65c' : col;
    if (e.tutTarget) col = blink ? '#ffffff' : '#ffd65c';
    c.fillStyle = col; c.beginPath(); c.arc(e.pos.x, e.pos.z, (e.tutTarget ? 3 : e.miniR) / s * 2.2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.fillStyle = 'rgba(185,140,255,0.18)'; c.beginPath(); c.moveTo(W / 2, W / 2); c.arc(W / 2, W / 2, W * 0.42, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.closePath(); c.fill();
  c.fillStyle = '#e8d6ff'; c.beginPath(); c.arc(W / 2, W / 2, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(196,150,255,0.5)'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 3, 0, Math.PI * 2); c.stroke();
}
