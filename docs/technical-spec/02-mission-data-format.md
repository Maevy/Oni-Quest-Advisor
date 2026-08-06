# Mission Data Format

- All domain content — seasons, missions, factions, and Schemes — is authored as
  **JSON**, not hardcoded in the app. Everything under the domain topic should be
  configurable this way: mission text, setup bullets, results objectives + VP values,
  quest rules prose, faction Scheme pools, and (see
  [03-map-rendering.md](./03-map-rendering.md)) the map's deployment zones and
  objective markers.
- This lines up with the architecture already agreed in the root `CLAUDE.md`: JSON
  files are static data loaded through `lib/data`, shaped into typed domain objects
  matching the types defined in `lib/domain`. Editing a mission means editing its
  JSON, not touching app code.
- Practically: one JSON file per mission (description, setup, map, results, quest
  rules), one per faction (name, Scheme pool), and one per common-Scheme pool.
- **No separate season file.** Each mission's JSON carries its own `season` field
  (e.g. `"season": "Season 2"`). The app derives the season list for Screen 1 (Season
  Select) by loading all missions and collecting the distinct `season` values found —
  one button per distinct season. Adding a mission to a new season is just adding a
  mission file with that season value; no separate season registry to keep in sync.
- Editing content (missions, factions, Schemes) is always done by directly editing
  these JSON files — no in-app editor/admin UI is planned.
