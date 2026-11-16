# City raids (Vision 2.0, phase 3): Clash of Clans style

**Purpose.** You command the attack instead of flying a saucer: scout, choose where to land which troops, time your
powers. Serves pillar B (every choice changes the battle) and the empire loop (train in the Moon Base, then attack Earth).
Code: `src/world/raid.ts`, tuning `src/data/raid.ts`, HUD `#raid` in `index.html`.

## Player-facing rules
- **Scout.** The battle opens on the city from above. Drag to pan, wheel or pinch to zoom (WASD / arrows, +/- too).
  The clock does not run and Earth's reinforcements and jets wait until you act.
- **Deploy.** Troop cards at the bottom show how many of each troop you brought (your whole army) and their level.
  Pick a card (or 1-4), then tap the **glowing green zone** along the city edge; hold and slide to drop several.
  Tapping outside the zone shows a red ring and a hint.
- **Powers** (from the Armory; 5-7): **Orbital Laser** (after a 0.8 s warning ring: 260 damage to everything in a 10 m
  circle, 320 to buildings), **EMP Blast** (20 m: turrets, tanks, mechs, soldiers and helicopters stunned 6 s; bosses
  are immune), **Rally Beacon** (troops go to the spot and attack the structure there). Charges per raid: laser and EMP
  = Armory level, beacons 3.
- **Clock.** 3:00 from the first troop or power. Lose when time runs out, or when every deployed troop has fallen and
  none are left to deploy. **End battle** before deploying anything leaves without a penalty.
- **Stars.** ★ all shield pylons down · ★★ HQ down (victory) · ★★★ victory with at least 1:00 left.
- **After.** Troops never deployed go home; only fallen troops are lost. Surrendered soldiers are shipped to the Moon
  Base (2 humans each). Garrisons, tribute and chapters work as before.

## Acceptance (e2e)
A raid opens in scout mode with no troops landed; picking the clone card and tapping the zone five times lands five
clones, starts the clock and leaves ×5 on the card. A scripted raid (16 clones, 5 brutes, 4 saucers, 2 walkers vs.
Kansas City, defense 1, with an EMP and a laser on a pylon) won with ★★★ and 1:33 left.
