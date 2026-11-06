# 007 Dev hooks (`window.__AI`) for automated tests

- **Context.** Gameplay needs end-to-end checks without a human.
- **Decision.** Non-CrazyGames builds expose `window.__AI` (state, scene starters, `simulate(seconds)`, war room
  functions). `tools/e2e.mjs` drives the real game through it in headless Chromium.
- **Consequences.** Regression checks for each fixed bug and each new system's acceptance criteria. The CrazyGames
  build has no hooks, so its SDK behaviour is checked by hand in their QA tool.
