# lib/domain/ — domain

- Pure TypeScript: types (`Scenario`, `MissionCard`, ...) and pure functions
  (`pickRandomScenario`, `toggleMissionSelection`, ...). This is where game rules live
  (e.g. "a roll excludes the current scenario", "at least one mission must stay
  selected") — not in stores, routes, or components.
- No imports from Svelte, `lib/stores`, or `lib/data`. No `fetch`, no `localStorage`,
  no `window`/`document`.
- No hidden non-determinism: if a function needs randomness or the current time, take
  it as a parameter (inject the RNG/clock) instead of calling `Math.random()`/`Date.now()`
  inline, so it stays a pure, unit-testable function.
- No side effects, no UI concerns. Every function here should be testable with plain
  inputs and outputs, no mocking required.
