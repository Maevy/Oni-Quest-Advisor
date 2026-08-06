# Mission Detail — Panel 4: Results

Lists every scoreable objective for the mission. Each row/item has:

- The objective text (what to do to earn it).
- Its VP (victory point) value.
- A checkbox the player toggles once they've achieved it during play.

Example:

```
- Gain 1 VP for unlocking the Cache.                                    | 1 VP | ☑ Checked
- Gain 2 VP if your model has the Treasure in its Inventory at the end
  of the game.                                                          | 2 VP | ☐ Not Checked
```

- Checking/unchecking is purely the player tracking their own progress during a game —
  the app doesn't validate whether the objective was legally achieved.
- These are fixed, mission-defined objectives — distinct from the hidden per-faction
  Scheme objectives in Panel 5 (see [04-schemes-panel.md](./04-schemes-panel.md)).

## Open questions

- **Total score**: should the app sum up checked VP into a running total (Results VP +
  Scheme VP), or is that left to the player to add up themselves?
- **Persistence**: if the player leaves Mission Detail and comes back (or reloads the
  page mid-game), should checked objectives still be checked? Same question applies to
  the Scheme panel's checkboxes.
- **Reset**: is there a way to clear all checkboxes for a fresh play of the same
  mission, or does starting a new game just mean re-selecting the mission (which would
  imply state should reset per mission-selection)?
