# Moon Base (Phase 1 of Vision 2.0)

**Purpose.** Replace the mothership's text menus with the hollow moon: a living 3D base the player taps through.
Serves the new pillar "Everything is alive" and pillar 3 (the moon opens up room by room). Code: `src/scenes/moonbase.ts`,
data: `src/data/moonbase.ts`.

## Look
A cutaway of the Moon floating over Earth, in the Moonlit Toybox style (toon shading, ink outlines, slime-green and
violet alien tech). **Layout: the wedge** (chosen by Zayid, 7 Nov 2026): a quarter of the moon is cut out, two faces
meet at the glowing reactor shaft. Each face holds four storeys; every room reaches out to the moon's curved edge, so
the rooms fill most of each face (about 65 %), and goes 10 m deep into the rock. Outside: cratered crust with glowing seams, an observation
dome with Commander Zix on the north pole, antennas, a docking ring, saucers coming and going. On the faces: crew
walking the ledges, elevator capsules running between floors.

## Rooms and what they do in Phase 1
| Room | Phase 1 job (moved from the mothership) | Living animation | Later |
|---|---|---|---|
| Command Bridge | go to Earth (globe), war-room power | war map of Earth with blinking targets, typing crew, Zix swivelling in the captain's chair, hologram Earth with orbiting saucers, radar dish, live screens | chapter map, fleet orders |
| Hybrid Lab | grow Gray Clones and Hypno-Brutes | five vats with grays growing, bubbles, glowing flow in the ceiling pipe, new clones walking out, operator desk | hybrids with traits |
| Shipyard | build Attack Saucers and Mega Walkers | saucer rising on a lift while two arms weld it (sparks), a second half-built frame with its own welder, conveyor, crane, spinning hazard beacon, workers | ship classes |
| Research Lab | saucer upgrades (beam, shield, engine, ray, cargo) | a cow and a human floating in specimen tubes, DNA hologram, scanning robot arm, bubbling flasks, live screens, a scientist walking | the tech tree |
| Guest Quarters | the specimen catalogue | three cells with couches and beds, humans fidgeting, one pacing, alien TV, a guard on patrol, a pizza drone doing rounds | workers, test subjects |
| Cargo Vault | resources and Earth artifacts | teleport pad beaming loot in from Earth, conveyor to the stacks, hover-drone, spinning artifacts, a keeper | storage upgrades |
| Trophy Hall | achievements and saucer skins | Liberty torch, Eiffel top and pyramid tip spinning under swaying spotlights, golden Zix statue, a guided tour | a trophy per capital |
| Armory | locked ("Phase 3") | weapon racks, power cells charging in turn, a Mega Walker on display, an alien test-firing at a cardboard tank | powers for city raids |
| Reactor Core | shows the base level | pulsing core, spinning rings, energy pulses up and down the shaft, sparks | energy |

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

## Status (v0.5.0, 7 Nov 2026)
- Built and in the game: the Moon Base replaces the mothership. After the training night the moon flies in and its
  tutorial runs (Hybrid Lab → build a clone → Research Lab → upgrade the beam → To Earth). Continue lands on the moon.
- Tap a room (in 3D or its tag) to fly in; the room panel opens (right side, bottom sheet in portrait) with a row of
  room buttons to hop between rooms; Back or Esc flies out.
- Purchases play in the room: a clone climbs out of a vat and walks off (Hybrid Lab), the saucer on the lift spins and
  bursts with sparks (Shipyard), the DNA hologram spins up (Research Lab), with a caption.
- Budget: overview 256 draw calls on low graphics (outlines only on the room you are in, batched bubbles and DNA,
  fewer background actors on low); 422 on high.
- Acceptance checks: e2e walks training → Moon Base tutorial → build → upgrade → To Earth.
