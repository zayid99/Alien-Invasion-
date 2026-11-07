# Moon Base (Phase 1 of Vision 2.0)

**Purpose.** Replace the mothership's text menus with the hollow moon: a living 3D base the player taps through.
Serves the new pillar "Everything is alive" and pillar 3 (the moon opens up room by room). Code: `src/scenes/moonbase.ts`,
data: `src/data/moonbase.ts`.

## Look
A cutaway of the Moon floating over Earth, in the Moonlit Toybox style (toon shading, ink outlines, slime-green and
violet alien tech). Two layouts were rendered for approval: **wedge** (a quarter cut out, two faces meeting at the
reactor shaft) and **slice** (the front half cut away). Outside: cratered crust with glowing seams, an observation
dome with Commander Zix on the north pole, antennas, a docking ring, saucers coming and going. On the faces: crew
walking the ledges, elevator capsules running between floors.

## Rooms and what they do in Phase 1
| Room | Phase 1 job (moved from the mothership) | Living animation | Later |
|---|---|---|---|
| Command Bridge | go to Earth (globe), war-room power | crew at consoles, rotating hologram Earth | chapter map, fleet orders |
| Hybrid Lab | grow Gray Clones and Hypno-Brutes | vats with growing grays, rising bubbles | hybrids with traits |
| Shipyard | build Attack Saucers and Mega Walkers | saucer on a lift, welding robot arms with sparks, conveyor, crane | ship classes |
| Research Lab | saucer upgrades (beam, shield, engine, ray, cargo) | robot arm, floating cow specimen, bubbling flasks | the tech tree |
| Guest Quarters | the specimen catalogue | humans on couches, alien TV, a guard | workers, test subjects |
| Cargo Vault | resources and Earth artifacts | crates in resource colours, hover-drone moving crates | storage upgrades |
| Trophy Hall | achievements and saucer skins | stolen landmarks spinning under spotlights | a trophy per capital |
| Armory | locked ("Phase 3") | blinking panel, weapon racks | powers for city raids |
| Reactor Core | shows the base level | pulsing core, spinning rings | energy |

## Player-facing rules
- **Overview:** the whole moon with a name tag on every room. Tap a room (or its tag) → the camera flies into it and its
  panel opens beside it. **Back** flies out. Drag rotates the moon a little; pinch/wheel zooms.
- **Building plays in the room:** buying a unit or an upgrade plays a 3-6 s animation in that room (a clone climbs out
  of a vat, a saucer rises off the lift, the robot arm installs the part) while the result counts up. No waiting
  timers (anti-pillar).
- **Entry:** new players still start in the Training Night (CrazyGames instant play). After it, a short fly-in shows the
  moon opening, and the moon becomes the home screen. Returning players land on the moon.
- **Phones:** tags are tap targets of at least 44 px; in portrait the room panel is a bottom sheet over the room.

## Budget
- Overview within 250 draw calls on low graphics; rooms share Kit-merged geometry; humans/aliens are instances.
- Low graphics turn off the face walkers and the outside saucers.

## Acceptance criteria
1. After the training night the player lands on the moon; Continue lands on the moon.
2. Every room tag is tappable on desktop and phone; Back returns to the overview.
3. Everything the mothership did is reachable from rooms (units, upgrades, globe, catalogue, achievements, skins).
4. Each purchase plays its room animation.
5. Low graphics overview ≤ 250 draw calls; no console errors.

## Open question for Zayid
- Wedge or slice layout (concept renders, 7 Nov 2026).
