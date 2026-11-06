# Return hooks: away tribute, counter-attacks, daily challenge

**Purpose.** Give players a reason to come back tomorrow beyond the streak. Serves pillar B (the world moves while you
are away). Fixes "nothing happens while you are away".

## Player-facing rules
- **While you were away.** Coming back after 30 minutes or more, your cities have kept paying: a card shows what
  arrived (up to 8 hours count).
- **Earth strikes back.** After 2 hours or more away, with 2+ conquered cities, Earth counter-attacks one of them: its
  resistance jumps. The card and Earth News say where. A night in that region calms it again (see occupation.md).
- **Daily challenge.** Every day one special site appears on the globe: same region and twist for everyone that day.
  It can be played once; its score and stars are kept as "today's best".

## Tuning (`src/data/campaign.ts` → `RETURN`)
- `RETURN.minAwayH = 0.5`, `RETURN.maxAwayH = 8`; away tribute = today's tribute × `awayH / RETURN.hoursPerDay (4)`
  (so 8 hours = 2 days of tribute).
- Counter-attack: `awayH ≥ RETURN.attackAfterH (2)` and `≥ 2` occupied cities; target = the city with the smallest
  garrison (ties: the highest resistance); `resistance += RETURN.attackRes (40)`.
- Daily challenge: seed = hash of the local date; region = an unlocked region picked by the seed; twist picked by the
  seed among the allowed twists; level = that region's mission level + 1.

## Edge cases
- First visit: no away card.
- Clock changes backwards: away time below 0 counts as 0.
- The challenge site disappears at local midnight; a played challenge does not come back the same day.

## Acceptance criteria
1. Loading a save with `savedAt` 3 hours ago and 2 conquered cities shows the away card with tribute and a
   counter-attack, and pays the tribute.
2. The globe shows a "Daily challenge" row; playing it once records the score; it is gone afterwards until tomorrow.
