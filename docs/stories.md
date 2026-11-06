# Epics and stories (v0.4 sprint)

Sprint goal: fix the launch blockers from `docs/STUDIO_REVIEW.md` and build the five approved design changes.
P0 = must ship in this sprint. Evidence = how "done" is proven.

## Epic 0: Launch blockers (P0) ✅
| Story | Acceptance | Evidence |
|---|---|---|
| Won invasion is never recorded as a defeat | HQ falls within 1.6 s after the saucer → Victory, city occupied | e2e race check (fails with the bug, passes with the fix) |
| No tribute farming | ending a night at once pays 0 tribute, counts no mission | e2e abort check |
| Music stops when paused / hidden | battle music pauses with the game; audio suspended in a hidden tab | code review + manual |
| Helicopters fair, war room honest | "Even fight" armies win alone; "Risky" ones need the player | invasion balance runs (`docs/STUDIO_REVIEW.md` §2 method) |
| SDK order | `gameplayStart` never before `loadingStop` | code review (platform.ts) |

## Epic 1: Night sites (P0) ✅ — [night-sites.md](gdd/night-sites.md)
| Story | Acceptance | Evidence |
|---|---|---|
| 1.1 Twists on sites | twisted site names + goal on the globe card from night 3 | one-off script (twist.js): twist map counts, goal line, grade |
| 1.2 Twist map changes | County Fair has ~2× animals, Tank Depot 3 extra tanks | e2e: counts entities |
| 1.3 Goal progress line | objective line shows `name: x/y` | screenshot |
| 1.4 Grade + best | report shows stars, score, best; bonus paid when the goal is met | e2e: grade function + bonus |

## Epic 2: Invasion command (P0) ✅ — [invasion-command.md](gdd/invasion-command.md)
| Story | Acceptance | Evidence |
|---|---|---|
| 2.1 Gravity drop | live soldier held, dropped on a pylon damages it | one-off script (drop.js): pylon 640 → 583 hp |
| 2.2 Rally | F sets a ring; army objective switches to the target there | one-off script (drop.js): objective = pylon under the saucer |
| 2.3 Fair loss | two losses → defense +1 only | e2e: cityLevel after 2 failures |

## Epic 3: Occupation (P0) ✅ — [occupation.md](gdd/occupation.md)
| Story | Acceptance | Evidence |
|---|---|---|
| 3.1 Resistance + revolt | grows daily; revolt at 100 stops tribute | e2e: advance days |
| 3.2 Nights calm regions | a night in the region drops resistance 35, ends revolt | e2e |
| 3.3 Garrisons | victory leaves 15 % of survivors; report row | e2e: army after win |
| 3.4 Globe display | resistance bar, REVOLT tag, city panel rows | screenshot |

## Epic 4: Chapters and ending (P0) ✅ — [campaign-chapters.md](gdd/campaign-chapters.md)
| Story | Acceptance | Evidence |
|---|---|---|
| 4.1 Chapter gating | tier n+1 unlocks only with chapter n's capital | e2e: capture capital → tier up |
| 4.2 Chapter card | globe shows chapter, goal, progress | screenshot |
| 4.3 Final assault + ending | after 4 capitals the final card; win → ending modal | one-off script (chap.js) + screenshot |
| 4.4 New Game+ | keeps upgrades/army, resets map, harder cities | e2e: state after NG+ |

## Epic 5: Return hooks (P0) ✅ — [return-hooks.md](gdd/return-hooks.md)
| Story | Acceptance | Evidence |
|---|---|---|
| 5.1 Away tribute | save 3 h old → card + tribute paid | one-off script (away.js, real reload + Continue); e2e covers the rule |
| 5.2 Counter-attack | 2+ cities, 2 h+ away → one city's resistance +40, headline | e2e |
| 5.3 Daily challenge | one challenge site per date, playable once, best kept | e2e |

## Epic 6: Release (P0) ✅
| Story | Acceptance | Evidence |
|---|---|---|
| 6.1 Docs | GDD v0.4, systems index, ADRs, this file | files in `docs/` |
| 6.2 Build | `tsc`, both builds, e2e green; low-end draw calls within budget | command output |
| 6.3 Upload | new CrazyGames zip v0.4.0 from HEAD | zip in `marketing/` |

## Sprint result (6 Nov 2026)
All stories done. Evidence: `npm test` (tools/e2e.mjs) re-checks every criterion marked "e2e" above on each run; the
ones marked "one-off script" were verified once with scripts kept outside the repo and should move into e2e next; the bug A check was proven by re-introducing the bug (the test then fails with "Defeat").
Low-end check (low graphics, CPU ×4 slower): busy mission 208 draw calls, County Fair night 246, invasion 288.
Upload: `marketing/alien-invasion-conquer-earth-v0.4.0-crazygames.zip` (131 files, 6.5 MB, no dev hooks).
Not verified by a human yet: how the twists, gravity drop and chapters feel. Next step: a playtest with real players.
