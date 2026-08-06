# Functional Spec — Oni Quest Advisor

Status: **draft, behavior only.** No visual or technical decisions have been made yet —
this describes _what_ the app does from the player's perspective, so we can align on
behavior before the next stage tackles _how_ it's built and _how_ it looks.

## Entity glossary

- **Season** — a top-level grouping of missions (e.g. "Season 1", "Season 2"). Old
  seasons stay selectable even if outdated/irrelevant to current play.
- **Mission** — belongs to exactly one season. Has a name, lore description, setup
  instructions, a map, a list of scoreable objectives ("Results"), and quest rules
  (prose). See [02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md)
  and [03-results-panel.md](./03-results-panel.md).
- **Faction** — a player-selectable side (e.g. "Helian League"). Has its own pool of
  Scheme cards, in addition to a pool of Schemes common to all factions.
- **Scheme** — a hidden/secret mission card, drawn from a faction's pool + the common
  pool. Has a title and rule text; the rule text implies how many times it can be
  scored (see [04-schemes-panel.md](./04-schemes-panel.md)).

## Screen flow

```
Season Select  →  Mission Select (per season)  →  Mission Detail (per mission)
     ↑                    ↑    ↓ "Return"              ↓ "Return"
     └──── "Return" ──────┘    └──────────────────────┘
```

Details of each screen and its controls: [01-navigation-flow.md](./01-navigation-flow.md).

## Documents in this spec

1. [01-navigation-flow.md](./01-navigation-flow.md) — Season Select, Mission Select,
   Return/Random controls.
2. [02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md) —
   Description, Setup, Map, Quest Rules panels (read-only content).
3. [03-results-panel.md](./03-results-panel.md) — objectives, VP values, achieved
   checkboxes.
4. [04-schemes-panel.md](./04-schemes-panel.md) — faction/intelligence/draw/select
   flow for hidden Scheme missions.

Each document ends with an **Open questions** section for anything ambiguous in the
original description — these should be resolved before or during the technical stage.
