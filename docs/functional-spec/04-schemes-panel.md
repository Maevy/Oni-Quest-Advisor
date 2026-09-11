# Mission Panels — Schemes

Lets a player draw and track their **hidden Scheme** — the secret objective card that sits
alongside the mission's public Results. A player holds **exactly one** active Scheme per
mission.

Schemes are the app's only information-asymmetric mechanic, so what a player sees depends on
the mode: in solo everything is theirs, in hot-seat the two players share one screen and one
secret each, and online the **server** decides what each phone is allowed to receive.

## The shared three-state flow

`SchemesPanel` (solo), the active seat of `SchemesPanelTwoPlayer` (hot-seat) and
`OnlineSchemeSetup` (online lobby) all implement the same flow.

### Step 1 — Draft: faction and intelligence

Three controls in a row:

1. **Faction** — a `<select>` with a disabled `Select…` placeholder; the six playable factions.
2. **Intelligence** — a number input (`min="0"`), empty mapping to `null`.
3. **Draw Missions** — a button, disabled until both are set.

A live hint **`Draws {n}`** shows how many cards the entered intelligence will draw, from
`drawCountForIntelligence`:

| Intelligence | Draws        |
| ------------ | ------------ |
| ≤ 13         | 2 (pick one) |
| 14–15        | 3 (pick one) |
| ≥ 16         | 4 (pick one) |

> The button label reads **"Draw Missions"** although it draws _Schemes_ — legacy copy, and
> consistent across all three implementations, so it reads as intentional. See Open questions.

### Step 2 — Draw

Pressing the button draws from a **single combined pool**: the selected faction's cards plus any
card tagged common (`getSchemePool`). The pool is not a fixed split between the two.

The deck behind the draw contains **multiple physical copies** of some cards, and the draw is
weighted by each card's copy count for that faction (`copiesForFaction`), so a 4-copy card is
four times as likely as a 1-copy card. If a draw hits a Scheme already drawn, it is discarded and
redrawn transparently until the target number of **distinct** cards is reached
(`drawUniqueSchemes`; randomness injected as an `Rng`, so the draw is pure and testable).

The drawn cards appear as a list, each a full-width clickable button showing its title and rule
text.

**The drawn hand is not persisted** — it lives only in the store (`drawnSchemes`,
`drawnSchemesP1`/`P2`) and is cleared on load. Reloading mid-choice means drawing again. This is
deliberate: a persisted hand would let a player re-roll by reloading until they liked the
options.

### Step 3 — Forced selection

The player picks exactly one card. On pick the others disappear and only the chosen card remains.
With ≤ 13 intelligence there are still two cards, so this is always a real choice.

The pick is stored as `ChosenScheme` — `{ schemeId, factionId, intelligence, checkedIncrements }`.
Only the **id** is persisted; card content is looked up in the bundled data on load. The faction
and intelligence are captured on the choice as well as kept in the draft.

### Step 4 — Tracking the chosen Scheme

The chosen card renders with its title and rule text plus:

- a row of **`maxIncrements` boxes** (same `IncrementBoxes` control as Results — click box _n_ to
  set, click an achieved box to step back one), representing the card's scoreable increments;
- a red **✕** delete control (`aria-label="Delete chosen Scheme"`).

VP per box comes from the card: a flat `vpPerIncrement`, or per-box `incrementVp` values for
cards whose rulebook text caps the total ("2 VP, then 1 VP"). See
[../technical-spec/04-scheme-data-format.md](../technical-spec/04-scheme-data-format.md).

**Delete** clears the chosen Scheme and its box progress and returns to Step 1 — but the faction
and intelligence inputs **stay prefilled** from `schemeDraft`, so the player only re-presses
Draw. (A full mission **Reset** from the Command Panel does clear the draft too.)

`OnlineSchemeSetup` is this flow **minus the increment boxes** — in the lobby there is nothing to
score yet; boxes appear in-game.

## Read-only variants

- **`SchemesBriefingPanel`** (solo Mission Briefing) — no flow at all, just the line
  _"Can be selected when the game starts."_ The briefing is read-only by design.

## Hot-seat: two secrets, one screen

`SchemesPanelTwoPlayer` shows two stacked cards — **PLAYER 1** (sky) and **PLAYER 2** (orange).
What each displays depends on `activePlayer`:

|                    | Active player                 | Inactive player                 |
| ------------------ | ----------------------------- | ------------------------------- |
| Nothing chosen     | full draft/draw flow          | italic _No schemes_             |
| Chosen, unrevealed | full flow + **Reveal** button | italic _Hidden_                 |
| Chosen, revealed   | card + editable boxes         | card + **still-editable boxes** |

- **Reveal is permanent** — one-way, via `revealScheme(player)`. It cannot be taken back.
- The **Reveal** button sits under the ✕ and only appears for the active player on their own
  unrevealed scheme.
- Once revealed, the scheme is visible to whoever holds the device — and its boxes stay
  **editable by either player**. Hot-seat has no server to enforce ownership; the physical
  handover is the control. (Contrast with online, where boxes are strictly owner-only.)
- Switching who is active is the **Swap Player** mechanic in the Command Panel, with a
  6-second countdown so the outgoing player can look away before their secret is on screen.
  See [05-command-panel.md](./05-command-panel.md) and
  [06-two-player-hot-seat.md](./06-two-player-hot-seat.md).

Results are **not** gated this way — both players tick objectives freely at all times.

## Online: reveal is a scored decision

Drafting happens in the **lobby** (`OnlineSchemeSetup`, in each seat card). In-game,
`OnlineSchemesPanel` shows two cards — yours and the opponent's.

**Your own card:**

- Not chosen → italic _No scheme_.
- Chosen and already revealed → an emerald **Revealed** pill, and boxes editable **only during
  the Scoring phase** (disabled during Reveal).
- Chosen and unrevealed, during the **Reveal phase** → a toggle button reading **Reveal** /
  **Undo reveal**, driven by `revealIntent`. While the intent is set but not yet committed, a
  hint reads _"Reveal intent set — the opponent sees it once scoring starts."_
- Chosen and still hidden during **Scoring** → instead of boxes, the text _"Hidden schemes can't
  be scored — reveal your scheme to unlock its boxes."_

**The opponent's card:**

- Revealed → the card plus **read-only** boxes.
- Chosen but unrevealed → italic _Hidden Scheme_ (no title, no text — the card content never
  reaches your phone).
- Nothing chosen → italic _No schemes_.

The two online rules that make this interesting:

1. **Reveal is a toggleable intent, not an action.** During a Reveal phase presses can be taken
   back; they become permanent and visible only when the leader advances the game to Scoring.
2. **A hidden scheme scores nothing.** Boxes unlock only once the scheme is revealed, so keeping
   a scheme secret costs its VP. Revealing is a genuine secrecy-versus-scoring trade-off.

The server enforces both, and the per-seat visibility filter means an unrevealed scheme's
content is never transmitted to the opponent at all. See
[07-online-two-player.md](./07-online-two-player.md).

## Persistence

| Data                                                     | Solo / hot-seat                              | Online                                     |
| -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Chosen scheme (id, faction, intelligence, checked boxes) | `localStorage`, per mission                  | server game state, per seat                |
| Drawn hand (pre-choice)                                  | **not persisted**                            | server-side, per seat                      |
| Scheme draft (faction + intelligence)                    | `localStorage`, survives a delete            | server game state                          |
| Reveal state                                             | `schemeRevealed` per player (`localStorage`) | `revealIntent` + `schemeRevealed` per seat |

Solo and hot-seat progress is merged onto the empty-progress factory on load, so fields added
later get their defaults.

## Open questions

- **"Draw Missions" should probably read "Draw Schemes".** The button has said this since the
  first implementation; it is consistent everywhere, which is the only reason it has survived.
  Cheap to fix, tiny risk of confusing a player used to the old label.
- **The hot-seat inactive player's revealed boxes are editable by whoever holds the device.**
  That matches the mode's trust model (one shared phone, physical handover), but it is worth
  stating explicitly: hot-seat has no privacy enforcement at all, only a countdown.
- **The drawn hand is not persisted in solo/hot-seat, but is on the online server.** A solo
  player who reloads mid-choice loses their options; an online player does not. Is the solo
  behaviour a feature (no re-rolling) or an oversight?
- Nothing prevents drawing again after choosing, or re-choosing without deleting — the flow is
  linear by UI, not by guard. Should `chooseScheme` be idempotent/locked once set?
- Should the box row show the card's **VP per box** inline? Today the player must read the rule
  text to know whether box 2 is worth 1 or 2 VP, which matters for the `incrementVp` cards.
