# Night sites: twists, 3-star grade, personal best

**Purpose.** Make each night worth choosing and worth replaying well. Serves pillar A (more and better abductions)
and B (where you strike matters). Fixes the review's "nights are interchangeable" risk.

## Player-facing rules
- From the player's 3rd night on, most abduction sites carry a **twist**: a change to the map plus a goal and a bonus.
  The site name, the globe card and the in-night objective line show it.
- Every night ends with a **grade of 0–3 stars** and a **score**; the report shows the personal best and says
  "New best!" when it is beaten.
- The twist goal's bonus is paid at the end of the night if the goal was met (also when the night ends early).

## Twists (tuning: `src/data/campaign.ts` → `TWISTS`)
| id | Name | Map change | Goal | Bonus |
|---|---|---|---|---|
| fair | County Fair | pens hold 2× animals | abduct 16 animals | +25 biomass |
| market | Night Market | 1.6× townsfolk | abduct 18 humans | +8 humans |
| rush | Rush Hour | 2× traffic | abduct 8 vehicles | +20 metal |
| expo | Science Expo | 6 scientists at the plaza (instead of 2) | abduct 4 scientists | +6 humans, +10 metal |
| depot | Tank Depot | 3 extra parked tanks at the base (only offered with beam level 3+) | abduct 2 tanks | +30 metal |
| quiet | Quiet Night | none | end the night with alert ≤ 1 | +5 humans, +15 biomass, +10 metal |

Twist chance per new site: `TWIST_CHANCE = 0.65` (none before the 3rd night).

## Score and stars
- `score = humans × 3 + biomass × 1 + metal × 2` of the cargo banked this night (combo bonuses included, twist bonus not).
- `target = 40 + 15 × site level`.
- Stars: 1 if `score ≥ 0.5 × target`; 2 if `score ≥ target`; 3 if 2 stars **and** (the twist goal is met, or there is
  no twist and `score ≥ 1.6 × target`).
- A night lost to a shield failure earns at most 1 star; ending a night early earns none.
- Saved: `best.nightScore` (highest score), `best.stars3` (count of 3-star nights).

## Edge cases
- Tutorial night: no twist, no grade.
- Depot twist needs beam level 3 (`up.beam ≥ 2`); it is never offered before.
- Twist goals count only abductions that reach the saucer (not things dropped).

## Acceptance criteria
1. From the 3rd night, at least one of the offered sites usually has a twist; its name and goal are on the globe card.
2. The twist's map change is visible (e.g. a County Fair has about twice the animals).
3. The objective line shows goal progress during the night (`County Fair: animals 5/16`).
4. The report shows stars, score, best, and the bonus when the goal is met; the bonus is added to resources.
5. An aborted night shows 0 stars; a destroyed one at most 1.
