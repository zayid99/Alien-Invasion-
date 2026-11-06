// CrazyGames SDK v3 adapter. Outside CrazyGames (or if the SDK fails) every call is a safe no-op.
import { ADS_ENABLED, PLATFORM } from '../config';

let sdk: any = null;
const FAKE_ADS = PLATFORM !== 'crazygames' && (() => { try { return localStorage.getItem('ai-fake-ads') === '1'; } catch { return false; } })();
/** Test-only stand-in for an ad: a dark full-screen card for `ms`, audio paused like a real ad. */
function fakeAd(label: string, ms: number): Promise<boolean> {
  return new Promise(res => {
    const d = document.createElement('div'); d.textContent = `${label} (test)`;
    d.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:#0f0828ee;color:#fff;font:600 28px system-ui';
    document.body.appendChild(d); platform.onAdPause?.(true);
    setTimeout(() => { d.remove(); platform.onAdPause?.(false); res(true); }, ms);
  });
}
let inGameplay = false, loading = false, heldStart = false;
const lastCloudWrite = new Map<string, number>();
const pendingCloud = new Map<string, ReturnType<typeof setTimeout>>();

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('could not load ' + src)); document.head.appendChild(s);
  });
}
const safe = (f: () => void) => { try { f(); } catch (e) { console.warn('[platform]', e); } };

export const platform = {
  get active() { return !!sdk; },
  onMuteChange: null as null | ((muted: boolean) => void),
  onAdPause: null as null | ((paused: boolean) => void),
  async init() {
    if (PLATFORM !== 'crazygames') return;
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      sdk = (window as any).CrazyGames?.SDK; if (!sdk) throw new Error('SDK missing');
      await sdk.init();
      safe(() => sdk.game.addSettingsChangeListener(() => platform.onMuteChange?.(platform.muted())));
    } catch (e) { console.warn('[platform] CrazyGames SDK unavailable, continuing without it', e); sdk = null; }
  },
  muted(): boolean { try { return !!sdk?.game?.settings?.muteAudio; } catch { return false; } },
  // CrazyGames expects loadingStop before the first gameplayStart: a gameplayStart asked for while loading is held
  // back and sent right after loadingStop.
  loadingStart() { loading = true; safe(() => sdk?.game.loadingStart()); },
  loadingStop() { loading = false; safe(() => sdk?.game.loadingStop()); if (heldStart) { heldStart = false; platform.gameplayStart(); } },
  /** Call when the player is actually playing (a mission), and stop on menus/pause. */
  gameplayStart() { if (loading) { heldStart = true; return; } if (inGameplay) return; inGameplay = true; safe(() => sdk?.game.gameplayStart()); },
  gameplayStop() { heldStart = false; if (!inGameplay) return; inGameplay = false; safe(() => sdk?.game.gameplayStop()); },
  /** Moments of joy (city captured, big upgrade). */
  happytime() { safe(() => sdk?.game.happytime()); },
  /**
   * Can rewarded offers be shown? Only with ads on (Full Launch) and the SDK loaded. Outside the CrazyGames build,
   * localStorage 'ai-fake-ads' = '1' fakes ads (a 1.5 s placeholder) so the flow can be tested.
   */
  adsAvailable(): boolean { return (ADS_ENABLED && !!sdk) || FAKE_ADS; },
  /** Between missions only. Does nothing while ADS_ENABLED is false (basic launch). */
  midgameAd(): Promise<void> {
    if (FAKE_ADS) return fakeAd('Midgame ad', 1000).then(() => undefined);
    if (!ADS_ENABLED || !sdk) return Promise.resolve();
    return new Promise(res => {
      const done = () => { platform.onAdPause?.(false); res(); };
      safe(() => sdk.ad.requestAd('midgame', { adStarted: () => platform.onAdPause?.(true), adFinished: done, adError: done }));
    });
  },
  rewardedAd(): Promise<boolean> {
    if (FAKE_ADS) return fakeAd('Rewarded ad', 1500);
    if (!ADS_ENABLED || !sdk) return Promise.resolve(false);
    return new Promise(res => {
      safe(() => sdk.ad.requestAd('rewarded', {
        adStarted: () => platform.onAdPause?.(true),
        adFinished: () => { platform.onAdPause?.(false); res(true); },
        adError: () => { platform.onAdPause?.(false); res(false); },
      }));
    });
  },
  cloudGet(key: string): string | null { try { return sdk?.data?.getItem(key) ?? null; } catch { return null; } },
  /** CrazyGames asks for at most one data write per key every 30 s, so writes are batched. */
  cloudSet(key: string, value: string) {
    if (!sdk?.data) return;
    const write = () => { pendingCloud.delete(key); lastCloudWrite.set(key, performance.now()); safe(() => sdk.data.setItem(key, value)); };
    const since = performance.now() - (lastCloudWrite.get(key) ?? -1e9);
    clearTimeout(pendingCloud.get(key));
    if (since >= 30000) write(); else pendingCloud.set(key, setTimeout(write, 30000 - since));
  },
};
