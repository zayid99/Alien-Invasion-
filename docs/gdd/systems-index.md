# Systems index

Status: ✅ built · 🆕 designed in v0.4 (this pass) · 🔜 planned · 💡 later. Priority: P0 = the game does not work
without it, P1 = core retention, P2 = depth. Pillars: **A** abduction feels great, **B** every choice changes the
world, **C** easy to start, deep to master, **D** the whole planet.

| # | System | Status | Pri | Pillar | Depends on | Code | Design |
|---|---|---|---|---|---|---|---|
| 1 | Saucer flight, beam, stun ray, cargo | ✅ | P0 | A | input, entity | `world/player.ts`, `world/combat.ts` | GDD §4 |
| 2 | Abduction juice, combos, MEGA BEAM | ✅ | P0 | A | 1 | `world/combat.ts`, `gfx/fx.ts` | GDD §4 |
| 3 | Night map (countryside) + civilians | ✅ | P0 | A, D | biomes | `world/maps/countryside.ts`, `world/civilians.ts` | GDD §5 |
| 4 | Alert + Earth response (missions) | ✅ | P0 | B | 1, 3 | `world/combat.ts`, `world/military.ts` | GDD §4.2 |
| 5 | **Night sites: twists, 3-star grade, best score** | 🆕 | P1 | A, B | 3, 4, 11 | `data/campaign.ts`, `scenes/mission.ts` | [night-sites.md](night-sites.md) |
| 6 | Resources + economy (humans, biomass, metal) | ✅ | P0 | B | 1 | `data/balance.ts` | GDD §4.1 |
| 7 | Mothership: units + upgrades | ✅ | P0 | C | 6 | `scenes/mothership.ts`, `data/units.ts` | GDD §4.5–4.6 |
| 8 | City invasion: army AI, pylons, HQ, bosses | ✅ | P0 | B, D | 7, 10 | `world/invasion.ts`, `scenes/invasion.ts` | GDD §4.4 |
| 9 | **Invasion command: gravity drop, rally, fair loss** | 🆕 | P1 | A | 1, 8 | `world/invasion.ts`, `world/combat.ts` | [invasion-command.md](invasion-command.md) |
| 10 | City look, destruction, battle life | ✅ | P1 | D | — | `world/maps/city*.ts`, `world/cityDamage.ts`, `world/battle.ts` | GDD §5 |
| 11 | Globe: regions, cities, sites, panel | ✅ | P0 | B, D | 12 | `scenes/globe.ts` | GDD §3 |
| 12 | Campaign: days, awareness, tribute | ✅ | P0 | B | 6 | `game/campaign.ts` | GDD §4.2 |
| 13 | **Occupation: resistance, revolts, garrisons** | 🆕 | P1 | B | 8, 12 | `game/campaign.ts` | [occupation.md](occupation.md) |
| 14 | **Chapters, final assault, ending, New Game+** | 🆕 | P1 | B, D | 8, 12 | `game/campaign.ts`, `scenes/invasion.ts` | [campaign-chapters.md](campaign-chapters.md) |
| 15 | Meta: daily streak + mission, catalogue, achievements, skins | ✅ | P1 | C | 6 | `game/meta.ts`, `ui/meta.ts` | GDD §7 |
| 16 | **Return hooks: away tribute, counter-attacks, daily challenge** | 🆕 | P1 | B | 5, 12, 13 | `game/campaign.ts`, `ui/meta.ts` | [return-hooks.md](return-hooks.md) |
| 17 | Earth News | ✅ | P2 | B | 12 | `game/news.ts` | GDD §7 |
| 18 | Tutorial + onboarding | ✅ | P0 | C | 1, 7, 11 | `ui/tutorial.ts` | GDD §6 |
| 19 | Save + migration + cloud save | ✅ | P0 | — | platform | `core/save.ts` | [ADR 004](../adr/004-save-versioning.md) |
| 20 | Platform (CrazyGames SDK), ads | ✅ | P0 | — | — | `core/platform.ts`, `ui/rewards.ts` | [ADR 006](../adr/006-platform-adapter.md) |
| 21 | Rendering: toon + ink, quality, bloom | ✅ | P0 | — | — | `gfx/toon.ts`, `core/engine.ts` | [ADR 005](../adr/005-ink-outlines.md), ART_STYLE.md |
| 22 | Audio | ✅ | P1 | A | — | `core/audio.ts` | — |
| 23 | Research, rooms, specimen traits | 🔜 | P2 | C | 7 | — | GDD §4.7–4.9 |

## Contradiction check (v0.4 systems together)

- **Resistance vs return hooks:** a counter-attack adds resistance, and nights remove it. Both use the same number,
  so there is one rule to learn. Revolts never take a city away (anti-pillar: no grind walls), they only stop its
  tribute.
- **Garrisons vs chapters:** garrisons shrink the army after each win, which slows the push to a chapter capital. That
  is wanted (nights stay necessary), but the share is small (15 %) so a capital is never out of reach.
- **Gravity drop vs abduction:** live defenders are held and thrown, surrendered ones and wrecks are still beamed up
  for resources. Both happen with the same button, decided by the target's state, so the beam stays one verb.
- **Daily challenge vs tribute farming fix:** the challenge is a normal night (a day passes, tribute is paid once),
  so it cannot be used to farm.
- **Loss penalty cap vs retry offer:** the cap (+1 defense at most) and the rewarded retry (which removes the +1) agree.
