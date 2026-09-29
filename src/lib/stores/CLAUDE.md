# lib/stores/ — application/state layer

- Owns runtime state: loaded content (missions/factions/schemes), the current screen
  - selections, and the per-mission play progress.
- Class-based singletons in `.svelte.ts` files (`contentStore`, `navigationStore`,
  `missionProgressStore`, `twoPlayerProgressStore`, `onlineGameStore`, `armyBuilderStore`,
  `tournamentStore`, `tournamentEventStore`), re-exported from `index.ts`. Built on Svelte 5 runes
  (`$state`/`$derived`) and exposed via
  small purposeful methods (e.g. `selectSeason()`, `rollRandomMission()`,
  `drawSchemes()`, `setRound()`) — not as raw mutable state exported wholesale for
  callers to mutate directly.
- `onlineGameStore` and `tournamentEventStore` are server-driven: they hold the
  visibility-filtered view, send intents to the API and refetch state (SSE notifications
  trigger refetches). No local mutation of game state — the server is the source of truth.
  `tournamentStore` is the opposite: a purely local, in-memory wizard draft that is discarded
  on leave.
- Orchestrates, doesn't decide: calls into `lib/domain` for any rule/decision logic
  (random draws, clamping, VP math) and into `lib/data` for loading/persistence.
  The store itself shouldn't implement that logic.
- Side effects (persisting progress, loading content) go through `lib/data` — never
  inline `localStorage.*` or `fetch` calls here.
- Persisted progress is loaded by merging it onto `domain.createEmptyProgress()`, so
  fields added later get their defaults — keep this pattern when extending
  `MissionProgress`.
- Markup-free: no Svelte component/UI concerns in this layer.
- **Stores are unit-testable.** Vitest runs in a node environment with no browser, but the
  `sveltekit()` plugin in `vite.config.ts` applies the runes transform to `.svelte.ts` under
  `test` too, so a `$state`/`$derived` class instantiates and behaves normally outside a
  component. `armyBuilder.svelte.spec.ts` is the working example: `await contentStore.loadArmy()`
  in a `beforeAll`, then drive the singleton through its methods against the real bundled
  content. Two things follow from the singleton being shared: reset it at the top of each case
  (`selectFaction()`/`leave()`), and build fixtures from whatever the content actually offers
  rather than assuming a unit id — a fixture that asserts "some faction has a unit with limit ≥ 3"
  survives a content drop, one that names a unit does not.
