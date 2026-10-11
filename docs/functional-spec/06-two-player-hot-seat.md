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
**edit statuses**, **manage Stamina**. Since the 2026-10-11 rework every petal acts on **the
flower at the centre** and on nothing else — choosing a target is no longer a petal's job — and
one orange **star** covers assigning and removing alike, a second "remove" petal being only a
second door into the same ring. The petals are one dark-blue glass — a very dark fill, a brighter
blue outline — because
the glyph carries the meaning, not a tint: a red **sword**, a green **medic's cross**, an orange
**star**, a yellow **disc** for Stamina, and a grey exclamation mark in a grey ring for the card. Pressing a petal lights its rim bright yellow with a glow, and only one petal glows at
a time: pressing another moves the light, hovering shows it transiently, and a dismissal drops
it as the petals retract. The pressed petal is the selection its own sub-flow opens from; until
then the other action petals hold their place and keep the focus open. The info
petal's light is the open card's rather than a standing selection: closing the card returns it
to the ring's default grey, and keyboard focus wears its own sky rim, so yellow always means
hover or pressed. The info petal opens the copy's **unit card** above the flower: dismissing the
card — click outside or Escape — closes one layer and leaves the flower centred, and only the
next click outside glides it home.

**Acting on another model: drag and drop** (2026-10-11). Cross-model interaction left the petals
for a gesture: pick a strip flower up and drag it towards any other flower, friend or foe. Past
an 8 px threshold the lift becomes a drag — the States bands fade out to clear the field, a
measured clone of the flower follows the finger at the screen root (the pane's overflow and the
strip's transform would clip it), and a slowly turning green crosshair rings whichever other
flower the finger is over. Dropping on one opens the **Interaction panel**; dropping on nothing
returns the clone to its slot and fades the bands back in. A drag is never a view-swipe — the
strip's horizontal swipe stands down while a flower owns the gesture — and never a focus: the
click a finished drag leaves behind is swallowed.

The panel puts the **origin flower on the left and the target on the right**, seat-rimmed, with a
right-pointing arrow and the word _Interaction_ between them, and below them a box of seven
actions: **Assign Damage** (red sword), **Assign Healing** (green cross), **Assign / Remove
Status** (orange star), **Assign / Remove Buff** (blue up-arrow, _inert for now_), **Deal
Stagger** (a yellow Stamina ring broken open), **Deal Stun** (a yellow Stamina ring struck through
with an X) and **Trade Item** (_inert for now_). All seven are offered regardless of friend or
foe — the player decides. Damage and Healing open the shared **amount pad**, a calculator grid of
**1 … 9** with an OK that stays dead until a digit is tapped; Status opens the shared **boxed
State picker** — the fourteen pickable States as orbs with a tooltip line naming the one under
the finger and an Accept; Stagger and Stun ask first ("Assign Stagger/Stun to the target?"). On
confirm the action's glyph **flies from the origin flower through the arrow to the target**, the
commit lands in the target seat's vitality map, and the target's boxes walk to the new value
before the panel folds; accepted States fly to the target as a cluster while removed ones simply
clear. Stagger spends **one** of the target's activations and Stun **every** one — Stamina only,
no State of their own — so a model with no Stamina track offers neither.

**The self damage and heal flows.** The sword and the cross open that same amount pad below the
centred flower, tinted red or green; OK deals or restores the amount **to the model at the
centre**, clamped to the Life left or to the room under the overheal cap, and its Life boxes walk
one by one while the pad folds back to the petals and the flower stays centred for the next
action.

**The self status flow.** The star blooms the fourteen pickable States as orbs on a ring around
the centred flower — a real 44 px touch target each, on a radius that fits the smaller screen
dimension — with nothing competing for the space. A carried State lights the same yellow rim the
pressed petal does and wears its own colour; the rest are the petals' dark glass with a grey
glyph. Tapping an orb toggles it in a **draft** — nothing is written yet — under the line "Tap
status effects to add or remove them. Tap model icon twice to confirm". The model icon is the
commit: the first tap arms the green crosshair around it, the second writes the whole draft to
the focused copy's seat and glides the flower home. Toggling an orb disarms a pending commit, so
a tap after an edit never writes by accident. Escape and click-outside discard the draft and
close.

**Zero Life is a contract, not a pick** (reworked 2026-10-08). Incapacitated left the ring
entirely: a living model whose Life reaches 0 is forced into Incapacitated and Crouched —
Crouched stays a locked orb, dimmed and labelled "forced while Life is 0", while Incapacitated
cannot be offered at all — and any heal of at least one point drops the Incapacitated again as
the model stands back up, keeping whatever else it carried. A model already on the floor that
takes another hit dies: with no Life left to take, the hit's whole effect is the Dead State.
Dead itself is a pick like any other — killing is a decision — and can also be assigned straight
to a standing model; where Dead sits, Incapacitated never sits with it, so turning Dead drops
it, and taking Dead off a corpse at zero Life lands the copy back on the floor, forced States
and all. An **Undead** model has no Incapacitated: zero Life puts it straight into Dead, and a
heal up from zero takes that Dead back off. Because any flower is a valid drop target and the
self petals act on whatever is centred, a heal can always reach a fallen or Dead copy — the rise
takes the Dead State off whichever copy it lifts — and a second hit on the fallen is still how
Dead arrives. Neither State rides the band: a fallen model wears a translucent **yellow wash
with the Incapacitated glyph** over its icon and a Dead one a slighter **red wash with the
skull**, on every flower — strip and centred copy alike — so what happened to a model reads
across the table without ever looking at the orbs.

**The Stamina flow** (2026-10-08) is the fourth petal function:
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
while the ring is idle — no flow open, no card above — because mid-flow the player's hand is
somewhere else. Over-Stamina has no box of its own (the ring never grows), so
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
