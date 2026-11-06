# Occupation: resistance, revolts, garrisons

**Purpose.** Keep abduction nights necessary for the whole campaign and make conquered cities feel alive. Serves
pillar B. Fixes the review's "tribute makes nights optional" risk.

## Player-facing rules
- Every conquered city has **resistance** (0–100 %). It rises a little every day. High resistance lowers the city's
  tribute. At 100 % the city **revolts**: it pays nothing until order is restored.
- Running an abduction night anywhere in a region scares its cities: resistance there drops sharply, and any revolt
  there ends.
- After a victory, a **garrison** of the surviving units stays behind in the city. A bigger garrison slows resistance.
- Cities are never lost to a revolt (anti-pillar: no grind walls).

## Tuning (`src/data/campaign.ts` → `OCC`)
- Daily growth: `max(1, OCC.base + size − OCC.perGarrison × garrison)` with `base = 2`, `perGarrison = 0.5`.
- A night in the region: `resistance −= OCC.nightCalm (35)`; a revolt there resets to `OCC.afterRevolt (20)`.
- Tribute multiplier: `1 − OCC.tributeLoss (0.6) × resistance / 100`; 0 while revolting.
- Garrison: `ceil(OCC.garrisonShare (0.15) × surviving units)`, taken cheapest first (clones, then brutes, saucers,
  walkers), at least 1 if anything survived.
- New cities start at resistance 0.

## Edge cases
- Old saves: cities without resistance start at 0 with a garrison of 0.
- The final assault city has no resistance (the game ends there).

## Acceptance criteria
1. The globe's conquered-city rows show resistance; revolting cities show a REVOLT tag.
2. The city panel shows resistance, garrison and today's tribute.
3. A night in a region drops resistance of that region's cities by 35 and ends revolts.
4. The victory report lists the garrison left behind; the army shrinks by that many units.
