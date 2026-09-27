# lib/server/ — server (online games and tournaments)

- Server-only layer, used exclusively by the API routes in `src/routes/api/games/` and
  `src/routes/api/tournaments/` (plus the unauthenticated ops probe `src/routes/api/health/`). May
  import `lib/domain` (pure, shared between client and server) and read the bundled static content
  through the `lib/data` loaders (`content.ts` wraps them). Never imports from `lib/stores`,
  `lib/components`, or Svelte client APIs; no `localStorage` or `window`.
- `db.ts` owns the libsql file database (dev: `.data/oni-quest.db`, Fly: volume at `/data` via
  `DATA_DIR`) and bootstraps the schema lazily on first use (WAL journal mode + busy timeout). It
  holds two families of tables: `games`/`game_events` for online matches and
  `tournaments`/`tournament_events` for tournament events — each an append-only history plus one
  state-snapshot row per entity.
- `gameRepository.ts` is the only module that speaks SQL for games. Every mutation runs through
  `mutateOpen` / `mutateAsSeat` / `mutateAsLeader`: the complete authenticated read-modify-write
  cycle (SELECT → auth → guards → snapshot refresh + append to the append-only `game_events`
  history) happens inside one write transaction, serialized behind an in-process FIFO queue — the
  libsql client fails concurrent write transactions with SQLITE_BUSY instead of queueing them. One
  Node process = the queue is complete; a multi-process deployment would need database-level
  locking instead.
- `tournamentRepository.ts` is its tournament twin (`mutateOpenTournament` for joins,
  `mutateAsTournamentViewer` / `mutateAsTournamentOrganizer` for everything else) with its own FIFO
  queue, so a lobby's concurrent joins can never double-book a seat.
- `payload.ts` parses request-body shapes the server stores as snapshots (a `PickedArmy`, a string
  list) with hard length caps. `sse.ts` is an in-process change-notification registry — one per
  entity family, capped subscribers per entity (8 games, 40 tournaments). Events are hints — the
  client refetches the full visibility-filtered state on notification, so no event replay logic
  exists anywhere.
- `ids.ts` / `http.ts` / `errors.ts` provide entity codes, seat tokens (plain tokens are returned
  to clients exactly once; only SHA-256 hashes are stored), `ApiError` and the shared auth/error
  handling for the routes.
- `rateLimit.ts` is a fixed-window in-memory limiter, applied per IP by `src/hooks.server.ts` —
  that hook also caps API body size, logs one redacted line per API request (path only; query
  strings may carry seat tokens) and logs unhandled errors. Both creation endpoints (`/api/games`,
  `/api/tournaments`) share the stricter hourly bucket.
- `cleanup.ts` owns retention: games (lobby 7 days, abandoned 30, finished/closed 90, with a final
  round auto-finished instead of deleted) and tournaments (lobby 7 days, abandoned 30, concluded
  exactly the 48-hour report window the creation notice promises).
- All game rules live in `lib/domain` (`online.ts`, `tournamentEvent.ts`) — this layer only
  persists, authenticates and transports. Validation of actions = domain `can*` guards.
