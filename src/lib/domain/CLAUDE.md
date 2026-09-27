# lib/domain/ — domain

- Pure TypeScript: types (`Mission`, `SchemeCard`, `MissionProgress`, ...) and pure
  functions (`pickRandomMission`, `drawUniqueSchemes`, `setRound`, `calculateTotalVP`,
  ...). This is where game rules live (e.g. "intelligence 14–15 draws 3 Schemes",
  "the round is clamped to 1–5") — not in stores, routes, or components.
- No imports from Svelte, `lib/stores`, or `lib/data`. No `fetch`, no `localStorage`,
  no `window`/`document`.
- No hidden non-determinism: if a function needs randomness or the current time, take
  it as a parameter (inject the RNG/clock) instead of calling `Math.random()`/`Date.now()`
  inline, so it stays a pure, unit-testable function.
- No side effects, no UI concerns. Every function here should be testable with plain
  inputs and outputs, no mocking required — covered by the colocated `*.spec.ts` files.
- Pure algorithms that are not game rules belong here too when the server shares them:
  `qr.ts` (the in-app QR encoder) is the example — it is pure, unit-tested and rendered
  by a component, so it has no better home. Anything with I/O stays in `lib/data` or
  `lib/server`.
