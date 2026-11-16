// The Moon Base room screen (docs/ui/room-screen.md, Zayid's wireframe): the room plays live in the centre window and
// the controls sit around it. Clash of Clans style: train troops in the Hybrid Lab and Shipyard, research troop levels
// and saucer tech in the Research Lab, upgrade rooms. Everything here only reads/writes through game/base.ts.
import { G } from '../game/state';
import { RES, UPGRADES, canAfford } from '../data/balance';
import type { UpgradeKey, Cost } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS } from '../data/units';
import type { UnitKey } from '../data/units';
import { CITIES, regionById } from '../data/earth';
import { ROOMS, ROOM_IDS } from '../data/moonbase';
import type { RoomId } from '../data/moonbase';
import { ROOM_UP, TROOP } from '../data/base';
import type { UpRoom } from '../data/base';
import { armyPower, earthPower, cityLevel, cityState, regionUnlocked, verdict } from '../game/campaign';
import { SPECIMENS, specimensFound, achievementsDone, ACHIEVEMENTS, artifactsFound } from '../game/meta';
import { ARTIFACTS } from '../core/assets';
import { SKINS } from '../data/skins';
import { chapterCardHTML, showCatalogue, showAchievements, showHangar } from './meta';
import { renderWallet } from '../scenes/globe';
import { $, ICON } from './dom';
import { SFX } from '../core/audio';
import {
  train, cancelLast, queueProgress, queueCap, trainTime, unitStats, unitLevel, unitPowerLv, troopResearch, saucerResearch, startResearch,
  roomLevel, roomUpgrade, startRoomUpgrade, jobProgress, fmtTime, maxTroopLevel, baseHooks,
} from '../game/base';
import type { TrainRoom } from '../game/base';

/** Set by scenes/moonbase.ts. */
export const moonHooks = {
  celebrate: (_room: RoomId, _text: string) => {}, room: () => null as RoomId | null, go: (_id: RoomId | null) => {},
  fun: (_room: RoomId, _what: string) => {}, earth: () => {},
};
interface Act { t: string; s?: string; cls?: string; off?: boolean; hide?: boolean; run?: () => void; id?: string }
interface Spec { tip: string; main: Act; b1?: Act; b2?: Act; up?: UpRoom; status: () => { k: string; v: string; p?: number; icons?: string; cancel?: TrainRoom } }

const cost = (c: Cost) => RES.filter(r => c[r]).map(r => `${ICON(r)}${c[r]}`).join(' ');
const can = (c: Cost) => canAfford(G.save.res, c);
function trainAct(k: UnitKey, n = 1, cls = 'slime'): Act {
  const T = UNIT_TYPES[k], r = (k === 'clone' || k === 'brute') ? 'hybrid' : 'shipyard', c = Object.fromEntries(RES.map(x => [x, (T.cost[x] || 0) * n])) as Cost;
  const full = G.save.base.q[r as TrainRoom].length + n > queueCap(r as TrainRoom);
  return { t: `${n > 1 ? `×${n} ` : ''}${T.name.toUpperCase()}`, s: full ? 'queue full' : `${cost(c)} · ${trainTime(k).toFixed(0)}s`, cls, off: full || !can(c), id: n > 1 ? `rs-train-${k}-5` : `btn-build-${k}`, run: () => train(k, n) };
}
const queueStatus = (r: TrainRoom) => () => {
  const q = G.save.base.q[r], P = queueProgress(r);
  if (!q.length) return { k: r === 'hybrid' ? 'VATS' : 'BAYS', v: 'Ready to train', p: 0 };
  return { k: `TRAINING · ${q.length}/${queueCap(r)}`, v: `${UNIT_TYPES[P.head].name} · ${fmtTime(P.left)}`, p: P.p, icons: q.map(k => `<i class="qi ${k}">${UNIT_TYPES[k].name[0]}</i>`).join(''), cancel: r };
};
const labStatus = () => {
  const j = G.save.base.lab, P = jobProgress(j); if (!j) return { k: 'LAB', v: 'Idle: start a research', p: 0 };
  const name = j.kind === 'troop' ? `${UNIT_TYPES[j.key as UnitKey].name} Lv ${unitLevel(j.key as UnitKey) + 1}` : `${UPGRADES[j.key as UpgradeKey].name} Lv ${G.save.up[j.key as UpgradeKey] + 2}`;
  return { k: 'RESEARCHING', v: `${name} · ${fmtTime(P.left)}`, p: P.p };
};
function nextTarget() { return CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b))[0]; }

const SPECS: Record<RoomId, () => Spec> = {
  hybrid: () => ({ tip: 'Grow troops from biomass and humans. They train one after another, even while you are away.', up: 'hybrid',
    main: trainAct('clone', 1), b1: trainAct('brute', 1), b2: trainAct('clone', 5, ''), status: queueStatus('hybrid') }),
  shipyard: () => ({ tip: 'Build war machines from stolen metal. Saucers fly over buildings; walkers flatten pylons.', up: 'shipyard',
    main: trainAct('saucer', 1), b1: trainAct('walker', 1), b2: trainAct('saucer', 5, ''), status: queueStatus('shipyard') }),
  research: () => ({ tip: 'Make your troops stronger and upgrade your saucer. One research at a time.', up: 'research',
    main: { t: 'UPGRADE TROOPS', s: `max level ${maxTroopLevel()}`, cls: 'slime', id: 'rs-troops', run: troopsPop },
    b1: { t: 'SAUCER TECH', s: 'beam · shield · engine', id: 'rs-saucer', run: saucerPop }, b2: { t: 'MY ARMY', s: `power ${armyPower()}`, run: armyPop }, status: labStatus }),
  bridge: () => { const tg = nextTarget(); return { tip: 'The war room. Check your army against Earth, then choose where to strike.',
    main: { t: 'CHOOSE A TARGET', s: 'open the globe', cls: 'slime', id: 'btn-bridge-earth', run: () => moonHooks.earth() },
    b1: { t: 'WAR ROOM', s: `army ${armyPower()}`, run: warPop }, b2: { t: 'CHAPTER', s: 'campaign goal', run: () => pop('Campaign', chapterCardHTML()) },
    status: () => ({ k: 'NEXT TARGET', v: tg ? `${tg.name} · ${verdict(armyPower(), earthPower(cityLevel(tg))).text}` : 'All cities in reach taken', p: tg ? Math.min(1, armyPower() / earthPower(cityLevel(tg))) : 1 }) }; },
  cells: () => ({ tip: 'Our guests: every human you beam up lives here. Keep them fed and entertained!',
    main: { t: 'SPECIMEN CATALOGUE', s: `${specimensFound()}/${SPECIMENS.length} found`, cls: 'slime', run: () => showCatalogue() },
    b1: { t: 'FEED GUESTS', s: 'pizza time!', run: () => moonHooks.fun('cells', 'feed') }, b2: { t: 'CHANGE CHANNEL', s: 'alien TV', run: () => moonHooks.fun('cells', 'tv') },
    status: () => ({ k: 'GUESTS', v: `${G.save.totals.humans} humans abducted`, p: Math.min(1, specimensFound() / SPECIMENS.length) }) }),
  storage: () => ({ tip: 'Everything beamed up from Earth lands on the teleport pad. A bigger vault means bigger daily supply drops.', up: 'storage',
    main: { t: 'VAULT CONTENTS', s: 'resources collected', cls: 'slime', run: vaultPop }, b1: { t: 'ARTIFACTS', s: `${artifactsFound()}/${ARTIFACTS.length} found`, run: vaultPop },
    b2: { t: 'BEAM IN', s: 'test the teleporter', run: () => moonHooks.fun('storage', 'beam') },
    status: () => ({ k: 'SUPPLY BONUS', v: `Daily drops +${(roomLevel('storage') - 1) * 20}%`, p: (roomLevel('storage') - 1) / 4 }) }),
  trophy: () => ({ tip: 'Landmarks stolen from Earth, achievements and saucer skins.',
    main: { t: 'ACHIEVEMENTS', s: `${achievementsDone()}/${ACHIEVEMENTS.length}`, cls: 'slime', run: () => showAchievements() },
    b1: { t: 'SAUCER SKINS', s: `${SKINS.filter(k => !k.ach || G.save.ach[k.ach]).length}/${SKINS.length}`, run: () => showHangar() }, b2: { t: 'TOUR', s: 'join the guide', run: () => moonHooks.fun('trophy', 'tour') },
    status: () => ({ k: 'CONQUERED', v: `${G.save.totals.citiesTaken} cities · ${G.save.best.bosses} bosses`, p: Math.min(1, G.save.totals.citiesTaken / 60) }) }),
  armory: () => ({ tip: 'Powers for city raids: EMP blast, gravity well, mind control, orbital laser. Opens with city raids.',
    main: { t: 'LOCKED', s: 'opens with city raids', off: true }, b1: { t: 'TEST FIRE', s: 'shoot the cardboard tank', run: () => moonHooks.fun('armory', 'fire') }, b2: { t: '', hide: true },
    status: () => ({ k: 'ARMORY', v: 'Coming in the next update', p: 0 }) }),
  reactor: () => ({ tip: 'The reactor powers the whole moon. Energy for bigger rooms and ships arrives soon.',
    main: { t: 'OVERLOAD!', s: 'just for fun', cls: 'slime', run: () => moonHooks.fun('reactor', 'overload') }, b1: { t: '', hide: true }, b2: { t: '', hide: true },
    status: () => ({ k: 'BASE', v: `Day ${G.save.day} · army ${armyPower()}`, p: 1 }) }),
};

// ---------------------------------------------------------------- pop-up cards (inside the window)
let popRun: ((b: HTMLElement) => void) | null = null;
function pop(title: string, html: string, run: ((b: HTMLElement) => void) | null = null) {
  $('rs-pop-title').textContent = title; $('rs-pop-body').innerHTML = html; popRun = run; $('rs-pop').hidden = false; SFX.play('ui');
}
const closePop = () => { $('rs-pop').hidden = true; popRun = null; };
const pips = (lv: number, max = 5) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;
function troopsPop() {
  const busy = G.save.base.lab;
  pop('Upgrade troops', `<p class="sub">Each level adds hit points and damage. The lab's level sets the highest troop level (now ${maxTroopLevel()}).</p><div class="rs-cards">${UNIT_KEYS.map(k => {
    const r = troopResearch(k), S = unitStats(k);
    return `<div class="rs-card"><b>${UNIT_TYPES[k].name}</b>${pips(unitLevel(k))}<small>HP ${S.hp} · DMG ${S.dmg} · power ${unitPowerLv(k)}</small>
      ${r.max ? '<span class="tag ok">Max level</span>' : r.locked ? `<span class="tag hot">Lab level ${r.lv - 1} needed</span>` : `<small>${cost(r.cost)} · ${fmtTime(r.time)}</small>
      <button class="btn slime small" id="rs-res-${k}" data-troop="${k}" ${busy || !can(r.cost) ? 'disabled' : ''}>Level ${r.lv}</button>`}</div>`;
  }).join('')}</div>${busy ? '<p class="sub">The lab is busy. One research at a time.</p>' : ''}`, b => { if (b.dataset.troop && startResearch('troop', b.dataset.troop)) { closePop(); refresh(); } });
}
function saucerPop() {
  const busy = G.save.base.lab;
  pop('Saucer tech', `<div class="rs-cards">${(Object.keys(UPGRADES) as UpgradeKey[]).map(k => {
    const U = UPGRADES[k], r = saucerResearch(k);
    return `<div class="rs-card"><b>${U.name}</b>${pips(G.save.up[k] + 1)}<small>${U.stat(G.save.up[k])}${r.max ? '' : ` → ${U.next(G.save.up[k])}`}</small>
      ${r.max ? '<span class="tag ok">Max level</span>' : `<small>${cost(r.cost)} · ${fmtTime(r.time)}</small><button class="btn slime small" id="btn-up-${k}" data-up="${k}" ${busy || !can(r.cost) ? 'disabled' : ''}>Level ${r.lv + 1}</button>`}</div>`;
  }).join('')}</div>${busy ? '<p class="sub">The lab is busy. One research at a time.</p>' : ''}`, b => { if (b.dataset.up && startResearch('saucer', b.dataset.up)) { closePop(); refresh(); } });
}
function armyPop() {
  pop('My army', `<div class="rs-cards">${UNIT_KEYS.map(k => { const S = unitStats(k); return `<div class="rs-card"><b>${UNIT_TYPES[k].name} ×${G.save.army[k]}</b>${pips(unitLevel(k))}<small>HP ${S.hp} · DMG ${S.dmg}</small><small>power ${unitPowerLv(k)} each</small></div>`; }).join('')}</div><p class="sub">Total army power: <b>${armyPower()}</b></p>`);
}
function warPop() {
  const tg = nextTarget(), us = armyPower(), them = tg ? earthPower(cityLevel(tg)) : 1, top = Math.max(us, them) * 1.1;
  pop('War room', `<div class="power"><div class="lane us"><span>Your army</span><div class="track"><i style="width:${(us / top * 100).toFixed(1)}%"></i></div><b>${us}</b></div>
    <div class="lane them"><span>${tg ? tg.name : 'No target'}</span><div class="track"><i style="width:${(them / top * 100).toFixed(1)}%"></i></div><b>${tg ? them : 0}</b></div></div>
    <p class="sub">${tg ? `Easiest city in reach: <b>${tg.name}</b> (defense ${cityLevel(tg)}). ${verdict(us, them).text}.` : 'Every city in reach is yours.'} Earth gets stronger every day.</p>`);
}
function vaultPop() {
  const s = G.save, T = s.totals;
  pop('Cargo Vault', `<dl class="kv">${RES.map(r => `<dt>${r[0].toUpperCase() + r.slice(1)}</dt><dd>${Math.floor(s.res[r])} <small>(${T[r]} collected)</small></dd>`).join('')}<dt>Earth artifacts</dt><dd>${artifactsFound()}/${ARTIFACTS.length}</dd></dl>
    <p class="sub">${Object.entries(s.artifacts).filter(([, n]) => n).map(([a, n]) => `${a.replace('_', ' ')} ×${n}`).join(' · ') || 'No artifacts yet. Look near houses at night.'}</p>`);
}
function upPop(r: UpRoom) {
  const u = roomUpgrade(r), lv = roomLevel(r), busy = G.save.base.build;
  pop(`Upgrade the ${ROOM_UP[r].name}`, `<div class="rs-cards one"><div class="rs-card"><b>Level ${lv}${u.max ? '' : ` → ${u.lv}`}</b>${pips(lv)}
    <small>Now: ${ROOM_UP[r].effect(lv)}</small>${u.max ? '<span class="tag ok">Max level</span>' : `<small>Next: ${ROOM_UP[r].effect(u.lv)}</small><small>${cost(u.cost)} · ${fmtTime(u.time)}</small>
    <button class="btn slime" id="rs-do-up" data-room="${r}" ${busy || !can(u.cost) ? 'disabled' : ''}>Upgrade</button>`}</div></div>
    ${busy ? `<p class="sub">The builder drone is busy with the ${ROOM_UP[busy.room].name}. One room at a time.</p>` : ''}`, b => { if (b.dataset.room && startRoomUpgrade(b.dataset.room as UpRoom)) { closePop(); refresh(); } });
}

// ---------------------------------------------------------------- render + per-frame
let shown: RoomId | null = null, acts: Record<string, Act> = {}, accT = 0;
const resShown: Record<string, number> = {};
function setBtn(id: string, a: Act | undefined) {
  const el = $(id) as HTMLButtonElement; if (!a || a.hide) { el.hidden = true; return; }
  el.hidden = false; const html = `<span class="t">${a.t}</span>${a.s ? `<small>${a.s}</small>` : ''}`;
  if (el.innerHTML !== html) el.innerHTML = html;
  el.disabled = !!a.off; el.classList.toggle('slime', a.cls === 'slime'); el.classList.toggle('primary', a.cls === 'primary');
  el.classList.toggle('ready', !a.off && !!a.cls); if (a.id) el.dataset.tid = a.id; acts[id] = a;
}
function renderRes() {
  const box = $('rs-res'); if (!box.dataset.built) { box.dataset.built = '1'; box.innerHTML = `<div class="hd"><span>RESOURCES</span><span id="rs-day"></span></div>` + RES.map(r => `<div class="rrow ${r}">${ICON(r)}<span>${r[0].toUpperCase() + r.slice(1)}</span><b id="rs-r-${r}">0</b></div>`).join('') + `<div class="rrow army"><span class="ai">◆</span><span>Army power</span><b id="rs-r-army">0</b></div>`; }
}
/** Re-read everything (after a purchase, a finished job, a room change). */
export function refresh() {
  const id = moonHooks.room(); renderWallet('moon-wallet'); $('moon-sub').textContent = `The Hollow Moon · Day ${G.save.day}`;
  const rs = $('rs'), top = document.querySelector('.moon-top') as HTMLElement;
  document.body.classList.toggle('in-room', !!id);
  if (!id) { rs.hidden = true; if (top) top.hidden = false; closePop(); shown = null; return; }
  if (top) top.hidden = true; rs.hidden = false;
  if (shown !== id) { shown = id; closePop(); rs.classList.remove('enter'); void rs.offsetWidth; rs.classList.add('enter'); }   // replay the slide-in
  const R = ROOMS[id], S = SPECS[id]();
  $('rs-name').textContent = R.name; $('rs-sub').textContent = R.job; $('rs-tip').innerHTML = `<b>i</b> ${S.tip}`;
  $('rs-cam').textContent = `CAM ${String(ROOM_IDS.indexOf(id) + 1).padStart(2, '0')} · ${R.name.toUpperCase()}`;
  $('rs-pos').textContent = `${ROOM_IDS.indexOf(id) + 1} / ${ROOM_IDS.length}`;
  rs.dataset.room = id; rs.style.setProperty('--acc', R.accent);
  acts = {}; setBtn('rs-main', S.main); setBtn('rs-b1', S.b1); setBtn('rs-b2', S.b2);
  const up = $('rs-up') as HTMLButtonElement;
  if (S.up) {
    const b = G.save.base.build, u = roomUpgrade(S.up);
    up.hidden = false; up.disabled = false;
    up.innerHTML = b?.room === S.up ? `<span class="t">BUILDING…</span><small>${fmtTime(jobProgress(b).left)}</small>` : `<span class="t">⬆ LEVEL ${roomLevel(S.up)}</span><small>${u.max ? 'max level' : 'upgrade room'}</small>`;
    up.classList.toggle('busy', b?.room === S.up); up.onclick = () => upPop(S.up);
  } else up.hidden = true;
  renderRes(); renderStatus(S);
}
function renderStatus(S: Spec) {
  const st = S.status(), el = $('rs-status') as HTMLButtonElement;
  if (!el.dataset.built) { el.dataset.built = '1'; el.innerHTML = '<small></small><b></b><span class="qs"></span><i class="bar"><em></em></i>'; }
  const [k, v, qs, bar] = [el.children[0], el.children[1], el.children[2] as HTMLElement, el.children[3].firstElementChild as HTMLElement];
  if (k.textContent !== st.k) k.textContent = st.k; if (v.textContent !== st.v) v.textContent = st.v;
  if (qs.innerHTML !== (st.icons || '')) qs.innerHTML = st.icons || ''; qs.hidden = !st.icons;
  bar.style.width = `${((st.p || 0) * 100).toFixed(1)}%`;
  el.classList.toggle('live', (st.p || 0) > 0 && (st.p || 0) < 1); el.dataset.cancel = st.cancel || ''; el.title = st.cancel ? 'Tap to cancel the last unit in the queue (full refund)' : '';
}
/** Per frame while on the moon: tween the numbers, refresh progress and affordability a few times a second. */
export function updateRoomScreen(dt: number) {
  const id = moonHooks.room(); if (!id) return;
  for (const r of [...RES, 'army']) {
    const want = r === 'army' ? armyPower() : Math.floor(G.save.res[r as typeof RES[number]]), cur = resShown[r] ?? want, el = document.getElementById('rs-r-' + r);
    const next = Math.abs(want - cur) < 1 ? want : cur + (want - cur) * Math.min(1, dt * 10); resShown[r] = next;
    if (el) { const t = String(Math.round(next)); if (el.textContent !== t) { el.textContent = t; if (Math.round(next) !== want) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } } }
  }
  const d = document.getElementById('rs-day'); if (d) d.textContent = `DAY ${G.save.day}`;
  if ((accT += dt) > 0.2) { accT = 0; refresh(); }
}
export const renderMoonPanel = refresh;

/** Buttons are wired once (main.ts calls this at boot). */
export function initRoomScreen() {
  const run = (id: string) => () => { const a = acts[id]; if (a && !a.off && a.run) { press(id); a.run(); refresh(); } };
  for (const id of ['rs-main', 'rs-b1', 'rs-b2']) $(id).addEventListener('click', run(id));
  $('rs-back').addEventListener('click', () => moonHooks.go(null));
  $('rs-map').addEventListener('click', () => moonHooks.go(null));
  const step = (d: number) => () => { const i = ROOM_IDS.indexOf(moonHooks.room() || 'bridge'); moonHooks.go(ROOM_IDS[(i + d + ROOM_IDS.length) % ROOM_IDS.length]); };
  $('rs-prev').addEventListener('click', step(-1)); $('rs-next').addEventListener('click', step(1));
  $('rs-earth').addEventListener('click', () => moonHooks.earth());
  $('rs-status').addEventListener('click', e => { const r = (e.currentTarget as HTMLElement).dataset.cancel as TrainRoom; if (r) { cancelLast(r); refresh(); } });
  $('rs-pop-x').addEventListener('click', closePop);
  $('rs-pop').addEventListener('click', e => { if (e.target === $('rs-pop')) closePop(); const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement; if (b && !b.disabled && popRun && b.id !== 'rs-pop-x') popRun(b); });
  baseHooks.changed = () => { if (G.mode === 'moonbase') refresh(); };
}
/** A quick squash on the pressed button. */
function press(id: string) { const el = $(id); el.classList.remove('pressed'); void el.offsetWidth; el.classList.add('pressed'); }
