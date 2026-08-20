# lib/data/ — infrastructure

- Wraps every side-effecting/external concern: loading the static game data
  (missions, factions, schemes) and reading/writing `localStorage` for persisted
  per-mission progress.
- Static content lives under `content/{missions,factions,schemes}/*.json` and is
  loaded eagerly with `import.meta.glob`; progress is stored under the
  `oni-quest-advisor:` localStorage key prefix. Exposes small, typed functions
  (`loadMissions()`, `loadSchemes()`, `loadMissionProgress(id)`,
  `saveMissionProgress(progress)`, ...) — callers (stores) get plain data back and
  don't know _how_ it was fetched or persisted.
- No business/domain logic here. Deciding _which_ Scheme to draw or _validating_ a
  selection belongs in `lib/domain`, not here.
- The static dataset is loaded here so the source can be swapped later (e.g. for a
  real backend) without touching domain, stores, or components.
- Online mode seam: `onlineApi.ts` (fetch wrapper for `/api/games/...`, no business
  logic beyond request/response mapping) and `onlineSession.ts` (the seat's
  game-id/seat/token triple in `localStorage` under the same key-prefix convention).
