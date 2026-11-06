# Alien Invasion: Conquer Earth

A 3D browser game. You are **Commander Zix**, a gray alien. Abduct humans, cows and cars across the real world, build an army on your mothership, and conquer Earth's great cities one by one.

Built with TypeScript, three.js and Vite, for release on **CrazyGames**.

- Design document (pillars, systems, the 125-feature list, roadmap): [`docs/GDD.md`](docs/GDD.md)
- Art and sound credits (all CC0): [`CREDITS.md`](CREDITS.md)

## What's in this build (v0.1)

- **Real-world 3D globe** made from Natural Earth map data: 29 regions, 60 major cities, glowing mission sites, regional alert, global awareness, a day cycle, conquered territory and continent unlocks.
- **Abduction nights** in 4 biomes (farmland, desert, tropics, snow) with towns, farms, an army base, traffic, wildlife and collectible Earth artifacts. Earth responds with police, soldiers, tanks and missile trucks.
- **City invasions**: your army lands and fights on its own; you fly support. Destroy 3 shield pylons, then the defense HQ. Captured cities pay daily tribute.
- **Mothership**: 4 army units and 5 saucer upgrades.
- **Friendly tutorial**: Training Night, then a mothership tour and a globe tour. Every step waits until you've done it, and it can be skipped.
- Keyboard + mouse and touch controls, autosave, CrazyGames SDK hooks (ads switched off for the basic launch).

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

## Build for release

```sh
npm run build              # normal web build → dist/
npm run build:crazygames   # same, plus the CrazyGames SDK → dist-crazygames/
```

Upload the **contents** of `dist/` (zip it) to the CrazyGames developer portal. The build uses relative paths, so it works from any folder.

**Ads:** the basic launch has no ads. For the full launch, set `ADS_ENABLED = true` in `src/config.ts`. A midgame ad then plays between missions (never during gameplay) and sound mutes while it runs. `platform.rewardedAd()` is ready for optional rewards.

Check CrazyGames' current technical requirements before each submission. This session couldn't reach their docs to double-check the exact limits. The full build is about 8.6 MB, with the 3.2 MB music file loaded only when a battle starts.

## Test it

```sh
npm install --save-dev playwright && npx playwright install chromium   # one time
npm run build && npm test
```

The test plays the tutorial in a headless browser and fails on any console error.

In the browser console, `__AI.give(100)` adds 100 of every resource.

## How the code is organized

```
src/
  main.ts            boot, game flow between scenes, buttons, main loop
  config.ts          build switches (platform, ads)
  core/              engine (renderer, bloom, lights), input, audio, assets (glTF loader),
                     save (versioned), platform (CrazyGames SDK)
  data/              GAME CONTENT: balance.ts, units.ts, earth.ts (regions + cities), biomes.ts
  game/              live state + the world campaign (days, alert, tribute, unlocks, sites)
  gfx/               models made in code (saucer, gray aliens, farm animals, buildings), effects
  world/             entities and AI: civilians, military, player saucer, combat, invasion,
                     maps/ (countryside + city builders)
  scenes/            title, globe, mission, mothership, invasion
  ui/                HUD + radar, tutorial, portrait, DOM helpers
public/assets/       CC0 models (Kenney, Quaternius), sounds, music, licenses
```

### Good first changes

- **Balance:** `src/data/balance.ts` (saucer stats, upgrade costs, loot values, Earth's forces).
- **New city:** add a line to `CITIES` in `src/data/earth.ts` (name, country, region, lat/lon, size).
- **New unit:** add it to `src/data/units.ts`, then give it a model in `spawnUnit` (`src/world/invasion.ts`).
- **New jokes:** `src/world/lines.ts`.

## Roadmap

See section 11 of `docs/GDD.md`. Next up: research tree, mothership rooms, specimen traits, new mission types, helicopters and jets, and Earth's counter-attacks.
