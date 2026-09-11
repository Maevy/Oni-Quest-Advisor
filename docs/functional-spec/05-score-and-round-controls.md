# Score, Round and Game Controls

Where the running VP total, the round tracker and reset live. These are the controls that apply
to the **game as a whole** rather than to one panel, and each mode places them differently
because each mode has different constraints.

| Mode     | Control                 | Placement                                                 |
| -------- | ----------------------- | --------------------------------------------------------- |
| Solo     | `ScoreSummaryPanel`     | inline — the **first panel of the Scoring view**          |
| Hot-seat | `CommandPanelTwoPlayer` | a **drawer pinned to the right edge**                     |
| Online   | none                    | VP in the game header, rounds leader-driven in the footer |

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
- **Reset** rebuilds the mission's progress from empty, clearing every checked objective count,
  the chosen Scheme and its box progress, the scheme **draft** (faction + intelligence), and the
  round (back to 1). In hot-seat it resets **both** players and returns the active player to P1.
  It is a "start a fresh play of this mission", not a "clear the board" — and it is deliberately
  heavier than it looks. See Open questions.

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

Solo used to have the same right-edge drawer as hot-seat. It was folded into this inline panel
when the tracker became a three-view screen: a drawer overlapping a tabbed layout is crowded on a
phone, and the score belongs at the top of the view the player actually scores in. The drawer's
`pr-10` layout reservation went with it.

Note the minus glyph is a true minus sign (U+2212), not a hyphen.

## Hot-seat: the Command Panel drawer

`CommandPanelTwoPlayer` stays a drawer pinned to the right edge (`fixed top-1/2 right-0 z-40`),
because in hot-seat both players need the round and both totals visible _while_ looking at
whichever panel they are scoring in — and the screen is already full of per-player content.

**Collapsed tab** — vertically centred, showing a chevron (`‹` closed, `›` open), the label
**Command Panel** set vertically (`writing-mode: vertical-rl`, rotated 180°), and **Active** plus
`P1`/`P2` in the active player's colour. That last part matters: "whose turn is it" is readable
without opening the drawer. The tab carries `aria-expanded` and an `Open/Close command panel`
accessible name.

**Expanded drawer** (fly transition, `x: 140`, 200 ms):

- two VP blocks side by side — **P1 VP** (sky) and **P2 VP** (orange), each `{total} / 10`,
  computed independently from that player's own objectives and scheme;
- the round stepper, arranged **vertically** with `+` above the badge and `−` below (a count-up),
  labelled `Next round` / `Previous round`;
- a violet **Swap Player** button;
- **Reset**.

Tapping the tab toggles the drawer. **There is no click-outside-to-close** — the tab is the only
control, which keeps the drawer from being dismissed by a stray tap while scoring.

> **Layout consequence:** because the tab is `position: fixed`, `MissionDetailTwoPlayer` reserves
> matching right padding (`pr-10`) so content never sits under the collapsed tab. The _expanded_
> drawer intentionally overlays content.

### Swap Player

Pressing it does not swap immediately — the screen raises a full-screen **CountdownOverlay**
(`z-50`): _"Player swapping in"_ above a giant countdown number, `DURATION = 6` seconds ticking
every 1000 ms, with a **Skip** button. Finishing the countdown and pressing Skip both perform the
swap.

That delay is hot-seat's entire privacy mechanism: the outgoing player looks away before their
hidden Scheme is on screen. The swap flips `activePlayer` and touches no progress. See
[06-two-player-hot-seat.md](./06-two-player-hot-seat.md).

## Online: no such control

Online has no score panel and no drawer. The running total is in the game header
(`Your VP: {n} / 10`), rounds and phases are **leader-driven** buttons in the footer, and there is
no reset at all — a started online game cannot be rewound, only finished or closed. See
[07-online-two-player.md](./07-online-two-player.md).

## What is _not_ here

No Scheme interaction and no rules popups. Scheme draw/choose/reveal lives in the Schemes panel;
the Broken Morale / Ceasefire rule callouts are triggered from the Description panel's rule
labels. Keeping these controls to game-level state is what lets the solo panel sit inline and the
hot-seat drawer stay small enough to overlay a phone screen.

## Open questions

- **Reset has no confirmation**, unlike every other destructive action in the app — abandoning a
  game, closing an online game, deleting a saved army, switching army format and mounting over an
  upgrade are all behind a `ConfirmDialog`. Reset silently discards a whole mission's scoring.
  This now matters more: abandoning is guarded, so Reset is the one unguarded way to lose a run.
- **Should hot-seat adopt the three-view layout too?** Solo now splits Scoring / Army / Mission
  behind a sticky tab bar; hot-seat is still one long scrolling screen with a drawer. The Army
  view in particular would benefit both. Doing so would let the drawer retire entirely.
- **`activePlayer` is not persisted**, so a reload mid-hot-seat game silently returns control to
  P1 — possibly revealing P1's hidden scheme. Solo's equivalent problem was solved by the
  open-game resume prompt; hot-seat has no such mechanism.
- Online's absence of any shared control surface means the three modes put the round and VP in
  three different places. Once the shared header component happens (see
  [../technical-spec/01-visual-theme.md](../technical-spec/01-visual-theme.md)), is a unified
  game-level control surface worth it?
