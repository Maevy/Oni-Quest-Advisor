# Score, Round and Game Controls

Where the running VP total, the round tracker and reset live. These are the controls that apply
to the **game as a whole** rather than to one panel, and each mode places them differently
because each mode has different constraints.

| Mode     | Control                      | Placement                                                             |
| -------- | ---------------------------- | --------------------------------------------------------------------- |
| Solo     | `ScoreSummaryPanel`          | inline — the **first panel of the Scoring view**                      |
| Hot-seat | `ScoreSummaryPanelTwoPlayer` | inline — the Scoring view, **directly under the Active Player panel** |
| Online   | none                         | VP in the game header, rounds leader-driven in the footer             |

## Shared semantics

Identical in every mode, and owned by the domain:

- **Total VP** = checked Results VP + checked Scheme increments, **capped at `MAX_TOTAL_VP` = 10**
  and **not floored at 0** — ceasefire penalties can push a party negative, and the control shows
  that honestly (e.g. `−11 / 10`). Shown as `{total} / 10`. See
  [03-results-panel.md](./03-results-panel.md).
- **Round** is clamped to `MIN_ROUND..MAX_ROUND` (1–5), persisted with the rest of progress, and
  **tracked manually by the players** — locally the app has no notion of when a round actually
  ends. Online is the exception: the server's phase engine owns the round, so no stepper exists
  there.
- The round's **accent colour** (emerald → lime → amber → orange → red) comes from `roundAccent`,
  shared with the Results panels' per-round rows and the `R{n}` chips, so a round reads the same
  colour everywhere.
- **Reset** (solo only) rebuilds the mission's progress from empty, clearing every checked
  objective count, the chosen Scheme and its box progress, the scheme **draft** (faction +
  intelligence), and the round (back to 1). It is a "start a fresh play of this mission", not a
  "clear the board" — and it is deliberately heavier than it looks. Hot-seat dropped its Reset
  when it adopted the four-view tracker: with an abandon-and-resume lifecycle, a fresh play is
  Return → Abandon → pick the mission again, and a button that wipes **both** seats at once had
  no place next to the swap. See Open questions.

## Solo: the Score Summary panel

`ScoreSummaryPanel` is the first panel of the tracker's **Scoring** view (see
[01-navigation-flow.md](./01-navigation-flow.md) for the three-view layout). It is deliberately
**untitled** — the centred hero number is self-evident, and a heading above it read as noise.

- **Total VP** — centred: a small uppercase `Total VP` label over the value as `{total} / 10`, the
  number as a large sky hero figure (`text-5xl`, readable at a glance on a phone), the cap small
  beside it.
- **Round** — a horizontal stepper below a divider: `[−]` (disabled at round 1), the round number
  in a badge bordered and tinted with that round's accent, `[+]` (disabled at round 5). The
  `Round` label itself carries the accent colour.
- **Reset** — pushed to the right of the same row.

Solo used to have a right-edge drawer too. It was folded into this inline panel when the tracker
became a three-view screen: a drawer overlapping a tabbed layout is crowded on a phone, and the
score belongs at the top of the view the player actually scores in. The drawer's
`pr-10` layout reservation went with it.

Note the minus glyph is a true minus sign (U+2212), not a hyphen.

## Hot-seat: the score panel and the Active Player panel

Hot-seat retired its right-edge drawer when the tracker became a four-view screen — the same
reason solo retired its: a drawer overlapping a tabbed layout is crowded on a phone, and the
score belongs at the top of the view the player actually scores in. The `pr-10` layout
reservation went with it.

The Scoring view opens with an **Active Player** panel: _"Player 1 is the active Player"_ (or
Player 2) in the seat's colour, and under it the name of that seat's attached army — or _"No army
picked"_ — so the sheet's owner is unambiguous before anything else is read.

Below it, `ScoreSummaryPanelTwoPlayer`:

- **two VP blocks side by side** — **Player 1 Total VP** (sky) and **Player 2 Total VP** (orange),
  each `{total} / 10`, computed independently from that seat's own objectives and scheme; the
  active seat's block carries its border, the other sits on a neutral one;
- the **round stepper**, laid out horizontally like solo's (`[−]`, badge, `[+]`, the `Round` label
  in the round's accent) — but **Player 1 is the only seat that may move it**: while Player 2 is
  active both buttons are disabled and a line under the row says _"Only Player 1 advances the
  round."_ One round for the table, not one per seat;
- the **Swap Player** button on the row's right, carrying the app's neon beam in **violet**
  (`neon-border neon-violet`) — violet is the swap mechanic's hue and belongs to neither seat.

### Swap Player

Pressing it does not swap immediately — the screen raises a full-screen **CountdownOverlay**
(`z-50`): _"Player swapping in"_ above a giant countdown number, `DURATION = 6` seconds ticking
every 1000 ms, with a **Skip** button. Finishing the countdown and pressing Skip both perform the
swap.

That delay is hot-seat's entire privacy mechanism: the outgoing player looks away before their
hidden Scheme is on screen. The swap flips `activePlayer` and touches no progress; the Scoring
sheet rebinds to the new seat's objectives and the two army panes trade editable for frozen. See
[06-two-player-hot-seat.md](./06-two-player-hot-seat.md).

## Online: no such control

Online has no score panel and no drawer. The running total is in the game header
(`Your VP: {n} / 10`), rounds and phases are **leader-driven** buttons in the footer, and there is
no reset at all — a started online game cannot be rewound, only finished or closed. See
[07-online-two-player.md](./07-online-two-player.md).

## What is _not_ here

No Scheme interaction and no rules popups. Scheme draw/choose/reveal lives in the Schemes panel;
the Broken Morale / Ceasefire rule callouts are triggered from the Description panel's rule
labels. Keeping these controls to game-level state is what lets both local panels sit inline at
the top of the Scoring view instead of floating over a phone screen.

## Open questions

- **Reset has no confirmation**, unlike every other destructive action in the app — abandoning a
  game, closing an online game, deleting a saved army, switching army format and mounting over an
  upgrade are all behind a `ConfirmDialog`. Reset silently discards a whole mission's scoring.
  This now matters more: abandoning is guarded, so Reset is the one unguarded way to lose a run.
- **Hot-seat has no fresh-play shortcut at all now.** Its Reset went with the drawer, so starting
  the same mission over means abandoning the run and re-picking it. Is that friction acceptable,
  or does hot-seat want a guarded "start over" somewhere?
- **`activePlayer` is not persisted**, so a reload mid-hot-seat game silently returns control to
  P1 — possibly revealing P1's hidden scheme. The run now resumes through the open-game prompt,
  but the prompt restores the seats' state, not whose turn it was.
- Online's absence of any shared control surface means the three modes put the round and VP in
  three different places. Once the shared header component happens (see
  [../technical-spec/01-visual-theme.md](../technical-spec/01-visual-theme.md)), is a unified
  game-level control surface worth it?
