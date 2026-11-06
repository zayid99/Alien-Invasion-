# 006 Platform adapter for CrazyGames

- **Context.** The game ships on CrazyGames first and runs standalone for testing.
- **Decision.** `core/platform.ts` wraps SDK v3. Every call is a no-op outside CrazyGames. It owns event ordering:
  `gameplayStart` requested while loading is held back and sent right after `loadingStop` (v0.4).
- **Consequences.** Game code never touches the SDK directly. Ads stay behind `ADS_ENABLED` and `platform.adsAvailable()`.
