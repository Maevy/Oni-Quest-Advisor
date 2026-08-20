# lib/stores/ — application/state layer

- Owns runtime state: loaded content (missions/factions/schemes), the current screen
  - selections, and the per-mission play progress.
- Class-based singletons in `.svelte.ts` files (`contentStore`, `navigationStore`,
  `missionProgressStore`, `twoPlayerProgressStore`, `onlineGameStore`), re-exported
  from `index.ts`. Built on Svelte 5 runes (`$state`/`$derived`) and exposed via
  small purposeful methods (e.g. `selectSeason()`, `rollRandomMission()`,
  `drawSchemes()`, `setRound()`) — not as raw mutable state exported wholesale for
  callers to mutate directly.
- `onlineGameStore` is server-driven: it holds the visibility-filtered game view,
  sends intents to the API and refetches state (SSE notifications trigger refetches).
  No local mutation of game state — the server is the source of truth.
- Orchestrates, doesn't decide: calls into `lib/domain` for any rule/decision logic
  (random draws, clamping, VP math) and into `lib/data` for loading/persistence.
  The store itself shouldn't implement that logic.
- Side effects (persisting progress, loading content) go through `lib/data` — never
  inline `localStorage.*` or `fetch` calls here.
- Persisted progress is loaded by merging it onto `domain.createEmptyProgress()`, so
  fields added later get their defaults — keep this pattern when extending
  `MissionProgress`.
- Markup-free: no Svelte component/UI concerns in this layer.
