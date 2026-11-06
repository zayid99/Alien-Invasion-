# Invasion command: gravity drop, rally point, fair loss

**Purpose.** Put the beam back at the centre of city invasions so the player plays instead of watching. Serves pillar A.

## Player-facing rules
- **Gravity drop.** In an invasion the beam can grab Earth soldiers and tanks that are still fighting (tanks need the
  beam level that lifts them). They are held under the saucer while the beam is on. Let go and they fall: they are
  knocked out, and the crash damages everything near where they land, including shield pylons, turrets and (once its
  shield is down) the HQ. Surrendered soldiers and wrecks are still beamed up for resources, as before.
- **Rally.** Press **F** (or the **RALLY** button on touch) to send the army to the saucer's position. The army attacks
  the nearest pylon, turret or (unshielded) HQ within 50 m of the rally point; if there is none, it gathers there. A
  pulsing ring marks the point for 25 s or until its target falls.
- **Fair loss.** A failed invasion raises that city's defense by **at most 1** (it used to stack per attempt). The
  rewarded retry still removes it.

## Tuning (`src/data/balance.ts` → `DROP`, `RALLY`)
- `DROP.base = 40`, `DROP.perTon = 14`, `DROP.radius = 7`; landing faster than `DROP.minImpact = 9` m/s counts.
  Damage to each Earth target within the radius: `base + perTon × mass` (soldier ≈ 54, tank ≈ 40 + 14 × its mass).
  Buildings in the radius take 80 % of it.
- The dropped unit itself takes `DROP.self = 999` (soldiers surrender, tanks are wrecked).
- `RALLY.radius = 50`, `RALLY.time = 25` s.
- `LOSS.maxPenalty = 1` defense level.

## Edge cases
- Held units drift with the saucer; if the saucer is destroyed they fall.
- The HQ ignores drops while its shield is up (same as other damage).
- Rally while the army is empty does nothing and says so.

## Acceptance criteria
1. Holding the beam over a live soldier in an invasion lifts and holds it; releasing drops it; a drop on a pylon
   visibly damages it.
2. Pressing F sets a ring; units move to it and attack the target there.
3. Losing the same city twice leaves its defense at +1, not +2.
