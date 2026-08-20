# lib/server/ — server (online mode)

- Server-only layer, used exclusively by the API routes in `src/routes/api/games/`.
  May import `lib/domain` (pure, shared between client and server). Never imports
  from `lib/stores`, `lib/components`, or Svelte client APIs; no `localStorage` or
  `window`.
- `db.ts` owns the libsql file database (dev: `.data/oni-quest.db`, Fly: volume at
  `/data` via `DATA_DIR`) and bootstraps the schema lazily on first use.
- `gameRepository.ts` is the only module that speaks SQL. Every write is a single
  transaction that refreshes the `games` snapshot row and appends to the
  append-only `game_events` history.
- `sse.ts` is an in-process change-notification registry. Events are hints — the
  client refetches the full visibility-filtered state on notification, so no event
  replay logic exists anywhere.
- `ids.ts` / `http.ts` provide game codes, seat tokens (plain tokens are returned
  to clients exactly once; only SHA-256 hashes are stored) and the shared
  auth/error handling for the routes.
- All game rules live in `lib/domain` (`online.ts`) — this layer only persists,
  authenticates and transports. Validation of actions = domain `can*` guards.
