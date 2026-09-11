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

The **solo** panel strikes through an objective's text (`line-through`) once every instance is
checked. The hot-seat and online panels do not — see Open questions.

## Round-scoped objectives

An objective that scores at the end of a round is authored as **one entry per round** sharing a
`group`, with round-neutral text (see
[../technical-spec/02-mission-data-format.md](../technical-spec/02-mission-data-format.md)).
How that renders **depends on the panel**:

- **Mission Briefing** (`ResultsBriefingPanel`) — the only panel that collapses a group. One
  card per group: heading text + VP, then **a row for every round 1–5**. A round that scores
  shows `Round {n}` in that round's accent over a tinted background, with that round's boxes
  (disabled — the briefing is read-only). A round that cannot score renders as a muted row
  reading _**No VP**_, so a locked round is explicit rather than implied. Always five rows, so
  round colours line up across missions.
- **Every other panel** — one card per objective entry, each carrying only its `R{n}` chip. A
  group of four therefore appears as four separate cards.

> Consequence worth knowing: **Awaiting Reinforcements shows 12 separate cards** in hot-seat and
> online play (3 groups × 4 rounds) until those panels adopt the grouped layout. Solo shows the
> same 12 in the tracker, but 3 grouped cards in the briefing.

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

It is displayed in the Command Panel as `{total} / 10`, and per player in hot-seat and online.
See [05-command-panel.md](./05-command-panel.md).

Because a stored count can predate a content change that lowered an objective's `count`, the VP
math clamps each stored count to `objective.count` before multiplying. Old saves (and in-flight
online games) therefore can never pay out an instance the UI no longer shows.

## Per-mode behaviour

| Panel                                  | Who can edit                                  | Notes                                                                                                                      |
| -------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ResultsPanel` (solo)                  | the player                                    | strikes through completed objectives                                                                                       |
| `ResultsPanelTwoPlayer` (hot-seat)     | **both players, at all times**                | each row splits into a P1 (sky) and a P2 (orange) cell with its own boxes; objectives are _not_ gated by the active player |
| `OnlineResultsPanel`                   | own column, **only during the Scoring phase** | two columns: `{you} (you)` editable, opponent's always read-only; frozen during the Reveal phase                           |
| `ResultsBriefingPanel` (solo briefing) | nobody                                        | read-only, grouped per-round cards, boxes shown inert                                                                      |
| `OnlineMissionView` (lobby preview)    | nobody                                        | rows with **no boxes at all**, plus the note "Objectives unlock once the game has started."                                |

In hot-seat, both players tick freely on one device — the active-player gating covers the
**Schemes** panel, not Results. That is intentional: objectives are public information on a
shared table.

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
- **Reset** lives in the Command Panel and rebuilds progress from empty: it clears the checked
  objectives **and** the chosen Scheme **and** the scheme draft **and** the round. It is a
  "fresh play of this mission", not a "clear the board".

## Open questions

- **Completion strike-through is solo-only.** `ResultsPanel` strikes a completed objective;
  `ResultsPanelTwoPlayer` and `OnlineResultsPanel` never do. Either all three should, or none —
  the inconsistency is invisible only because the panels are never on screen together.
- **Bring the grouped layout to the interactive panels.** The per-round cards exist and are
  proven read-only; making them writable (per-round boxes writing to the per-round objective
  ids) is the natural next step and needs no progress-shape change. Until then Awaiting
  Reinforcements is 12 cards in three of four views.
- **`count: 1` renders two different ways** across panels (checkbox vs one box). Harmless, but
  it means a control's appearance does not imply its behaviour. Unify on boxes?
- **No per-objective note field.** Players sometimes want to jot _why_ a box is ticked (which
  Quarter, which model). Out of scope today.
- Should Reset ask for confirmation? It silently discards a whole mission's scoring, and unlike
  the army builder's destructive actions it has no ConfirmDialog.
