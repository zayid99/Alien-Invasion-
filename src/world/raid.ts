// City raids, Clash of Clans style (docs/gdd/city-raids.md): no saucer to fly. The player scouts the city from above,
// picks a troop card and taps the glowing deploy zone to drop troops, and fires powers (Orbital Laser, EMP Blast,
// Rally Beacon). The battle timer starts with the first troop. Troops that are never deployed go home safely.
import * as THREE from 'three';
import { G, track } from '../game/state';
import { camera } from '../core/engine';
import { INPUT } from '../core/input';
import { SFX } from '../core/audio';
import { FX, FXC, FT } from '../gfx/fx';
import { PAL } from '../gfx/palette';
import { UNIT_TYPES, UNIT_KEYS } from '../data/units';
import type { UnitKey } from '../data/units';
import { POWERS, POWER_IDS, RAID } from '../data/raid';
import type { PowerId } from '../data/raid';
import { spawnUnit, setRallyAt } from './invasion';
import { damageEnt, pushOut } from './entity';
import { damageBuildings } from './cityDamage';
import { unitLevel } from '../game/base';
import { $, UI } from '../ui/dom';

type Sel = { kind: 'unit'; key: UnitKey } | { kind: 'power'; key: PowerId } | null;
export const RD = {
  on: false, pool: {} as Record<UnitKey, number>, charges: {} as Record<PowerId, number>, sel: null as Sel,
  started: false, timeLeft: RAID.time, endT: -1, zone: null as THREE.Group | null, zoneMat: null as THREE.MeshBasicMaterial | null,
  cam: { x: 0, z: 0, d: 200, tx: 0, tz: 0, td: 200 }, ptr: new Map<number, { x: number; y: number; sx: number; sy: number }>(), drag: false, pinch0: 0,
  hold: null as { x: number; y: number; t: number } | null, pending: [] as { t: number; fn: () => void }[], wired: false,
};
export const raidHooks = { lost: (_why: string) => {}, cancel: () => {} };

const inZone = (x: number, z: number) => { const m = Math.max(Math.abs(x), Math.abs(z)); return m >= RAID.zoneIn && m <= RAID.zoneOut; };
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3(), _v = new THREE.Vector3();
function groundAt(cx: number, cy: number) {
  _ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
}

/** Called by startInvasion: troops wait on the Moon Base until deployed; build the zone and the battle bar. */
export function startRaid(armoryLv: number) {
  RD.on = true; RD.started = false; RD.timeLeft = RAID.time; RD.endT = -1; RD.pending = []; RD.hold = null; RD.ptr.clear();
  RD.pool = { ...G.save.army }; RD.charges = Object.fromEntries(POWER_IDS.map(p => [p, POWERS[p].charges(armoryLv)])) as Record<PowerId, number>;
  RD.sel = null; const first = UNIT_KEYS.find(k => RD.pool[k] > 0); if (first) RD.sel = { kind: 'unit', key: first };
  const S = RAID.cam.start, tall = camera.aspect < 1, z = tall ? S.z - 35 : S.z;   // tall phones: a little further into the city
  Object.assign(RD.cam, { x: S.x, z, d: S.d, tx: S.x, tz: z, td: S.d });
  buildZone(); renderBar(); placeCamera(1);
  if (!RD.wired) wireInput();
}
export function stopRaid() { RD.on = false; RD.hold = null; const r = document.getElementById('raid'); if (r) r.hidden = true; }

// ---------------------------------------------------------------- the deploy zone: a glowing band round the city edge
function buildZone() {
  const g = new THREE.Group(), w = RAID.zoneOut - RAID.zoneIn, mid = (RAID.zoneIn + RAID.zoneOut) / 2;
  const mat = RD.zoneMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(0.9), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const strip = (sx: number, sz: number, x: number, z: number) => { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2)), mat); m.position.set(x, 0.35, z); m.userData.noInk = true; g.add(m); };
  strip(RAID.zoneOut * 2, w, 0, mid); strip(RAID.zoneOut * 2, w, 0, -mid); strip(w, RAID.zoneIn * 2, mid, 0); strip(w, RAID.zoneIn * 2, -mid, 0);
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => new THREE.Vector3(a * RAID.zoneIn, 0.5, b * RAID.zoneIn));
  const line = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(2), toneMapped: false })));
  line.userData.noInk = true; g.add(line);
  RD.zone = g; G.world.add(g);
}

// ---------------------------------------------------------------- camera: scout from above; drag to pan, wheel/pinch to zoom
function placeCamera(k: number) {
  const c = RD.cam, B = RAID.cam.bound;
  c.tx = Math.max(-B, Math.min(B, c.tx)); c.tz = Math.max(-B, Math.min(B + 40, c.tz)); c.td = Math.max(RAID.cam.min, Math.min(RAID.cam.max, c.td));
  c.x += (c.tx - c.x) * k; c.z += (c.tz - c.z) * k; c.d += (c.td - c.d) * k;
  const p = RAID.cam.pitch; camera.position.set(c.x, Math.sin(p) * c.d, c.z + Math.cos(p) * c.d); camera.lookAt(c.x, 0, c.z);
}
function wireInput() {
  RD.wired = true; const cv = document.getElementById('game');
  cv.addEventListener('pointerdown', e => {
    if (!RD.on || G.mode !== 'invasion' || G.paused) return;
    RD.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); RD.drag = false;
    if (RD.ptr.size === 2) { const [a, b] = [...RD.ptr.values()]; RD.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); RD.hold = null; return; }
    // holding on the zone with a troop selected keeps dropping troops (Clash of Clans)
    if (RD.sel?.kind === 'unit') { const p = groundAt(e.clientX, e.clientY); if (p && inZone(p.x, p.z)) { act(e.clientX, e.clientY); RD.hold = { x: e.clientX, y: e.clientY, t: RAID.holdEvery * 2.5 }; RD.drag = true; } }
  });
  addEventListener('pointermove', e => {
    const q = RD.ptr.get(e.pointerId); if (!q || !RD.on) return;
    const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
    if (RD.ptr.size === 2) { const [a, b] = [...RD.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (RD.pinch0) RD.cam.td *= RD.pinch0 / d; RD.pinch0 = d; return; }
    if (RD.hold) { RD.hold.x = e.clientX; RD.hold.y = e.clientY; return; }   // sliding while holding drops along the zone
    if (Math.hypot(e.clientX - q.sx, e.clientY - q.sy) > 8) RD.drag = true;
    if (RD.drag) { const s = RD.cam.d / innerHeight * 1.25; RD.cam.tx -= dx * s; RD.cam.tz -= dy * s * 1.4; }
  });
  const up = (e: PointerEvent) => {
    const q = RD.ptr.get(e.pointerId); if (!q) return; RD.ptr.delete(e.pointerId);
    if (RD.ptr.size === 0) { if (!RD.drag && RD.on && G.mode === 'invasion' && !G.paused) act(e.clientX, e.clientY); RD.hold = null; RD.pinch0 = 0; }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!RD.on || G.mode !== 'invasion') return; e.preventDefault(); RD.cam.td *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
  $('rd-troops').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-unit]') as HTMLElement; if (b) select({ kind: 'unit', key: b.dataset.unit as UnitKey }); });
  $('rd-powers').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-power]') as HTMLElement; if (b) select({ kind: 'power', key: b.dataset.power as PowerId }); });
  $('rd-end').addEventListener('click', () => { if (!RD.on || G.inv?.over) return; if (!RD.started) raidHooks.cancel(); else raidHooks.lost('You ended the battle.'); });
}
function select(s: Sel) {
  if (s?.kind === 'unit' && !RD.pool[s.key]) { SFX.play('error'); UI.toast(`No ${UNIT_TYPES[s.key].name}s left to deploy`, 'warn', 1.4); return; }
  if (s?.kind === 'power' && !RD.charges[s.key]) { SFX.play('error'); UI.toast(`${POWERS[s.key].name}: no charges left`, 'warn', 1.4); return; }
  RD.sel = RD.sel && s && RD.sel.kind === s.kind && RD.sel.key === s.key && s.kind === 'power' ? null : s; SFX.play('ui'); renderBar();
}
/** A tap on the battlefield: deploy the selected troop, or fire the selected power. */
function act(cx: number, cy: number) {
  const p = groundAt(cx, cy); if (!p || !RD.sel) return;
  if (RD.sel.kind === 'unit') {
    const k = RD.sel.key;
    if (!inZone(p.x, p.z)) { FX.ring(_v.set(p.x, 0.6, p.z), 3, 0.4, FXC.tomato); hint('Drop troops in the <b>glowing green zone</b> around the city'); SFX.play('error'); return; }
    if (!RD.pool[k]) { const next = UNIT_KEYS.find(u => RD.pool[u] > 0); if (next) { RD.sel = { kind: 'unit', key: next }; renderBar(); } else return; }
    deploy(RD.sel.key as UnitKey, p.x, p.z);
  } else castPower(RD.sel.key, p.x, p.z);
}
function deploy(k: UnitKey, x: number, z: number) {
  if (!RD.pool[k]) return;
  RD.pool[k]--; const q = _v.set(x, 0, z); pushOut(q, UNIT_TYPES[k].radius + 0.5); spawnUnit(k, q.x, q.z, true);
  if (!RD.started) { RD.started = true; G.inv.raidStarted = true; hint(''); UI.comm('The invasion has begun! Destroy the three <b>shield pylons</b>, then their headquarters.', 5); }
  if (!RD.pool[k]) { const next = UNIT_KEYS.find(u => RD.pool[u] > 0); RD.sel = next ? { kind: 'unit', key: next } : null; }
  renderBar();
}
function castPower(id: PowerId, x: number, z: number) {
  if (!RD.charges[id]) return;
  const P = POWERS[id]; RD.charges[id]--; if (!RD.started) { RD.started = true; G.inv.raidStarted = true; }
  if (id === 'laser') {
    FX.ring(_v.set(x, 0.6, z), P.radius, P.delay, FXC.tomato); SFX.play('warp');
    RD.pending.push({ t: P.delay, fn: () => {
      FX.pillar(_v.set(x, 0, z), PAL.tomato, 260, 0.7, P.radius * 0.7); FX.explode(_v.set(x, 2, z), 2.6); G.shake = Math.max(G.shake, 1);
      for (const e of G.ents) if (e.team === 'earth' && !e.dead && e.hp > 0 && Math.hypot(e.pos.x - x, e.pos.z - z) < P.radius + e.r) damageEnt(e, P.dmg, 'player');
      damageBuildings(x, z, P.radius, P.buildingDmg); SFX.play('boom');
    } });
  } else if (id === 'emp') {
    FX.ring(_v.set(x, 1, z), P.radius, 0.6, FXC.white, FXC.mint); FX.spark(_v.set(x, 3, z), FXC.mint, 30, 14, 0.3, 0.6, 0); SFX.play('zap');
    for (const e of G.ents) if (e.team === 'earth' && !e.dead && e.kind !== 'boss' && Math.hypot(e.pos.x - x, e.pos.z - z) < P.radius + e.r) { e.stun = Math.max(e.stun || 0, P.stun); e.flash = 0.2; }
    FT.spawn(_v.set(x, 8, z), 'EMP!', 'combo', 1.4, 1.6);
  } else {
    setRallyAt(x, z); FX.pillar(_v.set(x, 0, z), PAL.violet, 60, 0.8, 1.2);
  }
  if (!RD.charges[id]) RD.sel = null;
  renderBar();
}

// ---------------------------------------------------------------- the battle bar (troop cards, power cards) + top bar
function renderBar() {
  const s = RD.sel;
  $('rd-troops').innerHTML = UNIT_KEYS.map((k, i) => `<button class="rd-card unit ${k}${s?.kind === 'unit' && s.key === k ? ' sel' : ''}${RD.pool[k] ? '' : ' empty'}" data-unit="${k}" id="rd-u-${k}">
    <kbd>${i + 1}</kbd><span class="ic">${UNIT_TYPES[k].name[0]}</span><b>${UNIT_TYPES[k].name.replace('Attack ', '').replace('Hypno-', '').replace('Gray ', '').replace('Mega ', '')}</b><i class="n">×${RD.pool[k]}</i><span class="lv">Lv ${unitLevel(k)}</span></button>`).join('');
  $('rd-powers').innerHTML = POWER_IDS.map((p, i) => `<button class="rd-card power ${p}${s?.kind === 'power' && s.key === p ? ' sel' : ''}${RD.charges[p] ? '' : ' empty'}" data-power="${p}" id="rd-p-${p}" title="${POWERS[p].blurb}">
    <kbd>${i + 5}</kbd><span class="ic">${POWERS[p].icon}</span><b>${POWERS[p].name.split(' ')[1] || POWERS[p].name}</b><i class="n">×${RD.charges[p]}</i></button>`).join('');
  if (!RD.started) hint(s?.kind === 'power' ? `Tap the city to fire the <b>${POWERS[s.key].name}</b>` : 'Scout the city: <b>drag</b> to look around. Pick a troop, then <b>tap the green zone</b> to deploy');
  else if (s?.kind === 'power') hint(`Tap where the <b>${POWERS[s.key].name}</b> should hit`); else hint('');
}
function hint(h: string) { const el = $('rd-hint'); el.innerHTML = h; el.hidden = !h; }
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Stars so far: all pylons down, HQ down (victory), victory with a minute left. */
export function raidStars() { const I = G.inv; const won = I.over && I.hq.hp <= 0 && (!I.boss || (I.bossEnt && I.bossEnt.hp <= 0)); return (I.pylonsLeft === 0 ? 1 : 0) + (won ? 1 : 0) + (won && RD.timeLeft >= RAID.threeStarLeft ? 1 : 0); }

/** Per frame in a raid (instead of flying the saucer). */
export function updateRaid(dt: number) {
  const I = G.inv; if (!RD.on || !I) return;
  // keyboard: WASD/arrows pan, +/- zoom, 1-4 troops, 5-7 powers
  const k = RAID.cam.keys * dt * (RD.cam.d / 160);
  if (INPUT.down('KeyA') || INPUT.down('ArrowLeft')) RD.cam.tx -= k; if (INPUT.down('KeyD') || INPUT.down('ArrowRight')) RD.cam.tx += k;
  if (INPUT.down('KeyW') || INPUT.down('ArrowUp')) RD.cam.tz -= k; if (INPUT.down('KeyS') || INPUT.down('ArrowDown')) RD.cam.tz += k;
  if (INPUT.down('Equal') || INPUT.down('NumpadAdd')) RD.cam.td *= 1 - dt; if (INPUT.down('Minus') || INPUT.down('NumpadSubtract')) RD.cam.td *= 1 + dt;
  UNIT_KEYS.forEach((u, i) => { if (INPUT.hit('Digit' + (i + 1))) select({ kind: 'unit', key: u }); });
  POWER_IDS.forEach((p, i) => { if (INPUT.hit('Digit' + (i + 5))) select({ kind: 'power', key: p }); });
  placeCamera(Math.min(1, dt * 8));
  if (RD.hold && (RD.hold.t -= dt) <= 0) { RD.hold.t = RAID.holdEvery; act(RD.hold.x, RD.hold.y); }
  for (let i = RD.pending.length - 1; i >= 0; i--) if ((RD.pending[i].t -= dt) <= 0) { const f = RD.pending[i].fn; RD.pending.splice(i, 1); f(); }
  if (RD.zoneMat) RD.zoneMat.opacity = (RD.sel?.kind === 'unit' ? 0.22 : 0.1) + Math.sin(G.time * 4) * 0.05;
  if (RD.started && !I.over) {
    RD.timeLeft = Math.max(0, RD.timeLeft - dt);
    const alive = G.ents.some(e => e.team === 'alien' && !e.dead && e.utype), left = UNIT_KEYS.some(u => RD.pool[u] > 0);
    if (RD.timeLeft <= 0) raidHooks.lost("Time's up! Earth held the city.");
    else if (!alive && !left && !RD.pending.length) { if (RD.endT < 0) RD.endT = 2; else if ((RD.endT -= dt) <= 0) raidHooks.lost('Every troop has fallen.'); }
    else RD.endT = -1;
  }
  // top bar
  $('rd-timer').textContent = RD.started ? fmt(RD.timeLeft) : 'SCOUT'; $('rd-timer').classList.toggle('low', RD.started && RD.timeLeft < 30);
  const st = raidStars(), stars = $('rd-stars').children; for (let i = 0; i < 3; i++) stars[i].classList.toggle('on', i < st);
}
