# Mission Detail — Static Panels

These are the read-only, no-interaction panels of Mission Detail (Screen 3). They are
shown top-to-bottom as panels 1, 2, 3, and 6 of the six-panel stack; panels 4 and 5 are
interactive and documented separately
([03-results-panel.md](./03-results-panel.md),
[04-schemes-panel.md](./04-schemes-panel.md)).

## Panel 1 — Description

- Plain text. Lore/flavor text about the mission, no game-rule content.

## Panel 2 — Setup

- A bullet list of setup instructions, e.g.:

  ```
  - Obelisk: There is 1 Objective Marker at the center of the field.
  - Standard Deployment: 8" Deployment Zones.
  ```

- Each bullet is a short label + a description of that setup element.

## Panel 3 — Map

- A visual representation of the mission's map: a box containing coloured zones and
  lines with numbers (deployment zones, objective markers, etc.).
- Read-only, no interaction described (no click targets, no annotations by the player).

## Panel 6 — Quest Rules

- Prose text describing the mission's specific rules (distinct from Panel 1's lore —
  this is rules content, not flavor).

## Open questions

- **Map panel content model**: is the map a static image per mission, or does it need
  to be data-driven (zones/lines/numbers as structured data so it could, e.g., be
  themed or scaled)? Affects how map data is authored, not covered here since this is
  a behavior spec.
- **Setup panel structure**: is each bullet just a text string, or does it have a
  distinct label + description (as the example suggests: "Obelisk:" as label,
  remainder as description)?
