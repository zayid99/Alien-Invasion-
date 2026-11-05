// Guided tutorial: one instruction at a time; each step waits until the player has done it.
import { $ } from './dom';
import { SFX } from '../core/audio';

export interface TutStep { text: string; check: () => boolean; enter?: () => void; highlight?: string }
export const TUT = {
  steps: [] as TutStep[], i: 0, active: false, label: 'Training', onDone: null as null | (() => void), onSkip: null as null | (() => void),
  start(label: string, steps: TutStep[], onDone?: () => void, onSkip?: () => void) {
    this.label = label; this.steps = steps; this.i = 0; this.active = true; this.onDone = onDone || null; this.onSkip = onSkip || null;
    $('tut').hidden = false; this.enter();
  },
  enter() {
    const s = this.steps[this.i]; s.enter?.();
    $('tut-step').textContent = `${this.label} ${this.i + 1}/${this.steps.length}`; $('tut-text').innerHTML = s.text;
    this.clearHighlight(); if (s.highlight) setTimeout(() => $(s.highlight)?.classList.add('tut-target'), 30);
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
};
