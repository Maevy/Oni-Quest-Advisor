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
- **Two of these modules define a `factionId` and they are not the same id space.**
  `army.ts`'s `ArmyFactionId` has **7** ids (`oni-clans` and `goblin-wartribes` among
  them); `faction.ts`'s scheme `Faction` has **6** (`monster-factions` instead). They
  overlap on five and resolve against different catalogs, so a field holding one must
  never be read as the other — `PublicSeatState` keeps `army.factionId` and
  `factionId` apart for exactly this reason. `schemeFactionForArmy()` is the only
  bridge: it passes the five shared ids through and sends both monster army factions to
  the deck they share. Reach for it whenever an army has to imply a Scheme deck.
- Guards and transitions here are **total**: a failed guard returns the state unchanged
  rather than throwing. That is what lets a caller skip a precondition silently — an
  online `startGame` on a state whose seats never readied just stays a lobby — so a test
  that drives a transition must assert the phase/status actually moved, not only that the
  call did not throw.
