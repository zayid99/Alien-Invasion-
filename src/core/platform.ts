// CrazyGames SDK v3 adapter. Outside CrazyGames (or if the SDK fails) every call is a safe no-op.
import { ADS_ENABLED, PLATFORM } from '../config';

let sdk: any = null;
let inGameplay = false;
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
  loadingStart() { safe(() => sdk?.game.loadingStart()); },
  loadingStop() { safe(() => sdk?.game.loadingStop()); },
  /** Call when the player is actually playing (a mission), and stop on menus/pause. */
  gameplayStart() { if (inGameplay) return; inGameplay = true; safe(() => sdk?.game.gameplayStart()); },
  gameplayStop() { if (!inGameplay) return; inGameplay = false; safe(() => sdk?.game.gameplayStop()); },
  /** Moments of joy (city captured, big upgrade). */
  happytime() { safe(() => sdk?.game.happytime()); },
  /** Between missions only. Does nothing while ADS_ENABLED is false (basic launch). */
  midgameAd(): Promise<void> {
    if (!ADS_ENABLED || !sdk) return Promise.resolve();
    return new Promise(res => {
      const done = () => { platform.onAdPause?.(false); res(); };
      safe(() => sdk.ad.requestAd('midgame', { adStarted: () => platform.onAdPause?.(true), adFinished: done, adError: done }));
    });
  },
  rewardedAd(): Promise<boolean> {
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
