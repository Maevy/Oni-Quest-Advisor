# lib/stores/ — application/state layer

- Owns runtime state: loaded scenarios, the currently selected scenario, the currently
  selected mission card ids.
- Built with Svelte 5 runes (`$state`/`$derived`), exposed as small purposeful
  functions (e.g. `rollScenario()`, `selectScenario(id)`, `toggleMission(id)`) — not as
  raw mutable state exported wholesale for callers to mutate directly.
- Orchestrates, doesn't decide: calls into `lib/domain` for any rule/decision logic
  (random pick, selection validation) and into `lib/data` for loading/persistence.
  The store itself shouldn't implement that logic.
- Side effects (persisting the current selection, loading scenario data) go through
  `lib/data` — never inline `localStorage.*` or `fetch` calls here.
- Markup-free: no Svelte component/UI concerns in this layer.
