# Vision 2.0: the Hollow Moon

Decided with Zayid on 7 November 2026. This document records the new direction; system designs live in `docs/gdd/`.

## The pitch
The Moon is hollow: it is the Gray Empire's ship. You run it room by room (shipyard, hybrid lab, research, guest
quarters for abducted humans, trophy hall...), every room alive with animation. From the Moon you sneak down to Earth
at night with your saucer to abduct people, animals and machines, and you raid Earth's real cities Clash of
Clans-style: scout, choose troops, landing edges and powers, then watch the city fall apart.

## Decisions
1. **Tone: cartoon.** After a raid you choose **Rule** (hypnotized citizens work for you: tribute, garrison,
   resistance) or **Raze** (the city is levelled: lots of scrap metal and fear, no tribute, awareness spikes). People
   are abducted, flee or are teleported away; the game never shows civilians killed. Keeps the comedy and the
   CrazyGames audience (largely 8-18).
2. **Platform: CrazyGames on the web now**, mobile web included. Every new screen is tap-first. If the CrazyGames
   numbers are good, the same build can be wrapped as an Android app (then iOS) later without a rewrite.
3. **City battles: pure Clash of Clans style.** Scout → plan (troops, landing edges, up to 3 powers) → deploy and fire
   powers by tapping. The saucer is no longer flown in city battles; it stays the hero of the night missions.
4. **Start with the Moon Base.**

## Pillars (updated)
1. **Abduction feels great** (nights, unchanged).
2. **Every choice changes the world** (where you strike, Rule or Raze, stealth or loud).
3. **Easy to start, deep to master** (new players are in a night within seconds; the Moon opens up room by room).
4. **The whole planet** (real cities, landmarks, regional looks).
5. **Everything is alive** (new): no screen is just text; every action has a scene with animation behind it.

## Anti-pillars (updated)
- **No dead screens.** Every menu sits on top of a living 3D room.
- **No grind walls and no waiting timers.** Building plays a short animation (seconds, not hours); there is nothing
  to pay to skip.
- **Nobody is shown dying.** Stunned, surrendered, abducted, fled, never killed.
- **Three taps or fewer** for any base decision.

## Phases (each one ships to CrazyGames before the next starts)
1. **Moon Base** (`docs/gdd/moon-base.md`): the hollow-moon hub replaces the mothership screen.
2. **Depth:** research tree, hybrids with traits from abducted specimens, ship classes (scout, hauler, warship,
   carrier), energy from the reactor, the cloak and stealth nights.
3. **City raids:** Clash of Clans-style scout / plan / deploy with powers from the Armory; the military escalates
   realistically and some civilians fight back.
4. **Rule or Raze**, more rooms and room upgrades, trophies from every capital.
