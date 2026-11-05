// Small DOM helpers: element lookup, cached text updates, toasts and commander messages.
import { portrait } from './portrait';
import { RES } from '../data/balance';
import type { Cost } from '../data/balance';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const ICON = (r: string) => `<svg class="ico"><use href="#i-${r}"/></svg>`;
export function costHTML(c: Cost, have?: Record<string, number>) {
  return RES.filter(r => c[r]).map(r => `<span class="${r}${have && (have[r] || 0) < c[r] ? ' short' : ''}" title="${r}">${ICON(r)}${c[r]}</span>`).join('');
}
const SCREENS = ['scr-title', 'scr-howto', 'scr-briefing', 'scr-summary', 'scr-mothership', 'scr-pause', 'scr-end'];
const cache: Record<string, string> = {};

export const UI = {
  touch: false, commT: 0,
  show(id: string | null) { for (const s of SCREENS) $(s).hidden = s !== id; },
  hud(on: boolean) { $('hud').hidden = !on; $('touch').hidden = !(on && UI.touch); },
  globe(on: boolean) { $('globe-ui').hidden = !on; },
  /** Only touch the DOM when the value changed. */
  set(id: string, prop: 'text' | 'html', val: string) {
    const k = id + prop; if (cache[k] === val) return; cache[k] = val;
    const el = $(id); if (!el) return; if (prop === 'text') el.textContent = val; else el.innerHTML = val;
  },
  toast(msg: string, cls = '', dur = 2.4) {
    const box = $('toasts'); while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = msg; box.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000);
  },
  /** Commander Zix speaks (portrait + text box). */
  comm(text: string, dur = 5) {
    $('comm').hidden = false; $('comm-text').innerHTML = `<span class="who">Commander Zix</span>${text}`;
    portrait.attach($('comm-face')); portrait.talk = Math.min(dur, 2.5); UI.commT = dur;
  },
  hideComm() { $('comm').hidden = true; UI.commT = 0; },
  tick(dt: number) { if (UI.commT > 0) { UI.commT -= dt; if (UI.commT <= 0) $('comm').hidden = true; } },
  hint(html: string) { UI.set('hint', 'html', html); },
};
