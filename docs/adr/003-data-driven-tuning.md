# 003 Tuning lives in `src/data`

- **Context.** Balance changes are frequent and must be safe for a non-programmer to request.
- **Decision.** Every gameplay number (costs, hit points, damage, rewards, chances, timers) belongs in `src/data/`
  (`balance.ts`, `units.ts`, `campaign.ts`), named, never as a magic number in system code.
- **Consequences.** One place to tune, and the war room estimate can read the same numbers the fight uses. The review
  found older values outside `data/` (boss HP, mech HP, alert gains); move them when those systems are next touched.
