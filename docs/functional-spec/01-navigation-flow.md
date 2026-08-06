# Navigation Flow

## Screen 1 — Season Select

- First thing the player sees on entering the app. A short welcome, then a set of
  buttons, one per season (e.g. "Season 1", "Season 2").
- Clicking a season button:
  - The season buttons disappear.
  - The app moves to **Screen 2 — Mission Select**, scoped to that season's missions.
- Old seasons remain clickable even if outdated — the app doesn't hide or disable them.

## Screen 2 — Mission Select

- Shows all missions belonging to the selected season as a 3-column grid of clickable
  mission names, e.g.:

  ```
  Mission 1 | Mission 2 | Mission 3
  Mission 4 | Mission 5 | Mission 6
  ```

- Top right of this screen: two controls side by side.
  - **Return** — goes back to Screen 1 (Season Select).
  - **Random** — picks one of the currently listed missions at random and opens it,
    i.e. has the same effect as the player clicking that mission's name directly
    (see Screen 3). _(assumption — see Open questions)_
- Clicking a mission's name: the mission grid disappears, the app moves to
  **Screen 3 — Mission Detail** for that mission.

## Screen 3 — Mission Detail

- Shows the full detail view for one mission (six vertically-stacked panels — see
  [02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md),
  [03-results-panel.md](./03-results-panel.md), and
  [04-schemes-panel.md](./04-schemes-panel.md)).
- Top right: a **Return** control that goes back to Screen 2 (Mission Select for the
  season the mission belongs to) — not all the way back to Season Select.
- This is true whether the player arrived here via a direct mission click or via
  **Random**.

## Open questions

- **Random button**: does it navigate straight into Mission Detail for the chosen
  mission (assumed above), or does it just highlight/select a mission within the grid
  and require a second confirm click?
- **State on Return**: when returning from Mission Detail to Mission Select, or from
  Mission Select to Season Select, is any in-progress state on the screen you're
  leaving discarded, or should it be restored if you navigate back in later? (Relevant
  once Results checkboxes and Scheme selection exist — see those docs.)
- **Deep linking**: should a specific mission/season be reachable via URL (e.g. to
  resume where you left off after closing the browser), or is in-memory navigation
  during a single session enough?
