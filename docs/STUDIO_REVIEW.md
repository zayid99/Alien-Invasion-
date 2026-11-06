# Studio review: Alien Invasion: Conquer Earth

Date: 6 November 2026. Build reviewed: `c229ed0` (v0.3.0 plus the phone UI, city and model updates).
Method: the game-studio pipeline ("existing work" path, rigor **full**). Two independent role reviews (Creative
Director; Technical Director + QA Lead) read the code without seeing each other's conclusions. On top of that:
an automated invasion balance test, a scope check against `docs/GDD.md`, and a launch checklist. The serious bugs
were re-checked against the code before being listed.

Pipeline position: concept, pillars and art direction exist; no systems index, per-system design docs or
architecture decision records; one smoke test. Next stage: **Systems design**.

## 1. Scope check (plan vs build)

- Built: about 45 of the 125 features in the GDD catalogue (about 36 %).
- Built but never planned: destructible cities, 11 regional city styles, Earth News, rewarded ads and the retry
  offer, 15 extra cities (60, not 45), 4 extra regions (29, not 25).
- Built ahead of plan: helicopters, jets, city bosses, landmarks, skins.
- Skipped: roadmap step 2, the "North America slice" (research, rooms, specimen traits, 3 new mission types).
  Effort went to launch prep and spectacle instead.
- The GDD is stale: counts and statuses are wrong, and it promises a 40–60 hour campaign. The real campaign is
  about 4–8 hours.

## 2. Playtest report (automated)

Session: build `c229ed0`, headless Chromium, low graphics, scripted players. The human "first 5 minutes" (did
players understand the goal, how did it feel) is **NOT ASSESSED**: it needs real players from the target age.

**Balance (High).** Invasions became much harder after the city update. The saucer hovered over the army and never
fired, so this measures the army alone:

| Army vs Kansas City (defense 1) | War room said | Before the city update | After |
|---|---|---|---|
| 8 clones + 2 brutes | Risky | lost | lost |
| 10 clones + 3 brutes + 1 saucer | Even fight | won in 104 s | lost the whole army |
| same army, helicopters removed | | | won in 88 s |

Cause: ground units ignore flying enemies (`world/invasion.ts:186`), so only Attack Saucers and the player can
shoot helicopters, and the war room's estimate leaves helicopters and jets out.

## 3. Confirmed bugs

- **A (High):** a won invasion can be recorded as a defeat. If the saucer is shot down and the army kills the HQ
  inside the next 1.6 s, the loss handler still runs and the city's defense goes up.
- **B (Medium):** tribute farming. Start a night, pause, "End the night": a day passes, tribute pays, and it counts
  for the daily mission and night achievements.
- **C (Medium):** the battle music keeps playing while paused or with the tab hidden.
- Low: "New game" always asks to erase a save on a first visit; aborting the training night shows a normal report;
  the first-visit SDK events send `gameplayStart` before `loadingStop`.

## 4. Creative Director

Core loop: the 30-second beam/stun action is the strongest part (squash, YOINK, combos, MEGA BEAM). The 5-minute
night cycle works but nights are interchangeable. Between sessions only the daily streak pulls players back.
Progression has no ending, and late-game tribute makes nights economically optional.

| Pillar | Verdict |
|---|---|
| Abduction feels great | holds in nights, weak in invasions (the player mostly watches) |
| Every choice changes the world | weak: consequences are numbers, every night is the same farm |
| Easy to start, deep to master | half: easy yes, deep not yet |
| The whole planet | holds on the globe, weak in play (world fully open after 6 cities) |

Primary player: Achiever/collector. Secondary: Explorer, light Storyteller. Not for: Competitors, Socializers,
deep strategy fans. Comparables: Hole.io, Plague Inc., Learn to Fly.

Recommended changes (all approved by Zayid on 6 Nov 2026):
1. Night site twists and a 3-star grade per night, with a personal best.
2. The beam matters in invasions: throw tanks and soldiers onto pylons, tap to set the army's rally point; soften
   the defense penalty for losing.
3. Nights stay necessary: conquered cities build resistance that nights in their region suppress; garrisons stay
   behind in conquered cities.
4. Chapters gated by continent bosses, a final assault, an ending, and New Game+.
5. Return hooks: "while you were away" tribute, Earth counter-attacks, a daily challenge night with a best score.

Anti-pillars: not a management sim (any menu decision takes 3 taps or fewer); no grind walls; nobody dies.

## 5. Technical Director and QA Lead

Download size and performance are fine (JS 320 KB gzipped; 250 draw calls in a mission, 303 in an invasion on a
low-end simulation). Risks, highest first: the CrazyGames zip is older than the source; no WebGL context-loss
handling; large canvases on iOS; screen changes can stall on slow networks; audio not suspended when hidden; cloud
save throttled to 30 s with no flush on page close. Code health: tuning numbers scattered outside
`src/data/balance.ts`, loose TypeScript, very large `globe.ts` and `invasion.ts`.

Implicit decisions worth recording: global mutable state `G`; scenes as free functions with hook objects; ink
outlines as a second material slot; screen changes wait for background downloads; toon conversion at load time;
whole-save JSON migration; throttled cloud save; no physics engine.

Pre-release checks (★ automatable with the `__AI` dev hooks): ★ new player reaches the mothership with no errors;
★ a full night ends at dawn; ★ shield failure loses the cargo; ★ invasion win and loss; ★ saucer-down/HQ-down race
is a win; ★ old saves migrate; ★ pause and abort pay no tribute; ★ low quality renders under budget; ★ fake-ad
pacing; CrazyGames QA tool on the real build; iPhone Safari and low-end Android; touch; tab hidden in each mode;
throttled 3G; zip rebuilt from HEAD.

## 6. Launch checklist (Basic Launch)

Verdict on `c229ed0`: **NO-GO** until three fixes: rebuild the zip from the latest code, fix bug A, rebalance
helicopters and make the war room count them. Ready: covers, store text, performance, credits and licences, no
personal data collected, progress save through CrazyGames. Gaps: the preview video shows the old cities; no plan for
a first patch.
