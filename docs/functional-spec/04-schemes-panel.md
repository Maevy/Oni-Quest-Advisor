# Mission Detail — Panel 5: Schemes

Lets the player draw and track their hidden Scheme mission(s) for the game. This is
the most stateful panel — it has its own mini flow within Mission Detail. A player
only ever holds exactly one active Scheme at a time per mission.

## Step 1 — Faction & Intelligence entry

Three controls in a row:

1. **Faction** — dropdown. Player picks their faction (e.g. "Helian League").
2. **Intelligence** — number input, right beside the faction dropdown. Player enters
   their leader's intelligence value.
3. **Draw Missions** — button, right beside the intelligence input.

Intelligence determines how many Scheme cards get drawn:

| Intelligence | Draws                                 |
| ------------ | ------------------------------------- |
| ≤ 13         | 1 (no real choice — it's taken as-is) |
| 14–15        | 2 (pick one)                          |
| ≥ 16         | 3 (pick one)                          |

## Step 2 — Draw

- Clicking **Draw Missions** draws the number of Scheme cards above from a pool
  combining Schemes specific to the selected faction and Schemes common to all
  factions (one combined pool, not a fixed split between the two).
- The deck backing this draw can contain multiple physical copies of the same Scheme.
  If a draw hits a Scheme already drawn this round, it's discarded and redrawn
  automatically, transparently to the player, until the target number of _distinct_
  Schemes is reached.
- The drawn Schemes appear as a list below, each showing a title and its rule text.

Example (intelligence 16+, 3 draws):

```
- Head Hunt
    Gain 1 VP (to a maximum of 3 VP) for each Deathblow you perform against enemy models.
- Open Aggression
    Reveal this Scheme during your Strategic Phase and discard it during the End Phase;
    receive 1 VP for each Wound dealt to enemy models this turn (to a maximum of 3 VP).
- Stalwart Defender
    Receive 3 VP if there are no enemy models in your Deployment Zone at the end of
    the game.
```

## Step 3 — Forced selection

- The player must pick exactly one of the drawn Schemes (clicking it, e.g. "Head
  Hunt"). At intelligence ≤ 13 there's only one drawn card, so this is a formality —
  it's still "picked," just with no real choice.
- On pick: the other drawn Schemes disappear — only the chosen one remains displayed.

## Step 4 — Tracking the chosen Scheme

- Beside the chosen Scheme, a row of checkboxes appears. The checkbox count is
  explicit per-Scheme data (not inferred from the rule text) — e.g. Head Hunt is
  authored with 3 checkboxes worth 1 VP each, while a flat-VP scheme like Stalwart
  Defender is authored with a single checkbox worth 3 VP.
- A red "X" delete control also appears beside the chosen Scheme. Clicking it clears
  the chosen Scheme and its checkbox progress, returning to Step 1 — but the faction
  and intelligence inputs stay prefilled with what was entered before, so the player
  only has to press "Draw Missions" again rather than re-enter everything.
