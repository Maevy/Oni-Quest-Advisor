# routes/ — presentation (pages) + API endpoints

- Pages only wire things together: read state from `lib/stores`, pass it down to
  `lib/components`, forward component events/callbacks back into store actions.
- The online-mode API lives in `api/games/**/+server.ts`: thin handlers that
  validate input, call `lib/server` (repository/SSE/auth helpers — which in turn
  apply `lib/domain` rules) and return JSON. No game rules inside the handlers.
- `join/[code]/` is the invite-link entry point; it hands the code to the
  navigation store and redirects into the single-page flow on `/`.
- No business logic here — no mission-picking logic, no Scheme draw rules, no round
  or VP calculation. That belongs in `lib/domain` (rules) or `lib/stores`
  (orchestration).
- Don't call `fetch` or touch `localStorage` directly — that goes through `lib/data`,
  invoked from a store.
- Don't define new types here — import from `lib/domain`.
- Keep `<script>` blocks in `+page.svelte` short. If a page's script is doing anything
  beyond "read store → render component → call store action on event", that logic
  probably belongs one layer down.
