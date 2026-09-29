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
- **Seat cards**: Player 1 (sky, with a **Game Leader** badge) and Player 2 (orange). Each shows
  that player's **army** — name, faction in its colour and a **Standard**/**Roster** tag — and a
  **Ready** row. Empty seat 2 reads **"No Player 2, invite someone"**. The opponent's army **code
  never leaves the server**, so a seat card cannot be used to import somebody else's list.
- **Ready** (per seat, lobby only): your own row is a toggle button reading **Ready** and then
  **Ready ✓** (`aria-pressed`), so it can be taken back. The other seat's row is a read-only chip
  — **Ready** in emerald or **Not ready** in slate — because nobody can ready anybody else. The
  row disappears once the game has started; readiness is spent.
- A read-only **mission preview** follows, with every panel collapsible and its Results showing
  no boxes at all plus the note _"Objectives unlock once the game has started."_
- **Start Game** (leader only, at the bottom) — disabled until **both** seats are ready. While it
  is disabled a hint under it names whichever gate is still missing, in the order it can be acted
  on: _"Waiting for a second player to join."_ → _"Press Ready to continue."_ → _"Waiting for the
  other player to be ready."_ Player 2 sees no Start button, only _"The game leader starts the
  game once both players are ready."_ Schemes are **not** part of this gate any more; they are
  chosen after the armies are prepared.
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

## The army reveal

**Start Game** opens the **Army Reveal** — the rulebook's "players reveal their Faction" and "reveal
their Roster" as one moment. Both seats' registered armies flip open at once and stay open for the
rest of the game. Each panel shows the army badge and, for a **Roster** registration, a **View your
roster** / **View their roster** button opening a read-only browse of the full 125-point list:
units, mounts and the equipment pool, every row and pool entry opening its rule card. The browse
says plainly that it is _"the roster as it was registered — not the match list built from it."_

A **Standard** registration gets no browse button, only the note _"Fields a Standard list — its
contents stay secret until deployment."_ That asymmetry is the rulebook's, not ours: step 4 reveals
the _roster_, and for a Standard player the registered list **is** the party, which step 5 keeps
private. Revealing it here would hand over the match list before deployment.

**Continue to army preparation** belongs to the leader and is the only way out; there is no way
back, and what was revealed stays revealed — the browse buttons follow onto the preparation screen.

## Preparing the armies

**Continue to army preparation** opens **Army Preparation**, because a match is 85 points and a
seat may have registered a 125-point Roster.

The screen shows both seats. Each panel carries the registered army's badge (name, faction, its
**Standard**/**Roster** tag) and a status: **Combat ready** in emerald, or **Needs a match list** in
amber.

- A seat that registered a **Standard** army is combat-ready on arrival, with the note _"Your
  registered army is already a legal match list."_ There is nothing for that player to do but wait.
- A seat that registered a **Roster** gets **Create army out of a roster**, which **borrows the army
  builder**: it opens on the builder itself with the roster loaded as a budget, **← Back** instead of
  ← Main Menu, a _"Cut down from your roster"_ tag where the format tabs were, and **Accept** where
  Copy Army Code and Save Army were. Only the units, mounts and equipment the roster held are
  offered, and Accept refuses an empty or over-cap list, saying why. See
  [08-army-builder.md](./08-army-builder.md#cutting-a-roster-down-to-a-match-list).
- Accepting returns to this screen, now reading **Combat ready**, with the match list badged below
  the registered one and an **Edit match list** button. **The cut stays editable until the table
  moves on** — leaving preparation is what makes it final.

Once combat-ready, a seat assigns its **Leader** from the same screen: a **Your Leader** list of
every copy in the match list, each row showing its name and its **M** and **INT**, chosen with a
single tap and changeable until preparation ends. **Any** copy may be the Leader — Stratagems are
restricted _to_ the Leader, not the Leader to Stratagem-bearers — and the list carries the rule the
choice exists for: _"Only your Leader may use Stratagems. The M and INT shown here become visible to
your opponent at Scheme selection; which model it is stays yours."_ Re-cutting the match list clears
the choice, because a new list renumbers its copies and the old pointer would dangle.

The opponent's panel shows the same status and never the list: a combat army's code is that seat's
secret, exactly like the registered one's.

**Proceed to the mission** belongs to the leader and unlocks when **both** seats are combat-ready
**and both have named a Leader** — the Leader is what gives a seat its intelligence, so a seat
without one could never draw. Until then the hint under it names whichever of the four gates is
still open, in order: _"Waiting for a second player."_, _"Prepare your army to continue."_,
_"Choose your Leader to continue."_, _"Waiting for the other player to prepare their army."_,
_"Waiting for the other player to choose their Leader."_ The opponent's panel mirrors the last two
as _"Preparing their army…"_ and _"Choosing their Leader…"_. Non-leaders read _"The game leader
continues once both armies are combat-ready."_

## Scheme selection

Proceeding opens **Scheme selection**. Both halves of the draft are already fixed and shown
read-only: the **faction** is the one the combat army belongs to, and the **intelligence** is the
Leader's declared INT. There is no faction dropdown and **no intelligence input** — the draw count
is the one number a player could inflate, so it is derived from a value that is already public (the
Leader's INT, published at this very step) rather than typed. `leavePrep` seeds both into the draft,
and the server draws from what it seeded, so no client input touches the count.

> Oni Clans and Goblin Wartribes are army factions with no Scheme deck of their own; both draw from
> **Monster Factions**, the deck the scheme data has always kept for them.

Each player, independently:

1. presses **Draw Missions** — the draw happens **server-side** from the seeded intelligence, and
   the resulting hand is persisted per seat,
2. picks one card.

Draw counts follow the standard brackets (≤ 13 → 2, 14–15 → 3, ≥ 16 → 4); see
[04-schemes-panel.md](./04-schemes-panel.md). The local modes still type their intelligence in,
having no Leader to take it from.

**Begin Round 1** belongs to the leader and unlocks once both seats have chosen; the hint under it
names whichever is missing. Choosing is not the same as being locked in — a player may delete and
re-choose while this step is open.

**What the opponent sees here:** their **faction**, plus _"Choosing a Scheme…"_ until a card is
picked, and — from this step on — **their Leader's M and INT**, as _"Their Leader: M {m} · INT
{int}"_. Which copy it is never travels; the exposure exists for the initiative roll the rulebook
puts at step 8, and stops at the two numbers. Neither the drawn hand nor the chosen card is
transmitted.

## Playing: the tracker

**Begin Round 1** opens the tracker — the same groundwork as the solo and hot-seat trackers: a
`ScreenHeader` carrying the mission name and a four-way sliding spotlight switcher, **P1 Scoring /
P2 Scoring / Army / Mission**, swipeable left and right like the others. Under the header a shared
score bar shows `Round {n} / 5`, the running score in the seat colours, and — for the leader only —
the one button that moves the game: **Advance to next round**, reading **Conclude game** on round 5.

### The scoring views

One view per seat, labelled by seat and coloured by it. Your own is editable; the other seat's is
read-only — its boxes inert, its scheme _"Hidden Scheme"_ until revealed. Each view is three
panels, top to bottom:

- **{seat} Scoring** — one line, _"{name} is Player 1"_. No total: the running VP for both seats
  is already in the score bar above the views, and repeating it here would only invite the two to
  disagree.
- **Scheme Results** — the seat's scheme: the card and, while hidden, a **Reveal** button on your
  own view (the opponent's hidden scheme shows nothing but the label); once revealed, the card
  with its increment boxes, editable only on your own view.
- **Results** — the grouped per-round cards, editable only on your own view.

Objective counts are cumulative across rounds — nothing is discarded when a round ends.

### Revealing a scheme

**Reveal** is available at any moment of any round, and it is neither a toggle nor an intent:
pressing it opens a confirmation — _"Reveal your scheme? Your opponent will see it and its boxes
unlock. This cannot be undone."_ (**Reveal** / **Keep it hidden**) — and confirming reveals the
scheme immediately, on both devices, forever. There is no phase that commits it and no way back.
Revealing unlocks that scheme's boxes; **a hidden scheme earns no Scheme VP at all**, so the
trade-off is secrecy versus scoring, exactly as on a table.

### The Army and Mission views

**Army** is, for now, an empty list — _"Nothing tracked here yet."_ — a placeholder for the per-copy
tracking planned for it. **Mission** is the read-only mission: description, setup, map and quest
rules, with the Broken Morale / Ceasefire rule cards opening from their labels.

**Advance to next round** snapshots both players' cumulative VP for the round (this feeds the
statistics table) and opens the next one. Objectives stay editable throughout a round — there is no
freezing and no sub-phase — and non-leaders see no advance button at all.

## Concluding and the scoring board

On round 5 the leader's button reads **Conclude game**. It snapshots round 5, **auto-reveals** any
scheme still hidden so the totals are traceable (auto-reveal does _not_ retroactively award VP,
since those boxes were never ticked), computes the winner and writes the result summary. The game
is over: no further mutations, no joins, nothing left to advance.

The **scoring board** replaces the tracker on every device:

- **Winner banner** — `Victory for` / faction name / player name, in the winner's seat colour, or
  **Draw**.
- **Round Statistics** — a table of rounds 1–5 × both players, each cell that player's
  **cumulative VP at the end of that round** (an em dash where no snapshot exists).
- **Both seats' scheme cards** — player name and faction, the (now revealed) card and its rule
  text, and its increment boxes read-only; _No scheme_ if none was chosen.
- **End game** — each player presses it **separately**, on their own device, when they are done
  reading. It is a local leave: it clears the seat session and returns to the main menu, while the
  concluded game stays on the server for its retention window and the other player's board is
  untouched.

There is no rematch or room reuse.

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
- A reload lands on whichever step the server says the game is on — preparation, Scheme selection
  or a round — because the screen follows the fetched state rather than the last click. An
  in-progress **cut** is the exception: it lives only in the borrowed builder, so a reload during
  one abandons it and the seat is back to "needs a match list".

## Visibility rules (server-enforced)

| Data                              | Owner sees          | Opponent sees                 |
| --------------------------------- | ------------------- | ----------------------------- |
| Player names, seats, leader badge | ✓                   | ✓                             |
| Army name, faction, format tag    | ✓                   | ✓                             |
| Roster contents (units, pool)     | own, always         | from the reveal on            |
| The cut match list                | own, with its code  | **only the flag**             |
| A Standard list's contents        | own, always         | **nothing until deployment**  |
| Leader identity                   | own                 | **nothing, ever**             |
| Leader M and INT                  | own                 | from Scheme selection on      |
| Combat-ready flag                 | ✓                   | ✓                             |
| Scheme faction (from the army)    | ✓                   | ✓                             |
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
`schemeFactionForArmy()` is the bridge: it passes the five shared ids through and sends both
monster army factions to the deck they share.

Readiness and combat-readiness are public even though nothing else about the preparation is,
because both gate a **leader** button — hiding them would leave that button locked for a reason no
client could name.

The one code that does travel is a **roster's**, and only once the game is running: the reveal is
the rulebook's step 4, and a roster is not a match list, so publishing it leaks nothing about the
party being cut from it. A Standard registration's code never travels, because for it the two are
the same list. The cut's code never travels either. Deployment — the rulebook's step 10, where a
physical table would see both parties — is not modelled, so a Standard player's list stays secret
for the whole match; that is recorded as an open question below.

## Differences from hot-seat

|                         | Online                                                 | Hot-seat                      |
| ----------------------- | ------------------------------------------------------ | ----------------------------- |
| Source of truth         | server                                                 | `localStorage`                |
| Scheme secrecy          | server-enforced filtering                              | convention + a swap countdown |
| Reveal                  | one confirmed press, any time in a round, irreversible | permanent, one press          |
| Hidden scheme scoring   | impossible                                             | possible                      |
| Revealed scheme's boxes | owner only                                             | either player                 |
| Objectives              | own view, editable all round                           | active seat's own sheet       |
| Round                   | server round engine, leader advances                   | manual, Player 1 only         |
| Armies                  | a registration **and** a cut combat list, server-side  | one per seat, tracked live    |
| Finish / statistics     | yes                                                    | none                          |

An online seat's armies are **registrations**, not tracked forces: the server stores the snapshots
and shows the registered one's name, faction and format, but nothing scores damage against them.
Hot-seat tracks Life, stamina and States per copy.

## Open questions

- **The pending-join nickname is not stripped server-side.** It is placed in every seat's view and
  merely _not rendered_ for a non-leader. Harmless today (a pending join only exists while seat 2
  is empty, so there is no second seat to receive it), but the visibility filter should not rely on
  that coincidence. The pending join also carries the joiner's army, and the leader's
  **"{name} wants to join your game"** popup shows neither — so a leader accepts without seeing
  what list the joiner brought. It appears on the seat card a moment later.
- **`resultSummary` is computed and stored but never displayed** — the statistics screen renders
  `winner` and `roundSnapshots` directly. It exists purely for the future server-side KPI export;
  worth confirming nothing on screen was meant to use it.
- **The event stream accepts any game status**, so a client can hold an open subscription to a
  finished or closed game. Benign (no further notifications arrive) but it keeps an `EventSource`
  alive until the player leaves.
- **Statistics export is still unbuilt** — the deferred phase that would make `resultSummary`
  queryable. Until it exists, finished games are retained 90 days as a bridge.
- Should the leader be able to **hand over leadership** on disconnect? Today a leader who never
  returns leaves the game stranded until cleanup auto-finishes or deletes it. It is now stranded in
  more places than it used to be: a leader who vanishes during **Army Preparation** or **Scheme
  selection** blocks the table just as surely as one who vanishes mid-round, and neither step has a
  timeout.
- **The cut match list keeps the registered army's name.** Both badges on the preparation screen
  then read identically apart from their format tag, which is thin evidence that the cut worked.
  Whether a cut should be named separately (or show its point total, which needs the catalogs the
  server does not have) is open.
- **A combat army's legality is the client's word.** `/combat-army` checks that the payload is a
  Standard `PickedArmy` and that the seat had something to cut, but the server has no army
  catalogs, so "≤ 85 points" and "only what the roster held" are enforced by the borrowed builder
  alone. The code is only ever echoed back to its owner, so a tampered client hurts nobody but
  itself — the same ruling the tournament join already made.
- **Deployment never reveals a party.** The rulebook's step 10 puts both armies on the table, but
  our mission screen shows no armies at all — so a Standard player's list stays secret for the
  whole match and a cut stays secret forever. Whether the game view should show both combat lists
  once round 1 begins (the physical-table equivalent) is open, and it is the reason a Standard
  registration has no browse button on the reveal screen.

Resolved since the last revision: the lobby's stale _"Round controls arrive in the next update."_
placeholder is gone (an `active` game with missing mission content now says so), and the close
confirmation reads _"Do you really want to close the game?"_ with **Cancel** on every screen that
offers it.
