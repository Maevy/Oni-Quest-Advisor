# Oni Quest Advisor

Companion web app for a tabletop game. Built to run as an installable app on any phone
(Android/iOS/other) via the browser — a web app, not a native/platform-specific one.

## Stack

- SvelteKit (Svelte 5, runes) + TypeScript (strict)
- Tailwind CSS 4 for styling
- No backend: runs entirely client-side. Game data (scenarios, mission cards) ships as
  static data bundled with the app; session state persists via `localStorage`.

## Core domain

- **Scenario**: a map + a pool of mission cards that belong to it. Players either roll a
  random scenario or pick one manually.
- **Mission card**: a specific objective/rule card belonging to a scenario. Once a
  scenario is active, any number of its mission cards can be selected.

## Architecture

Layered structure. Dependencies only point downward — never sideways, never up.

```
src/
  routes/          → presentation: pages, just wire data to components
  lib/
    components/    → presentation: reusable UI pieces
    stores/        → application/state layer
    domain/         → domain: types + pure logic functions
    data/            → infrastructure: fetch/localStorage wrappers
```

Rule of thumb: **routes → components/stores → domain/data**.
`domain` never imports from `stores`, `data`, or Svelte. `data` never contains business
logic. Each folder has its own `CLAUDE.md` with the specific rules for that layer —
read it before adding files there.

## Conventions

- TypeScript strict, no `any`. Domain types are the single source of truth — don't
  redefine `Scenario`/`MissionCard` shapes in other layers.
- Svelte 5 runes (`$state`, `$derived`, `$props`) — no legacy `writable`/`export let` style.
- Mobile-first, touch-friendly layouts — this is used on a phone during a game session.
- Prefer pure functions in `domain` over logic inline in components/stores/routes — it's
  the part that should be unit-testable without a browser.
