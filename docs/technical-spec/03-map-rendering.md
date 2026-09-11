# Map Rendering

The Deployment Map is `components/MissionMap.svelte`, driven entirely by the mission's
`map` object (`MapSpec` in `lib/domain/map.ts`). All geometry is pure domain
(`rulerAnchor`, `drawHorizontalDeployment`, `drawCircularDeployment`) and unit-tested in
`map.spec.ts`; the component only turns it into SVG.

## Bounds and coordinate system

- Every map is a fixed **36 × 36 inch** square — `MAP_SIZE_INCHES = 36`, not configurable per
  mission.
- Origin is **top-left**: X increases rightward, Y increases downward. The exact centre is
  `x: 18, y: 18`.
- The SVG uses `viewBox="0 0 36 36"`, so **every number in the markup is inches** — stroke
  widths, font sizes and dash arrays included. The frame is
  `mx-auto w-full max-w-72 rounded-xs border border-slate-700/20 bg-slate-950/70` (the one
  hard-edged, near-black surface in the app, so the board reads as a playing surface rather
  than a frosted panel). Panel title: **Deployment Map**, optionally `collapsible`.

## Orientation grid

Internal guide lines every **6″** (`GRID_STEP_INCHES = 6`, i.e. at 6/12/18/24/30 on both
axes), stroke `rgba(148,163,184,0.18)`, width `0.08`, dash `0.6 0.6`. **No gameplay
meaning** — purely a visual aid for eyeballing positions. Deliberately faint enough to sit
behind zones and markers.

## Deployment zones

Two players only — **Blue** and **Red** — and every zone is **mirrored**: whatever Blue gets,
Red gets the symmetrical opposite. A mission authors exactly **one** zone with a single
`rangeInches`; the mirror is derived, never configured. A mission is never rendered with no
zone at all.

|        | Blue                    | Red                      |
| ------ | ----------------------- | ------------------------ |
| Fill   | `rgba(56,189,248,0.18)` | `rgba(248,113,113,0.18)` |
| Stroke | `rgba(56,189,248,0.6)`  | `rgba(248,113,113,0.6)`  |
| Label  | `rgb(56,189,248)`       | `rgb(248,113,113)`       |

Zone outlines are **dashed** (`stroke-dasharray="1.2 0.8"`, width `0.15`) so the boundary
reads as a measured limit rather than a wall.

### Horizontal — `drawHorizontalDeployment(rangeInches)`

Players face top-to-bottom / bottom-to-top. Both zones span the **full width**:

- Red: `y = 0`, height `rangeInches` (down from the top edge).
- Blue: `y = 36 − rangeInches`, height `rangeInches` (up from the bottom edge).

### Radial — `drawCircularDeployment(rangeInches)`

Quarter-circle wedges, radius `rangeInches`, drawn as
`M cx cy L arcStart A r r 0 0 1 arcEnd Z`:

- Red: centred on the **top-left** corner `(0, 0)`.
- Blue: centred on the **bottom-right** corner `(36, 36)`.

### Zone labels

Each zone carries a centred, two-line label in its own saturated hue:

1. **`Deployment Zone`** — bold, letter-spacing `0.05`.
2. **`{rangeInches}"`** — at 0.7× the title size.

Horizontal zones use title size `1.9` (range line `1.33`), placed at `x = 18`, `y =` the zone's
vertical centre. Radial zones use the smaller title size `1.35` so the label fits inside the
corner arc, placed at `(r × 0.44, r × 0.38)` for Red and
`(36 − r × 0.44, 36 − r × 0.38)` for Blue.

This replaced the old pale corner text: the label now states _what_ the shaded area is, not
just its number, and uses the zone's own hue so Red and Blue are separable at a glance.

## Quarters cross

`map.quarters: true` draws a **solid** centre cross — one vertical and one horizontal line at
`18` — stroke `rgba(148,163,184,0.8)`, width `0.2`. Used when the four quadrants are
gameplay-relevant (e.g. Quarter War). Solid, not dashed, so it is visibly a different kind of
line from the orientation grid and the zone outlines.

## Objective markers

```jsonc
{
	"id": "clue-1",
	"x": 6,
	"y": 18,
	"shape": "triangle",
	"label": "Clue",
	"color": "#d946ef",
	"showRuler": true,
	"labelPosition": "below"
}
```

`color` is used **verbatim** as both fill and stroke, so a mission author can group related
objectives visually (any CSS colour string). Shapes (`MarkerShape`) and their sizes in inches:

| Shape      | Geometry                                                           |
| ---------- | ------------------------------------------------------------------ |
| `circle`   | radius `1.2`                                                       |
| `box`      | `2.4 × 2.4`, centred on the coordinate                             |
| `triangle` | circumradius `1.4`, apex up, base at `y + r`                       |
| `star`     | 10-point polygon, outer `1.4`, inner `× 0.45`, first point at −90° |
| `x`        | two diagonals spanning `±1.2`, stroke-width `0.4`                  |

**Marker label**: `marker.label`, font-size `1.3`, fill `rgb(226,232,240)`, horizontally
centred on `x`. Vertically at `y − 1.8` when `labelPosition: 'above'`, otherwise `y + 2.3`
(below is the default). `labelPosition` exists purely to avoid collisions with a nearby
marker's label.

**Overlap is the author's responsibility** — the renderer does not detect or auto-adjust
overlapping _markers_. Only ruler labels auto-stagger (below).

## Rulers (`showRuler`)

Measured from the **nearest edge**, not always from top-left. `rulerAnchor()` picks, per axis
independently, whichever edge is closer — `x ≤ 18` → left, otherwise right; `y ≤ 18` → top,
otherwise bottom — and reports the short distance. Ties go left/top. So a marker 5″ from the
right edge is labelled `5"`, never `31"`.

> This is the single most important rule here and the one most likely to be regressed: the
> anchor is always the **shortest path a player would actually measure**, which is by
> construction ≤ 18″ and one of the four corner combinations. Never revert to measuring
> everything from the top-left.

For a ruler marker the component draws two dashed guide segments (`rgba(148,163,184,0.7)`,
width `0.1`, dash `0.4 0.4`), each stopping **at the marker** — not a full crosshair:

- a horizontal segment from the chosen left/right edge to the marker, at `marker.y`;
- a vertical segment from the chosen top/bottom edge to the marker, at `marker.x`.

Distance labels are font-size `1.2`, fill `rgb(203,213,225)`, text `{xDistance}"` and
`{yDistance}"`.

### Label staggering

Two ruler markers sharing a coordinate would print their labels on top of each other (Clue
Trail has four markers all at `y = 18`). `rulerLabelOffset(marker, axis)` returns that
marker's index among the ruler markers sharing the same coordinate **on that axis**, and the
label is pushed inward by that index:

- **X-axis label**: offset `0.4 + index × 2.4` inward from the anchor edge (text anchored
  `start` or `end` to match the edge), at `y = marker.y − 0.5`.
- **Y-axis label**: `x = marker.x + 0.4`; `y = 1.4 + index × 1.6` when anchored top, or
  `36 − 0.7 − index × 1.6` when anchored bottom.

The offsets are per-axis, so markers that share only `x` or only `y` stagger on just that one.

## Adding or editing a map

1. Pick the zone type and its `rangeInches`; the mirror is automatic.
2. Place markers with explicit `x`/`y` in inches from the top-left.
3. Set `showRuler: true` only where a player would actually measure — a symmetrical layout
   usually needs it on one marker per group, not all of them.
4. Use `labelPosition: 'above'` to resolve a label collision; choose coordinates to avoid
   marker overlap.
5. Set `quarters: true` only when the four quadrants matter to the mission's rules.
6. Look at it on a phone: the frame renders at ≤ 288 px wide (`max-w-72`), so 1.2–1.3 unit
   font sizes are already near the legibility floor.

## Open questions

- **Visual sign-off is still pending** on the radial `Deployment Zone` label fit (Quarter War,
  Toxic Infestation) — the smaller `1.35` title size was chosen to fit inside the corner arc,
  but a large radius may still crowd it.
- Ruler stagger offsets are hand-tuned magic numbers (`2.4`, `1.6`). They work for the current
  content; a mission with many co-linear ruler markers may need wider steps.
- Marker overlap is unhandled by design. Would a lightweight collision warning in a content
  guard be worth it, given missions are authored by hand and reviewed?
- The orientation grid is hardcoded at 6″. If a mission ever needs a different subdivision
  (or none), `GRID_STEP_INCHES` would have to become map data.
