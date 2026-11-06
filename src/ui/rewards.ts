// Rewarded-ad offers (Phase 2, Full Launch): double a night's haul, recover cargo lost when the saucer was
// destroyed, retry a lost invasion with the army restored, double the daily supply drop. Nothing shows unless
// platform.adsAvailable() (ads on + SDK loaded). CrazyGames rule: never a midgame ad and a rewarded offer in the
// same break, so a watched reward skips the next midgame (main.ts betweenMissions reads takeRewardedGap()).
import { G } from '../game/state';
import { RES } from '../data/balance';
import type { Wallet } from '../data/balance';
import { platform } from '../core/platform';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { give, walletText } from '../game/meta';
import { $, UI } from './dom';

let gapRewarded = false;
/** True once if a rewarded ad was watched since the last midgame opportunity. */
export function takeRewardedGap() { const r = gapRewarded; gapRewarded = false; return r; }

/** Show `btn` as a rewarded offer; on a watched ad run `reward`. Each offer works once. */
export function offer(btn: HTMLButtonElement, label: string, reward: () => void) {
  if (!platform.adsAvailable()) { btn.hidden = true; return; }
  btn.hidden = false; btn.disabled = false; btn.innerHTML = `<span class="play">▶</span>${label}`;
  btn.onclick = async () => {
    if (btn.disabled) return; btn.disabled = true;
    const ok = await platform.rewardedAd();
    if (!ok) { btn.disabled = false; UI.toast('The ad did not finish, so no reward this time', 'warn', 2.4); return; }
    gapRewarded = true; btn.hidden = true; SFX.play('buy'); reward(); writeSave(G.save);
  };
}
const sum = (w: Partial<Wallet>) => RES.reduce((n, r) => n + (w[r] || 0), 0);

/** Night report offers: double what was banked, or bring back the cargo lost in a shield failure. */
export function nightOffers(banked: Partial<Wallet>, lost: Partial<Wallet>) {
  const btn = $<HTMLButtonElement>('btn-sum-reward');
  if (sum(lost) > 0) offer(btn, 'Recover lost cargo', () => { give(lost); UI.toast(`Cargo recovered: ${walletText(lost)}`, 'good', 2.6); });
  else if (sum(banked) > 0) offer(btn, 'Double this haul', () => { give(banked); UI.toast(`Haul doubled: ${walletText(banked)}`, 'good', 2.6); });
  else btn.hidden = true;
}
/** Invasion report offer after a defeat: retry with the army that went in and no defense penalty. */
export function retryOffer(show: boolean, retry: () => void) {
  const btn = $<HTMLButtonElement>('btn-end-reward');
  if (!show) { btn.hidden = true; return; }
  offer(btn, 'Retry with your army restored', retry);
}
