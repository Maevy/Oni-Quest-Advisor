# routes/ — presentation (pages) + API endpoints

- Pages only wire things together: read state from `lib/stores`, pass it down to
  `lib/components`, forward component events/callbacks back into store actions.
- The server-backed APIs live in `api/games/**/+server.ts` (online matches) and
  `api/tournaments/**/+server.ts` (tournament events): thin handlers that
  validate input, call `lib/server` (repository/SSE/auth helpers — which in turn
  apply `lib/domain` rules) and return JSON. No game rules inside the handlers.
- `api/health/` is the unauthenticated ops probe (Fly HTTP check); it reports
  aggregates only — never game ids, nicknames or tokens.
- Cross-cutting API concerns (body-size cap, per-IP rate limits, redacted
  request logging, unhandled-error logging) live in `src/hooks.server.ts`, not
  in the individual handlers.
- `join/[code]/` and `tournament-join/[code]/` are the invite-link entry points; each
  hands its code to the navigation store and redirects into the single-page flow on `/`.
- No business logic here — no mission-picking logic, no Scheme draw rules, no round
  or VP calculation. That belongs in `lib/domain` (rules) or `lib/stores`
  (orchestration).
- Don't call `fetch` or touch `localStorage` directly — that goes through `lib/data`,
  invoked from a store.
- Don't define new types here — import from `lib/domain`.
- Keep `<script>` blocks in `+page.svelte` short. If a page's script is doing anything
  beyond "read store → render component → call store action on event", that logic
  probably belongs one layer down.
