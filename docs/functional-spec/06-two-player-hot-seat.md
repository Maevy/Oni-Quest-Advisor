# Two-Player Hot-Seat Mode

Two players share **one device**. Each has their own objectives, their own hidden Scheme and
their own VP total; the app mediates who is looking at the screen.

Hot-seat is `gameMode: 'two-player'`, chosen on the mode-select screen (**2 Player Tracking**,
orange). It is a completely separate implementation from online play — different progress type,
different store, different components, different `localStorage` prefix — and was deliberately left
untouched by all the online-mode work.

## Entry and navigation

Identical to solo up to the mission click: `game-mode` → `season-select` → `mission-select`.
`selectMission()` then branches on `gameMode`:

- `two-player` → loads into `twoPlayerProgressStore` and goes **straight to `mission-detail`**.
- `solo` → loads into `missionProgressStore` and goes to the read-only `mission-briefing`.

So hot-seat **skips the Mission Briefing entirely** and lands on the interactive tracker. That is
also why hot-seat is unaffected by the solo briefing's disabled Start Game button: it never
passes through that screen.

## State model

`TwoPlayerMissionProgress` — one record per mission:

```
{ missionId, gameMode: 'two-player', currentRound, player1: PlayerProgress, player2: PlayerProgress }
```

Each `PlayerProgress` is `{ checkedObjectiveCounts, scheme, schemeDraft, schemeRevealed }` — the
same shape as solo progress, minus the mission id and round (which are shared).

Persisted to `localStorage` under **`oni-quest-advisor:2p-progress:{missionId}`** (solo uses
`oni-quest-advisor:mission-progress:`), so the same mission can hold independent solo and
hot-seat states. Loaded by merging onto `createEmptyTwoPlayerProgress()`, so fields added later
get their defaults.

`activePlayer` is **not** part of it — it lives only in the store, starts at `player1` on every
load, and is never written to disk. See Open questions.

## Player colours

Player 1 keeps the app's standard sky-blue accent. Player 2 is **orange** throughout
(`border-orange-500/40`, `text-orange-300`/`text-orange-400`). The colour identifies a seat
everywhere it appears: the Schemes cards, the Results sub-cells, the Command Panel's VP blocks
and the collapsed tab's `P1`/`P2` indicator.

## Results: both players, always editable

`ResultsPanelTwoPlayer` renders each objective once, with a two-column grid underneath: a **P1**
cell (sky) and a **P2** cell (orange), each with its own boxes bound to that player's count.

**Both cells are editable at all times.** Objectives are not gated by the active player — on a
shared table, objective state is public information, and making players swap to tick a box would
be pure friction. Both can toggle freely, in either order.

Unlike the solo panel, completed objectives are **not** struck through.

## Schemes: the one secret per player

`SchemesPanelTwoPlayer` stacks two cards, **PLAYER 1** and **PLAYER 2**, and what each shows
depends on `activePlayer`:

| State of that player's scheme | Active player sees                  | Inactive player sees  |
| ----------------------------- | ----------------------------------- | --------------------- |
| none                          | the full draft/draw flow            | italic _No schemes_   |
| chosen, unrevealed            | the full flow + a **Reveal** button | italic _Hidden_       |
| chosen, revealed              | card + editable boxes               | card + editable boxes |

The full flow is the standard faction → intelligence → Draw Missions → pick → track sequence, in
the seat's colour. See [04-schemes-panel.md](./04-schemes-panel.md).

**Reveal is permanent and one-way.** Only the active player can reveal their own scheme; once
revealed it stays revealed for the rest of the mission.

Note the asymmetry hot-seat accepts: once a scheme is revealed, **either player can tick its
boxes** — there is no owner-only enforcement, because there is no server to enforce it. The trust
model is "one phone, two people sitting together".

## The swap mechanic

Because both secrets live on one screen, the app needs a way to hand the device over without
leaking. The Command Panel's violet **Swap Player** button starts a **6-second full-screen
countdown** (`CountdownOverlay`, `z-50`): _"Player swapping in"_ above a giant number, with a
**Skip** button. Finishing the countdown and pressing Skip both perform the swap.

That delay is the whole privacy mechanism: the outgoing player looks away, the incoming player
takes the phone. `activePlayer` then flips and the Schemes panel re-gates.

The swap does **not** touch progress — objectives, schemes and the round all survive it.

## Command Panel

`CommandPanelTwoPlayer` is the solo panel plus:

- **two** VP blocks — `P1 VP` (sky) and `P2 VP` (orange), each `{total} / 10`, computed
  independently from that player's objectives and scheme;
- the **Swap Player** button;
- an `Active` + `P1`/`P2` indicator on the collapsed tab, in the active player's colour.

The round stepper is shared (one round for the table, not per player) and identical to solo.
**Reset** clears both players' progress and returns `activePlayer` to `player1`.

See [05-command-panel.md](./05-command-panel.md).

## Differences from online play

Same game, different trust model:

|                         | Hot-seat                  | Online                                                                 |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Device                  | one, shared               | one per player                                                         |
| Source of truth         | `localStorage`            | the server                                                             |
| Scheme secrecy          | convention + a countdown  | server-enforced visibility filter                                      |
| Reveal                  | permanent, one press      | a **toggleable intent**, committed when the leader advances to Scoring |
| Revealed scheme's boxes | editable by either player | **owner only**                                                         |
| Hidden scheme scoring   | allowed (boxes are there) | **impossible** — boxes stay locked until revealed                      |
| Round advancement       | manual stepper            | server phase engine, leader-driven                                     |
| Objectives              | both players, always      | own column, only during the Scoring phase                              |
| Swap mechanic           | yes                       | none needed                                                            |

The online rules that have no hot-seat equivalent (reveal-as-intent, revealed-only scoring,
phase freezing) exist because a server can enforce them; hot-seat cannot, so it does not pretend
to.

## Open questions

- **`activePlayer` is not persisted.** A reload mid-game silently returns control to P1 — which
  can put P1's hidden scheme in front of whoever is holding the phone, defeating the swap
  mechanic. Persisting it, or forcing a countdown on load, would close the hole.
- **No confirmation on Reset**, which wipes both players' entire mission state. Every other
  destructive action in the app is behind a `ConfirmDialog`.
- **The swap countdown is skippable**, which means the privacy guarantee is opt-in at the exact
  moment it matters. Is Skip worth keeping (it is genuinely useful when the same person is
  playing both seats for a test), or should it go?
- Should hot-seat get the **Mission Briefing** too? It currently skips straight to the tracker,
  so a two-player table never sees the read-only walkthrough or the grouped per-round Results.
- Hot-seat has **no notion of a finished game** — no statistics, no winner, no round snapshots.
  Online computes all three. Would a post-round-5 summary be useful here, or is the Command
  Panel's VP total enough?
