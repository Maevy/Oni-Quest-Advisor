# Mission Panels — Results

Lists every scoreable objective for the mission and lets the player track their own progress
against it. **The app never validates whether an objective was legally achieved** — it is a
tracker, not a referee.

## What is listed

`getScoreableResults(mission)` — the mission's own `results[]`, plus the automatic
**Ceasefire broken** objective when `mission.ceasefire` is true. The ceasefire penalty is
never authored in JSON.

Each row shows:

- the objective `text`,
- its `vp` value, right-aligned (sky, or red for the ceasefire penalty),
- an inline **round chip** (`R2`…`R5`) when the objective carries a `round`, coloured by that
  round's accent,
- the scoring control — see below.

### Checkboxes vs boxes

`count` is how many independent instances of the objective are scoreable (4 Quarters, 2 Ink
Snails, 1 end-of-game check):

- `count === 1` → a **single native checkbox** (solo and hot-seat panels).
- `count > 1` → a row of `count` **increment boxes**.

Box semantics (`IncrementBoxes`): a box is _achieved_ when its position ≤ the stored count.
Clicking box _n_ sets the count to _n_ — unless _n_ is already achieved, in which case it
**decrements by one**. So boxes behave like a rating you can walk back, not independent toggles.
Each box is announced as `"{n} of {count} achieved"`.

Two panels deliberately ignore the checkbox special-case and always render boxes, even at
`count: 1` — the read-only briefing panel and the online Results panel — so a row's visual
grammar does not change between modes.

### Penalty styling

`IncrementBoxes` takes a `tone`: `'score'` (sky) or `'penalty'` (red). The ceasefire row passes
`penalty`, so a −4 VP row never renders as a sky-blue achievement.

### Completion styling

The **solo and hot-seat** panels strike through an objective's text (`line-through`) once every
instance is checked — hot-seat shares the solo panel, bound to the active seat's counts. The
online panel does not — see Open questions.

## Round-scoped objectives

An objective that scores at the end of a round is authored as **one entry per round** sharing a
`group`, with round-neutral text (see
[../technical-spec/02-mission-data-format.md](../technical-spec/02-mission-data-format.md)).
How that renders **depends on the panel**:

- **Solo and hot-seat — briefing _and_ tracker** (`ResultsBriefingPanel`, `ResultsPanel`) — both
  collapse a group into one card: heading text + VP, then **a row for every round 1–5**. A round
  that scores shows `Round {n}` in that round's accent over a tinted background with that round's
  boxes; a round that cannot score renders as a muted row reading _**No VP**_, so a locked round
  is explicit rather than implied. Always five rows, so round colours line up across missions.
  The two panels are the same layout at two levels of interactivity: the briefing's boxes are
  disabled, the tracker's write to that round's own objective id — no extra progress state, since
  the id already encodes the round. In hot-seat the same panel is bound to whichever seat is
  active, so each player's per-round card tracks their own counts.
- **Online** — one card per objective entry, each carrying only its `R{n}` chip. A group of four
  therefore appears as four separate cards.

A grouped card also tracks completion as a whole: its heading is struck through once **every**
scoreable round in it is maxed out.

> Consequence worth knowing: **Awaiting Reinforcements shows 12 separate cards** in online play
> (3 groups × 4 rounds) until that panel adopts the grouped layout too. Both local modes now show
> 3 grouped cards in the briefing and the tracker.

## Ceasefire missions

`ceasefire: true` adds:

- the red **Ceasefire broken** row — `{ id: 'ceasefire-broken', vp: -4, count: 3 }`, i.e. three
  red penalty boxes, up to −12 VP. The penalty is incurred **per breach**: every Attack against
  or damage dealt to an enemy model in round 1 costs −4 VP again.
- the amber **Important** callout stating that round 1 cannot score,
- and a content guard forbidding the mission from shipping any Round-1 objective.

## Important callouts

`mission.important[]` renders as an amber box (uppercase **Important** header, bulleted list)
below the objectives — rules notes shown alongside Results. **Display only, never counted for
VP.** Already wired into every Results view, so adding a note to a mission needs no code change.

## Total score

Total VP = checked Results VP + checked Scheme increments, **capped at `MAX_TOTAL_VP` = 10**
(a player cannot earn more per mission) and **not floored at 0** — the rules allow a party to
drop below zero, so three ceasefire breaches can legitimately show as `−11 / 10`.

It is displayed as `{total} / 10` — in the solo tracker's untitled score panel, in hot-seat's
score panel (one block per seat), and in the online game header. See
[05-score-and-round-controls.md](./05-score-and-round-controls.md).

Because a stored count can predate a content change that lowered an objective's `count`, the VP
math clamps each stored count to `objective.count` before multiplying. Old saves (and in-flight
online games) therefore can never pay out an instance the UI no longer shows.

## Per-mode behaviour

| Panel                                  | Who can edit                                  | Notes                                                                                                                    |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ResultsPanel` (solo tracker)          | the player                                    | grouped per-round cards, editable; strikes through a completed objective or group                                        |
| `ResultsPanel` (hot-seat tracker)      | **the active seat only**                      | the same panel bound to the active player's counts; swapping hands the sheet over, so each seat ticks its own objectives |
| `OnlineResultsPanel`                   | own column, **only during the Scoring phase** | two columns: `{you} (you)` editable, opponent's always read-only; frozen during the Reveal phase                         |
| `ResultsBriefingPanel` (solo briefing) | nobody                                        | read-only, grouped per-round cards, boxes shown inert                                                                    |
| `OnlineMissionView` (lobby preview)    | nobody                                        | rows with **no boxes at all**, plus the note "Objectives unlock once the game has started."                              |

Hot-seat used to show both seats' cells on one shared sheet; it now follows solo's rule that a
scoring sheet belongs to whoever holds the device, and the swap is what transfers it. Objectives
remain public information in the sense that the incoming player sees the outgoing one's ticks the
moment they take over — but nobody edits a sheet that is not theirs.

## Persistence and reset

- Stored per mission as `checkedObjectiveCounts: Record<objectiveId, number>` (0…`count`) in
  `localStorage` — `oni-quest-advisor:mission-progress:{missionId}` solo,
  `oni-quest-advisor:2p-progress:{missionId}` hot-seat. In online mode the counts live in the
  server's game state instead.
- Written on every toggle; restored when the mission is re-entered, including across a reload.
  Loaded state is merged onto `createEmptyProgress()` so fields added later get defaults.
- Because progress is keyed by **objective id**, renaming an id orphans the stored count, and a
  duplicate id inside one mission would make two rows share a single count (guarded by
  `lib/data/missions.spec.ts`).
- **Reset** (solo only, in the untitled score panel) rebuilds progress from empty: it clears the
  checked objectives **and** the chosen Scheme **and** the scheme draft **and** the round. It is a
  "fresh play of this mission", not a "clear the board" — and it leaves the run open. Hot-seat has
  no Reset; a fresh play there is Return → Abandon → pick the mission again.
- **Both local modes:** abandoning the run — the tracker's ← Return, or the resume prompt on app
  start — deletes the whole progress record together with the open-game marker. Reset restarts
  the mission; abandoning ends it. See
  [01-navigation-flow.md](./01-navigation-flow.md).

## Open questions

- **Completion strike-through is missing online.** `ResultsPanel` (both local trackers) strikes a
  completed objective; `OnlineResultsPanel` never does. Either both should, or neither — the
  inconsistency is invisible only because the panels are never on screen together.
- **Bring the grouped layout to online.** Both local modes now have it in the briefing and the
  tracker — writable per-round boxes needing no progress-shape change, since the objective id
  already encodes the round — so the conversion is proven and mostly mechanical. Until online
  follows, Awaiting Reinforcements is 3 grouped cards locally but 12 separate cards there.
- **`count: 1` renders two different ways** across panels (checkbox vs one box). Harmless, but
  it means a control's appearance does not imply its behaviour. Unify on boxes?
- **No per-objective note field.** Players sometimes want to jot _why_ a box is ticked (which
  Quarter, which model). Out of scope today.
- Should Reset ask for confirmation? It silently discards a whole mission's scoring, and unlike
  the army builder's destructive actions it has no ConfirmDialog.
