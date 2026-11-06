# 004 Save format: versioned JSON, additive migration

- **Context.** Progress must survive updates; CrazyGames' Data module mirrors local storage.
- **Options.** (a) Whole-save JSON with a version number and a merge that fills new fields with defaults. (b) Per-version
  migration steps.
- **Decision.** (a), with a rule: new fields are added with safe defaults and never renamed or removed. Steps that need
  real conversion get a small `if (s.v < N)` block in `migrate`.
- **Consequences.** v4 (this pass) adds `ngPlus`, `challenge`, city `res`/`revolt`/`garrison`, `best.nightScore`,
  `best.stars3` with defaults; `tierUnlocked` is never lowered. Cloud writes are throttled to one per 30 s.
