// Guided tutorial: one instruction at a time; each step waits until the player has done it.
// The card (#tut) is a cream sticker with a poster header strip: saucer glyph + "TRAINING 1/6" badge (#tut-step)
// on the left, "Skip tutorial" on the right (docs/ART_STYLE.md §7 "Tutorial box").
import { $ } from './dom';
import { SFX } from '../core/audio';
import { reducedMotion } from '../core/util';

export interface TutStep { text: string; check: () => boolean; enter?: () => void; highlight?: string }
export const TUT = {
  steps: [] as TutStep[], i: 0, active: false, label: 'Training', onDone: null as null | (() => void), onSkip: null as null | (() => void),
  start(label: string, steps: TutStep[], onDone?: () => void, onSkip?: () => void) {
    this.label = label; this.steps = steps; this.i = 0; this.active = true; this.onDone = onDone || null; this.onSkip = onSkip || null;
    $('tut').hidden = false; this.enter(false);
  },
  /** Show the current step. `pop` replays the card's pop-in so a new instruction is noticed. */
  enter(pop = true) {
    const s = this.steps[this.i]; s.enter?.();
    const badge = $('tut-step');
    if (badge) badge.textContent = `${this.label} ${this.i + 1}/${this.steps.length}`;   // uppercased by CSS (Bangers)
    $('tut-text').innerHTML = s.text;
    // §9 card enter: scale .9 → 1.03 → 1 over .24 s. #tut has no CSS animation to restart, so use WAAPI (the
    // `scale` property composes with the card's own translateX centring).
    if (pop && !reducedMotion) $('tut').animate?.([{ scale: '.9' }, { scale: '1.03', offset: 0.6 }, { scale: '1' }], { duration: 240, easing: 'cubic-bezier(.2, 1.6, .4, 1)' });
    this.clearHighlight(); if (s.highlight) setTimeout(() => { if (this.active && this.steps[this.i] === s) $(s.highlight)?.classList.add('tut-target'); }, 30);
  },
  clearHighlight() { document.querySelectorAll('.tut-target').forEach(el => el.classList.remove('tut-target')); },
  tick() {
    if (!this.active) return;
    const s = this.steps[this.i]; if (s.highlight && !$(s.highlight)?.classList.contains('tut-target')) $(s.highlight)?.classList.add('tut-target');
    if (!s.check()) return;
    SFX.play('buy'); this.i++;
    if (this.i >= this.steps.length) this.finish(); else this.enter();
  },
  finish() { this.active = false; this.clearHighlight(); $('tut').hidden = true; const f = this.onDone; this.onDone = null; f?.(); },
  stop() { this.active = false; this.clearHighlight(); $('tut').hidden = true; },
  skip() { const f = this.onSkip; this.stop(); f?.(); },
  /**
   * A new scene is starting: the globe tutorial counts as done once you leave the globe (its only goal is to get
   * you into a mission); any other running tutorial just stops. Keeps the Earth card from leaking into missions.
   */
  leaveScene() { if (!this.active) return; if (this.label === 'Earth') this.finish(); else this.stop(); },
};
