# routes/ — presentation (pages)

- Pages only wire things together: read state from `lib/stores`, pass it down to
  `lib/components`, forward component events/callbacks back into store actions.
- No business logic here — no mission-picking logic, no Scheme draw rules, no round
  or VP calculation. That belongs in `lib/domain` (rules) or `lib/stores`
  (orchestration).
- Don't call `fetch` or touch `localStorage` directly — that goes through `lib/data`,
  invoked from a store.
- Don't define new types here — import from `lib/domain`.
- Keep `<script>` blocks in `+page.svelte` short. If a page's script is doing anything
  beyond "read store → render component → call store action on event", that logic
  probably belongs one layer down.
