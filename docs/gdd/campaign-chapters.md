# Chapters, final assault, ending, New Game+

**Purpose.** Give the campaign a shape: a clear goal every ~45 minutes, a finale and a "done" moment, then a reason to
play again. Serves pillars B and D. Fixes "no ending" and "the world unlocks too fast".

## Player-facing rules
- The campaign has **4 chapters**, one per unlock tier. Each chapter has a **capital** guarded by a boss. Conquering
  the capital unlocks the next chapter's regions.
- After the 4th capital falls, the **Final Assault** on the World Defense Command opens. Winning it ends the story:
  an ending screen, credits and the **Conqueror** saucer skin.
- **New Game+** restarts the conquest with your upgrades, army, skins, catalogue and achievements kept, and Earth
  stronger (+2 defense on every city and +1 threat on every night per New Game+ level).
- The globe panel always shows the current chapter, its goal and progress.

## Chapters (tuning: `src/data/campaign.ts` → `CHAPTERS`, `FINAL`)
| Chapter | Tier | Regions | Capital (boss) |
|---|---|---|---|
| 1 | 1 | North America | New York (Liberty Titan) |
| 2 | 2 | South America & Europe | Paris (Iron Knight) |
| 3 | 3 | Africa, Russia & the Middle East | Cairo (Savanna Goliath) |
| 4 | 4 | Asia & Oceania | Tokyo (Mega Shogun) |
| Final | — | World Defense Command, Geneva | Project Halo, defense `FINAL.level = 7` (+2 per NG+) |

- `tierUnlocked = 1 + number of chapter capitals conquered, in order` (never lowered for old saves).
- New Game+ resets: day 1, awareness, alert, cities, sites, tiers, resources (to `FINAL.ngStart = 40` each).

## Edge cases
- Old saves that already unlocked tiers by the old city count keep them; the chapter card shows the lowest chapter
  whose capital is not yet taken.
- Capitals are normal cities in every other way (tribute, resistance).

## Acceptance criteria
1. The globe shows "Chapter N · name" with the capital as the goal.
2. Conquering the capital announces the next chapter and unlocks its regions.
3. After the 4th capital the Final Assault card appears; winning it shows the ending with New Game+ and Keep playing.
4. New Game+ keeps upgrades and army, resets the map, and cities show higher defense.
