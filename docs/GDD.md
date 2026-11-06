# Alien Invasion: Conquer Earth — Game Design Document

Status: living document. Version 0.4 (6 November 2026, after the studio review in `docs/STUDIO_REVIEW.md`). Owner: Zayid.
System-by-system design: `docs/gdd/systems-index.md`. Decisions: `docs/adr/`. Current sprint: `docs/stories.md`.

## 1. The pitch

You are **Commander Zix**, a gray alien sent by the Gray Empire to conquer Earth. Fly a flying saucer over the real world, abduct humans, animals and machines, grow an army on your mothership, and invade the world's great cities one by one until humanity serves the Empire.

Comedic B-movie tone: the stun ray never kills ("dead humans make terrible servants"), defeated soldiers wave white flags, and humans say silly things while they float up.

- **Platform:** browser (CrazyGames first), keyboard + mouse and touch.
- **Business model:** free. Basic launch without ads. Full launch adds CrazyGames ads (midgame between missions, optional rewarded ads for bonuses).
- **Target length:** today a first campaign of about 6-10 hours in 4 chapters plus a final assault, then New Game+ and daily challenges. The long-term aim (40-60 hours) needs research, rooms and genetics (§4.7-4.9).

## 2. Design pillars

1. **Abduction feels great.** The beam, the floating screaming humans and the "bloop" into the saucer are the core joy. Every system should feed more and better abductions.
2. **Every choice changes the world.** Where you strike, how loud you are, and what you build change how Earth responds.
3. **Easy to start, deep to master.** A guided first night, then systems unlock one at a time over the first hours.
4. **The whole planet.** Real continents, real cities, recognizable places, all stylized and friendly.

**Anti-pillars** (what we will not do):
- **Not a management sim.** No spreadsheet screens; any menu decision takes 3 taps or fewer. (Protects pillar 3.)
- **No grind walls.** Never ask a player to replay an identical night just to afford progress; nothing is ever taken
  away for good (revolts stop tribute, they never lose a city). (Protects pillars 1 and 3.)
- **Not a killing game.** Nobody dies: stunned, surrendered, abducted, never killed. (Protects the tone.)

## 3. The three layers

| Layer | What you do | Feels like |
|---|---|---|
| **Globe** (strategy) | Choose mission sites on a 3D Earth, watch regions react, plan invasions, manage occupied cities | Plague Inc., XCOM's geoscape |
| **Missions** (action) | Fly the saucer: beam things up, stun defenders, send cargo home, survive Earth's response; or support your army in a city invasion | arcade action |
| **Mothership** (management) | Spend resources on units, saucer upgrades, rooms, research and specimen breeding | base building |

### Core loop

Globe: pick a site → Mission: abduct → resources come home → Mothership: build and upgrade → Globe: Earth reacts (alert, awareness, new defenses) → pick the next site, or invade a city.

### Long loop

Occupy cities → they pay daily tribute but build resistance, which nights in their region calm (`gdd/occupation.md`)
→ conquer each chapter's capital and its boss to open the next continents (`gdd/campaign-chapters.md`) → Earth
counter-attacks while you are away (`gdd/return-hooks.md`) → final assault on Earth's World Defense Command → ending
→ New Game+.

### Night loop (v0.4)

Most sites carry a twist (County Fair, Tank Depot, Quiet Night...) with a goal and a bonus; every night is graded
0-3 stars against a personal best (`gdd/night-sites.md`). In invasions the beam throws live defenders onto pylons and
the army can be rallied (`gdd/invasion-command.md`).

## 4. Systems

### 4.1 Resources
- **Humans:** from people. Used for Hypno-Brutes, pilots, research subjects, labor.
- **Biomass:** from animals, crops and forests. Used for clones and food.
- **Metal:** from vehicles and structures. Used for machines and upgrades.
- Later: **Energy** (power plants, reactors), **Knowledge** (scientists, libraries), **Artifacts** (silly Earth objects like pizza and rubber ducks that grant perks).

### 4.2 Alert, Awareness and Panic
- **Regional alert (0-100):** rises when you strike a region and decays each day. High alert means police, then army, tanks and missile trucks show up sooner and in greater numbers.
- **Global awareness (0-100):** how much the world believes in aliens. Raises Earth's military budget and research speed. Stealthy play keeps it low.
- **Panic** (later): high panic weakens Earth's economy but makes cities harder to hold.

### 4.3 Earth's response
- Inside a mission: escalating response by alert level (police → soldiers → tanks → missile trucks → helicopters and jets later).
- On the globe: Earth's defense level grows with days and awareness. Later Earth gets its own research tree (radar networks, beam jammers, the orbital laser "Project Halo") and counter-attacks on occupied cities.

### 4.4 Invasions and occupation
- A city invasion: your army lands and fights on its own. You fly support, drop reinforcements, and abduct surrendering soldiers mid-battle. Destroy the shield pylons, then the city's defense HQ.
- Occupied cities pay daily tribute. Later: resistance meter, garrisons, hypno-towers, uprisings.

### 4.5 Army
Units fight on their own. Built from resources on the mothership or dropped in battle.

### 4.6 Saucer upgrades
Tractor beam (lift weight, speed, radius), shield, engines, stun ray, cargo hold. Later: weapon slots, modules, hull types, cosmetic skins.

### 4.7 Specimens and genetics (planned)
Abducted humans carry traits (Athlete, Genius, Soldier, Chef, Conspiracy Theorist...). Breed hybrids that inherit traits, so your army reflects your abductions.

### 4.8 Research (planned)
Three trees with about 80 techs: **Biology** (clones, hybrids, specimens), **Technology** (saucer, weapons, machines), **Psionics** (mind control, stealth, propaganda).

### 4.9 Mothership rooms (planned)
Cloning vats, probe lab, hypno chamber, hangar, reactor, brig, recycler, hydroponics, research lab, war room, crew quarters, trophy hall, and more. Rooms cost power and crew and unlock features.

## 5. The world map

A stylized real Earth built from Natural Earth data (public domain). The world is split into 29 game regions and 60 real major cities, each with its regional architecture and a landmark, for example New York, Los Angeles, Toronto, Mexico City, São Paulo, London, Paris, Moscow, Cairo, Lagos, Dubai, Mumbai, Dhaka, Beijing, Tokyo and Sydney.

Each region has a biome that shapes its mission maps:
- **Temperate:** farms, forests, small towns.
- **Desert:** sand, cacti, oases.
- **Tropical:** palms, jungle edges, rice fields.
- **Cold:** snow, pines, ice.

**Unlock order (chapters):** 1 North America (capital New York), 2 South America & Europe (Paris), 3 Africa, Russia & the Middle East (Cairo), 4 Asia & Oceania (Tokyo), then the Final Assault on the World Defense Command in Geneva. Each chapter opens when the previous capital falls.

## 6. Tutorial and onboarding

1. **Training Night** (US Midwest farm, no army). New players land here straight from the loading screen (CrazyGames: gameplay immediately); the High Council's orders are the first tutorial line. Steps: fly, beam a cow, beam a human, send cargo, stun and beam a police officer. Each step waits until you've done it.
2. **Mothership tour:** build your first Gray Clone, buy your first upgrade.
3. **Globe tour:** pick your first real mission site.
4. **Gradual unlocks:** invasions unlock once you have a real army. Research, rooms and genetics unlock in later updates, each with a short guided intro.

## 7. Feature catalog (target: 100+)

Status: ✅ in this build · 🔜 next updates · 💡 later

**Missions and modes (15)**
✅ Abduction night (4 biomes) · ✅ City invasion · ✅ Training night · 🔜 Stealth snatch (abduct a scientist unseen) · 🔜 Specimen hunt (rare trait human) · 🔜 Crop circles (propaganda) · 🔜 Sabotage (power plant, radar) · 🔜 Defend an occupied city · 🔜 Rescue a captured gray · 💡 Aircraft-carrier raid · 💡 Desert secret base · 💡 Antarctic lab · ✅ Boss battles (city bosses + Project Halo) · 💡 Endless survival · ✅ Daily challenge night (v0.4)

**Saucer gear (20)**
✅ Tractor beam · ✅ Stun ray · ✅ Boost · ✅ Cargo teleport · ✅ Shield · 🔜 EMP pulse · 🔜 Gravity bomb · 🔜 Cloaking · 🔜 Decoy hologram · 🔜 Mind-wipe ray · 💡 Multi-beam · 💡 Magnet hook for tanks · 💡 Drone escort · 💡 Hull types (scout, hauler, warship) · ✅ Skins · ✅ Combos + MEGA BEAM (Phase 1) · 💡 Repair nanites · 💡 Scanner · 💡 Teleport strike · 💡 Planet cracker (endgame)

**Army units (20)**
✅ Gray Clone · ✅ Hypno-Brute · ✅ Attack Saucer · ✅ Mega Walker · 🔜 Jetpack Gray · 🔜 Sludge Tank · 🔜 Hybrid Soldier · 🔜 Probe Drone · 🔜 Brain Bug (mind control) · 💡 Abductor Ship · 💡 Siege Tripod · 💡 Spore Pod · 💡 Psi Priest · 💡 Mech Captured (converted Earth mech) · 💡 Goo Blob · 💡 Shield Drone · 💡 Mothership Lance · 💡 Clone Swarm · 💡 Hero units ×2

**Earth enemies (25)**
✅ Police · ✅ Soldiers · ✅ Tanks · ✅ Missile trucks · ✅ AA turrets · ✅ Shield pylons · ✅ Defense HQ · 🔜 Jeeps with gunners · ✅ Helicopters · ✅ Fighter jets · 🔜 SWAT · 🔜 Agents in black suits · 🔜 Earth mechs · 💡 Scientists with gadgets · 💡 Radar network · 💡 Beam jammers · 💡 Navy ships · 💡 Orbital laser · 💡 Super soldier · 💡 Giant robot boss · 💡 Rival alien hunters · 💡 Conspiracy vloggers (raise awareness) · 💡 Farmers with pitchforks · 💡 Dogs that bark at saucers · 💡 Weather balloons (decoys)

**Mothership and progression (20)**
✅ Unit building · ✅ 5 upgrade tracks · ✅ War room power estimate · ✅ Autosave · 🔜 Rooms ×12 · 🔜 Research ×80 (counted as 1 system here) · 🔜 Specimen traits ×30 · 🔜 Hybrid breeding · 🔜 Crew officers · 💡 Trophy hall · ✅ Specimen catalogue + artifacts (Phase 1) · 💡 Clans ×4 · 💡 Commander skills · ✅ Achievements ×30 (Phase 1) · ✅ Daily supply streak (Phase 1) · ✅ Daily missions (Phase 1) · ✅ New Game+ (v0.4) · 💡 Difficulty modes · 💡 Iron-man mode · 💡 Sandbox · 💡 Statistics · 💡 Codex ("Earthpedia")

**World and globe (15)**
✅ Real-world 3D globe · ✅ 29 regions · ✅ 60 real cities · ✅ Regional alert · ✅ Global awareness · ✅ Day cycle · ✅ Mission sites · ✅ Occupation + daily tribute · ✅ Continent unlocks · 🔜 Earth research tree · ✅ Counter-attacks (v0.4) · ✅ Resistance and revolts (v0.4) · ✅ Landmarks per city · 💡 Weather and seasons · 💡 Moon and Mars expansion

**Presentation (10)**
✅ CC0 animated characters and vehicles · ✅ Synth + sample sound · ✅ Touch controls · ✅ Bloom lighting · 🔜 Music per region · 🔜 More voice-style barks · 💡 Day missions · 💡 Photo mode · 💡 Localization (Bengali, Spanish, ...) · 💡 Accessibility options

That's 125 features. Counted the research tree, traits and achievements as one feature each.

Also built, not in the original catalogue: destructible cities, 11 regional city styles, Earth News, rewarded ads and the retry offer, night twists and 3-star grades, gravity drop and rally, garrisons, away tribute.

## 8. Progression and length (target math)

Measured, not hoped (studio review, 6 Nov 2026):
- Training + first invasion: ~15-20 min (first "even fight" city around night 3-4).
- Chapter 1 (North America, capital New York): ~45-75 min. Later chapters: ~1-2 h each.
- First campaign including the Final Assault: about 6-10 h. Replay: New Game+ (Earth +2 defense per level), daily challenges.
- The original 40-60 h target needs the planned research, rooms and genetics systems.

## 9. CrazyGames launch plan

- **Basic launch:** no ads. SDK used for `loadingStart/Stop`, `gameplayStart/Stop` and `happytime` (victories). Progress saved in browser storage, mirrored to the CrazyGames data module when available.
- **Full launch:** midgame ad after a mission (never during gameplay), optional rewarded ad (for example "double tribute today"). Audio muted while an ad plays.
- Keep the first download small: models are compressed (meshopt) and loaded per scene.
- Check the current CrazyGames technical requirements before each submission.

## 10. Tech

TypeScript + three.js + Vite. Content (regions, cities, units, upgrades, balance) lives in `src/data/` so most new content is a data edit. See `README.md` for the code map.

## 11. Roadmap

1. ✅ **Foundation**: project, ported gameplay, globe, tutorial, CrazyGames hooks.
1b. ✅ **Launch prep + v0.4 retention pass**: Phase 1/2 meta, cartoon art, city identity, studio-review fixes, night twists, invasion command, occupation, chapters and ending, return hooks.
2. 🔜 **North America vertical slice:** research tree v1, mothership rooms v1, specimen traits, 3 new mission types, helicopters, region music.
3. 🔜 **The world:** all continents playable, Earth research and counter-attacks, resistance.
4. 💡 **Depth and replay:** clans, genetics, crew, bosses, New Game+, achievements.
5. 💡 **Polish and full launch:** art and audio pass, balance, ads, localization.
