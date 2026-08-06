# lib/data/ — infrastructure

- Wraps every side-effecting/external concern: loading the static scenario/mission
  dataset, reading/writing `localStorage` for persisted session state.
- Exposes small, typed functions (`loadScenarios()`, `saveSelection(state)`,
  `loadSelection()`) — callers (stores) get plain data back and don't know _how_ it
  was fetched or persisted.
- No business/domain logic here. Deciding _which_ scenario to pick or _validating_ a
  selection belongs in `lib/domain`, not here.
- Static game data (scenario/mission JSON) is loaded from here so the source can be
  swapped later (e.g. for a real backend) without touching domain, stores, or components.
