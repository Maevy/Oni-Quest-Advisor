# Session archive

What was built, release by release. **`git log` is the authoritative record** — this file is
the index into it, not a copy of it. Each entry says what shipped, which of its decisions and
traps are still load-bearing, and the commit range to read for the full story.

This replaced the per-session log that used to make up ~93% of `PROGRESS.md` (about 1870
lines of it). Compressing rather than moving it verbatim was deliberate: commit messages in
this repo are already multi-paragraph essays (the last 60 alone run to 74 KB), so a verbatim
copy would have duplicated `git log` and started rotting the day it was written — the old log
had already grown stale references to components that no longer exist. The uncompressed
original is still in history: `git log --follow -- PROGRESS.md`.

`PROGRESS.md` now carries only the live state: where things stand, what is next, and the traps
worth knowing before touching the code.

---

## v0.9.0 — the online rebuild, tournaments, flowers and reports (2026-10-13, 56 commits)

Two features landed in this order and neither is deployed: the tournament, then a ground-up
redesign of the online front door; the Battle Flowers, the interaction log and both reports
followed on top. **Read the deploy warning in `PROGRESS.md` before shipping either** — the
online half needs the production database wiped, and a wipe is database-wide, so it takes the
tournament tables with it.

### Tournament (`9367fc1`…`19d7fea`, 9 commits)

A Tournament Organizer configures an event, invites players by link or QR, assigns pairings
and starts rounds. Built in five steps, each shipped behind the previous one.

- **Configuration wizard** (`9367fc1`, `566e201`, `134cc3e`) — a red **Organize Tournament**
  entry on the mode select, then a local three-pane wizard on `TournamentDraft`
  (`domain/tournament.ts`): basics (name, external link normalized to http(s), organizer,
  "TO also plays" revealing a Roster army pick), Missions & Tables (Add Quest popup, one
  editable name per table, count derived as half the field), and a read-only Overview
  (`TOURNAMENT_SETUP_STEPS`, `previousTournamentStep()` as the only back rule). Nothing is
  persisted or sent while configuring.
- **Server-side creation, lobby and joining** (`75a4627`) — `TournamentState`
  (`domain/tournamentEvent.ts`) with `createTournamentEvent`/`joinTournament` guards and the
  `viewForTournamentToken`/`peekTournament` visibility filters; `tournaments` +
  `tournament_events` tables; `tournamentRepository.ts` mirroring the games repository (one
  write transaction per mutation behind its own FIFO queue, so concurrent joins cannot
  double-book a seat); `sse.ts` became a registry factory shared by games and tournaments.
  Create Tournament first shows the retention notice — data kept 48 hours _after it
  concludes_ so a report can be generated — and only a proceed from that makes the first
  server call.
- **Resume and abandon** (`ff0ab26`) — a stored seat session produces a startup **prompt**
  rather than dropping the device in, and it is the third startup claim (after the online
  seat, before the local game). Abandon is the only way out and always reaches the server:
  `leaveTournament` frees a player's seat (lobby only — a seat in a running pairing needs a
  forfeit rule that does not exist yet), `cancelTournament` is the organizer's and sets
  status `closed` with **seats kept** so every open device still authenticates and can be
  told what happened instead of meeting a bare 404. The lobby's ← Return opens the same
  prompt; there is no local-only exit any more, because that is what stranded seats.
- **Starting and match prep** (`8c5a293`) — `/start` needs ≥ 2 registered players with at
  most one seat empty; `/assign` and `/start-round` drive the `tournament-round` screen,
  which every device reaches by following the event **status**, not a click.

**Worth remembering:**

- **The QR symbol is encoded in-app.** `npm install` is blocked on this machine, so
  `domain/qr.ts` is a from-scratch byte-mode, EC-level-M, versions 1–6, mask-0 encoder
  rendered as SVG — nothing about a join link goes to a third-party generator, which matters
  because the link _is_ the credential to join. Verified by an independent in-spec reader, by
  jsQR decoding the rendered symbol, and by diffing codewords against a third-party encoder.
  That verification found two real bugs: the timing pattern was drawn over the finder rings,
  and the RS generator multiplied by x in the wrong direction.
- **The BYE is a first-class occupant**, `{ kind: 'bye' }` next to `{ kind: 'seat',
seatIndex }`, assigned by the organizer like any player. This settled the long-open "who
  takes the BYE" question as _the TO's choice_; what a BYE win is worth in points is still
  open.
- **The assignment gate is not just "everybody assigned".** With four tables and six players,
  2/2/1/1 assigns everybody and still strands two of them without an opponent, so a table
  holding a single occupant blocks Start Round.
- **Table assignment needs two input paths.** HTML5 drag-and-drop does not exist on touch, so
  there is pointer-event dragging _and_ tap-a-chip-then-"Place here" — and only the second is
  keyboard/screen-reader reachable, and only the second works when the pool and the target
  table are not on screen at once.
- **`payload.tableIndex ?? undefined` was a bug**: `null` means "back to the pool" and
  collapsing it into "missing" made unassigning 400. A `null` that carries meaning must not
  go through `??`.
- **Svelte eats whitespace at an inline `{#if}` boundary** — `every player{#if odd} and the
BYE{/if}` rendered as "playerand the BYE". Recorded in `src/lib/components/CLAUDE.md`.
- **Chromium's `URL` accepts `https://not a link`** (percent-encoding the spaces into the
  host) where Node throws, so link validation that only parses is engine-dependent. The
  domain rejects whitespace before parsing and a unit test pins it for both engines.

### The round plays: `game`, `scoring` and the conclusion (2026-10-02)

The round's `game` and `scoring` phases got their content: a table's match became an ordinary
online game the tournament owns, the organizer got a megaphone, and the event learned to end.

- **Enter Game** — a table's match is created by the first of its two players to press it, with
  **both seats filled** from the registrations (`createTournamentGame`), the round's mission and
  its season; the second press takes the other seat. No join code, no approval, no mission to
  pick: the pairing was already decided. From there the pair walks the ordinary online flow, and
  the match's exits come back to the board (`Return to Tournament` on the score screen, the
  header's Return, and a silent tournament resume when a device reloads into its match).
- **The game id is derived** — `CODE-R{round}T{table}A{attempt}` — which is what makes Enter Game
  idempotent and race-free: two devices pressing at once aim at one row, and the second insert
  meets a primary-key conflict instead of opening a rival table. `/enter-game` also **re-mints the
  caller's seat token**, the recovery path for a device that lost its session (the old token dies,
  which is the same one-token-one-seat rule a join lives by).
- **Results report themselves.** A finished game folds its VP into the round
  (`recordTableResult`, idempotent — a retention auto-finish and a leader's last click can both
  arrive), the standing is **cumulative across rounds**, and the round moves to `scoring` by
  itself when its last table reports. The organizer's **Next Round** archives the round into
  `completedRounds` (the report's raw material) and opens the next mission; **Conclude
  Tournament** ends the event onto the final standing — gold, silver, bronze and grey, ties
  sharing the higher place.
- **A dead table replays** (a closed game bumps the table's `attempt`, giving the replay a fresh
  id); there is deliberately **no organizer score override**. A BYE table is settled at round
  start with **5 VP**, so it never holds a round open.
- **The megaphone** — per-table composers on the board plus a broadcast in the organizer's
  header; a player's inbox lives in the header of the board _and_ of all six online screens,
  glowing yellow with a count while unread, grey once read, closing on a press outside. Messages
  belong to the round they were sent in and carry per-seat read state.
- **A concluded event frees no seat**: its exits are local, because a freed seat would drop that
  player out of the archived standing the 48-hour report window exists to keep.

Traps this pass added to the collection:

- **Vite full-page-reloads every connected browser on any write under the project root** —
  including a throwaway `.mjs` harness in `.qwen/tmp/`, which made mid-journey devices drop back
  onto the startup prompt and read as a flaky app. Harnesses live outside the tree now.
- **"Press outside the popup" must click something inert.** The first attempt clicked mid-page
  and landed on a table panel's Enter Game, walking the test device into its match.
- **A re-minted token retires the old one**, so a harness that keeps the first Enter Game's
  session and presses again gets a 401 on the old token — correct behaviour, surprising test.

**Next, agreed but not built:** the tournament report — `completedRounds` holds everything it
needs and the **Prepare Tournament Report** button is on the conclusion screen, inert.

### The online redesign (`da407c1`…`4ddd789`, 17 commits)

The online mode's front door was inverted, its opening grew two preparation steps, its rounds
lost their sub-phases, and its game view became a tracker.

- **A game is born set up** (`ba18257`) — the create screen is a **frontend-only draft**
  (player name, season → mission, army) and **Open Lobby** is the first server call. Gone
  with the old flow: `canSelectMission`, `selectMission`, `/select-mission` and the lobby's
  Mission Selection card. The joiner does the same, so **both seats arrive with an army**
  (`PendingJoin` carries it through and `acceptJoin` seats it).
- **Readiness** (`283e14e`) — `OnlineSeatState.ready`, toggled by its own seat only and
  public in the filtered view, because the leader's Start Game is gated on it and hiding it
  would leave that button locked for a reason no client could name.
- **The borrowed builder** (`2f9d17d`) — `domain/armyConstraint.ts` cuts a Roster
  registration down to a legal 85-point Standard list, enforced through the seams that
  already existed (`entryUpgradeBlock`/`addEntryUpgrade` gained an optional constraint and a
  `'roster'` reason; the store's `units`/`upgrades` getters filter to the roster's ids).
- **Army Preparation and Scheme Selection** (`abf7779`) — a seat carries `combatArmy` next to
  its registered `army`; `createEmptySeat` sets it to the registration when that is already
  Standard and to `null` for a Roster, which is exactly what makes a seat read _"Needs a match
  list"_. `leavePrep` seeds the Scheme **faction from the combat army** as a transition rather
  than a client call, so no seat can draw from a deck its army does not belong to.
- **The army reveal** (`d70a853`), **the Leader** (`cdeb5ce`) and **the Leader's
  intelligence** (`d473b25`) — rulebook steps 3, 4 and 6.
- **The match became a tracker** (`a03faaf`) — `OnlineTracker` on the shared groundwork, and
  `OnlineGamePhase` collapsed to `armies | prep | setup | playing`.
- **Muted text moved up two steps app-wide** (`4829725`) and **one top bar everywhere**
  (`c10cdae`, `f23ec18`, `6c222de`, `a67a71a`).

**Worth remembering:**

- **The Roster format is no longer internally named `'tournament'`** (`da407c1`), because
  `ArmyFormat`'s second value collided with the tournament feature's vocabulary just as the
  redesign put a format into server payloads for the first time. It is `'roster'` behind a
  **decode** migration, not a data one: `encodeArmy` writes `r`, `decodeArmy` accepts both `r`
  and the legacy `t`, and `savedArmyFormat()` folds a stored `'tournament'` string — so no
  saved-army record is rewritten and a code shared before the rename still imports. The
  fingerprint is catalog-derived and was untouched, which is _why_ old codes still decode
  instead of failing as `roster-mismatch`. The `'tournament'`/`'tournament-join'` **slot ids**
  name the wizard's army slots, not the format, and stayed.
- **`startGame` is a total function, which is the trap.** A caller that forgets readiness gets
  no error — it silently keeps a lobby. `cleanup.spec`'s synthetic journey would have gone on
  passing its retention tests for the wrong reason. Every fixture that starts a game goes
  through a `readyUp()` helper.
- **The cut's budget is only three counts** — copies per unit, **mounted** copies per unit,
  and assignable copies per upgrade id. That is all a roster's `{ id, qty }` equipment pool
  can express: it is a shopping list with a price, not an equipped state, and nothing in the
  codebase ever resolved "Pouch ×2 in the pool" onto a model. The mounted-copies rule (a
  mount picked in the roster may be deselected, one never picked may never be added) is a pure
  ceiling, so no entry has to be traced back to the copy it came from and unmounting gives the
  budget back.
- **The point cap stayed soft.** The free builder has always let a list overshoot and shown the
  total in red, so `acceptCut()` refuses an over-cap list instead of the `+` buttons blocking.
- **`borrowArmyBuilder()` exists because `leaveArmyBuilder()` hard-coded `game-mode` _and_
  called the store's `leave()`** — borrowing the builder from a live match would have dumped
  the player out of the match and wiped the list they were cutting.
- **Preparation steps are phases, not statuses**, because `cleanup.ts` buckets retention by
  status literal — a new status would match no bucket and leak forever.
- **A `factionId` in a `/draft` body is a 400, not a silent ignore.** `/draft` was narrowed to
  intelligence and then deleted outright once the intelligence came from the Leader.
- **`schemeFactionForArmy()` is the monster-faction bridge** (`domain/faction.ts`): five of the
  seven army ids are also scheme ids, but **Oni Clans and Goblin Wartribes have no scheme deck
  of their own** — they are the two halves of the scheme data's Monster Factions and share its
  deck. Resolving an army faction against the scheme catalogs without the mapping finds
  nothing for exactly those two. The related trap: `PublicSeatState.factionId` is a **scheme**
  faction (6 ids) while an army's is an `ArmyFactionId` (7 ids); they overlap on five and
  resolve against different catalogs, so the army faction had to be its own field.
- **A Standard registration's code is withheld forever.** `toPublicSeat` publishes
  `rosterCode` only when the game is out of the lobby **and** the registration is a Roster,
  because for a Standard seat the registered list _is_ the match list and the rulebook keeps
  parties secret until deployment. Hence the deliberate asymmetry on screen. `toPublicSeat`
  takes a `SeatReveal` record so a caller cannot forget to decide either half.
- **`ArmyView` never carried the equipment pool** — the tracker only ever rendered Standard
  lists, so a browsed roster showed its units and silently dropped half its points. It carries
  `picks` and an `upgradeIndex` now.
- **The client declares the Leader's M and INT** with the assignment, because the server loads
  no army catalogs and cannot compute effective stats from a code — the same "client's word"
  ruling army legality rests on. Only those two numbers are published, only from `setup` on,
  and the identity never travels. A re-cut clears the leader (a new list renumbers its copies
  on decode and the old `entryId` would dangle).
- **The intelligence is the Leader's, so nobody types it.** The setup screen's input was a
  second, private, contradictable copy of a number the app already knew and published: a
  player could type 20, draw four cards, and the opponent would never see it. All 56 bundled
  models have an INT, so a null-INT Leader is unreachable in practice.
- **Revealing a scheme is a one-way seat action at any moment** in a running round, behind a
  confirmation. That deleted `revealIntent`, `toggleRevealIntent`, `advanceToScoring`,
  `bothSchemesRevealed`, `/reveal-intent` and `/finish`.
- **`slate-400/500` survive only as _state_ colours** after the palette pass (inactive tab
  segments, off-state glyphs, the locked-round and "Not ready" chips, disabled buttons). Eight
  sites were restored by hand, because a find-replace that brightens an inactive tab also
  deletes the distinction it exists to draw. Nothing readable sits below `slate-300` now;
  `01-visual-theme` records the floor and the exception list.
- **Wiring the header's Return to the store's `leave()` would have stranded seats** (session
  token cleared, server game alive). Return on a live screen keeps the session; only terminal
  exits drop it.
- **A reload into a live game never loaded the army catalogs** — nothing but the create/join
  pickers did — leaving the roster browse and the Leader picker silently empty.
- **Stores are unit-testable.** The `sveltekit()` vite plugin applies the runes transform under
  vitest too, so a `$state` class instantiates in the node environment;
  `armyBuilder.svelte.spec.ts` is the working example. Its fixtures are built from whatever the
  bundled content offers rather than naming unit ids, and one recorded a fact the first attempt
  got wrong: **no single unit reaches 85 points at its copy limit**, so building an over-cap
  list takes several.

**Open questions** (all in `docs/functional-spec/07-online-two-player.md`): the cut keeps its
registration's name, so the two badges on the prep screen read identically apart from the
format tag; a combat army's **legality is the client's word**; a vanished leader now strands a
table in two more places, neither with a timeout; **deployment never reveals a party** — the
rulebook's step 10 puts both armies on the table but our mission screen shows none, so a
Standard player's list stays secret for the whole match; and the **initiative roll** (step 8)
is still unmodelled, its formula and prize being rulebook text we do not have, though the
exposure it exists for (the Leader's M and INT) is already in place. Still deferred: the
leader's accept popup cannot show the joiner's army, `pendingJoinNickname` is only hidden
client-side, and online's resume/leave flow is not aligned with the tournament's
prompt-and-abandon pattern.

### 2026-10-05 — two fixes and the Battle Flowers

- **Slayer's Blade's granted traits had no popups.** The producer wrote that one item effect as
  plain text — a scan of every rich-text segment in the generated content found it to be the
  only unlinked grant list in the catalog — so a third `SOURCE_LINK_FIXES` entry repairs the
  markup before parsing; the regenerated `items.json` gains exactly one changed effect.
- **The army builder's header floated centred over its full-bleed body**, the one screen whose
  panels are not `max-w-xl`. `ScreenHeader` gained a `wide` prop that drops the centred column
  so Return lines up with the panel edge; every other screen keeps the column.
- **Battle Flowers**: hot-seat's two army panes became a single **Army** view (the switcher is
  now Scoring / Army / Mission) holding one panel split into a sky and an orange half. Every
  copy is a flower — the icon in a circular orb with one thin ring flush against it: Stamina
  boxes yellow on the left half, Life red on the right, a lost point an empty box with its
  coloured rim from the bottom end, an overhealed Life repainting blue from the top end instead
  of growing the ring (`vitalityRingStates`). Clicking a flower **focuses** it: the screen
  blurs, a 1.3× clone glides from the slot to the viewport centre and the other flowers fade;
  once landed, a ring of eight **petal buttons** (damage / heal / status × self / enemy / ally,
  tinted red / emerald / violet) blooms out from behind the flower, and dismissing retracts the
  petals before the flower glides home. The clone lives at the screen root because the sliding
  strip's transform would trap a `fixed` overlay inside the pane. Petal icons and functions are
  the next session's work; until then hot-seat cannot edit Life, stamina or States at all — the
  vitality menu went with the army panes it lived in.

### 2026-10-06 — the petals grow hands (98e4c26)

- The six petals got their **glyphs** (grey bang in a ring for the card, red sword, green medic's
  cross, orange star to assign and light-blue one to remove a status, yellow disc for Stamina)
  and the first two functions. Damage and heal share one shape: pressing the petal blooms a
  **third ring** of amounts (1…6 and X, painted behind the action ring so it emerges from behind
  it; X opens a small amount entry), an amount brings the field forward as a target row under the
  flower — the living copies for damage, every copy below its overheal cap for heal, seat rims
  and copy badges, the focused copy's twin among them so a model can act on itself — one tap
  selects under a turning green crosshair, the second confirms, the flow's glyph flies to the
  target and its Life boxes walk one by one before the overlay closes with the change committed.
- **Worth remembering:** the amount ring _is_ the third ring (petals 47–61, amounts 64–76 in the
  overlay's 125-unit box), so anything new that wants a radius has to take it from somewhere. The
  row hangs at `top: calc(50% + width × 1.05)` with `max-h-[34dvh]` — on a 640 px-tall phone it
  already ends past the bottom edge, which is why pushing the rings outward is not free. The hit
  commits the moment the glyph lands, so the row renders from a **snapshot** taken when the amount
  was chosen; rendering it from the live views would change every affected box at once mid-fade.

### 2026-10-07 — the status flow: a band on the strip, a ring of States at the centre

- The States a copy carries now hang off its strip flower as a **band of orbs on the upper arc**,
  just outside the vitality ring — own glyph in its own colour (`StatusGlyph`), a `+n` chip once
  more than four would not fit the arc, absent on a clean copy, display-only. The band is capped
  and the panel's flower gap is `gap-5` because the topmost orb reaches ~16 px past the flower's
  box, into the gap.
- The assign/remove petal pair **collapsed into one orange star**: the ring it opens both assigns
  and removes, so a second petal would only be a second door into the same room. Five petals now.
- The status flow is the first that **moves the focus**: the star's row holds every copy of both
  seats (States are not a function of Life), one tap — not two, because the ring is reversible and
  has its own commit — moves the focus onto that copy. The overlay keeps one instance and _swaps
  its displayed flower_: the wrapper's `left/top/width` and its centring translate transition
  together, so changing the anchor mid-flight moves nothing, and on close the flower glides home
  into the **target's** slot. The flower the overlay opened from stays **lit** in its slot (a new
  `undimmed` on the panel, keyed by seat _and_ entry because two seats may field the same save).
- All fifteen States bloom around the target as tappable 44 px orbs on a radius fitted to the
  smaller screen dimension. Nothing competes for that radius: the petals went home with the flower
  they belonged to, and this flow has no amount ring. Taps edit a **draft**; the model icon
  commits it — first tap arms the crosshair, second writes the whole draft in one go — and
  toggling an orb disarms a pending commit. Escape and click-outside discard.
- **Worth remembering:** `setUnitVitality` runs every commit through `applyZeroHpStates`, so a
  status editor that offered to clear Incapacitated or Crouched on a 0-Life copy would show the
  tap silently undone. The ring therefore **locks** those two orbs while Life is 0, and
  `ZERO_HP_STATUSES` / `statusLockedAtZeroHp` share one list with `applyZeroHpStates` so the lock
  and the rule cannot drift (a spec asserts both directions). Verified end to end in a real
  browser (45 assertions: the flow, the draft discard, the lock, the `+n` chip, and the
  damage/heal regression after the petal count changed).

---

### 2026-10-08 … 10-13 — two dialogs replace the petals; the flowers carry to solo and online; the log and the reports

- **The petals are gone** (`07d27ac`, `5300018`, `a396896`, `f9323e1`): a **tap** on a flower
  opens the **Self Interaction dialog** — the cross-model shell with one inert model at the top
  and six buttons (Assign Damage / Healing / Status, the inert Buff, Model Info, Activation
  Management) — and a **drag** past an 8 px threshold lifts a measured clone, rings the hovered
  flower with a crosshair and opens the **Interaction panel** on drop (seven actions, friend or
  foe; Stagger spends one activation, Stun every one). Both dialogs reuse the shared amount pad
  and boxed State picker and render at the screen root, because the strip's transform traps
  `fixed` overlays. The target rows and the petal rings they served went with them; a finished
  drag's leftover click is swallowed, and the desktop mouse drags a flower now that the icon no
  longer native-drags (`4542ee7`).
- **Solo carried the board** (`70bd405`): its Army view is the flower board with the same two
  dialogs, committing into `MissionProgress.vitality`; the vitality menu it replaced is gone.
  A muted line under every board names the two gestures (`6f293cb`).
- **The interaction log** (`9d2dbd9`): online stores **no vitality at all** — every flower-dialog
  commit appends a `vitality-committed` row to `game_events` (round server-stamped) and both
  devices fold the log into their boards (`foldHistory`), so the log *is* the state and the
  battle report later folds the same rows. An undo appends a `vitality-reverted` the fold skips:
  **actor-only, and only while their action is still the last one**. The opponent's half of the
  board arrives through `POST /roster` — each seat publishes its combat list as board entries
  once the round runs, once only, because the server cannot derive entry ids from a code; the
  composition opens at play, the importable code never travels. Above the board a history strip
  previews the latest sentence; tapping it opens the round-grouped dialog with the Undo button.
- **The reports** (`c36bd2b`, `51a4932`): `domain/pdf.ts` is a hand-written PDF 1.4 writer —
  no dependency may be installed — deterministic, uncompressed streams, Helvetica widths for
  wrapping. The **battle report** (finished online screen) carries code, match date, mission
  with a vector map thumbnail, both armies, rounds with scores and interactions, and the
  damage/healing rankings; the **tournament report** (conclusion screen, organizer-only
  `GET /report`) adds the tournament page, the field with the final standing and the matches
  grouped by round, folding every match's log into the event-wide conclusion. Both are built on
  the device and **persisted nowhere**; both share `domain/reportLayout.ts`.

**Worth remembering:**

- **A reverted action keeps its sentence but no forced-State lines** — it never changed the
  state they describe — and the fold narrates commits whose target entry its bases do not know,
  because a report must list what was recorded even where a board half never published.
- **The composition reveal survives the finish and a finished match still accepts a publish**,
  or a device reconnecting after the last round could never field its half of a report.
- **Dead and Incapacitated never share a copy**: the kill trades the fall's Incapacitated for
  Dead, so a death must not read as "stands back up" — the lift lines fire only on a rise.
- **The PDF's uncompressed streams are the verification story**: poppler is not installed here,
  so the harnesses grep the downloaded bytes; escaped parens (`\(Ada\)`) are the usual surprise.
- **The API limiter is 120 POSTs/minute/IP** — a tournament harness burns it in one journey;
  throttle at ~70 and wait the window out between runs.

---

## v0.8.0 — the hot-seat parity release (2026-09-26, 3 commits)

The 2-player tracker caught up with the solo one. Both local modes now go through the
read-only **Mission Briefing**, whose army slots are per seat in hot-seat (**Pick P1 Army** /
**Pick P2 Army**, seat-coloured panels, and a warning when either seat starts without a
list); the tracker is a four-view **Scoring / P1 Army / P2 Army / Mission** sliding strip
opening on an **Active Player** panel and an inline score panel (two **Player 1/2 Total VP**
blocks, a round stepper only Player 1 may move, and a violet neon **Swap Player** replacing
the drawer's Reset); Results binds to the active seat, which brings the grouped per-round
cards to hot-seat; each army pane is editable for its own seat and frozen for the other; and
the open-game lifecycle now covers hot-seat via a `mode` on the record.

**Worth remembering:** hot-seat's **Reset is gone** — a fresh play is Return → Abandon →
re-pick the mission. `OpenGame` gained `mode`, and records written before hot-seat joined the
lifecycle carry none and read as solo. `PlayerProgress` gained `pickedArmy` + `vitality`,
hydrated **per seat** so old saves get their defaults; online's seats moved to a shared
`SeatProgress` base so the online protocol never carries army state. `CommandPanelTwoPlayer`
and `ResultsPanelTwoPlayer` were deleted. `ScreenHeader`'s actions container wraps, which is
what lets four buttons or a four-up switcher fit a 320 px phone.

Detail: `git log v0.7.1..v0.8.0`

## v0.7.1 — rules-link hotfix (2026-09-14, 3 commits)

The Broken Morale / Ceasefire rule cards render again in the tracker's Mission view. First
bug report against v0.7.0: clicking them dimmed the screen but showed no card.

**Worth remembering:** the dialog was correct, its _position_ was not. `DescriptionPanel`
rendered `RuleCalloutDialog` as a sibling of `Panel`, which escaped the panel's
`backdrop-filter` but not the three-view **sliding strip** — whose `translateX` makes it the
containing block for `fixed` descendants. The backdrop (`inset-0` of a 300%-wide translated
strip) still covered the viewport while the centred card sat off-screen in the strip's middle.
The rule was widened and recorded: **any transformed _or_ backdrop-filtered ancestor traps a
`fixed` descendant**, so the panels now emit `onOpenRule` and all five screens render
`RuleCalloutDialog` at their root.

Detail: `git log v0.7.0..v0.7.1`

## v0.7.0 — the solo view release (2026-09-14, 18 commits)

Thirteen sessions' work: the read-only **Mission Briefing** on the additive v2 Results schema
(`round`/`group`, per-round cards); a working **Start Game** that warns before a run begins
without an army; the tracker rebuilt as a **Scoring / Army / Mission** three-view screen
behind a sliding spotlight switcher with the open-game lifecycle; **Pick Army** attaching a
saved Standard army as a read-only snapshot with per-copy vitality tracks and the vitality
menu (damage, heal with overheal to double, stamina, fifteen States); the shared
`ScreenHeader` top bar; the leveled-grant fix; and the glowing Solo entry button. Also in this
range: Supply Run's rescoring, overlay Escape handling, and the **docs catch-up**
(2026-09-11) that took `docs/` from 7 spec documents to 14 and made it current against the
code for the first time.

**Worth remembering:**

- **The full-height screen rule was established here.** `ArmyBuilderView` and the two local
  trackers are `h-dvh overflow-hidden` roots with a pinned header and per-panel
  `overflow-y-auto overscroll-contain` lists. Going back to `min-h-dvh` lets the root grow to
  the length of the longest panel, which makes the document the one scroller shared by all
  panels and strands the player far below a short panel after scrolling a long one.
- **A leveled grant must not invent ranks**: an upgrade reading "receives the Stealth I skill"
  was granting Stealth II.
- **Overheal leaves the extra hearts lit for a manual cancel** when healing back up — recorded
  as an open question rather than resolved.
- Overlays must render as siblings of `Panel` with the parent holding the open state, or a
  panel's `backdrop-filter` traps them (the defect v0.7.1 then hit again from a different
  direction).

Detail: `git log v0.6.4..v0.7.0`

## v0.6.4 — scoring hotfix (2026-09-11, 2 commits)

Two player-reported bugs around the 1st Round Ceasefire. **"Ceasefire broken" is scoreable
three times** at −4 VP each (red penalty boxes in solo, hot-seat and online, up to −12 VP) —
the penalty is incurred per breach, but `CEASEFIRE_OBJECTIVE` had `count: 1`. And **the
ceasefire missions no longer offer Round-1 VP** (Quarter War lost stronger-presence-round-1
and uncontested-round-1; Awaiting Reinforcements went from 5 to 4 boxes per objective), both
gaining an amber note that players cannot score VP during Round 1. Persisted objective counts
are clamped to the objective count in the VP math so pre-fix saves cannot overcount, and a new
mission-content spec fails when a ceasefire mission ships a Round-1 objective.

Detail: `git log v0.6.3..v0.6.4`

## v0.6.3 — model size + builder scrolling (2026-09-06, 4 commits)

Model size migrated from the producer's `size_info` to a required, ordered `ArmyUnitSize`
literal union (`small`…`epic`, **compared by rank** because every size rule is a ceiling or a
"two Sizes larger" test). Flying Carpet's "Size Medium or smaller" ceiling became an automated
upgrade gate, and **a mounted model counts as its mount's size** (Slayer Dragoon is medium,
huge on Lupus Rex) with a confirmation before an invalidated upgrade is dropped. Also fixed
the army builder's panel scrolling (`h-dvh` containment, `overscroll-contain`, new picks
scrolled into view).

Detail: `git log v0.6.2..v0.6.3`

## v0.6.2 — saved armies, Roster format, phone polish (2026-09-02, 15 commits)

Saved armies (save/load/delete with a Standard/Roster filter), the **Roster format** (125 pts
with a sideboard equipment pool, a guarded format switch, format-aware codes and saves), lazy
army content, resized first-screen portraits, and a phone-polish round (unit-card divider,
compact stepper, header, touch swipe, flip tabs, readability).

Detail: `git log v0.6.1..v0.6.2`

## v0.6.1 — producer-markup hotfix (2026-09-01, 2 commits)

Repaired broken producer markup for Piercing Stream's Armor-Piercing trait link (plus a
`POSION` typo). Roman/numeric level suffixes are now parsed onto links, and popups grey out
the levels above the unit's own.

Detail: `git log v0.6.0..v0.6.1`

## v0.6.0 — the army builder (2026-09-01, 28 commits)

The largest feature after the app itself: faction select, the producer unit import
(`scripts/importUnits.mjs`), unit cards carrying the full rules catalogs (classes, skills,
traits, combat arts, spellcrafts, inventories, stratagems), mounts, standard-mode upgrades
with a picker and choice dialogs, and army codes with roster-fingerprinted export/import.
Built across many sessions — abandoned-game retention, per-copy entries and unit rules,
combat arts and level lists, spellcrafts and spell tables, stratagems/inventories/upgrades,
the Sand Kingdoms selection upgrades, then army codes. Roster format and Save Army shipped as
teasers and were finished in v0.6.2.

Detail: `git log v0.5.1..v0.6.0`

## v0.5.1 — join-accept fix and presentation (2026-08-23, 8 commits)

Join-accept fix, the official Eldfall Chronicles artwork, the neon border, one-time notices
(privacy banner, online intro) and the LF pin in `.gitattributes`.

Detail: `git log v0.5.0..v0.5.1`

## v0.5.0 — online 2-player mode (2026-08-21, 8 commits)

The server-backed online mode in four phases, plus a hardening pass (integrity, security, ops)
and the ops baseline: SQLite on the Fly volume, the SSE registry, seat-token auth, rate
limiting, the mutation queue and retention cleanup. A player-feedback round followed the
release.

Detail: `git log v0.4.1..v0.5.0`

## v0.4.1 / v0.4.0 — hot-seat mode (2026-08-19, 3 commits)

v0.4.0 added two-player hot-seat mode with per-player objectives, hidden schemes and the swap
mechanic; v0.4.1 fixed the scheme draw counts to match the rulebook.

Detail: `git log v0.3.0..v0.4.1`

## v0.3.0 — mode select (2026-08-18, 1 commit)

The game mode select screen, the scheme draw threshold fix and inverted button styling.

Detail: `git log v0.2.0..v0.3.0`

## v0.2.0 — map rulers and the VP cap (2026-08-16, 2 commits)

Nearest-edge map rulers, the 10 VP mission cap, and the Open Hostilities and Awaiting
Reinforcements missions.

Detail: `git log v0.1.0..v0.2.0`

## v0.1.0 — first release (2026-08-16, 4 commits)

The command panel, rule popups, the automatic ceasefire objective, all six faction Scheme
decks, app versioning and the fan-project footer. Work began 2026-08-06.

Detail: `git log v0.1.0`
