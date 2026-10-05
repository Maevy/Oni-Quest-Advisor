# Two-Player Hot-Seat Mode

Two players share **one device**. Each has their own objectives, their own hidden Scheme, their
own army and their own VP total; the app mediates who is looking at the screen.

Hot-seat is `gameMode: 'two-player'`, chosen on the mode-select screen (**2 Player Tracking**,
orange). It is a completely separate implementation from online play — different progress type,
different store, different components, different `localStorage` prefix — and was deliberately left
untouched by all the online-mode work.

## Entry and navigation

Identical to solo through the mission click: `game-mode` → `season-select` → `mission-select`.
`selectMission()` loads into `twoPlayerProgressStore` and both local modes then land on the
read-only **Mission Briefing**, whose **Start Game** button records the open game and enters the
tracker. Hot-seat's briefing differs from solo's only in its army slots: the header carries
**Pick P1 Army** (sky) and **Pick P2 Army** (orange) instead of one **Pick Army**, and each seat's
attached list renders as its own panel — **Player 1 Army** / **Player 2 Army** — between the
Description and Setup panels. See
[01-navigation-flow.md](./01-navigation-flow.md#screen-4a--mission-briefing-mission-briefing-both-local-modes).

Starting with a seat that has no army asks _"It is strongly recommended to start a game with both
players having an army. Do you want to proceed?"_ (**Start anyway** / **Not now**), because the
tracker's army panes are read-only and a run fields what it started with.

## State model

`TwoPlayerMissionProgress` — one record per mission:

```
{ missionId, gameMode: 'two-player', currentRound, player1: PlayerProgress, player2: PlayerProgress }
```

Each `PlayerProgress` is the shared `SeatProgress` (`checkedObjectiveCounts`, `scheme`,
`schemeDraft`, `schemeRevealed` — the same shape online's seats use) plus two local-only fields:
`pickedArmy` (the seat's snapshot) and `vitality` (Life/stamina/States per army copy). Online has
no armies, so its seats stay on `SeatProgress` and never carry them.

Persisted to `localStorage` under **`oni-quest-advisor:2p-progress:{missionId}`** (solo uses
`oni-quest-advisor:mission-progress:`), so the same mission can hold independent solo and
hot-seat states. Loaded through `hydrateTwoPlayerProgress()`, which merges **each seat** onto its
own empty defaults — a shallow spread over the whole record would replace both seats and leave a
field added later as `undefined`.

`activePlayer` is **not** part of it — it lives only in the store, starts at `player1` on every
load, and is never written to disk. See Open questions.

## Player colours

Player 1 keeps the app's standard sky-blue accent. Player 2 is **orange** throughout. The pair
lives in one place (`components/playerAccent.ts`), so a seat reads the same everywhere it appears:
the briefing's pick buttons and army panel headings, the Active Player line, the two VP blocks,
the army pane titles and the interactive row's hover glow.

## The three-view tracker

The tracker is the same sliding-strip screen as solo's, with three views behind the header's
spotlight switcher: **Scoring / Army / Mission**. A horizontal swipe steps between
them like everywhere else, and each pane scrolls itself.

### Scoring

Top to bottom:

1. **Active Player** panel — _"Player 1 is the active Player"_ (or Player 2) in the seat's colour,
   with that seat's army name under it, so nobody has to guess whose turn the sheet is.
2. **Score panel** — two VP blocks side by side, **Player 1 Total VP** (sky) and **Player 2 Total
   VP** (orange), each `{total} / 10` computed independently from that seat's objectives and
   scheme; the active seat's block carries its border. Below them the **round** stepper and the
   **Swap Player** button.
3. **Results** — the solo panel, grouped per-round cards included, bound to the **active seat
   only**. This is the mode's fundamental rule change: objectives are no longer a shared sheet
   with two columns, each player ticks their own after the device has been handed over.
4. **Schemes** — unchanged in spirit: both seats stacked, the active one interactive, the other
   _Hidden_ until revealed. See [04-schemes-panel.md](./04-schemes-panel.md).

The round is one counter for the table, and **Player 1 is the seat that carries it**: while
Player 2 is active the stepper's buttons are disabled and a line under them says _"Only Player 1
advances the round."_

There is **no Reset**. The score panel's only action besides the round is **Swap Player**, which
carries the app's neon beam in violet (`neon-border neon-violet`) — violet being the swap
mechanic's hue, belonging to neither seat. A fresh play is reached the way every other run ends:
Return → Abandon → pick the mission again.

### Army — the Battle Flowers

One panel split vertically in half: a translucent **sky** half for Player 1 and a translucent
**orange** half for Player 2, each headed by its seat's name and the army it fields (or _No army
attached_). Every copy in a seat's list is drawn as a **Battle Flower**: the unit's icon in a
circular orb, ringed by a circular bar in two halves.

- The **left half** is the copy's Stamina: one equal box per point of its effective STA, filled
  yellow.
- The **right half** is its Life: one box per point of its effective HP, filled red.
- A lost point **empties its box from the bottom end** of the half (a dark box keeping its
  coloured rim), so the ring's shape never changes mid-game.
- The ring is thin and sits flush on the orb, and the two halves meet at 12 and 6 o'clock, so the
  whole flower reads as **one circle** rather than an orb inside a disconnected band. Every
  filled box carries a dark border so the count reads at a glance; a lost box's coloured rim is
  what marks its slot.
- An overhealed Life **repaints its extra points blue over the red boxes from the top end**
  instead of growing the ring: two base HP healed to three read one blue and one red box, at
  four both are blue.
- A half a model has no value for (a null STA or HP) draws no boxes at all.
- A mounted copy is one flower: the rider's icon, the mount's stats on the ring, and the mount's
  name under the unit's.

Both seats share the one view, so the old active/frozen distinction no longer applies to armies —
a flower is reference for whoever holds the phone.

**Focusing a flower.** Clicking a flower lifts it out of the panel: the screen behind blurs and
dims, the flower glides to the viewport centre at 1.3× its size, and every other flower fades to
a quarter of its opacity so the focused one holds the eye. A click anywhere outside the flowers —
or Escape — glides it back into its slot and restores the panel. The enlarged flower is a
measured clone rendered at the screen root (`BattleFlowerFocus`), because the sliding strip's
transform would trap a `fixed` overlay inside the pane; it grows a third, deliberately not to
full screen. Once the flower has landed, a ring of eight **petals** blooms outside its ring —
thicker arc buttons, one per action the flower will offer: damage to this model, to an enemy or
to a friendly; heal this model or a friendly; assign a status to this model, an enemy or a
friendly — tinted red, emerald and violet by kind. Dismissing retracts the petals first and only
then glides the flower home. The petals' behaviour is the next iteration; today they hold their
place and keep the focus open. Focusing is the flower's only other interaction: beyond it the
flowers edit nothing. The vitality menu, the unit card and status assignment return in the
interaction phase, rebuilt on the flower itself; until then those features are simply absent
from the army view.

Because decoded entry ids are position-based (`imported-1` for a list's first copy), both seats
can hold the same id; the two `vitality` maps keep them apart.

### Mission

The static reference panels, identical to solo's Mission view.

## The swap mechanic

Because both secrets live on one screen, the app needs a way to hand the device over without
leaking. The score panel's violet **Swap Player** button starts a **6-second full-screen
countdown** (`CountdownOverlay`, `z-50`): _"Player swapping in"_ above a giant number, with a
**Skip** button. Finishing the countdown and pressing Skip both perform the swap.

That delay is the whole privacy mechanism: the outgoing player looks away, the incoming player
takes the phone. `activePlayer` then flips and the Scoring sheet rebinds to the new seat's
objectives; the Army view is shared reference and does not change hands.

The swap does **not** touch progress — objectives, schemes, vitality and the round all survive it.

## Return means abandon

The tracker's **← Return** asks _"Abandon this game? Both players' progress will be lost."_
(**Keep playing** / **Abandon**). Abandoning deletes the open-game record and both seats' saved
progress, and returns to the mission list — the same lifecycle solo has, since v0.7.2. A reload
mid-run offers the resume prompt, and the record's `mode` sends it into this tracker. See
[01-navigation-flow.md](./01-navigation-flow.md#open-game-lifecycle-solo-and-hot-seat).

## Differences from online play

Same game, different trust model:

|                         | Hot-seat                        | Online                                                                 |
| ----------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Device                  | one, shared                     | one per player                                                         |
| Source of truth         | `localStorage`                  | the server                                                             |
| Scheme secrecy          | convention + a countdown        | server-enforced visibility filter                                      |
| Reveal                  | permanent, one press            | a **toggleable intent**, committed when the leader advances to Scoring |
| Revealed scheme's boxes | editable by either player       | **owner only**                                                         |
| Hidden scheme scoring   | allowed (boxes are there)       | **impossible** — boxes stay locked until revealed                      |
| Round advancement       | manual, Player 1 only           | server phase engine, leader-driven                                     |
| Objectives              | active seat's own sheet         | own column, only during the Scoring phase                              |
| Armies                  | one per seat, as Battle Flowers | none                                                                   |
| Swap mechanic           | yes                             | none needed                                                            |

The online rules that have no hot-seat equivalent (reveal-as-intent, revealed-only scoring,
phase freezing) exist because a server can enforce them; hot-seat cannot, so it does not pretend
to.

## Open questions

- **`activePlayer` is not persisted.** A reload mid-game silently returns control to P1 — which
  can put P1's hidden scheme in front of whoever is holding the phone, defeating the swap
  mechanic. Now that a reload resumes the run through the open-game prompt, the hole is one
  accidental refresh wide. Persisting it, or forcing a countdown on load, would close it.
- **The swap countdown is skippable**, which means the privacy guarantee is opt-in at the exact
  moment it matters. Is Skip worth keeping (it is genuinely useful when the same person is
  playing both seats for a test), or should it go?
- **The flowers focus but do not edit.** Life, stamina and States cannot be changed in hot-seat
  at all right now: the vitality menu went with the army panes it lived in, and the flower's own
  interaction — box taps, the unit card on the orb, status assignment on the flower — is the next
  iteration. Until then a run fields whatever Life it started with.
- Hot-seat has **no notion of a finished game** — no statistics, no winner, no round snapshots.
  Online computes all three. Would a post-round-5 summary be useful here, or are the two VP
  blocks enough?
