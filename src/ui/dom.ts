// Small DOM helpers: element lookup, cached text updates, toasts, commander messages, the screen-transition
// iris and the damage overlay ("Moonlit Toybox" UI, docs/ART_STYLE.md §6, §7, §9).
import { portrait } from './portrait';
import { RES } from '../data/balance';
import type { Cost } from '../data/balance';
import { reducedMotion } from '../core/util';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const ICON = (r: string) => `<svg class="ico"><use href="#i-${r}"/></svg>`;
export function costHTML(c: Cost, have?: Record<string, number>) {
  return RES.filter(r => c[r]).map(r => `<span class="${r}${have && (have[r] || 0) < c[r] ? ' short' : ''}" title="${r}">${ICON(r)}${c[r]}</span>`).join('');
}
/** A changing number in a fixed-width slot (§3 "Changing numbers"): `--n` digits wide, tabular, right-aligned. */
// A <span>, not a <b>: it keeps the weight of the text around it (cost rows are Fredoka 600, §3).
export const numHTML = (v: string | number, n = String(v).length) => `<span class="num" style="--n:${n}">${v}</span>`;
/** Restart a CSS animation that is bound to a class (remove, force a style flush, add). */
export function replayClass(el: Element, cls: string) { el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls); }
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const SCREENS = ['scr-title', 'scr-howto', 'scr-briefing', 'scr-summary', 'scr-mothership', 'scr-pause', 'scr-end'];
const cache: Record<string, string> = {};

// ---- Commander Zix typing state: the full line is laid out at once (so the balloon never resizes) and the
// not-yet-typed tail of every text node sits in an invisible span that shrinks as the line types out. ----
interface TypeNode { full: string; shown: Text; rest: HTMLSpanElement; start: number }
const typing = { nodes: [] as TypeNode[], pos: 0, len: 0 };
const TYPE_CPS = 75;   // characters per second
function prepareTyping(el: HTMLElement) {
  typing.nodes = []; typing.pos = 0; typing.len = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const t of texts) {
    const rest = document.createElement('span'); rest.style.visibility = 'hidden'; rest.textContent = t.data;
    const full = t.data; t.data = ''; t.after(rest);
    typing.nodes.push({ full, shown: t, rest, start: typing.len }); typing.len += full.length;
  }
}
function applyTyping(pos: number) {
  for (const n of typing.nodes) {
    const k = Math.max(0, Math.min(n.full.length, Math.floor(pos - n.start)));
    if (n.shown.data.length === k) continue;
    n.shown.data = n.full.slice(0, k); n.rest.textContent = n.full.slice(k);
  }
}
function stopTyping() { typing.nodes = []; typing.pos = typing.len = 0; $('comm')?.classList.remove('talk'); }

// ---- iris + hurt state ----
let irisQueue: Promise<void> = Promise.resolve(), irisDepth = 0;
let hurtAt = -1e9, hurtPeak = 0, hurtTimer: ReturnType<typeof setTimeout> = null;
let toastFlip = false;

export const UI = {
  touch: false, commT: 0,
  /**
   * Compiles the new scene's shaders while the iris is closed (main.ts sets it to renderer.compileAsync with a
   * timeout). Kept as a hook so this module does not depend on the renderer.
   */
  prewarm: (): Promise<void> => Promise.resolve(),
  show(id: string | null) { for (const s of SCREENS) $(s).hidden = s !== id; },
  hud(on: boolean) {
    if (on) UI.clearGlobe();   // §7: the globe UI must never leak into a mission
    else UI.hurtPulse(false);
    $('hud').hidden = !on; $('touch').hidden = !(on && UI.touch);
  },
  globe(on: boolean) { $('globe-ui').hidden = !on; },
  /**
   * Scene hygiene (§7 last rule): hide the globe UI and every map label. Same effect as globe.ts hideLabels(),
   * done on the DOM directly so any scene can call it without importing the globe.
   */
  clearGlobe() {
    UI.globe(false);
    const box = $('g-labels'); if (box) for (const el of Array.from(box.children) as HTMLElement[]) el.style.opacity = '0';
  },
  /** Only touch the DOM when the value changed. */
  set(id: string, prop: 'text' | 'html', val: string) {
    const k = id + prop; if (cache[k] === val) return; cache[k] = val;
    const el = $(id); if (!el) return; if (prop === 'text') el.textContent = val; else el.innerHTML = val;
  },
  /** Toasts tilt -2deg / +1.5deg alternately by arrival (not by position, so they never flip when one leaves). */
  toast(msg: string, cls = '', dur = 2.4) {
    const box = $('toasts'); while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = msg;
    toastFlip = !toastFlip; d.style.rotate = toastFlip ? '-2deg' : '1.5deg';
    box.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000);
  },
  /** Commander Zix speaks: the balloon pops in from the porthole, then the line types out while it wobbles. */
  comm(text: string, dur = 5) {
    const box = $('comm'), el = $('comm-text');
    if (box.hidden) box.hidden = false; else { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; }   // pop again for a new line
    el.innerHTML = text; stopTyping();
    if (!reducedMotion) { prepareTyping(el); if (typing.len) box.classList.add('talk'); }
    portrait.attach($('comm-face')); portrait.talk = Math.min(dur, Math.max(1, typing.len / TYPE_CPS)); UI.commT = dur;
  },
  hideComm() { $('comm').hidden = true; UI.commT = 0; stopTyping(); },
  tick(dt: number) {
    if (typing.nodes.length) {
      typing.pos += dt * TYPE_CPS; applyTyping(typing.pos);
      if (typing.pos >= typing.len) stopTyping();
    }
    if (UI.commT > 0) { UI.commT -= dt; if (UI.commT <= 0) UI.hideComm(); }
  },
  hint(html: string) { UI.set('hint', 'html', html); },

  /**
   * Resource chip gain (§7): pop the chip (scale 1.3 → 1 with a white flash) and float a "+N" tag above it.
   * Works for the HUD chips (#res .r) and any `.chip` (globe wallet, mothership).
   */
  popChip(chip: HTMLElement, gain: number) {
    if (!chip) return;
    replayClass(chip, 'pop');
    if (gain > 0) {
      const p = document.createElement('span'); p.className = 'plus'; p.textContent = `+${gain}`;
      chip.appendChild(p); setTimeout(() => p.remove(), 750);
    }
  },

  /** True while a screen transition is running (main.ts ignores the pause key then). */
  get irisBusy() { return irisDepth > 0; },
  /** True from the moment the iris starts closing until its swap has run (the old view is still on screen). */
  irisClosing: false,
  /**
   * Screen transition (§7 "iris"): close the iris on `from` (a screen point: the clicked button or the saucer;
   * default the centre), hold 80 ms, run `swap`, pre-compile the new scene, then open. Under reduced motion it
   * is a plain 0.2 s fade (the CSS does that). Transitions queue, so a double click never overlaps two of them.
   * Never rejects: an error in `swap` is logged and the iris still opens.
   */
  iris(swap: () => void | Promise<void>, from?: { x: number; y: number }): Promise<void> {
    irisDepth++;
    const run = async () => {
      const el = $('iris');
      try {
        if (!el) { try { await swap(); } catch (err) { console.error(err); } await UI.prewarm(); return; }
        if (from && isFinite(from.x) && isFinite(from.y)) { el.style.setProperty('--x', `${Math.round(from.x)}px`); el.style.setProperty('--y', `${Math.round(from.y)}px`); }
        else { el.style.removeProperty('--x'); el.style.removeProperty('--y'); }
        UI.irisClosing = true; el.classList.add('on');
        await wait(reducedMotion ? 200 : 380 + 80);   // close, then hold
        try { await swap(); } catch (err) { console.error(err); }
        UI.irisClosing = false;
        await UI.prewarm();
        el.classList.remove('on');
        await wait(reducedMotion ? 200 : 420);        // open
      } finally { irisDepth--; UI.irisClosing = false; }
    };
    const p = irisQueue.then(run, run);
    irisQueue = p.catch(() => undefined);
    return p;
  },

  /**
   * Damage overlay (§6): `level` 0..1 flashes #hurt to that peak opacity (opacity only, 0.25 s); 0 turns the
   * overlay off (flash and low-shield pulse). Hits closer than 90 ms merge into one flash.
   */
  hurt(level: number) {
    const el = $('hurt'); if (!el) return;
    if (!(level > 0)) { clearTimeout(hurtTimer); el.classList.remove('on', 'pulse'); hurtPeak = 0; return; }
    const now = performance.now(), peak = Math.min(1, level);
    if (now - hurtAt < 90 && peak <= hurtPeak) return;
    hurtAt = now; hurtPeak = peak;
    el.style.setProperty('--hurt', peak.toFixed(2));
    replayClass(el, 'on');
    clearTimeout(hurtTimer); hurtTimer = setTimeout(() => { el.classList.remove('on'); hurtPeak = 0; }, 260);   // lets .pulse resume
  },
  /** Low shield (< 25 %): the overlay pulses at 1 Hz (CSS). */
  hurtPulse(on: boolean) { const el = $('hurt'); if (el && el.classList.contains('pulse') !== on) el.classList.toggle('pulse', on); },
};
