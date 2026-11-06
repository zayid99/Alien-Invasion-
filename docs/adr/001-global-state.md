# 001 Global mutable game state `G`

- **Context.** A small team (one developer plus Claude) building a browser game with many interacting systems.
- **Options.** (a) One mutable state object read and written by every system. (b) An entity-component framework.
  (c) Per-scene state objects with explicit ownership.
- **Decision.** (a): `game/state.ts` exports `G`, holding live state (`ents`, `player`, `night`, `inv`) and the save
  (`G.save`).
- **Consequences.** Fast to build and easy to inspect from the dev hooks. No ownership: any system can change
  anything, and timers can outlive their scene (see 002). Keep new state in typed sub-objects of `G`.
