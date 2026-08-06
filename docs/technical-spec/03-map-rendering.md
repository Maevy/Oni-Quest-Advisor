# Map Rendering

The map is the hardest part of Panel 3 (see
[functional-spec/02-mission-detail-static-panels.md](../functional-spec/02-mission-detail-static-panels.md))
and now the map's _content_ has moved from "static image" to "structured data" (per
the earlier decision in the functional-spec Q&A) — this is that data model and its
rendering behavior.

## Map bounds

- Every map is a **36 × 36 inch** square box. This is the fixed playing-field size for
  every mission — not configurable per mission, always 36×36.
- Two players only: **Player Blue** and **Player Red**. Any zone that belongs to a
  player is always mirrored — whatever Blue gets, Red gets the symmetrical opposite.

## Deployment zones

Two zone shapes, each described by a single **range** value (a depth or radius in
inches) — the mirroring for the other player is automatic, not something the mission
author configures separately.

Every mission defines exactly one zone (horizontal or radial) — a mission is never
rendered with no deployment zone at all.

### Horizontal deployment — `drawHorizontalDeployment(range)`

- Players face top-to-bottom / bottom-to-top.
- Blue's zone: a box spanning the _full width_ of the map, `range` inches deep,
  starting from the bottom edge going up. Rendered in a blue tint.
- Red's zone: the mirrored box, `range` inches deep, starting from the top edge going
  down. Rendered in a red tint.
- The zone's depth (`range`, in inches) is shown as a visible label on the side of the
  zone, so the player can see e.g. "8 inches deep."

### Radial (circular) deployment — `drawCircularDeployment(range)`

- Blue's zone: a circular area with radius `range`, centered on the **bottom-right**
  corner of the map (so within the map bounds it renders as a quarter-circle wedge).
  Rendered in a blue tint.
- Red's zone: the mirrored quarter-circle, radius `range`, centered on the **top-left**
  corner. Rendered in a red tint.
- Same idea as horizontal: the `range` should be visibly labeled so the player can
  read off the radius.

Only one of these two zone shapes is used per mission (a mission picks either
horizontal or radial deployment, passing just its `range`).

## Objective markers

- Coordinate origin is fixed as **top-left** for every map: X increases to the right,
  Y increases downward. E.g. the exact center of the 36×36 map is `X: 18, Y: 18`.
- Each marker has a **shape**: one of `star`, `box`, `triangle`, `circle`, `x`.
- Each marker has a **label** (e.g. `"Cache"`) — an explicit text field linking it to
  the corresponding Results-panel objective, rather than relying on the player to
  infer which marker is which from context.
- Each marker has a **colour**, configurable per marker in its JSON (not fixed/shared
  across all markers) — lets a mission author group related objectives visually.
- Each marker has a **ruler flag**. When `true`, a short dimension-line style guide is
  drawn: one segment from the left edge to the marker (labeled with the Y distance)
  and one from the top edge to the marker (labeled with the X distance), stopping at
  the marker — not a full crosshair across the whole map. When `false`, no guide lines
  are drawn for that marker — since every map is symmetrical, players are expected to
  eyeball the position without needing exact numbers every time.
- Marker overlap (two markers placed close together or on top of each other) is the
  mission author's responsibility to avoid via careful coordinate choice — the
  renderer does not detect or auto-adjust for it.

## Open questions

None remaining for this document.
