# Online Two-Player Mode

Two players, **each on their own phone**, playing the same mission with the **server as the
source of truth**. Phones are views of server state, not owners of it.

This is a third mode beside solo and hot-seat — separate screens, separate state, separate
persistence. Hot-seat is untouched by it. Implementation detail (API, state model, SSE, SQLite,
lifecycle) is in
[../technical-spec/06-online-architecture.md](../technical-spec/06-online-architecture.md).

Two design consequences follow from the server owning the game, and they shape everything below:

- **Secrets are real.** An unrevealed Scheme's content is never transmitted to the opponent's
  phone — the server filters each seat's view.
- **Rules can be enforced.** Phase gating, revealed-only scoring and round advancement are
  server-side guards that return errors, not UI conventions.

## Creating a game (Player 1 / leader)

1. Mode select → **Online 2 Player Game** (the neon-bordered button). On the **first** press a
   one-time intro modal warns that the feature is experimental: **Continue** proceeds and
   persists the acknowledgement, **Back** returns to the mode select.
2. The **create screen** is a local draft — nothing is sent until its button is pressed. Three
   fields, all required:
   - **Your Player Name** — 1–24 characters after trimming, placeholder `e.g. Konichan`.
   - **Mission** — a season dropdown then a mission dropdown, with the note _"The mission is
     fixed for the whole game — your opponent joins into it."_ There is no Random button here.
   - **Your Army** — a **Pick Army** button opening the saved-army picker, which for this slot
     lists **both** formats and says _"A Standard army is combat-ready at once; a Roster army is
     cut down to 85 points once the game starts."_ Once picked it becomes a row with the list's
     name, its faction in the faction's colour, a **Standard**/**Roster** tag, a tap to change it
     and a ✕ to remove it.
3. **Open Lobby** stays disabled until all three are set, with the hint _"Name, mission and army
   open the lobby."_ beneath it. Pressing it shows a full-screen **"Preparing the battlefield…"**
   overlay while the game is created.
4. A failure (an unreachable server, the hourly creation limit) surfaces as an error line on the
   same screen and **keeps the draft**, so nothing has to be re-entered.
5. The **lobby** appears, headed `Game#{code} Lobby` with the status line **Setup Phase**.

The creator is the **leader** for the whole game: only they advance phases, finish and close it.
There is no leader handover. The mission is no longer theirs to pick in the lobby — it was fixed
at creation.

## The lobby

- **Close Game** (leader only) → a confirmation dialog. Available in the lobby and mid-game.
- **Invite card** (leader only): `SHARE LINK TO INVITE PLAYER`, the (truncated) invite URL and a
  **copy to clipboard** button that reads **Copied!** for two seconds.
- **Mission** (both players, read-only): `{season} — {name}`, the mission the creator fixed. If
  the id is not in the bundled content the card says so rather than guessing.
- **Seat cards**: Player 1 (sky, with a **Game Leader** badge) and Player 2 (orange). Each opens
  with that player's **army** — name, faction in its colour and a **Standard**/**Roster** tag —
  and holds their faction/scheme area below. Empty seat 2 reads **"No Player 2, invite someone"**.
  The opponent's army **code never leaves the server**, so a seat card cannot be used to import
  somebody else's list.
- A read-only **mission preview** follows, with every panel collapsible and its Results showing
  no boxes at all plus the note _"Objectives unlock once the game has started."_
- **Start Game** (leader only, at the bottom) — disabled until **both** players have chosen a
  Scheme. Player 2 sees no Start button.
- When a join request arrives, the leader gets a popup: **"{name} wants to join your game"**
  with **Accept** / **Deny**.

## Joining (Player 2)

1. Player 2 opens the invite link (`/join/{code}`), which hands the code to the app and continues
   on `/`. The screen reads **"You are about to join Game#{code}. Enter your player name and pick
   the army you field."** with a player-name input (placeholder `e.g. Konichan`) and the same
   **Your Army** row as the create screen — both formats, name, faction, tag, change and ✕.
2. **Request to Join** stays disabled until a name **and** an army are set.
3. The request goes **pending**: _"Waiting for the game leader to accept your request…"_ above a
   pulsing `Game#{code}`. The phone polls for a decision every 2 seconds.
4. **Accept** → Player 2 takes seat 2, carrying the army they registered with, and lands in the
   same lobby, minus the leader-only controls. **Deny** → Player 2 sees **"Your Request has been
   revoked"**.

Other rejection states: **"This game is already full."** and **"This game has been closed."**

The joiner's seat credential is generated **on their own phone** and only its hash is ever
stored, so no secret travels back to them at accept time.

## Setup: faction and Scheme

Once Player 2 is present, both seats' scheme areas unlock. Each player, independently:

1. picks a **faction** and enters their **intelligence**,
2. presses **Draw Missions** — the draw happens **server-side**, and the resulting hand is
   persisted per seat,
3. picks one card.

Draw counts follow the standard brackets (≤ 13 → 2, 14–15 → 3, ≥ 16 → 4); see
[04-schemes-panel.md](./04-schemes-panel.md).

**What the opponent sees during setup:** their **faction only**, plus **"Hidden Scheme"** once a
card is chosen (or **"No schemes"** before that). Neither the drawn hand nor the chosen card is
transmitted.

## Playing: rounds and phases

**Start Game** → Round 1, **Reveal** phase. The game view header shows `Game#{id}`,
`Round {n} — Reveal Phase` / `— Scoring Phase`, and `Your VP: {n} / 10`.

Each round has two phases:

### Reveal phase

- Each player may press **Reveal** on their own scheme. This is a **toggleable intent**, not a
  commitment — the button reads **Undo reveal** once set, and a hint confirms
  _"Reveal intent set — the opponent sees it once scoring starts."_
- Objectives and scheme boxes are **frozen**; the scheme panel shows disabled boxes.
- The leader's footer button reads **"Round {n} Scoring"**. Pressing it **commits** every set
  intent: those schemes become permanently revealed and visible to the opponent. Intents that
  were not set stay hidden.
- Non-leaders see _"The game leader advances the rounds."_

### Scoring phase

- Each player checks **their own** objectives. State is cumulative across rounds — nothing is
  discarded when a round ends.
- Revealed schemes show **editable** increment boxes, **owner-only**.
- A scheme still hidden shows instead: _"Hidden schemes can't be scored — reveal your scheme to
  unlock its boxes."_ **A hidden scheme earns no Scheme VP at all.** Revealing is therefore a
  real trade-off: secrecy versus scoring.
- The leader's footer button reads **"Proceed to next round"**, which:
  - snapshots both players' cumulative VP for the round (this feeds the statistics table),
  - freezes objectives and boxes (state preserved, read-only),
  - advances to Round _n_+1's **Reveal** phase — **except** when both schemes are already
    revealed, in which case Reveal is skipped and it goes straight to Scoring.

This repeats through **Scoring Round 5**, after which the leader's button reads
**"Finish Game"**.

## Finish and statistics

**Finish Game** (leader) concludes the game for both players. All remaining hidden schemes are
**auto-revealed** so the totals are traceable — auto-reveal does _not_ retroactively award VP,
since those boxes were never ticked.

The statistics screen replaces the game view:

- **Winner banner** — `Victory for` / faction name / player name, in the winner's seat colour, or
  **Draw**.
- **Round Statistics** — a table of rounds 1–5 × both players, each cell that player's
  **cumulative VP at the end of that round** (an em dash where no snapshot exists).
- **Both seats' scheme cards** — player name and faction, the (now revealed) card and its rule
  text, and its increment boxes read-only; _No scheme_ if none was chosen.
- **Return to Main Menu**.

There is no rematch or room reuse — returning to the menu ends it.

## Closing a game

The leader may close at any point in the **lobby** or **mid-game**, always behind a confirmation
dialog (_"Do you really want to close the game?"_). The game ends for both players; the opponent
sees that it was closed and gets **Return to Main Menu**.

Closing is **refused once the game has finished or is already closed** — those states are
terminal.

## Reconnection

Phones sleep, lose signal and get killed mid-game, so resume is a first-class behaviour, not an
add-on:

- The seat (game code + seat + token) is kept in `localStorage`. On app start the page tries to
  resume it, showing **"Reconnecting to your game…"**.
- If the server rejects the session (unknown game, bad token) the session is dropped and the
  player lands back on the main menu.
- On a **network** failure the session is _kept_ and an error is shown with a way back, so a
  tunnel or a sleeping server does not cost a player their game.
- The server may be **cold** — the Fly machine auto-stops when idle, so the first request after a
  pause takes several seconds. Clients refetch and resubscribe on wake, which absorbs this.
- Live updates arrive as lightweight change notifications; the client responds by **refetching the
  full state**. There is no event replay and no optimistic update anywhere — the server's answer
  is the only truth.

## Visibility rules (server-enforced)

| Data                              | Owner sees          | Opponent sees                 |
| --------------------------------- | ------------------- | ----------------------------- |
| Player names, seats, leader badge | ✓                   | ✓                             |
| Army name, faction, format tag    | ✓                   | ✓                             |
| Army **code**                     | own, to re-import   | **nothing**                   |
| Faction (chosen or drafted)       | ✓                   | ✓                             |
| Drawn scheme hand                 | own cards           | **nothing**                   |
| Chosen scheme, unrevealed         | full card           | **"Hidden Scheme"**           |
| Chosen scheme, revealed           | full card           | card + boxes, **read-only**   |
| Own objective counts              | editable in Scoring | ✓ read-only                   |
| Reveal intent                     | own, toggleable     | **nothing** (until committed) |
| Invite link, pending join request | leader only         | —                             |

The army's `factionId` in the filtered seat view is an **army** faction (7 ids, including
`oni-clans` and `goblin-wartribes`) and is a separate field from the **scheme** faction (6 ids,
including `monster-factions`). The two id spaces overlap on five ids and resolve against
different catalogs, so reusing one field for both would mis-resolve exactly the monster factions.

## Differences from hot-seat

|                         | Online                                       | Hot-seat                      |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| Source of truth         | server                                       | `localStorage`                |
| Scheme secrecy          | server-enforced filtering                    | convention + a swap countdown |
| Reveal                  | toggleable intent, committed on phase change | permanent, one press          |
| Hidden scheme scoring   | impossible                                   | possible                      |
| Revealed scheme's boxes | owner only                                   | either player                 |
| Objectives              | own column, Scoring phase only               | active seat's own sheet       |
| Round                   | server phase engine, leader-driven           | manual, Player 1 only         |
| Armies                  | one registered per seat, server-side         | one per seat, tracked live    |
| Finish / statistics     | yes                                          | none                          |

An online seat's army is a **registration**, not a tracked force: the server stores the snapshot
and shows its name, faction and format, but nothing scores damage against it. Hot-seat tracks
Life, stamina and States per copy.

## Open questions

- **Stale placeholder copy.** The lobby still contains _"Round controls arrive in the next
  update."_ for an `active` game — leftover text from an earlier phase. It can only surface if an
  active game's mission content is missing, but it is dead and misleading; remove it.
- **The pending-join nickname is not stripped server-side.** It is placed in every seat's view and
  merely _not rendered_ for a non-leader. Harmless today (a pending join only exists while seat 2
  is empty, so there is no second seat to receive it), but the visibility filter should not rely on
  that coincidence. The pending join also carries the joiner's army, and the leader's
  **"{name} wants to join your game"** popup shows neither — so a leader accepts without seeing
  what list the joiner brought. It appears on the seat card a moment later.
- **Copy inconsistencies around closing.** The dialog text has a stray space before the question
  mark (_"…close the game ?"_), and the cancel button reads **Keep playing** in the lobby but
  **Cancel** in the game view. Pick one.
- **`resultSummary` is computed and stored but never displayed** — the statistics screen renders
  `winner` and `roundSnapshots` directly. It exists purely for the future server-side KPI export;
  worth confirming nothing on screen was meant to use it.
- **The event stream accepts any game status**, so a client can hold an open subscription to a
  finished or closed game. Benign (no further notifications arrive) but it keeps an `EventSource`
  alive until the player leaves.
- **Statistics export is still unbuilt** — the deferred phase that would make `resultSummary`
  queryable. Until it exists, finished games are retained 90 days as a bridge.
- Should the leader be able to **hand over leadership** on disconnect? Today a leader who never
  returns leaves the game stranded until cleanup auto-finishes or deletes it.
