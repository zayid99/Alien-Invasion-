# 002 Scenes as free functions with hook objects

- **Context.** Five scenes (title, globe, mission, mothership, invasion) plus the victory and report screens.
- **Options.** (a) Free functions `startX/updateX/endX` and mutable hook objects for callbacks. (b) Scene classes with
  a lifecycle and cancellable timers.
- **Decision.** (a). `main.ts` switches on `G.mode`; scenes call back through `missionHooks`, `invasionHooks`,
  `playerHooks`, `globeHooks`.
- **Consequences.** Little code. Delayed callbacks (`setTimeout`) are not cancelled on scene change, which caused the
  "won invasion recorded as a defeat" bug. Rule from v0.4: every delayed callback must check that its scene is still
  the active one (`G.mode`, `G.inv.over`) before acting.
