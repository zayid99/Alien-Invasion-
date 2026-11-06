# Submitting Alien Invasion: Conquer Earth to CrazyGames (Basic Launch)

Basic Launch is CrazyGames' soft launch: no ads, a limited audience, at least 7 days and 500 plays (or 21 days at
most). CrazyGames then compares conversion, average playtime and day-1 retention with other games and decides on
Full Launch (ads on). Check the developer portal's current rules before you submit; they change.

## 1. Build the upload
- `npm run build:crazygames` builds into `dist-crazygames/` (SDK on, ads off, no console cheats).
- A ready zip of version 0.3.0 is in this folder: `alien-invasion-conquer-earth-v0.3.0-crazygames.zip`
  (124 files, 9 MB; `index.html` at the root). Limits: 50 MB initial download (20 MB for the mobile homepage),
  250 MB / 1,500 files in total.

## 2. In the CrazyGames developer portal (developer.crazygames.com)
1. Create a developer account and choose **Submit a game**.
2. Upload the zip (or the contents of `dist-crazygames/`).
3. Game type: **HTML5**. Engine: **three.js** (Other).
4. Orientation: **landscape**; mark **mobile supported** (the game also plays in portrait).
5. Turn on **Progress Save** (the game saves through the SDK Data module; without the toggle the module is off).
6. Title, description, controls and tags: copy from `STORE.md`.
7. Covers: `cover_landscape_1920x1080.png`, `cover_portrait_800x1200.png`, `cover_square_800x800.png`
   (check the portal's required sizes; resize the portrait/square ones if they differ).
8. Preview video: `preview.mp4` (20 s, 1280×720, real gameplay, no audio).
9. Choose **Basic Launch**. Ads are switched off in code (`ADS_ENABLED = false` in `src/config.ts`).

## 3. Their QA checks this build already passes
- New players land in gameplay immediately (straight into the training night).
- `loadingStart/Stop`, `gameplayStart/Stop` and `happytime` are sent; progress saves via the Data module.
- Mouse + keyboard and touch; no custom fullscreen button; no outside links; English.
- Initial download about 6 MB before play.

## 4. While Basic Launch runs
- Watch the dashboard: conversion (still playing after 1 min), average playtime, D1 retention, CTR.
- Targets from the research: 80 %+ conversion, 10+ min playtime, D1 10–15 %.
- If CTR is low, try another cover. Tell Claude the numbers and it will tune the game.
