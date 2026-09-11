# Technical Spec — Oni Quest Advisor

**How the app is built** — data formats, rendering behaviour, the visual system and the online
architecture. For player-facing behaviour see
[../functional-spec/](../functional-spec/README.md).

This spec complements, and does not replace, two other sources:

- the root [QWEN.md](../../QWEN.md) — stack, domain model, layered architecture, conventions,
  commands and release process;
- the `CLAUDE.md` inside each `src/lib/` layer folder — the binding rules for adding files to
  that layer. Read the one in a folder before you add anything there.

Where a rule here and a rule in a layer `CLAUDE.md` disagree, the layer file wins: it is closer
to the code and reviewed on every change.

> These specs describe the app **as built**, verified against the code at v0.6.4 plus the
> unreleased solo Mission Briefing on `develop`.

## Documents

1. [01-visual-theme.md](./01-visual-theme.md) — palette and surfaces, the button system and its
   hue semantics, player and round accent systems, the neon border, overlay stacking and the
   `backdrop-filter` trap, the scrolling model.
2. [02-mission-data-format.md](./02-mission-data-format.md) — the mission JSON schema, the
   one-entry-per-round `round`/`group` convention, the automatic ceasefire objective, the content
   guards that enforce all of it, and an add-a-mission checklist.
3. [03-map-rendering.md](./03-map-rendering.md) — the 36″ board: coordinate system, orientation
   grid, deployment zone geometry and labels, the quarters cross, marker shapes, and the
   **nearest-edge** ruler rule with its label staggering.
4. [04-scheme-data-format.md](./04-scheme-data-format.md) — faction and scheme JSON, file layout,
   per-faction deck composition, `copies` overrides, the `incrementVp` vs `vpPerIncrement` rule,
   draw brackets and persistence.
5. [05-army-data-format.md](./05-army-data-format.md) — the generated unit content, the producer
   import pipeline, the rules catalogs, artwork matching, lazy loading, and army-code
   serialization.
6. [06-online-architecture.md](./06-online-architecture.md) — the server-authoritative online
   mode: state model and transitions, the API surface, SSE, SQLite persistence, the mutation
   queue, auth and visibility filtering, hardening, and game lifecycle/cleanup.

## Two facts that cause the most damage when forgotten

**Content JSON is loaded behind a type assertion.** `npm run check` cannot see a bad value in a
mission, scheme or unit file. The only gates are the content specs (`lib/data/missions.spec.ts`)
and the importer's explicit `throw`s — so a new content invariant needs a guard, not a type.

**A `backdrop-filter` makes an element the containing block for its `position: fixed`
descendants.** An overlay nested inside a `Panel` covers only that panel, and every later panel
paints over it. Overlays render as siblings of `Panel`, with the parent holding the open state.
This has already shipped as a regression once. See
[01-visual-theme.md](./01-visual-theme.md#overlays-stacking-and-the-backdrop-filter-trap).

## Open questions

- **No content guard for schemes or units.** Missions have six; the 20-cards-per-deck invariant,
  scheme id uniqueness and the `incrementVp`/`maxIncrements` relationship are untested.
  See [04-scheme-data-format.md](./04-scheme-data-format.md).
- **Season ordering** is glob/file order, not semantic — invisible with one bundled season, wrong
  the day a second ships.
- **No schema migration mechanism** for the online SQLite database; the schema is bootstrapped
  lazily and has never had to change in production yet.
- **Design tokens do not exist.** The palette is the Tailwind slate/sky scale and the button
  recipes are copy-pasted class strings, which is why disabled styling has drifted between
  screens.
