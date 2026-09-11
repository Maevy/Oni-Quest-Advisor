# Command Panel

A fixed drawer pinned to the **right edge** of the mission screen, holding the controls that
apply to the game as a whole rather than to one panel: the running VP total, the round tracker,
and reset. In hot-seat it additionally carries the player swap.

It exists because those three things are needed _while looking at other panels_ — a player
scoring an objective wants to see the total move, and a table finishing a round wants to advance
it without scrolling back to the top.

Two variants: `CommandPanel` (solo) and `CommandPanelTwoPlayer` (hot-seat). **Online mode has no
Command Panel** — its round/phase advancement is leader-driven and lives in the game view's
footer, and its VP totals are in the header.

## Collapsed tab

A small tab flush to the right edge, vertically centred (`fixed top-1/2 right-0 -translate-y-1/2`,
`z-40`), showing a chevron (`‹` when closed, `›` when open) and the label **Command Panel** set
vertically (`writing-mode: vertical-rl`, rotated 180°). It carries `aria-expanded` and an
`Open/Close command panel` accessible name.

The hot-seat tab also shows **Active** plus `P1`/`P2` in the active player's colour, so "whose
turn is it" is readable without opening the drawer.

Tapping the tab toggles the drawer (fly transition, `x: 112` solo / `x: 140` hot-seat, 200 ms).
**There is no click-outside-to-close** — the tab is the only control, which keeps the drawer from
being dismissed by a stray tap while scoring.

> **Layout consequence:** because the tab is `position: fixed`, the mission screens reserve
> matching right padding in their root (`pr-10`) so content never sits under the collapsed tab.
> The _expanded_ drawer intentionally overlays content.

## Total VP

Label **TOTAL VP**, then the value as `{total} / 10` — the number large and sky, the `/ 10` cap
small beside it. The cap is `MAX_TOTAL_VP`, imported from the domain rather than hardcoded.

The total is Results VP + Scheme VP, capped at 10 but **not floored at 0** — ceasefire penalties
can push a party negative, and the panel shows that honestly (e.g. `−11 / 10`). See
[03-results-panel.md](./03-results-panel.md).

Hot-seat shows **two** blocks side by side: **P1 VP** (sky) and **P2 VP** (orange), each computed
independently from that player's own objectives and scheme.

## Round tracker

Label **Round**, coloured with the current round's accent (`roundAccent`), then a vertical
stepper:

- **`+` on top** — `aria-label="Next round"`, disabled at round 5.
- the round number in an `h-10 w-10` box bordered and tinted in that round's accent colour
  (emerald → lime → amber → orange → red for rounds 1–5),
- **`−` below** — `aria-label="Previous round"`, disabled at round 1.

The `+`-above/`−`-below arrangement mirrors a vertical count-up. The minus glyph is a true minus
sign (U+2212), not a hyphen.

Rounds are clamped to `MIN_ROUND..MAX_ROUND` (1–5) in the domain, persisted with the rest of
progress, and **tracked manually by the players** — the app has no notion of when a round
actually ends locally. In online mode the server's phase engine owns the round instead, so this
stepper does not exist there.

The same accent ramp is used by the Results panels' per-round rows and the `R{n}` chips, so a
round reads the same colour everywhere in the app.

## Reset

A single **Reset** button below a divider. It rebuilds the mission's progress from empty, which
clears:

- every checked objective count,
- the chosen Scheme and its box progress,
- the scheme **draft** (faction + intelligence),
- the round (back to 1).

In hot-seat it resets **both** players and returns the active player to P1.

This is a "start a fresh play of this mission", not a "clear the board" — it is deliberately
heavier than it looks, and currently has **no confirmation dialog**. See Open questions.

## Swap Player (hot-seat only)

A violet **Swap Player** button, placed between the round block and Reset. Pressing it does not
swap immediately — the parent screen raises a full-screen **CountdownOverlay** (`z-50`):

- text **"Player swapping in"** above a giant countdown number,
- `DURATION = 6` seconds, ticking every 1000 ms,
- a **Skip** button.

Both letting the countdown finish and pressing Skip call the same swap. The delay exists so the
outgoing player can hand the phone over and look away **before** their hidden Scheme is on
screen — it is the only privacy mechanism hot-seat mode has.

The swap flips `activePlayer` between `player1` and `player2`. `activePlayer` is **in-memory
only** — it is not persisted, and loading a mission always starts on P1.

See [06-two-player-hot-seat.md](./06-two-player-hot-seat.md).

## What is _not_ here

The Command Panel holds no Scheme interaction and no rules popups. Scheme draw/choose/reveal lives
in the Schemes panel; the Broken Morale / Ceasefire rule callouts are triggered from the
Description panel's rule labels. Keeping the drawer to game-level controls is what lets it stay
small enough to overlay a phone screen.

## Open questions

- **Reset has no confirmation**, unlike every other destructive action in the app (close game,
  delete saved army, switch army format, mount a model that would invalidate an upgrade — all
  behind `ConfirmDialog`). It silently discards a whole mission's scoring. This looks like an
  oversight rather than a decision.
- **The drawer never closes on outside tap.** Good for avoiding accidental dismissal, but a
  player who wants the screen back has to hit the small tab. Is a tap-on-content close worth it?
- **`activePlayer` is not persisted**, so a reload mid-game silently returns control to P1 —
  possibly revealing P1's hidden scheme to whoever is holding the phone. Persisting it (or
  forcing a swap-countdown on load) would close that hole.
- Online mode's absence of a Command Panel means the three modes put the round/VP controls in
  three different places. Once the shared header component happens (see
  [../technical-spec/01-visual-theme.md](../technical-spec/01-visual-theme.md)), is a unified
  game-level control surface worth it?
