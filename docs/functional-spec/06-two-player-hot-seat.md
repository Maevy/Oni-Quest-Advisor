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
  four both are blue. Over-Stamina repaints the yellow boxes violet the same way, to double the
  base.
- A half a model has no value for (a null STA or HP) draws no boxes at all.
- A mounted copy is one flower: the rider's icon, the mount's stats on the ring, and the mount's
  name under the unit's.
- The States a copy carries hang off the flower as a **band of orbs over its shoulders**, just
  outside the vitality ring: eight slots — four arcing down the left, four down the right, 12
  o'clock left clear where the two ring halves meet — and the carried States fill them in order,
  the left four from the top down and then the right. Each orb wears the State's own glyph in its
  own colour; past eight, the last right slot becomes a `+n` chip counting the rest. A copy
  carrying no States shows no band, so a clean army reads exactly as it always did. The band is
  display-only — the flower's own click still focuses it — and the flower's aria-label names the
  States for a screen reader.

Both seats share the one view, so the old active/frozen distinction no longer applies to armies —
a flower is reference for whoever holds the phone.

**Focusing a flower.** Clicking a flower lifts it out of the panel: the screen behind blurs and
dims, the flower glides to the viewport centre at 1.3× its size, and every other flower fades to
a quarter of its opacity so the focused one holds the eye. A click anywhere outside the flowers —
or Escape — glides it back into its slot and restores the panel. The enlarged flower is a
measured clone rendered at the screen root (`BattleFlowerFocus`), because the sliding strip's
transform would trap a `fixed` overlay inside the pane; it grows a third, deliberately not to
full screen. Once the flower has landed, a ring of five **petals** blooms outside its ring —
thicker arc buttons, clockwise from 12 o'clock: the model's card, **deal damage**, **heal**,
**edit statuses**, **manage Stamina**. Damage and heal no longer declare a target — choosing the
model is the action's own step — and neither do the States, so one orange **star** covers
assigning and removing alike; a second "remove" petal would only be a second door into the same
ring. The petals are one dark-blue glass — a very dark fill, a brighter blue outline — because
the glyph carries the meaning, not a tint: a red **sword**, a green **medic's cross**, an orange
**star**, a yellow **disc** for Stamina, and a grey exclamation mark in a grey ring for the card. Pressing a petal lights its rim bright yellow with a glow, and only one petal glows at
a time: pressing another moves the light, hovering shows it transiently, and a dismissal drops
it as the petals retract. The pressed petal is the selection a later ring of sub-petals will
bloom from; until then the other three action petals hold their place and keep the focus open. The info
petal's light is the open card's rather than a standing selection: closing the card returns it
to the ring's default grey, and keyboard focus wears its own sky rim, so yellow always means
hover or pressed. The info petal opens the copy's **unit card** above the flower: dismissing the
card — click outside or Escape — closes one layer and leaves the flower centred, and only the
next click outside glides it home.

**The damage flow** — the first petal function (2026-10-05). Pressing the sword blooms a third
ring of seven petals, **1 … 6 and X** — painted beneath the action ring, so it emerges from
behind it — the last opening a small amount entry; pressing an
amount brings the whole living field forward: every alive copy of both armies, the focused
copy's twin among them so a model can hit itself, each drawn as its flower with both rings, in
a wrapped grid below the flower under the line "Tap on selected model and then confirm it
again". Seat-coloured rims say whose model it is and a badge numbers duplicate copies. One tap
selects — a slowly turning green crosshair — and a second tap on the same icon confirms: the red
sword flies from the focused flower to the target, and on arrival the hit is committed to that
seat's vitality map, clamped to the Life left, while the target's Life boxes darken one by one;
when the last one has faded the overlay dismisses itself and the army view returns to normal.
Dead copies leave the row. Escape and click-outside peel the flow back one layer at a time — the
amount entry, then the sub-ring and row, then the overlay — and a strike in flight ignores them
both.

The **heal flow** is the same shape turned around: the cross blooms the same amount ring (its X
entry labelled "Healing"), the row offers every copy below its **overheal cap** — the fallen and
the whole alike, because Life overheals to double its base — the green cross flies instead of the
sword, and the boxes refill one by one, past full into the blue overheal and no further than
double the base. Whether a heal may raise a fallen copy is still an open ruling.

**The status flow** (2026-10-06) is the third petal function, and the first that moves the focus.
The star opens the same target row — but with **every** copy of both armies in it, fallen and
untouched alike, because States are not a function of Life — under the line "Tap target to
select statuses". One tap, not two: the ring the tap leads to is reversible and has its own
commit, so a mis-tap costs nothing. That tap moves the focus onto the chosen copy — its flower
takes the centre while the flower the overlay opened from glides back to its slot and stays
**lit** there, the one bright flower in a dimmed strip, because that is where it now lives — and
a beat later all fifteen States bloom around the target as orbs on a ring of their own: a real
44 px touch target each, on a radius that fits the smaller screen dimension, with nothing
competing for the space (the petals went home with the flower they belonged to, and this flow has
no amount ring). A carried State lights the same yellow rim the pressed petal does and wears its
own colour; the rest are the petals' dark glass with a grey glyph. Tapping an orb toggles it in a
**draft** — nothing is written yet — under the line "Tap status effects to add or remove them.
Tap model icon twice to confirm". The model icon is the commit: the first tap arms the green
crosshair around it, the second writes the whole draft to that seat's vitality map in one go and
sends the flower home into **the target's** slot. Toggling an orb disarms a pending commit, so a
tap after an edit never writes by accident. Escape and click-outside discard the draft and close.
The two States a model at zero Life is forced into — Incapacitated and Crouched — are **locked
orbs**, dimmed and labelled "forced while Life is 0": the store re-applies them to every commit,
so offering to clear them would only show the tap undone.

**The Stamina flow** (2026-10-08) is the fourth petal function, and the only one with no row:
the yellow disc blooms a third ring of just the two steps Stamina has — **−1 and +1** — dead at
the floor and at the over-Stamina cap, and each tap acts on the flower already centred, the one
the petals belong to. The commit lands at once and the centred flower's Stamina boxes walk the
single step: a spend empties its box from the bottom end exactly like Life, a gain refills it
the same way, and past the base the extra point repaints its box **violet** from the top end —
over-Stamina overheals to double the base the way Life's blue does. The step ring stays out
between taps, so several points cost several taps; Escape or click-outside folds it, and the
next Escape glides the flower home. A model with no Stamina value gets a dead disc — dimmed and
labelled — instead of a ring of two disabled steps.

**Box taps** (2026-10-08) are the shortcut over all of it, and the last piece of the flower
interaction. On the focused flower — and only there, the strip's flowers stay display-only — the
ring's boxes are themselves tappable while the petals hold their place just outside the ring:
tapping the n-th box of a half sets that stat straight to n, Life or Stamina alike, the boxes
walking to the new value and the commit landing at once like a Stamina step. Taps are live only
while the ring is idle — no flow open, no strike in flight, no card above — because mid-flow the
player's hand is somewhere else. Over-Stamina has no box of its own (the ring never grows), so
it stays the disc's +1; and the boxes are a pointer shortcut rather than a path of their own —
every value they set is also reachable through the petals — so they carry no keyboard role and
sit inside the overlay's flower copy, which is hidden from assistive tech as a duplicate of the
strip flower behind it.

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
- Hot-seat has **no notion of a finished game** — no statistics, no winner, no round snapshots.
  Online computes all three. Would a post-round-5 summary be useful here, or are the two VP
  blocks enough?
