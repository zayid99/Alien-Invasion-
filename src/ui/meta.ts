// UI for the meta layer (game/meta.ts): pop-up cards for achievements / new specimens / daily missions, the daily
// supply-drop window, the specimen catalogue and achievement lists, the globe's daily card and the night
// summary's "next goals".
import { G } from '../game/state';
import { RES, UPGRADES, canAfford } from '../data/balance';
import type { UpgradeKey, Wallet } from '../data/balance';
import { CITIES, regionById } from '../data/earth';
import { ARTIFACTS } from '../core/assets';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { armyPower, cityLevel, cityState, earthPower, regionUnlocked } from '../game/campaign';
import {
  META, SPECIMENS, ACHIEVEMENTS, STREAK_REWARDS, specimensFound, artifactsFound, achievementsDone, canClaimDaily, claimDaily,
  streakReward, dailyDef, dailyReward, today, walletText,
} from '../game/meta';
import { $, UI, ICON } from './dom';
import { platform } from '../core/platform';
import { offer } from './rewards';
import { give, skinUnlocked } from '../game/meta';
import { SKINS } from '../data/skins';
import { setUfoSkin } from '../gfx/models';
import { UFO } from '../world/player';

const wtags = (w: Partial<Wallet>) => RES.filter(r => w[r]).map(r => `<span class="${r}">${ICON(r)}${w[r]}</span>`).join('');

// ---------------------------------------------------------------- pop-up cards
const POP_LABEL = { achievement: 'Achievement', specimen: 'Catalogue', daily: 'Daily mission' };
export function initMetaUI() {
  META.notify = n => {
    const box = $('pops'); if (!box) return;
    while (box.children.length > 2) box.firstElementChild.remove();
    const d = document.createElement('div'); d.className = `pop ${n.kind}`;
    d.innerHTML = `<span class="pop-tag">${POP_LABEL[n.kind]}</span><b>${n.title}</b><p>${n.text}</p>`;
    box.appendChild(d); SFX.play(n.kind === 'achievement' ? 'fanfare' : 'coin');
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3800);
  };
  $('meta-close').addEventListener('click', closeModal);
  $('meta-modal').addEventListener('click', e => { if (e.target === $('meta-modal')) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('meta-modal').hidden) closeModal(); });
}

// ---------------------------------------------------------------- modal window
let onClose: (() => void) | null = null;
function openModal(eyebrow: string, title: string, body: string, wide = false, close: (() => void) | null = null) {
  $('meta-eyebrow').textContent = eyebrow; $('meta-title').textContent = title; $('meta-body').innerHTML = body;
  $('meta-modal').classList.toggle('wide', wide); $('meta-modal').hidden = false; onClose = close;
}
function closeModal() { $('meta-modal').hidden = true; const f = onClose; onClose = null; f?.(); }
export const modalOpen = () => !$('meta-modal').hidden;

// ---------------------------------------------------------------- daily supply drop
/** Show the 7-day supply-drop window if today's drop is unclaimed. `after` runs once it is closed. */
export function maybeShowDailyDrop(after?: () => void) {
  if (!canClaimDaily()) { after?.(); return false; }
  const D = G.save.daily, yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return today(d); })();
  const next = D.lastClaim === yesterday ? D.streak + 1 : 1, cycle = Math.floor((next - 1) / 7) * 7;
  const tiles = STREAK_REWARDS.map((_, i) => {
    const day = cycle + i + 1, state = day < next ? 'got' : day === next ? 'now' : '';
    return `<div class="drop ${state}${i === 6 ? ' big' : ''}"><span class="d">Day ${day}</span><div class="w">${wtags(streakReward(day))}</div>${state === 'got' ? '<i class="tick">✓</i>' : ''}</div>`;
  }).join('');
  openModal('Daily supply drop', next > 1 ? `Day ${next} in a row!` : 'Welcome back, Commander', `
    <p class="sub">The mothership sends supplies every day. Come back tomorrow to keep the streak going. Day 7 is a big one!</p>
    <div class="drops">${tiles}</div>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn reward" id="btn-claim2" hidden></button><button class="btn slime" id="btn-claim">Claim day ${next}</button></div>`, false, after || null);
  offer($<HTMLButtonElement>('btn-claim2'), `Claim ×2`, () => {
    const { streak, reward } = claimDaily(); give(reward);
    UI.toast(`Day ${streak} supplies ×2: ${walletText(reward)} twice`, 'good', 2.8); closeModal();
  });
  $('btn-claim').addEventListener('click', () => {
    const { streak, reward } = claimDaily(); writeSave(G.save); SFX.play('buy');
    UI.toast(`Day ${streak} supplies: ${walletText(reward)}`, 'good', 2.6);
    closeModal();
  }, { once: true });
  return true;
}

// ---------------------------------------------------------------- daily mission card (globe panel)
export function dailyCardHTML() {
  const M = G.save.daily.mission, def = dailyDef();
  if (!G.save.tutorial.done || !M || !def || M.date !== today()) return '';
  const f = Math.round(M.progress / def.target * 100);
  return `<div class="daily-card${M.done ? ' done' : ''}">
    <div class="eyebrow">Daily mission${G.save.daily.streak > 1 ? ` · supply streak ${G.save.daily.streak} days` : ''}</div>
    <b>${M.done ? 'Done! A new one arrives tomorrow.' : def.text}</b>
    ${M.done ? '' : `<div class="dbar"><i style="width:${f}%"></i></div><div class="dfoot"><span>${M.progress}/${def.target}</span><span class="cost">${wtags(dailyReward())}</span></div>`}
  </div>`;
}

// ---------------------------------------------------------------- catalogue + achievements
const nice = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export function showCatalogue() {
  const groups = ['Humans', 'Animals', 'Farm finds', 'Vehicles'] as const;
  let h = `<p class="sub">Every new kind you beam up joins the catalogue and pays a bonus. ${specimensFound()}/${SPECIMENS.length} specimens · ${artifactsFound()}/${ARTIFACTS.length} artifacts.</p>`;
  for (const g of groups) {
    h += `<h3 class="cat-h">${g}</h3><div class="cat-grid">` + SPECIMENS.filter(s => s.group === g).map(s => {
      const n = G.save.catalogue[s.kind] || 0;
      return `<div class="spec${n ? '' : ' locked'}"><b>${n ? s.name : '???'}</b><span>${n ? `×${n}` : 'Not found yet'}</span></div>`;
    }).join('') + '</div>';
  }
  h += `<h3 class="cat-h">Earth artifacts</h3><div class="cat-grid">` + ARTIFACTS.map(a => {
    const n = G.save.artifacts[a.replace('_', ' ')] || 0;
    return `<div class="spec art${n ? '' : ' locked'}"><b>${n ? nice(a) : '???'}</b><span>${n ? `×${n}` : 'Hidden on farms'}</span></div>`;
  }).join('') + '</div>';
  openModal('Mothership lab', 'Specimen catalogue', h, true);
}
export function showAchievements() {
  const h = `<p class="sub">${achievementsDone()}/${ACHIEVEMENTS.length} earned.</p><div class="ach-list">` + ACHIEVEMENTS.map(a => {
    const got = G.save.ach[a.id];
    return `<div class="ach${got ? ' got' : ''}"><i>${got ? '★' : '☆'}</i><div><b>${a.name}</b><span>${a.text}${got ? ` · day ${got}` : ''}</span></div></div>`;
  }).join('') + '</div>';
  openModal('Hall of conquest', 'Achievements', h, true);
}
/** The hangar: earned saucer skins (Phase 2). Equipping one repaints the saucer right away. */
export function showHangar() {
  const render = () => SKINS.map(k => {
    const got = skinUnlocked(k.id), on = G.save.skin === k.id;
    const sw = `background:radial-gradient(ellipse 50% 42% at 50% 40%, ${k.hull} 0 62%, ${k.rim} 63% 74%, ${k.under} 75% 100%)`;
    return `<button class="skin${got ? '' : ' locked'}${on ? ' on' : ''}" data-skin="${k.id}" ${got ? '' : 'disabled'}>
      <i class="sw" style="${sw}">${k.spots ? `<u style="background:${k.spots}"></u><u style="background:${k.spots}"></u>` : ''}</i>
      <b>${k.name}</b><span>${on ? 'Equipped' : got ? 'Tap to equip' : `Locked: ${k.unlock}`}</span></button>`;
  }).join('');
  openModal('Mothership hangar', 'Saucer skins', `<p class="sub">Earn skins by playing. They change how your saucer looks, nothing else.</p><div class="skins">${render()}</div>`, true);
  $('meta-body').querySelector('.skins').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('[data-skin]') as HTMLButtonElement; if (!b || b.disabled) return;
    G.save.skin = b.dataset.skin; writeSave(G.save); setUfoSkin(UFO, G.save.skin); SFX.play('buy');
    showHangar();
  });
}
/** Labels for the mothership buttons. */
export function metaButtonLabels() {
  return { cat: `Catalogue ${specimensFound()}/${SPECIMENS.length}`, ach: `Achievements ${achievementsDone()}/${ACHIEVEMENTS.length}` };
}

// ---------------------------------------------------------------- next goals (night summary)
export function nextGoalsHTML() {
  const s = G.save, goals: string[] = [];
  const M = s.daily.mission, def = dailyDef();
  if (M && def && !M.done && M.date === today()) goals.push(`<b>Daily mission:</b> ${def.text} (${M.progress}/${def.target})`);
  const ups = (Object.keys(UPGRADES) as UpgradeKey[]).filter(k => s.up[k] < 4).map(k => {
    const c = UPGRADES[k].costs[s.up[k]], short = RES.reduce((n, r) => n + Math.max(0, (c[r] || 0) - s.res[r]), 0);
    return { k, c, short };
  }).sort((a, b) => a.short - b.short);
  const u = ups[0];
  if (u) {
    const U = UPGRADES[u.k], lvl = s.up[u.k] + 2;
    if (canAfford(s.res, u.c)) goals.push(`<b>Upgrade ${U.name} to level ${lvl}</b> on the mothership. You can afford it now!`);
    else goals.push(`<b>${U.name} level ${lvl}</b>: ${RES.filter(r => (u.c[r] || 0) > s.res[r]).map(r => `${(u.c[r] || 0) - Math.floor(s.res[r])} more ${r}`).join(', ')}.`);
  }
  const city = CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b))[0];
  if (city) {
    const us = armyPower(), them = earthPower(cityLevel(city));
    goals.push(us >= them ? `<b>Invade ${city.name}!</b> Your army (${us}) is stronger than its defense (${them}).`
      : `<b>Conquer ${city.name}</b>: build ${them - us} more army power on the mothership.`);
  }
  if (specimensFound() < SPECIMENS.length) goals.push(`<b>Specimens found: ${specimensFound()}/${SPECIMENS.length}.</b> Each new kind pays a bonus.`);
  if (!goals.length) return '';
  return `<div class="goals"><div class="eyebrow">Next goals</div><ol>${goals.slice(0, 3).map(g => `<li>${g}</li>`).join('')}</ol></div>`;
}
