# Progress & how things work

Handoff notes for picking this project back up. See `QWEN.md` and the per-layer
`CLAUDE.md` files for the authoritative architecture rules.

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/
- Latest release: **v0.8.0** (tag on `main`) — the hot-seat parity release: the
  2-player tracker now matches the solo one. Both local modes go through the read-only
  **Mission Briefing**, whose army slots are per seat in hot-seat (**Pick P1 Army** /
  **Pick P2 Army**, seat-coloured panels, a warning when either seat starts without a
  list); the tracker is a four-view **Scoring / P1 Army / P2 Army / Mission** sliding
  strip opening on an **Active Player** panel and an inline score panel (two
  **Player 1/2 Total VP** blocks, a round stepper only Player 1 may move, and a violet
  neon **Swap Player** — hot-seat's Reset is gone, a fresh play is Return → Abandon);
  Results binds to the active seat and so gains the grouped per-round cards, each army
  pane is editable for its own seat and frozen for the other, and the open-game
  lifecycle (Return abandons behind a confirmation, app start offers to resume) now
  covers hot-seat via a `mode` on the record. v0.7.1 was the rules-link hotfix — the Broken
  Morale / Ceasefire rule cards are visible again in the tracker's Mission view
  (the three-view strip's translateX had trapped their dialog off-screen behind
  the backdrop), fixed by rendering `RuleCalloutDialog` at the screen root in all
  five screens that show it. v0.7.0 was the solo view release: the read-only
  **Mission Briefing** on the additive v2 Results schema (per-round cards), a working
  **Start Game** that warns before a run begins without an army, the tracker rebuilt as a
  **Scoring / Army / Mission** three-view screen with the open-game lifecycle (Return abandons
  behind a confirmation, app start offers to resume), **Pick Army** attaching a saved standard
  army as a read-only snapshot with per-copy vitality tracks and the vitality menu (damage,
  heal with overheal to double, stamina, fifteen States), the shared `ScreenHeader` top bar
  across four screens, the leveled-grant fix (a "receives the Stealth I skill" upgrade no longer
  invents Stealth II) and the glowing Solo entry button; v0.6.4 was the ceasefire scoring
  hotfix, v0.6.3 migrated model size, v0.6.2 added saved armies and the Roster format, v0.6.1
  was the rules-link hotfix. The per-session details are all recorded below. Day-to-day work
  happens on `develop`, pushed to `git@github.com:Maevy/Oni-Quest-Advisor.git` (note the
  working branch is `develop`, not `main`).
- The Fly volume `oni_quest_data` (1 GB, mounted at `/data`) exists since the
  v0.5.0 deploy — future deploys only need `fly deploy`. (A fresh app clone
  would have to create the volume first:
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1`.)
- The planning basis for the online mode lives in `MULTIPLAYER_PLAN.md` at the
  project root — **gitignored, local-only, never pushed**. It holds the full player
  journey spec, the phase/state model, the phasing table and the decisions log.
- **`docs/` is current again** (2026-09-11): the functional and technical specs were
  caught up against the code and extended from 7 spec documents to 14 (16 files with
  the two READMEs), covering the whole app rather than just the v0.1.0 mission flow.
  Where the code and `MULTIPLAYER_PLAN.md` disagree, **`docs/` is the spec and the plan
  is design history** — the eight as-built divergences are listed in
  `docs/technical-spec/06-online-architecture.md`.
- Missions currently in the app (`src/lib/data/content/missions/`): Treasure Hunt,
  Clue Trail, Magic Stones, Quarter War, Snail Chase, Supply Run, Toxic Infestation,
  Open Hostilities, Awaiting Reinforcements.
- Army builder shipped in v0.6.0: faction select, producer unit import
  (`scripts/importUnits.mjs`), unit cards with classes, skills, traits,
  combat arts, spellcrafts, inventories and stratagems (inline cards), mounts,
  standard-mode upgrades (per-copy picks with slots, gating and choice dialogs)
  and army codes (clipboard export + import on the faction select).
  Save/Load Army shipped afterwards (Save Army dialog in the builder header,
  Load Army on the faction select; saves persist as code + metadata under
  `oni-quest-advisor:saved-armies`), then the Roster format (125 pts,
  separate equipment pool, format-switch confirmation, format-aware codes
  and saves) — see the session notes below. v0.6.3 added model size:
  `size_info` became a required, ordered `ArmyUnitSize`, Flying Carpet's size
  ceiling got automated, and a mounted model counts as its mount's size.

## What was done in the last session (Tournament: starting the event, the match-prep screen and its roadmap)

The tournament left the lobby. **Start Tournament** works, and behind it is a new screen every
device shares: the round, the mission, the victory-point standing and the table assignment board.

1. **Starting.** The organizer's **Start Tournament** unlocks at two registered players **with at
   most one seat still empty** — the configured tables are the tables that will play, so two empty
   seats would leave one dark while exactly one is what the BYE fills — and the lobby names
   whichever gate is missing (_"2 of 4 seats are still empty — at most one may stay open, or a table
   would go unplayed."_), with the server refusing the same start with a 409. Starting moves the
   event `lobby` → `active`, which closes joining _and_ leaving for good. An odd registered field
   gets the agreed announcement first — _"Start with 3 players? The field is odd, so the missing
   spot is filled with a BYE … Whoever you assign the BYE to sits this round out and takes it as a
   win."_ (**Start** / **Not yet**); an even field starts straight away.
2. **The round model.** `TournamentState` gained `round: TournamentRound | null` — number,
   `missionId` (round _n_ plays mission _n_ of the configured list), one occupant list per table
   and per-seat victory points — with `hydrateTournamentState()` giving rows written before the
   field existed their `null` (the repository hydrates on both read paths, so an old lobby row
   never hands a component `undefined`). An **occupant** is `{ kind: 'seat', seatIndex }` or
   `{ kind: 'bye' }`: the BYE is a first-class occupant the TO assigns like a player, which settles
   the long-open "who takes the BYE" question as _the organizer's choice_.
3. **Domain.** `registeredSeatIndexes`, `fieldNeedsBye`, `sameOccupant`,
   `canStartTournament`/`startTournament`/`createTournamentRound`,
   `canAssignOccupants`/`assignOccupant` (one call covers a drop on another table, a drop back into
   the pool and a drop on its own table, because the occupant is lifted out first),
   `unassignedOccupants` and `isRoundReady` — plus `MIN_PLAYERS_TO_START`/`MAX_TABLE_OCCUPANTS`
   (the latter also travels in the view as `maxOccupants`, so no component hardcodes the pairing
   rule). 31 new tests, including the one that matters most: **the gate is not just "everybody
   assigned"** — with four tables and six players, 2/2/1/1 assigns everybody and still strands two
   of them without an opponent, so a table holding a single occupant blocks Start Round.
4. **Server.** `POST /api/tournaments/[id]/start` (organizer-only, 409 when it cannot start,
   `tournament-started` in the history) and `/assign` (organizer-only, `{ occupant, tableIndex }`
   with `tableIndex: null` meaning "back to the pool"; 400 for a malformed occupant/table, 409 for
   a full table, an unregistered seat, a BYE the field does not need or an event that is not
   preparing a round), both through the existing FIFO-serialized organizer mutation and both
   announcing themselves over SSE. `payload.ts` grew `parseTournamentOccupant`/`parseTableIndex`.
5. **Client.** `tournamentEventStore.start()`/`assign()` (server-authoritative: the board that
   comes back is the server's, never a locally patched copy, and the board freezes while a move is
   in flight so drops cannot overtake each other), the `tournament-round` screen id, and a page
   effect that follows the event **status** rather than a click — the organizer pressing Start
   moves every participant to the round screen with no reload, and the effect only acts while a
   tournament screen is already up, so nobody is yanked back from the menu. The startup prompt's
   **Return** now lands on whichever screen the fetched status names.
6. **The screen** (`TournamentRoundPrep`), in four parts: **Progress** (the roadmap, item 7), Round
   Control (round, mission + season, the standing at 0 VP with `(you)` marked), the big green gated
   **Start Round** with a hint naming whichever half of the gate is missing, and Table Assignment —
   the pool (players in seat order, then the BYE) above one card per table (name, `n/2`, chips in
   their army's faction colour, the BYE in amber, and a sit-out line where it lands). **Two ways to
   move an occupant**, because HTML5 drag-and-drop does not exist on touch: pointer-event dragging
   (ghost chip, highlighted container, `touch-action: none` so scrolling does not steal it) _and_
   tap-a-chip-then-"Place here", which is also the only keyboard/screen-reader path and the one that
   works when the pool and the target table are not on screen at once. Players see the identical
   board read-only with plain chips. The lobby's dead Start button and its "arrives with the next
   step" line are gone, and the shared retry-or-abandon panel became `TournamentUnavailable`.
7. **Round phases and the roadmap.** A round walks **setup → game → scoring** as server state
   (`TOURNAMENT_ROUND_PHASES`), and `tournamentRoadmap()` derives the event's whole progression from
   it — three steps per configured mission plus a final _Tournament Conclusion_ (3_n_ + 1 of them),
   with `currentIndex` on the step the event is on. `TournamentRoadmap` renders it as a line of dots
   glowing green out of grey: reached steps and the connector leading to them are green, the current
   one pulses (`motion-safe:animate-ping`, so reduced motion gets a static glow), the rest stay
   grey, and a caption names the current step and its state (_· now_ / _· done_ / _· upcoming_) —
   tapping any dot names that one instead, and tapping it again returns to the current. The strip
   scrolls horizontally and centres itself on the current step, so a nine-mission tournament's 28
   dots still fit a 320 px phone without the page overflowing. Visually it sits in the shared
   `Panel`'s new darker `tone="dark"` variant (slate-900 at 80% instead of the frosted slate-800 at
   40%) with a centred title, and the strip itself is centred in the panel — an inner
   `w-max min-w-full justify-center` row, because `justify-center` on the scroller would clip the
   steps before the current one when the strip overflows. Verified by a 14-assertion visual pass
   (computed background alpha 0.8 vs 0.4 on the neighbouring panels, centred title and strip with
   equal left/right gaps, and at 320 px the strip scrolling with both ends reachable).
8. **Start Round is the organizer's, and it does something.** A player never sees the button, only
   _"The organizer starts the round once every player is paired."_ For the TO it is gated on a
   complete pairing and calls `POST /api/tournaments/[id]/start-round`, which moves the phase to
   `game` — the roadmap advances on every device at once and **the tables lock** for everybody,
   because a pairing must not change underneath a match being played (undoing it is a new open
   question; a mistake means cancelling the event). `canAssignOccupants` now requires the setup
   phase and the assign endpoint says _"The tables are locked — this round is under way"_ instead of
   the generic refusal. A phaseless round written earlier hydrates to `setup`.
9. **Verified:** `check` 0/0, lint clean, 515 tests (49 new: 48 domain, 1 repository), a
   46-assertion API pass for start/assign (the start gate and its 403/401, the round it opens, the
   closed lobby, every assign refusal, the BYE, the ready flag, moving and unassigning, both SSE
   notifications, cancelling a running event) plus a 16-assertion one for start-round (the phase and
   roadmap index it writes, the unpaired 409, a player's 403, a stranger's 401, starting twice, the
   locked tables and their message, the pairings surviving the lock, cancelling a running round), a
   60-assertion browser pass over two contexts (wizard → lobby → the BYE announcement → both devices
   on the round screen → a real pointer drag → tap-to-place → move-back → the gate unlocking → 320 px
   → both reloads returning _to the round_ with the pairings intact → abandoning from it), a
   46-assertion one for the roadmap (seven dots for two missions, the panel sitting above Round
   Control, the organizer-only button, the phase change reaching the player's device live, the
   connector lighting up behind it, the lock, tapping dots, both reloads keeping the step, and the
   strip scrolling instead of overflowing at 320 px) and a 12-assertion one for the empty-seat rule
   (two of four seats: the button locked with the reason and a 409 from the API; a third joiner
   unlocking it with the BYE announcement; the round then opening with the BYE in the pool and both
   devices on it).
10. **Two bugs the passes caught.** `payload.tableIndex ?? undefined` collapsed the explicit `null`
    ("back to the pool") into "missing", so unassigning 400'd — a `null` that carries meaning must
    not go through `??`. And Svelte eats the whitespace at an inline `{#if}` boundary:
    `every player{#if odd} and the BYE{/if}` rendered as "playerand the BYE" (recorded in
    `components/CLAUDE.md`, with the two ways around it). A third trap for verification scripts:
    `innerText` is CSS-uppercased, so `waitForFunction` needles must be compared case-blind — and
    the Add Quest popup closes after every pick, so a two-mission wizard run reopens it.
11. **Docs:** 09-tournament gained "Starting the tournament", "The match-preparation screen" with
    its round-phase table, and a new "Next — playing and scoring the round"; its open questions were
    narrowed (missions→rounds is decided for the round being prepared, what a table holds is
    answered for prep, manual pairing now asks about _later_ rounds, only the BYE's _worth_ is left
    open, and undoing a started round is new). The navigation flow records the new screen and the
    status-driven switching, the functional README gained Round/BYE/Occupant/Round phase/Roadmap
    glossary entries and the screen-map step, and QWEN.md the whole model.
12. **Next (agreed, not built):** the `game` and `scoring` phases — what the tables actually play,
    how a result is reported, how the standing is fed and how the next round opens.

## What was done in the session before (Tournament: returning to a seat, and abandoning it)

Polish on the shipped lobby: until now a reload dropped a device straight back into the lobby
without asking, and the only way out — the lobby's ← Return — cleared `localStorage` while the
server kept the seat occupied (or the whole event alive) forever. Both ends now go through the
server, and every participant lands back on the screen the tournament is currently on.

1. **The startup prompt.** A stored seat session is offered back the way an open local game is:
   the app fetches the current view first (so the prompt can name the tournament and so a dead
   session is dropped instead of offered), then asks. _"You are participating in "X". Abandoning
   it gives up your seat."_ — the organizer gets _"You are the organizer of "X". Abandoning it
   cancels the tournament and deletes it for everyone."_ **Return** is the prominent button and
   the Escape branch and enters the freshly refetched lobby, which then stays current over SSE;
   **Abandon** is the destructive one. It is the third startup claim, after the online seat and
   before the local game.
2. **One way out.** The lobby's ← Return opens exactly the same prompt with exactly the same
   consequences — there is no local-only exit any more, because that is what stranded seats. A
   failed abandon (offline) keeps the dialog open with the reason (`ConfirmDialog` grew an
   optional `errorText`) rather than clearing the session behind the server's back. When the
   resume fetch itself did not get through, the lobby screen shows the error with **Try Again**
   and **Abandon** instead of rendering nothing. A successful retry re-opens the SSE stream too —
   without that the lobby would sit on its fetched view and miss every later change until a
   reload (found by the offline browser pass below).
3. **Domain** (`tournamentEvent.ts`): `canLeaveTournament`/`leaveTournament` (frees the caller's
   seat; refuses the organizer, who cancels instead, and refuses a token with no seat) and
   `canCancelTournament`/`cancelTournament` (status → `closed`, **seats kept** so every open
   device still authenticates and can be told what happened instead of meeting a bare 404).
   Leaving is a lobby-only rule for players — a seat in a running pairing needs a forfeit rule
   that does not exist yet (recorded as an open question); the organizer may cancel a running
   event, never a concluded one. 13 new tests (41 in `tournamentEvent.spec.ts`).
4. **Server**: `POST /api/tournaments/[id]/leave` (403 for the organizer, 409 once running, 401
   for a stranger, `player-left` in the history) and `/cancel` (organizer-only,
   `tournament-cancelled`), both through the existing FIFO-serialized mutations and both
   announcing themselves over SSE. Retention split: a concluded event still lives exactly the
   48-hour report window, a **cancelled** one 24 hours — long enough for the open lobbies to be
   told, and it has no report to keep.
5. **The cancelled device.** A refetch that comes back `closed` tears the session down and sets a
   store `notice` that survives the teardown, so the page can navigate home and show a dismissible
   banner on the main menu: _"The organizer cancelled this tournament."_ (a `GameModeSelect`
   notice prop). The same path reports a tournament that was deleted while the app was shut, and
   the invite link itself says _"This tournament was cancelled by its organizer"_ with **Join**
   disabled. `teardown()` now invalidates the fetch sequence so an in-flight response cannot
   resurrect a view for a session that is already gone.
6. **Decisions taken (with the user):** one abandon everywhere (the lobby's ← is not a local-only
   leave); a cancellation marks the event `closed`, notifies, and is purged by retention rather
   than hard-deleted (a 404 cannot be distinguished from a mistyped code); the TO may cancel a
   running event while players may not leave one.
7. **Verified:** `check` 0/0, lint clean, 466 tests (16 new: 13 domain, 2 repository, 1
   retention), a 22-assertion API pass (create, two joins, leave, the freed seat rejoinable, the
   organizer's 403 on leave, a player's 403 on cancel, stranger/missing-token 401s, 404, cancel,
   the seats surviving it, peek and join refusing a closed event, double-cancel and
   leave-after-cancel 409s, both SSE notifications, health) and a 36-assertion two-context
   browser pass (create through the wizard, both reload prompts and their role-specific wording,
   Escape = Return, the join over the invite link, the organizer's lobby updating live on the
   leave, the rejoin into the freed seat, the cancel reaching the player's device with the banner,
   a reload afterwards offering nothing, the cancelled invite link, and the prompt at 320 px),
   plus a 13-assertion offline pass (all `/api/tournaments/**` blocked: the prompt still appears
   with "this tournament" and the reason, Return lands on the retry panel rather than an empty
   screen, unblocking and **Try Again** resynchronizes the lobby, a join then reaches it live,
   and abandoning still cancels the event server-side).
   Two throwaway-script traps found on the way: Chromium's `innerText` returns CSS-uppercased
   panel titles (so body-text assertions must compare case-blind), and a fresh browser context
   shows the privacy banner, which intercepts clicks until dismissed.
8. **Docs:** 09-tournament gained a "Returning to a tournament, and abandoning it" section with
   the decisions and the new open question, the navigation flow records the third startup prompt
   and the lobby's ← semantics (plus its stale "server-side, next iteration" wizard diagram,
   fixed), the functional README gained a **Seat session** glossary entry, and the server
   CLAUDE.md the cancelled-event retention window.
9. **Next (agreed, not built):** still the odd field and the **BYE** behind Start Tournament.

## What was done in the session before (Tournament: creation, the lobby and joining)

The feature left the client: **Create Tournament** on the overview now talks to the server, and
the tournament lives in a shared **lobby** the organizer and every player see.

1. **The retention notice.** **Create Tournament** first opens a confirmation naming the reason:
   the tournament's data is kept 48 hours _after it concludes_ so a report can be generated (a
   printable report is a later step), then deleted. Only its **Create** is the first server
   contact; **Not yet** stays on the overview with the draft untouched.
2. **Domain `tournamentEvent.ts`.** The server-authoritative `TournamentState` (code, status
   `lobby`/`active`/`concluded`/`closed`, configuration, and one seat per pairing slot) with pure
   `createTournamentEvent` / `joinTournament` / `canJoinTournament` guards, `seatIndexForTokenHash`
   and the visibility filters: `viewForTournamentToken` (organizer or seated player — army names and
   factions, never codes or tokens) and `peekTournament` (what the join page may see before
   joining). 28 tests.
3. **Server.** `tournaments` + `tournament_events` tables; `tournamentRepository.ts` mirrors the
   games repository (one write transaction per mutation behind its own FIFO queue, so concurrent
   joins cannot double-book a seat); `payload.ts` parses the registered-army snapshot with length
   caps; `sse.ts` became a registry factory (games + tournaments, 40 subscribers per tournament);
   `POST /api/tournaments` (re-validates the whole configuration), `GET .../state`, `GET .../peek`,
   `POST .../join`, `GET .../events`; the creation rate limit now covers both creation endpoints;
   `/api/health` reports tournaments; cleanup keeps lobbies 7 days, abandoned events 30 and
   concluded ones exactly the 48-hour report window. 8 repository tests + 3 retention tests.
4. **QR.** `npm install` is blocked on this machine, so the symbol is encoded in-app: `domain/qr.ts`
   is a byte-mode, EC-level-M, versions 1–6, mask-0 QR encoder (GF log/exp tables, block
   interleaving, format BCH) rendered by `QrCode.svelte` as an SVG — nothing about a join link goes
   to a third-party generator. Verified two ways: an in-spec independent reader (jsQR's own
   function-mask and zigzag, de-interleaved) round-trips v1/v3/v4/v6 payloads, and jsQR decodes the
   rendered symbol in Edge; its codewords were also diffed against a third-party encoder's for the
   same payload and matched byte for byte. Two encoder bugs found that way: the timing pattern was
   drawn over the finder rings, and the RS generator multiplied by x in the wrong direction.
5. **Client.** `tournamentApi`/`tournamentSession` wrappers, `tournamentEvent.svelte.ts`
   (create/join/leave/cancelJoin, SSE-triggered refetches like `onlineGameStore`), screens
   `tournament-lobby` and `tournament-join` (route `/tournament-join/[code]`), the lobby and join
   components, app-start resume into the lobby, and the join picker reusing the saved-army dialog
   filtered to Roster lists.
6. **The lobby.** Name, external link, organizer, pairing mode, join code, missions, tables and one
   row per seat (registered name + army name/faction, `you`/`organizer` marks, or _Empty seat_);
   organizers also get **Share Link** (clipboard, with the URL shown inline when copying is
   blocked) and **QR Code**, plus a **Start Tournament** button that is deliberately disabled until
   the odd-field BYE rule exists. Players see the same lobby read-only.
7. **Verified:** `check` 0/0, lint clean, 450 tests (49 new), a 19-assertion API pass (create,
   peek, both views, join, duplicate-token and missing-army refusals, 401s, SSE, invalid
   configuration, health) and a 17-assertion two-context browser pass (notice → lobby → share →
   QR decoded with jsQR → second device joins → organizer's lobby updates live → reload resumes →
   leaving returns home).
8. **Next (agreed, not built):** **Start Tournament** with an odd number of registered players
   shows an info panel that the missing spot will be filled with a **BYE** — an imaginary player
   who takes a seat but is never played against, so that player sits the round out and takes the
   win. Open: who takes the BYE, and what a BYE win is worth in points.

## What was done in the session before (Tournament: the overview pane)

The wizard grew its third pane: the **Overview**, a read-only review of everything configured
before the tournament is created. Step 2's **Create Tournament** button became **Overview** (same
one-mission gate), and the step-1 summary panel it repeated is gone — the overview is now the only
place the whole draft is reviewed.

1. **The overview pane.** New `TournamentOverview.svelte`: four read-only panels — **Tournament**
   (name, external link, organizer, the playing tick and the army picked for the seat, or "None
   picked"), **Participants & Pairing** (field size, Swiss or by hand, plus the seat note while the
   TO plays), **Missions** (the list in the order added, name + season) and **Tables** (numbered
   names, "unnamed" for a cleared one). No inputs and no ✕ — a change means stepping back.
2. **Three panes in domain.** `TournamentSetupStep` is now derived from a
   `TOURNAMENT_SETUP_STEPS` tuple (`basics` → `missions` → `overview`) and
   `previousTournamentStep()` is the only back rule; the store's `back()` walks it and
   `reviewTournament()` opens the overview behind the same `canCreateTournament` gate that enables
   **Create Tournament** on the last pane. The page still decides that ← on the first pane leaves
   the wizard and discards the draft.
3. **Decided for the next step (not built):** pressing **Create Tournament** will first show a
   notice that the tournament's data is kept for **48 hours** afterwards for report generation (a
   printable tournament report is planned), and only a proceed from that notice makes the first
   server call. Recorded in 09-tournament.md so the seam stays honest until then.
4. **Verified:** `check` 0/0, lint clean, 397 tests (4 new), and a 35-assertion browser pass over
   the whole wizard (step 2 without the summary panel, the Overview gate, the overview's four
   panels and every fact on them, read-only-ness, back through all three panes with the draft
   intact, manual pairing reading through, Create still the seam, discard-on-leave).
5. **A held seat must come with a list (same session, user rule):** ticking "I am also a
   participant" now blocks **Continue** until a Roster army is attached — domain
   `organizerSeatNeedsArmy` joins the Continue gate, the store exposes `organizerArmyMissing`, and
   the pane marks the Pick button red with the reason beside it and again under the disabled
   Continue. Giving the seat up drops the army and unblocks the wizard again. 4 more domain tests
   (57 in `tournament.spec.ts`) and an 8-assertion browser pass over the gate.

## What was done in the session before (Tournament: entry point and configuration step 1)

The next big feature is **Tournament**: a Tournament Organizer (TO) creates an event, configures
it, invites players via link/QR, assigns pairings, overwatches the tables and concludes with a
victor. It is being built step by step; this session delivered the entry point and the first step
of the configuration wizard, and opened `docs/functional-spec/09-tournament.md` to carry the plan
and its open decisions.

1. **Entry point.** The mode select gained a fifth button, **Organize Tournament**, in the red
   outlined recipe, placed with the play modes above the Army Builder tool. It carries no neon
   treatment — the beam stays the Solo button's, one entry point at a time.
2. **The wizard.** New `tournament-setup` screen on the shared `ScreenHeader`: a **Tournament**
   panel (name, organizer name, "I am also a participant") and a **Participants & Pairing** panel
   (−/+ stepper over the field, "I assign the pairings myself each round"), then **Continue**.
   Continue is disabled until both names are non-blank.
3. **Decisions taken (with the user):** the field **steps in pairs, 4–32** (an even field needs no
   bye rule, so odd counts are unreachable rather than handled); a playing TO **holds one of the
   configured seats** rather than adding to them (the panel says so while the tick is on); the
   configuration is **local and in-memory** — nothing is persisted or sent until the tournament is
   actually created at the end of configuration, at which point the backend takes over.
4. **Step 2 exists as a seam.** Continue moves to a **Missions & Tables** pane that shows a
   one-line summary of the draft and says what comes next; Return from there goes back to step 1
   with the draft intact, from step 1 it leaves and discards. That pane is what the next
   iteration replaces.
5. **Layering.** `domain/tournament.ts` holds the draft type, the 4–32/pairs constants, the clamp
   and step functions and the Continue gate, with 19 colocated tests; `stores/tournament.svelte.ts`
   holds the in-memory draft and the wizard step; `TournamentSetup.svelte` is presentational and
   the page wires it. `TournamentSetupStep` lives in domain, not stores, so components keep their
   dependency direction.
6. **Verified:** `check` 0/0, lint clean, 363 tests (19 new), and a 46-assertion browser pass over
   the whole wizard (entry button colour and position, both panels, the name gate incl.
   whitespace, the stepper's bounds and pair stepping, both tickboxes and the seat note, step 2
   summary and back-navigation, discard-on-leave, 320 px).
7. **Found while writing the glossary:** the army builder's 125-point Roster format is internally
   `'tournament'` and that string is baked into the army-code wire format — so "tournament" now
   means two unrelated things in the code. Recorded as an open question in 09-tournament.md
   rather than renamed now (the wire format is shipped).
8. **Second pass on step 1, same session:** an optional **External Link** field between the two
   names (normalized to an http(s) URL, bare addresses gain `https://`, anything unusable blocks
   Continue and marks the field red), and ticking "I am also a participant" now reveals a **Pick
   Roster Army** button — the saved-army picker filtered to Roster-format lists — whose pick
   becomes a name/faction/✕ row. Giving up the seat drops the army. `PickArmyDialog` gained a
   `note` prop so the mission flow's copy stays and the tournament's says what it lists.
9. **Browser-found bug worth remembering:** Chromium's `URL` accepts `https://not a link`
   (percent-encoding the spaces into the host) where Node throws, so link validation that only
   parses is engine-dependent. The domain now rejects whitespace before parsing; the unit test
   pins it for both engines.
10. **Step 2 of the wizard, same session:** **Missions & Tables**. An **Add Quest** popup (season
    dropdown + that season's missions as clickable rows; Escape/Cancel/backdrop close without
    adding, already-added missions are disabled and marked) fills an ordered, deduplicated mission
    list with per-row ✕. Below it the **Tables** panel: one editable name per table, the count
    derived as half the participants, defaults materialized as "Table n", and custom names staying
    with their table number when the field changes on step 1. **Create Tournament** enables at one
    mission and is tonight only the seam — server-side creation is the next session. 14 more
    domain tests (49 in `tournament.spec.ts`) and a 34-assertion browser pass over step 2.

## What was done in the session before (hot-seat gets the solo treatment)

The 2-player tracker was still the v0.1.0-era single scrolling screen with a right-edge drawer;
this session brought it up to the solo tracker's level and unified the top bar along the way.

1. **A briefing for hot-seat.** `selectMission()` in two-player mode now lands on the read-only
   `MissionBriefing` like solo. The briefing became slot-based: solo brings one army slot,
   hot-seat brings one per seat, so the header shows **Pick P1 Army** (sky) and **Pick P2 Army**
   (orange) and each attached list renders as its own seat-coloured panel. Start Game with any
   seat empty warns _"It is strongly recommended to start a game with both players having an
   army."_ — with both filled it goes straight in.
2. **The four-view tracker.** `MissionDetailTwoPlayer` is now the same sliding-strip full-height
   screen as solo, with **Scoring / P1 Army / P2 Army / Mission** behind the spotlight switcher
   (and swipe). Scoring opens with a new `ActivePlayerPanel` ("Player 1 is the active Player" in
   the seat colour, army name under it) and a new `ScoreSummaryPanelTwoPlayer`: two VP blocks
   renamed **Player 1/2 Total VP**, the round stepper which only Player 1 may move, and a shiny
   violet **Swap Player** (`.neon-violet`, a four-line modifier over `.neon-border`'s custom
   properties). **Reset is gone** from hot-seat — a fresh play is Return → Abandon → re-pick.
3. **Per-seat scoring and armies.** Results is now the solo `ResultsPanel` bound to the active
   seat (so hot-seat gets the grouped per-round cards too, closing that backlog item), and each
   army pane is the shared `ArmyReadonlyPanel` with a seat title/colour and a frozen mode: the
   inactive seat's rows keep their portraits, pills, Life/stamina tracks and State glyphs but
   carry no click target. Vitality maps are per seat, so two seats fielding the same save keep
   their damage apart.
4. **The open-game lifecycle covers hot-seat.** `OpenGame` gained `mode`; records without one read
   as solo. Return asks _"Abandon this game? Both players' progress will be lost."_, abandoning
   deletes the record and both seats' progress, and a reload offers to resume into the right
   tracker. `PlayerProgress` gained `pickedArmy` + `vitality`, hydrated per seat so old saves get
   their defaults; online's seats moved to a new shared `SeatProgress` base so the online protocol
   never carries army state.
5. **Deleted** `CommandPanelTwoPlayer` and `ResultsPanelTwoPlayer` (both unreferenced after the
   rewrite). `ScreenHeader`'s actions container now wraps, which is what lets the briefing's four
   buttons and the tracker's four-up switcher fit a 320 px phone.
6. **Verified in a real browser (73 assertions)**: the whole journey — build and save an army,
   briefing picks and warnings for both seats, all four views, per-seat scoring and vitality,
   swap + countdown, frozen panes, abandon/keep-playing, reload → resume, 320 px overflow — plus a
   solo regression pass. `check` 0/0, lint clean, 344 tests (10 new domain tests for the seat
   fields and hydration).
7. **Docs caught up**: functional 01/02/03/05/06/07/08 + README, technical 01, and
   `components/CLAUDE.md`. The open questions that this work closed (grouped Results in hot-seat,
   three views in hot-seat, ScreenHeader on hot-seat) are gone from the backlog; the ones it
   sharpened (`activePlayer` not persisted now matters more, hot-seat has no fresh-play shortcut)
   are recorded in their place.

## What was done in the session before (rule callouts visible again in the Mission view)

First bug report against v0.7.0: clicking **Broken Morale** / **Ceasefire** in the solo tracker's
Mission view dimmed the screen but showed no card. The dialog was correct — its _position_ was
not: `DescriptionPanel` rendered `RuleCalloutDialog` as a sibling of `Panel`, which escaped the
panel's backdrop-blur but not the three-view **sliding strip**, whose `translateX` makes it the
containing block for fixed descendants. The backdrop (`inset-0` of a 300%-wide translated strip)
still covered the viewport while the centred card sat off-screen in the strip's middle.

1. **The overlay moved to the screen root.** `DescriptionPanel` and `MissionDescriptionPanel` now
   only emit `onOpenRule`; the five screens that use them (`MissionDetail`,
   `MissionDetailTwoPlayer`, `OnlineGameView`, `OnlineMissionView`, `MissionBriefing`) hold the
   `openRule` state and render `RuleCalloutDialog` at their root — the same place the army popups
   already live for exactly this reason.
2. **The rule was widened and recorded**: any transformed _or_ backdrop-filtered ancestor traps a
   fixed overlay (`components/CLAUDE.md`, `technical-spec/01`, `functional-spec/02`), with both
   regressions named so the next person extracting a popup knows what to check.
3. **Verified in a real browser (11 assertions)**: on the tracker's Mission view both cards now
   render fully inside the viewport with their rule text, Escape and backdrop-click close them,
   the briefing path is unchanged, and the view switcher still works afterwards. `check` 0/0,
   lint clean, 334 tests.

## What was done in the last session (the solo tracker's entry button glows)

The mode select's **Solo Quest Tracker** button carries the app's neon treatment in the sky
accent, to announce the redesigned solo flow: `.neon-border` is a conic-gradient beam masked to
the border ring plus a resting `box-shadow` halo, so the button reads as lit even between beam
passes. The Online button carried the beam in emerald while online play was new and lost it in
the same release once it wasn't, so the utility now has a single sky treatment and no accent
modifier. Verified in a real browser: sky beam and halo on Solo, no beam or halo on Online, both
still click through, and the beam stops under `prefers-reduced-motion` while the static halo
remains.

## What was done in the last session (upgrade grants no longer invent ranks)

Reported in play: Muffled movement on a Coalition of Thenion model that already has Stealth I
turned it into **Stealth II**. The rulebook only says "The model receives the Stealth I skill" — no
rank is gained. The cause was one rule for every leveled grant: `bumpLeveledRef` always did
`level + 1`.

1. **The rulebook words a grant two ways, so the effect now says which it is.** Surveying all ten
   leveled grants showed the split: Bujutsu Expertise, Kyujutsu Expertise and Poisoned Weapons
   explicitly say "gains access to the next rank/level of the Trait", while Muffled movement,
   Climbing Expertise, both Seasoned Combatants, Tactical Expertise and Traveling Duelist only say
   "receives the X". `ArmyUpgradeEffect`'s trait/skill/combatArt variants gained an optional
   `advance` flag, set in the importer's `UPGRADE_EFFECTS` table for those three and regenerated
   into `upgrades.json`.
2. **New grant semantics** (`grantLeveledRef` / `grantTraitFromEffect` replacing
   `bumpLeveledRef`): a missing reference is added at the granted level; an existing one is raised
   by one when the effect `advance`s, otherwise the granted level acts as a **floor**
   (`max(current, granted)`) — so Stealth I + Muffled movement stays Stealth I, Stealth II stays
   II, and Journeyman Adventurer's "Resourceful II" still lifts Resourceful I to II but never
   invents a Resourceful III. A no-op grant returns the reference list untouched.
3. **Survival's environment list merges** instead of being levelled: Journeyman Adventurer used to
   bump `survival--x-environment` to **level 2, which the catalog does not have** (Survival has
   only level 1). A granted `dynamicValue` now joins the model's comma-separated list
   (`Scorching` → `Scorching, Difficult`) and is skipped when already held, mirroring how
   Elemental Lineage merges Affinity elements.
4. **A redundant pick stays purchasable** — the player confirmed that in-game Muffled movement on a
   Stealth I model still means it deploys Shrouded, which the app does not model, so the existing
   `max-level` gate is unchanged and only blocks a model already at the catalog's top rank.
5. **Verified**: 11 new domain tests pin all three wordings plus the Survival merge and the
   per-copy advance (334 total, `check` 0/0, lint clean), and a 13-assertion browser pass drives
   the real builder — Bladebrethren Elite + Muffled movement shows **Stealth I** with Level II
   still greyed in the popup, Night-Temple Priestess (no Stealth) still gains **Stealth I**, and
   Clan Champion + Bujutsu Expertise still advances **Fencing IV → V**.
6. **Docs**: `technical-spec/05` documents the two wordings, the `advance` flag, the floor
   semantics and the Survival merge; `functional-spec/08` describes what a pick does to a leveled
   entry next to the gating table.

**Re-running `scripts/importUnits.mjs` rewrites the content JSON unformatted** — it writes
`JSON.stringify(..., '\t')`, while the committed files are Prettier-formatted (short arrays
collapsed). Run `npx prettier --write src/lib/data/content/units/*.json` afterwards; the diff then
shows only real changes. This session's regeneration produced a 480-line phantom diff across every
unit file that collapsed to the three intended `advance` flags.

## What was done in the last session (warning before starting without an army)

A player can reach the tracker without ever attaching a list, and the tracker's Army view is
read-only — so a run started bare stays bare for its whole life. The briefing now says so before
it lets that happen.

1. **The gate**: `MissionBriefing` keeps a `confirmNoArmy` flag; its Start Game button routes
   through `requestStart()`, which starts directly when `pickedArmy` is set and otherwise opens
   the shared `ConfirmDialog`: _"You are starting this game without a selected army. Do you want
   to proceed?"_ with **Start anyway** (confirm) and **Not now** (cancel, and the Escape branch).
   No new dialog component, no store or domain change — the gate is presentation-layer branching on
   a prop the component already has.
2. **Verified in a real browser — 16 assertions**: with no army the warning opens with both
   buttons, Not now and Escape both stay on the briefing, and Start anyway enters the tracker with
   no dialog left open; with a seeded `pickedArmy` snapshot the briefing shows the Selected Army
   panel and Start Game goes straight to the tracker. Abandoning still lands on the mission list.
   `check` 0 errors / 0 warnings, lint clean, 323 tests.
3. **Docs**: `functional-spec/01` records the warning and why it exists, next to the Start Game
   boundary paragraph.

## What was done in the last session (the shared top bar)

First concrete step of the long-standing "unify the top button bar" backlog item: the season and
mission selects now carry the same bar as the solo tracker, and the bar itself moved into one
component so all four screens share a single source.

1. **`ScreenHeader.svelte`** (new): `sticky top-0 z-30` over
   `border-b border-slate-700/40 bg-slate-950/80 backdrop-blur`, its row centred in the same
   `max-w-xl px-4` column as the page body. An optional `onBack` renders the red inverted
   **← Return**, an optional `title` renders as the page's `h1`, and an `actions` snippet holds
   whatever the screen puts on the right. Sticky is a no-op on the two full-height screens (their
   layout pins the bar already) and keeps Return in reach while a mission list scrolls.
2. **Four screens moved onto it**: the season select (Return only — its hero block keeps the
   screen's name), the mission select (Return, the season as the bar's title, and **Random** in
   the outlined orange recipe instead of the old solid pill), the briefing (Return + Pick Army +
   Start Game) and the solo tracker (Return + the spotlight view switcher, which lost its own
   `ml-auto` to the header's actions wrapper). The season select's odd `fixed top-4 left-4` sky
   "← Back" pill is gone; its root became a `flex min-h-dvh flex-col` so the bar sits above the
   centred hero instead of floating over it.
3. **One height everywhere**: the row carries `min-h-16`. Without it the bar followed its tallest
   control — a lone border-less Return measured 57 px against the tracker's 63 — so the four bars
   would have differed by up to 6 px. The value has to clear the tallest control _plus_ the row's
   `py-2.5`, because `border-box` measures min-height on the padded box; a first `min-h-11`
   attempt silently did nothing and the browser pass caught it.
4. **Verified in a real browser — 51 assertions**: the bar's computed chrome (position, top,
   z-index, border, backdrop, height, inner max-width/padding/gap, and the Return button's
   background, colour, radius, font and padding) is identical across all four screens; the season
   name is the mission select's only `h1`; Random matches the documented outlined-orange recipe
   (compared against a live probe, since Tailwind 4 reports `oklab()`); Return navigates back on
   the selects and opens the abandon confirmation on the tracker; the spotlight still starts under
   Scoring and follows a view switch; the single-scroller contract from the previous commit
   survives (document height equals the viewport, a wheel over the Mission pane leaves `scrollY`
   at 0 and the header at y 0); and no bar overflows at 320 px.
5. **Docs**: `technical-spec/01` gained a "The top bar" section and its z-index row now names
   `ScreenHeader`; `functional-spec/01` describes the bar on screens 2, 3, 4a and 4b; both
   READMEs' open question now lists the screens still to move (mode select, hot-seat, online,
   army builder).

**Left for the next pass:** the remaining screens' constellations, and whether the button recipes
themselves should become shared classes.

## What was done in the last session (one scroller on the full-height screens)

A player-reported layout bug: the tracker carried **two** scroll bars — the document's and the
view's — and dragging the document's dragged the pinned top bar away with it.

1. **Root cause**: `+layout.svelte` stacks the page and the site footer in a `min-h-dvh` column,
   so on the two full-height screens (solo tracker, army builder) the document was `100dvh +
footer` tall. Their `h-dvh overflow-hidden` roots kept the panes correct, but the document
   itself still scrolled by the footer's height — a second scroller sitting above the pinned
   header. The theme doc had even recorded that scroll as the price of keeping the footer
   reachable on the builder.
2. **Fix**: the layout derives `fullHeight` from the navigation store (`army-builder`, or
   `mission-detail` while in solo mode) and on those two screens locks its column to `h-dvh
overflow-hidden` and omits the footer. The document is exactly the viewport, the active panel
   is the one and only scroller, and the header can never leave. Hot-seat `mission-detail` and
   every other screen keep the footer and their normal document scroll.
3. **Verified in a real browser — 11 assertions**: on the tracker the document height equals the
   viewport; a wheel over the (short) Scoring pane moves nothing at all; a wheel over the
   overflowing Mission pane scrolls that pane while `scrollY` stays 0 and the header stays at
   y 0; the army builder's document is exactly the viewport too; and the mode select plus the
   hot-seat tracker still show the footer.
4. **Docs**: `technical-spec/01`'s scrolling-model and footer sections now describe the layout
   enforcing the full-height contract, replacing the passage that documented the footer scroll
   as intended.

## What was done in the last session (status tracking in the vitality menu)

The menu grew its third panel, and the Army rows grew the icons that make a copy's condition
readable from the list.

1. **The menu is three panels now**: Life, Stamina and **Statuses**. The first two kept the
   round step buttons with the sign drawn inside the heart/orb glyph; the third holds one round
   toggle per State — grey while off, lit in the State's own colour once clicked, greyed again
   on a second click, each with its name in small white type above the icon so nothing has to be
   recognised from memory. Fifteen labelled toggles outgrew a short phone screen, so the card
   scrolls its body and keeps Cancel/Accept pinned. Nothing commits until **Accept**, as before.
2. **Fifteen States**: Bleeding, Blinded, Confused, Crippled, Crouched, Dead, Flying, Fatigued,
   Immobilized, Incapacitated, Panicked, Weak Poison, Strong Poison, Slowed, Weakened. Shrouded
   is deliberately absent — it will be solved by other means. Poison's two icons are the Poison
   trait's WEAK and STRONG levels (a drop carrying a 1 or a 2) and exclude each other, since they
   are one condition at two strengths.
3. **State model**: `UnitStatus`, `UNIT_STATUSES` and `UNIT_STATUS_LABELS` joined `domain/army.ts`,
   and `UnitVitality` gained an optional `statuses` — progress saved before this feature carries
   none and needs no migration, the same trick as "absent means full". `toggleUnitStatus()` owns
   the flip and the poison exclusion; `unitStatuses()` reads past absent lists. Committing a
   zero-Life vitality also assigns Incapacitated and Crouched (`applyZeroHpStates`, the rulebook's
   fall); healing back up leaves them lit for a manual cancel, recorded as an open question. Ten
   new spec cases, **323 tests**.
4. **Glyphs**: `StatusGlyph.svelte` draws all fifteen by hand in a 24×24 viewBox — blood drop,
   dashed eye, stars over a head, broken bone, down arrow, skull, angel wing, hunched stickman,
   slashed boot, X-eyed head, three exclamation marks, numbered drops, snail, shield split in
   half. Off
   they read `slate-500`; on, each State's colour; inner cut-outs (skull eyes, poison numbers,
   the snail's spiral) are `slate-900` so they read on any fill. The Army row renders a copy's
   carried States as a wrapping line of glyphs under its points, at the menu's glyph size so
   they stay readable on a phone.
5. **Verified in a real browser**: clicking all fifteen lights fourteen (the poison exclusion),
   reopening shows them lit again, Accept puts fourteen icons on the row and clearing greys them
   back off, Bleeding + Strong Poison survive a reload through the resume prompt, and damaging a
   copy to 0 Life then accepting lights Crouched + Incapacitated on the row and in the menu.
   `check` 0 errors / 0 warnings, lint clean on `src`, 323 tests.
6. **Docs**: `functional-spec/01` describes the three-panel menu and the row icons;
   `technical-spec/01` gained the status glyph palette. The `QWEN.md` vitality sentence still
   reads `{ hp, sta }` — that file is protected from agent edits, so the one-line update
   (`{ hp, sta, statuses? }` plus the toggle/row-icon sentence) is left for a human hand.

## What was done in the last session (vitality menu: damage, heal, overheal)

The Army rows became interactive, closing the loop the vitality tracks started.

1. **Hover + click**: a row's border tints on hover; clicking it — or Enter/Space, since the row's
   click target is a `role="button"` wrapper inside the `<li>` (a `<li>` cannot take an interactive
   role, and a real `<button>` cannot contain the portrait and upgrade buttons) — opens
   `UnitVitalityDialog`.
2. **The menu** shows the larger tracks (`VitalityTrack large centered`) flanked by a damage button
   (marker + minus) on the left and a heal button (+) on the right. **Life overheals to double the
   base and the extra hearts render blue**; stamina has no headroom and caps at its base. Damage
   renders as an outlined marker with a black fill at 70 % opacity — the style specified for the
   later statuses. **Accept** commits, **Cancel**/Escape/backdrop discards.
3. **State**: `MissionProgress.vitality: Record<entryId, { hp, sta }>` (new `UnitVitality` type,
   defined in `domain/army.ts` so `progress` and `savedArmy` do not import each other). Absent
   means full, so untouched copies cost nothing. Decoded entry ids are position-based
   (`imported-N`), which is what makes the key stable across reloads. The values ride in the
   `ArmyView` bundle and persist with the run.
4. **Verified in a real browser — 17 assertions**: hover changes the computed border colour; the
   menu opens with the bigger track; two damage clicks render two empty hearts; healing to the cap
   reaches exactly double with that many blue hearts and disables `+`; stamina never exceeds its
   base and its recover disables at full; Cancel discards; Accept commits both tracks to the row;
   and the committed values survive a reload via the resume prompt.
5. **Docs**: `functional-spec/01` describes the menu, overheal and persistence; this file records
   the session.

**Next in this iteration:** further statuses join the same menu; the track already renders any
current/max pair, so they are additive.

## What was done in the last session (vitality tracks in the Army view)

The read-only Army rows now carry the live-tracking visuals, ready for the damage and status
feature that closes this iteration.

1. **`VitalityTrack.svelte`** (new): a column of markers for one stat — red **hearts** for HP,
   yellow **orbs** for stamina — taking `current` and `max`, so depletion later needs no markup
   change. Four markers per line, then a new line (HP 8 renders as 4 + 4). A depleted marker keeps
   its coloured outline with a black fill at 70 % opacity, exactly as specified for the future
   damage states.
2. **Wired into each Army row** on the right edge: HP track above, stamina track below, drawn from
   the copy's _effective_ stats (mount and upgrade effects included); a null stat renders no track.
   Each track exposes `role="img"` with an `aria-label` like `HP 4 of 4`.
3. **Nothing depletes yet** — `current` equals `max` everywhere. Making the row clickable to assign
   damage, and the further statuses, is the next step of this iteration and is untouched.
4. **Verified in a real browser** with an 8-unit Oni Clans army (Helian's pool tops out at HP 3, so
   it cannot exercise wrapping): every row carries both tracks, all start full, and HP 8 / HP 6 wrap
   to exactly two lines. The screenshot shows hearts above orbs on each row's right edge. `lint`
   clean, `svelte-check` 0/0, 313 tests.
5. **Docs**: `functional-spec/01` describes the tracks and notes the depleted style is pre-built;
   this file records the session.

## What was done in the last session (Pick Army + the read-only Army view)

The army builder and the mission flow finally meet.

1. **Upload Army became Pick Army** and works. It opens a picker listing the device's saved
   **standard**-format armies (Roster saves excluded — a run fields a standard list); picking one
   attaches it to the run. With none saved it asks _"It seems you don't have any saved armies. Do
   you want to create one?"_ — **Create one** jumps to the army builder, **Not now** closes.
2. **The attachment is a snapshot**, `PickedArmy { name, factionId, code }` on `MissionProgress`
   (`pickedArmy`), so it persists with the run, survives reload/resume, dies with the run on
   abandon, and cannot be changed by later edits or deletion of the save. `resetMission()` keeps
   it deliberately: a fresh play of the same mission still fields the same list.
3. **Selected Army panel** in the briefing, between Mission Description and Setup: army name,
   faction name in the faction colour, and an ✕ that detaches it.
4. **The tracker's Army view** renders the snapshot read-only: one row per copy (portrait, name,
   points, mount) plus a pill per picked upgrade. Portraits open the unit card and pills open the
   upgrade detail — both already pure-inspection components — but there are no steppers, upgrade
   slots, mount toggles or remove buttons, so the list cannot change. The unit/upgrade overlays
   render at the **screen root**, not inside the pane: the sliding strip carries a transform, which
   would otherwise become the containing block for their `fixed` positioning and trap them.
5. **Verified end to end in a real browser — 22 assertions**: the empty-state prompt on both
   branches; building and saving a standard army through the builder UI; picking it; panel
   placement between Description and Setup; ✕ removing it; the Army view showing name, faction and
   points with zero add and zero remove controls; the unit card opening and closing; and the pick
   surviving a reload via the resume prompt. `lint` clean, `svelte-check` 0/0, 313 tests, build OK.
6. **Docs**: `functional-spec/01` (Pick Army flow, Army view contents, new open question), `02`
   (briefing panel order), `08` (saved armies now feed the mission flow; snapshot-vs-link and
   Roster-excluded open questions), `technical-spec/05` (new "Saved armies and the picked-army
   snapshot" section), `QWEN.md` (`pickedArmy`, Pick Army), plus this file's TODO list.

**Left open on purpose:** the picked army is display-only (nothing validates it against the
mission), and Roster saves have no path into a run.

## What was done in the last session (solo tracker: three views + the open-game lifecycle)

Continuation of solo phase 2. After Start Game the tracker is no longer one long scrolling
screen — it is **three views behind a sticky tab bar** — and a solo run became an explicit
session with a resume/abandon lifecycle.

1. **Three views.** `MissionDetail` (solo) renders a sticky bar mirroring the briefing's: red
   **← Return** on the left, and three **Scoring / Army / Mission** buttons on the right with a
   glowing **spotlight** that slides under whichever is active (`aria-pressed`). A started game
   always opens on **Scoring**.
   - **Scoring** — `ScoreSummaryPanel` (new) → Results (editable, grouped per round) → Schemes.
   - **Army** — a stub that says so. It is the landing spot for the same "attach an army to a
     run" feature the briefing's disabled **Upload Army** button waits on; one decision unblocks
     both.
   - **Mission** — the four static panels only (Description + rule popups, Setup, Deployment
     Map, Quest Rules). Results and Schemes deliberately do **not** appear here, so nothing is
     rendered twice.

   The switcher is its own pattern rather than the army builder's segmented control: three equal
   `grid-cols-3` buttons with a one-cell-wide glow overlay translated by the active index, so the
   light _moves_ instead of a background repainting. (A first `flex` attempt gave the buttons
   unequal widths — `flex-1` floors each item at its label's content width — which broke the
   spotlight's thirds math; `grid-cols-3` makes the cells equal by definition.)

   A horizontal **swipe** steps between the views too (left = next, right = previous, clamped at
   both ends), reusing the army builder's gesture contract. It listens to touch/pen pointers only:
   a mouse drag is a text selection on desktop, and treating it as a swipe made the browser cancel
   the gesture and swallow the click mid-drag — the first implementation's failure mode, found by
   instrumenting the pointer events in a browser test rather than by reading the code.

   The views live in one **sliding strip** (`w-[300%]`, translated by the active index), so a
   switch slides the outgoing view out the way the gesture came from and the incoming one in from
   the opposite edge — the fluent swap. That made the tracker the app's **second full-height
   screen**: a shared document scroller would strand the player below a short view after reading a
   long one, whereas per-view scrollers also keep each view's scroll position across a switch.
   `touch-pan-y` had to go on the scrolling panes, not just the root — a scroll container with
   `touch-action: auto` makes Chromium reserve horizontal gestures and fire `pointercancel`, which
   silently killed the swipe until the panes got the property.

2. **The solo Command Panel drawer is gone.** Its contents — VP total, round stepper, Reset —
   moved into `ScoreSummaryPanel`, the first panel of Scoring, with the stepper turned horizontal
   (`[−] badge [+]`). `CommandPanel.svelte` was **deleted** (nothing else referenced it). Hot-seat
   keeps `CommandPanelTwoPlayer` untouched, and with it the `pr-10` right-edge reservation that
   solo no longer needs.
3. **Open-game lifecycle** (new, solo only): `domain/openGame.ts` (`{ missionId }`) plus
   `data/openGame.ts` under `oni-quest-advisor:open-game`.
   - **Start Game** records the open game (`beginGame()`).
   - **← Return** no longer navigates — it confirms _"Abandon this game? All progress will be
     lost."_ with **Keep playing** (prominent, and the Escape branch) vs **Abandon**. Abandoning
     deletes the open-game record **and** that mission's progress, then returns to the mission
     list.
   - **Reload/reopen** → `findResumableGame()` finds the record and the page prompts _"You have
     an open game: {mission}. Abandoning it loses all progress."_ with **Resume Game** /
     **Abandon**. Resume restores season, mission and progress and enters the tracker
     **directly**, skipping the briefing — that decision was already made.
   - A record whose mission the bundled content no longer has is dropped silently rather than
     offered.
   - The prompt is skipped when an online seat resumed instead: an online game wins, and the solo
     record survives for a later start.
   - Progress written before this feature has no record; it is picked up when that mission is
     next started, so nobody loses an old run to the upgrade.
4. **Both prompts reuse `ConfirmDialog`** instead of adding a dialog component. Its confirm
   branch is the red destructive one and Escape takes cancel, so mapping **Resume Game → cancel**
   makes the safe action the Escape branch by construction. Same trick for the in-game abandon
   (**Keep playing** → cancel).
5. **Verified in a real browser** (system Edge via Playwright's `channel`), **37 assertions**: no
   prompt on a fresh profile; lands on Scoring; the drawer is gone; round stepper and Reset
   present; the tab highlight follows the active view; the Army stub renders and hides scoring
   content; the Mission view has Setup/Map/Quest Rules and **no** score panel or scheme draw;
   VP math; Return → confirm → Escape keeps playing with progress intact; reload → prompt →
   Escape resumes into the tracker (not the briefing) with progress intact; reload → Abandon
   discards it (VP back to 0) and leaves no prompt; in-game Abandon returns to the mission list
   and leaves no prompt; zero console/page errors.
6. `npm run check` **0 errors / 0 warnings**, `npm run lint` clean, **313 tests pass**,
   `npm run build` succeeds. No new unit tests: the open-game seam is three `localStorage`
   wrappers and the rest is navigation, neither of which has a harness in this project — the
   browser pass covers that behaviour instead.
7. **Docs**: `05-command-panel.md` was **renamed** to `05-score-and-round-controls.md` (solo has
   no Command Panel any more) and rewritten around a per-mode table; `01` gained the three-view
   layout, the "Return means abandon" rule and a full open-game lifecycle table; `02` panel order,
   `03` where the total and Reset live, `04`, both READMEs (glossary + screen map + open
   questions), `technical-spec/01` (z-index and surface tables, new segmented- and
   spotlight-switcher rows, the
   padding reservation now hot-seat-only) and `QWEN.md` (OpenGame, the `open-game` storage key,
   the three-view `MissionDetail`, `ScoreSummaryPanel`, the mount-time resume). The 10 links to
   the renamed file were updated mechanically.

**Follow-up tweaks to the score panel, same session:** the Total VP block was centred; the
**"Current Score" title was removed** — the hero number is self-evident, and `Panel.title` became
optional for exactly this case; and the number was enlarged from `text-3xl` to `text-5xl` for
phone readability. Verified by screenshot: no heading inside the panel, the number's box 50 px
tall, and label and value both centred on the panel's midline.

## What was done earlier today (solo phase 2 — Start Game + grouped Results)

Phase 2 of the solo-view iteration, and the last item from the mission-briefing TODO list that
blocked the solo flow.

1. **Start Game is live.** `navigationStore.startGame()` switches `mission-briefing` →
   `mission-detail`, so the solo tracker is reachable by clicking for the first time since
   phase 1. Progress is loaded once, at the mission click, so Start Game changes only the
   screen — nothing re-initialises and any saved state for that mission is already in place.
   `MissionBriefing` gained an `onStart` prop; `+page.svelte` wires it.
2. **The interactive Results panel now uses the round-grouped layout.** `ResultsPanel` takes
   `entries: ResultsEntry[]` (from `groupResults`) instead of the raw `results` array, so a
   group renders as one card with a row per round 1–5 and **editable** boxes — the same layout
   as the briefing, differing only in interactivity. `MissionDetail` and `+page.svelte` pass a
   shared `resultsEntries` (renamed from `briefingEntries`, since it now feeds both panels).
   **No progress-shape change**: each round's boxes write to that round's own objective id,
   which the v2 schema already encodes.
3. **Deliberately unchanged:** plain ungrouped objectives render exactly as before — a native
   checkbox at `count: 1`, `IncrementBoxes` above it, red penalty styling on the ceasefire row.
   Only the grouped path is new, so missions without round groups look identical.
4. **Two small cleanups this enabled.** A grouped card's heading now strikes through once every
   scoreable round in it is maxed, extending the existing solo completion affordance to groups.
   And `ObjectiveRoundChip` came out of `ResultsPanel`: a plain entry can never carry a `round`,
   because the content guard requires `round` ⇒ `group` and `groupResults` groups every grouped
   entry, so the chip was unreachable there. It is still used by the hot-seat, online and
   lobby-preview panels.
5. **Verified in a real browser, not just by compiling.** Drove the running dev server through
   the system Edge install via Playwright's `channel` option (no browser download needed) —
   **25 assertions, all passing**: Start Game enabled while Upload Army stays disabled; the
   briefing's 16 read-only boxes (4 rounds × 4) with Round 1 locked as _No VP_ and the Important
   callout present; the tracker showing the same 16 boxes editable; VP math (box 2 of Round 2 →
   4 VP, re-clicking an achieved box steps back to 2, Round 5 scores independently → 4);
   persistence across a reload; Clue Trail still rendering its ceasefire penalty row plus four
   grouped rows; zero console/page errors. The throwaway script lived in `.qwen/tmp/` and was
   deleted afterwards.
6. `npm run check` **0 errors / 0 warnings**, `npm run lint` clean, **313 tests pass**,
   `npm run build` succeeds. No new unit tests: the layout is driven entirely by `groupResults`,
   which `domain/results.spec.ts` already covers, and stores have no test harness in this project.
7. **Docs updated** — `functional-spec/01` (screen map, the two-step solo flow, Screens 4a/4b),
   `03` (both solo panels collapse groups; per-mode table; the grouped-layout open question
   narrowed to hot-seat + online), `06` (hot-seat no longer contrasts itself against a disabled
   button), the functional README (screen map + open questions) and `QWEN.md`'s routes bullet —
   which also fixed a stray literal unicode escape sitting in that line where an arrow character
   belonged.

**Open decision left behind:** the tracker's **Return** still goes to the mission list, not back
to the briefing, so solo Return now skips a level. Deliberately not changed — it is a UX call.
Recorded in `functional-spec/01`'s open questions and in the TODO list below.

## What was done earlier today (Supply Run rescoring)

**Supply Run's Results were wrong**: a single `deposit-resources` objective at `count: 8` — one
flat pool of eight 2-VP deposits — instead of per-round scoring.

1. Converted to the additive v2 round/group format: one entry per scoreable round-end, all
   sharing the group `deposit-resources`, `count: 4` and `vp: 2` each, with round-neutral text
   ("…at the end of the round…"). Rounds **2–5**, so the briefing renders five rows with Round 1
   as a locked _No VP_ row — structurally identical to Clue Trail, just four boxes instead of one.
2. **Round 1 does not score** because Resources cannot be looted then: the mission's own Quest
   Rules forbid Interacting with Intrigue Tokens during Round 1, and a model can only deposit what
   it already carries. This is a _rules_ exclusion, **not** the ceasefire guard — Supply Run is
   `ceasefire: false`. That distinction is written into the new guard's comment so nobody later
   "fixes" it by adding Round 1 back.
3. Added an `important` callout — _"Models may not Interact with Intrigue Tokens during Round 1."_
   — reusing the Quest Rules wording verbatim rather than inventing any. The locked Round-1 row
   renders beside Results, which is where a player looks for the reason; Magic Stones does the
   same.
4. **New content guard** in `lib/data/missions.spec.ts` pinning the shape (one
   `deposit-resources` group, rounds `[2,3,4,5]`, `count === 4`, `ceasefire === false`), matching
   the existing Awaiting Reinforcements guard. **313 tests pass** (was 312).

The objective id changed from `deposit-resources` to `deposit-resources-round-N`, so any
previously saved Supply Run progress that ticked the old eight boxes is orphaned — inert rather
than broken, since VP math only sums ids the mission actually defines.

Still unconverted: the grouped per-round card renders **only in the Mission Briefing**. The
interactive tracker, hot-seat and online still show Supply Run as four separate cards with
`R2`…`R5` chips — the "bring grouped Results to hot-seat + online" TODO.

## What was done earlier today (overlay Escape handling)

The first defect surfaced by the docs survey, fixed on its own. **`Escape` did nothing in the
army dialogs unless focus happened to sit inside them.**

1. **Root cause.** `SaveArmyDialog`, `LoadArmyDialog`, `UnitCard`, `ArmyUpgradePicker` and
   `ArmyUpgradeDetail` bound `onkeydown` to their backdrop `div`. A `div` is not focusable, so
   the handler only fired while the event bubbled up from a focused descendant — e.g. while
   typing in the Save dialog's name input. Click anywhere else first and Escape went dead.
   `ConfirmDialog` had no Escape handling at all, which is also why `LoadArmyDialog`'s
   documented "Escape unwinds a pending delete confirmation" never worked.
2. **Fix: a shared Escape stack**, `components/escapeKey.ts` — `onEscapeKey(handler)` returns a
   disposer, used as `$effect(() => onEscapeKey(close))`. One window listener dispatches to the
   **topmost** registered handler only. A stack rather than a per-overlay window listener is
   required because these overlays nest: Load Army over the builder plus its delete confirm, a
   unit card plus its rules popups. Separate listeners would close _several_ layers per keypress
   — and in `LoadArmyDialog` would run `cancelOrUnwind` twice, closing the dialog along with the
   confirm. `UnitCard` registers a single handler covering its whole popup stack, so it still
   unwinds one popup per press. All seven overlays now use it, including `RuleCalloutDialog`,
   whose correct-but-local window listener was refactored onto the helper so it cannot
   double-fire when stacked.
3. **Two knock-on fixes the a11y lint forced.** Removing the card-level `onkeydown` exposed
   `a11y_click_events_have_key_events` on the four `role="dialog"` divs carrying
   `onclick={(e) => e.stopPropagation()}`. Those handlers existed only to shield the backdrop's
   close-on-click, so outside-click now tests `event.target === event.currentTarget` on the
   backdrop — the pattern `SaveArmyDialog`/`LoadArmyDialog` already used, and
   behaviour-preserving including for nested `UnitCard` popups. `svelte-check` is back to
   **0 errors / 0 warnings** (it reported 4 mid-fix). `role="presentation"` backdrops are exempt
   from that rule, which is why the backdrops never warned.
4. **Behaviour added, not just repaired:** `ConfirmDialog` now closes on Escape, taking the
   cancel branch — Escape never confirms. That makes it consistent at all four of its call sites:
   the army format switch, the mount-conflict warning, closing an online game, and deleting a
   saved army.
5. **Covered by tests** — `components/escapeKey.spec.ts`, 7 cases: topmost-only dispatch, other
   keys ignored, fallback once the top is disposed, mid-stack dispose, one shared listener
   attached/detached, double-dispose a no-op. It stubs `window` with `vi.stubGlobal` because the
   vitest environment is `node`. **312 tests pass** (was 305).
6. **Docs updated with the fix**: the convention is written into `lib/components/CLAUDE.md`,
   `technical-spec/01-visual-theme.md` explains the stack and the a11y rationale, and the
   `functional-spec/08-army-builder.md` open question is removed.

Untouched: backdrop click behaviour, all styling, and every other defect from the survey's list
below — they remain open questions in the specs.

## What was done earlier today (docs catch-up — no code changes)

Started from a single stale fact — `QWEN.md` and `docs/functional-spec/04-schemes-panel.md`
both still gave the pre-v0.4.1 scheme draw brackets — and turned into the full `docs/`
catch-up that `QWEN.md` had been deferring ("catch them up when the behavior is considered
stable"). **Docs only; no source file changed.** 305 tests pass, `lint` clean.

1. **`docs/` grew from 7 spec documents to 14** (9 files to 16 counting the two READMEs).
   Everything existing was rewritten against the code, and seven new documents cover the
   features that had no spec at all:
   `functional-spec/05-command-panel.md`, `06-two-player-hot-seat.md`,
   `07-online-two-player.md`, `08-army-builder.md`, `technical-spec/04-scheme-data-format.md`,
   `05-army-data-format.md`, `06-online-architecture.md`. Both spec READMEs were rebuilt
   (entity glossary now covers online and army-builder entities, plus a screen map).
2. **Method**: three parallel code surveys (presentation layer / army builder / online
   backend) plus direct reading of `domain`, `stores` and `data`. Every claim was verified
   against the implementation, not carried over from the old docs or from
   `MULTIPLAYER_PLAN.md` — which is why the surveys also produced a divergence list.
3. **`QWEN.md` corrections** (four, all verified): the draw brackets are **≤13 → 2, 14–15 → 3,
   ≥16 → 4**; `COMMON_FACTION_ID` is **dead** — no card uses it, so `shared.json` means "in 2+
   decks", not "in every deck"; a `schemeDraft` survives _deleting the chosen Scheme_ but **not**
   a mission `Reset` (which rebuilds from `createEmptyProgress()`); and the Docs section now
   indexes the full spec set instead of saying the specs lag. `src/lib/domain/CLAUDE.md`'s rule
   example was stale the same way and is fixed too.
4. **`MULTIPLAYER_PLAN.md`** (local-only): the §9 open question about updating the docs is
   resolved, a §10 decisions row records the catch-up, and the **eight places where the code has
   moved past the plan** are now written down in `technical-spec/06-online-architecture.md` —
   SSE notifications carry no `seq`; the joiner's seat token is **client-generated**, not
   server-issued; `round-snapshotted` payloads are `{round, player1, player2}` not `{vp1, vp2}`;
   `faction-drafted` payloads are partial; there is **no `applyEvent`/replay**; `closeGame`
   refuses once finished/closed; §2.2's scheme-box row omits the reveal gate §8 added; and §9's
   "30 days" retention is superseded by the shipped 90.
5. **Findings were recorded as Open questions, not fixed** — this was a docs session, so each one
   is written into the relevant spec's Open questions with enough context to act on later. The
   ones that look like genuine defects rather than gaps:
   - **`Escape` was focus-dependent in four army dialogs** — `SaveArmyDialog`, `LoadArmyDialog`,
     `UnitCard` and `ArmyUpgradePicker` bound `onkeydown` to non-focusable backdrop `div`s, so it
     only worked while focus happened to be inside. **Fixed immediately after this commit**; see
     the overlay Escape notes below.
   - **The Roster equipment pool can never receive the Paimon cost reduction.**
     `armyUpgradeCostReduction` only scans per-entry `upgrades`, and Roster entries carry none,
     so `rosterPickPoints` always charges raw cost. Needs a rules ruling before it is "fixed".
   - **`pendingJoinNickname` is not stripped server-side** — `viewForSeat` puts it in every
     seat's view and only the client hides it. Harmless today (a pending join exists only while
     seat 2 is empty) but the visibility filter should not depend on that coincidence.
   - **Hot-seat `activePlayer` is not persisted**, so a reload silently returns control to P1 —
     potentially showing P1's hidden scheme to whoever holds the phone, which is exactly what the
     swap countdown exists to prevent.
   - **The Command Panel's `Reset` has no confirmation**, unlike every other destructive action
     in the app, and it wipes objectives, scheme, draft _and_ round (both players, in hot-seat).
   - Dead/misleading copy: `OnlineLobby` still renders _"Round controls arrive in the next
     update."_ for an `active` game; `"Do you really want to close the game ?"` has a stray
     space; the close-confirm cancel button reads **Keep playing** in the lobby but **Cancel** in
     the game view.
   - Inconsistent rendering: completed-objective strike-through is solo-only; `count: 1` renders
     as a native checkbox in some panels and a single increment box in others; upgrade
     descriptions strip rich links in the picker/detail dialogs but render them in the unit card;
     the item box labelled **PW** actually shows `toughness`.
   - `armyCode.ts`'s header comment documents the layout as `A<fp3>:…` but `CODE_VERSION` is the
     lowercase `'a'` the spec asserts — comment is wrong, code is right.
   - **No content spec for schemes or army JSON** (missions have six guards). The 20-cards-per-deck
     invariant, scheme id uniqueness, `incrementVp.length === maxIncrements`, and army invariants
     like "every trait ref resolves" are all unverified.
6. **Solo `mission-detail` remains unreachable by clicking** (Start Game is disabled in the
   briefing) — unchanged from the previous session, and now documented as such in
   `functional-spec/01-navigation-flow.md` rather than being a surprise during testing.

## What was done in an earlier session (mission briefing — solo phase 1, unreleased)

The second iteration of the features starts with the **solo view**, split into two
phases. Only phase 1 exists so far: clicking a mission opens a read-only **Mission
Briefing** instead of the interactive tracker. Nothing here is tagged or deployed — it
sits on `develop` ahead of v0.6.4.

**Phase 1 = the briefing** (new `mission-briefing` screen, `MissionBriefing.svelte`):
no scheme selection, no VP scoring, no Command Panel. A sticky top bar carries three
buttons — red **← Return** (works, back to mission select), blue **Upload Army**
(disabled; a major feature later) and emerald **Start Game** (disabled; it will move to
phase 2). Hot-seat two-player is untouched and still goes straight to `mission-detail`
— `selectMission()` now branches on `gameMode`. Panel order: mission title (own panel,
centered `text-3xl` headline) → Mission Description (flavour text, then the Broken
Morale / Ceasefire labels) → Setup → Deployment Map → Results → Schemes (read-only:
"Can be selected when the game starts.") → Quest Rules.

1. **v2 Results schema, additive**: `ResultObjectiveDef` gained `round?: number` and
   `group?: string`, with the convention _one entry per round_ and round-neutral
   texts. Chosen deliberately over collapsing the per-round entries into a single id:
   five missions (Clue Trail, Magic Stones, Quarter War, Snail Chase, Toxic Infestation)
   already had per-round ids, so annotating them changed **no id and no count** —
   persisted progress, VP math, hot-seat, the online state and the wire protocol all
   stayed untouched. Awaiting Reinforcements was the exception (its rounds were
   implicit in `count: 4`) and was split 3 → 12 per-round objectives; its previously
   saved solo progress resets, which is the accepted cost.
2. **`groupResults()`** (`lib/domain/results.ts`) turns the flat objective list into
   `ResultsEntry[]`: plain objectives pass through in order, grouped ones become a card
   at their first member's position with a row for **every** round 1–5 and
   `objective: null` where nothing scores. User decision: always 5 rows, so round
   colors line up across missions and a locked round is explicit rather than implied.
3. **Round accents are shared now**: `components/roundAccent.ts` owns the green→red map
   (plus a translucent row `background`); both Command Panels import it instead of
   keeping private copies, and the briefing rows use the same hues at `/10` opacity.
4. **`ResultsBriefingPanel`** renders the cards — objective text + VP, then one row per
   round tinted with that round's color, a round label, and that round's boxes
   **disabled** (user decision: show them inert, so phase 2 only has to enable them).
   Locked rows read "No VP". Ungrouped objectives (Open Hostilities, Supply Run,
   Treasure Hunt, Toxic Infestation's Avatar) and the red ceasefire card render as
   before.
5. **Deployment map visuals**: frame border down to `/20` and `rounded-xs` (2 px —
   "reduce the rounded edges almost completely"), zone outlines dashed
   (`stroke-dasharray="1.2 0.8"` in inches), and each zone carries a centered bold
   **"Deployment Zone"** label plus its range in the zone's own saturated hue
   (red-400 / sky-400) instead of the old pale corner text. Radial zones use a smaller
   size to fit inside the corner arc.
6. **Round chips in the other modes**: since the grouped texts are round-neutral,
   `ObjectiveRoundChip` (`R2`…`R5` in the round's color) went into `ResultsPanel`,
   `ResultsPanelTwoPlayer`, `OnlineResultsPanel` and `OnlineMissionView` so they don't
   lose the round information. They still render one card per objective, so Awaiting
   Reinforcements shows 12 cards there until they adopt the grouped panel.
7. **Rule-callout overlay bug — a regression from this session's own extraction, found
   by the user and fixed**: moving the Broken Morale / Ceasefire labels into
   `RuleLabels` had moved the popup _inside_ `Panel`, whose `backdrop-blur` makes it the
   containing block for `position: fixed` descendants — the overlay covered only that
   panel and every later panel painted over it. Split into `RuleLabels` (buttons, emits
   `onOpenRule`) + `RuleCalloutDialog` (overlay), rendered as a **sibling** of `Panel`
   by `DescriptionPanel` and `MissionDescriptionPanel`, at `z-50` (was `z-30`) with the
   app's standard `bg-slate-950/70 backdrop-blur-sm` backdrop; clicking anywhere outside
   or Escape closes it. The rule is written into `lib/components/CLAUDE.md`. The army
   builder's popups were checked and are fine (rendered at `ArmyBuilderView`'s top
   level, outside its blurred panels).
8. **Other component work**: `MissionTitlePanel`, `MissionDescriptionPanel` and
   `SchemesBriefingPanel` are new; `RuleLabels` / `RuleCalloutDialog` came out of
   `DescriptionPanel`, which now renders identically to before.
9. **Tests**: 305 passing (was 297) — five `groupResults` specs
   (`lib/domain/results.spec.ts`) plus new content invariants in
   `lib/data/missions.spec.ts`; the ceasefire Round-1 guard now checks the `round`
   field, not only the text. `check` and `lint` clean. The mission JSONs were migrated
   by a throwaway script and verified so that **only the `results` arrays** differ from
   HEAD.

### TODO / next

- **Finish unifying the top button bar.** `ScreenHeader` now renders the season and mission
  selects, the briefing in both local modes and both local trackers; the mode select, the online
  screens and the army builder each still place and color their buttons differently and should
  move onto it.
- **The picked army is display-only**: nothing validates the attached list against the
  mission (points, faction, required units), and Roster saves cannot be picked at all.
  Both are deliberate for now; revisit if the army should matter beyond reference.
- **Bring the grouped Results to online** (both local modes have it now), so Awaiting
  Reinforcements stops rendering 12 separate cards there.
- **`activePlayer` is not persisted**, and now that a reload resumes a hot-seat run through the
  open-game prompt, the hole is one accidental refresh wide: whoever holds the phone after the
  reload sees Player 1's hidden scheme. Persist it, or force a countdown on load.
- **Visual sign-off still pending** on the radial "Deployment Zone" label fit (Quarter
  War, Toxic Infestation), 4-box rows at phone width, and whether the filled `bg-red-500`
  Return is notable enough.

## What was done in earlier sessions (v0.6.4 scoring hotfix)

Two player-reported scoring bugs, both around the 1st Round Ceasefire. Released
as **v0.6.4**.

1. **"Ceasefire broken" is scoreable three times**: the penalty is incurred per
   breach (every Attack/damage in Round 1 costs −4 VP again), but
   `CEASEFIRE_OBJECTIVE` had `count: 1` — a single checkbox, so a second breach
   could not be recorded. Now `count: 3`, i.e. up to −12 VP. All three modes
   picked the boxes up automatically because the panels branch on `count > 1`,
   and the online endpoint clamps against the same `objective.count` from the
   bundled content — no server change needed. The total was already uncapped
   downwards (the rule says a party may drop below 0; no panel clamps at 0), so
   three breaches show as e.g. "−11 / 10".
2. **Red boxes for the penalty**: `IncrementBoxes` gained an optional `tone`
   prop (`'score' | 'penalty'`), passed as `penalty` for the ceasefire row from
   `ResultsPanel`, `ResultsPanelTwoPlayer` (both seats) and
   `OnlineResultsPanel` (both seats) — otherwise the shared component would
   have rendered sky-blue ✓ boxes inside the red card. (The single-checkbox
   branch's red styling in the two local panels is now unreachable for this
   objective; left in place.)
3. **Round-1 scoring removed from the ceasefire missions**: Quarter War shipped
   `stronger-presence-round-1` and `uncontested-round-1` (10 → 8 objectives),
   and Awaiting Reinforcements' three per-round objectives had `count: 5` — one
   box per round including round 1 — now 4. Clue Trail was already correct
   (Rounds 2–5 only) and is the pattern both now follow.
4. **Both missions gained the amber `important` note** "Players cannot score VP
   during Round 1 (Ceasefire)." — `important` was already wired into every
   Results view (`MissionDetail`, `MissionDetailTwoPlayer`, `OnlineGameView`,
   `OnlineMissionView`), so no component change was needed.
5. **Persisted counts are clamped in the VP math**: `calculateTotalVP` and
   `calculateTwoPlayerVP` cap a stored checked count at `objective.count`.
   Saves (and in-flight online games) from before the fix could hold 5 ticks on
   a now-4-box objective, and the old reduce kept paying out the removed
   instance while the UI showed only 4 boxes. Removed Quarter War round-1 ticks
   simply stop counting — that objective no longer exists in the content, which
   is the intended outcome. No migration needed for either storage.
6. **New content guard**: `src/lib/data/missions.spec.ts` — the first spec
   outside `lib/domain`/`lib/server` — fails when a ceasefire mission ships a
   Results objective whose text mentions Round 1, and pins Awaiting
   Reinforcements' 4-box round-ends, so neither bug can come back with the next
   mission added. Tests 290 → 297; check/lint clean.

## What was done in earlier sessions (model size + builder scrolling)

Released as **v0.6.3**.

1. **`size_info` migrated** — the last rules-relevant character field left in
   the producer dump. All 63 characters carry `size_info: { id, size }`, and
   all 57 imported units now have a **required** `ArmyUnitSpec.size`. The `id`
   is discarded: it is a per-character Strapi relation id (63 distinct ids for
   7 sizes) and the dump has no size catalog, so only the label is usable.
   Values across the roster: Medium 46, Large 5, Huge 4, Small 3, Gigantic 3,
   Colossal 1, Epic 1 — the last two occur only on faction-less summons the
   import skips, but they are real rungs (the Art of Sorcery / Cryomancy spell
   text excludes exactly those two from Knockback).
2. **Modelled as an ordered literal union, not a string**: `ARMY_UNIT_SIZES`
   as const (`small` … `epic`, smallest first) → `ArmyUnitSize`, plus
   `armyUnitSizeRank` / `armyUnitSizeAtMost` / `armyUnitSizeLabel` in
   `domain/army.ts`. Every size rule in the game is a comparison ("Size Medium
   or smaller", "two or more Sizes larger"), which a free-form string cannot
   answer; the union also matches the house style (no TS enums anywhere in the
   repo, and `ARMY_STAT_KEYS` → `ArmyStatKey` already does the const-array
   trick). The ladder **order is inferred** — nothing in the dump states it, it
   was derived from the value set plus that spell text.
3. **The import is the data gate**: `data/units.ts` loads the content JSON
   behind a type assertion, so `npm run check` cannot see a bad size value.
   The import's `sizeId()` therefore **throws** on an unknown or missing label
   — the only thing standing between a producer typo and a silently wrong gate.
4. **Flying Carpet's size ceiling automated**: `parseUpgradeRequirement` now
   also reads "may be equipped by a model of Size Medium or smaller" into
   `requirement.maxSize`, and `entryUpgradeBlock` gates on it through the
   existing `'requirement'` block reason (the picker already renders that as
   "Model does not meet the requirement", so no new UI text was needed). It is
   the only size-gateable rule in the catalog; Unwieldy ("Size: Medium or
   smaller → STK can never exceed 1"), Stagger / Knockdown / Knockback ("two
   or more Sizes larger than the attacker") and Trample stay prose.
5. **A mounted model counts as its mount's size** (player decision): the
   Medium Slayer Dragoon becomes Huge on Lupus Rex and can no longer take
   Flying Carpet. Implemented as `ArmyUnitSpec.mount.size`, denormalized onto
   the rider exactly like the mount's `points` already was — which is what lets
   `entryUpgradeBlock` gate a mounted copy without a mounts catalog and
   without touching its signature (~30 call sites). Domain
   `effectiveUnitSize(unit, mounted)` + `ArmyRosterRow.effectiveSize`; the
   `UnitCard` takes a `size` prop the same way it takes `stats` and prints
   "Size: X" between the unit name and the faction line.
6. **Mounting cannot leave an illegal upgrade behind**: a size-capped pick made
   on foot used to survive the mount toggle, so domain `mountToggleConflicts`
   lists the picks the toggle _newly_ blocks (each is judged as a fresh pick
   against both the current and the toggled state, so the `'owned'` guard stays
   out of the way and still-legal upgrades are untouched). The page confirms
   through the shared ConfirmDialog ("Mount this model? Its size changes, so
   Flying Carpet will be removed.", Yes/No) and the store's `toggleMount` drops
   them via `removeEntryUpgrade` — the same "the page confirms beforehand"
   pattern as `setFormat`.
7. **Backward compatibility**: the new field does not invalidate army codes or
   saved armies (`catalogFingerprint` hashes unit ids, mount pairings and
   upgrade effect kinds only — pinned by a new spec). But `importArmy` returns
   `'invalid'` when a replayed pick is blocked, so a pre-size code holding a
   _mounted_ dragoon _with_ Flying Carpet is now rejected instead of silently
   trimmed. Accepted: that list is genuinely illegal under the new rule.
8. **Builder panel scrolling fixed** (player report: scroll the long Available
   list, pick a unit, flip right — and the short Your Army panel left you far
   below your army, so you had to scroll back up). The root was
   `flex min-h-dvh flex-col`: a _minimum_ height, so the root grew to the full
   length of the unit list, the panels' `min-h-0 flex-1 overflow-y-auto` lists
   never got a height to scroll within, and the **document** became the one
   scroller shared by both panels. Now `h-dvh overflow-hidden` — the header
   (Main Menu, format toggle, Copy/Save, points badge) stays pinned and each
   panel scrolls itself, keeping its own position across flips. Note this is
   the only full-height screen in the app; every other screen scrolls the
   document, and internal scrolling elsewhere uses a definite height
   (`UnitCard`'s `max-h-[85dvh]`).
9. **`overscroll-contain` on both lists**: even with a definite height the
   document is still `100dvh + footer` tall (`+layout.svelte` stacks
   `flex-1` content and the footer in a `min-h-dvh` column), so scrolling
   chained into it. It showed only in Your Army — a short list cannot scroll
   at all, so it passed every gesture straight to the page and the button bar
   slid away, while Available Units behaved. `overscroll-contain` stops the
   propagation; a list that cannot scroll is permanently at its boundary.
   Dragging on the header or card padding still reaches that ~90px of document
   scroll, which is what keeps the footer (artwork credit + version) reachable
   on this screen. Needs Safari 16+.
10. **New picks scroll into view**: `addArmyUnit` appends and the pick happens
    on the other panel, so an `$effect` on `entries.length` scrolls the Your
    Army list to its end when the army grows. Both panels stay in the DOM
    while the track is translated, so the new row is already in view by the
    time the player flips. The count is seeded inside the effect (not at
    module scope — Svelte flags that as `state_referenced_locally`), so
    mounting with an existing army via a code import or a saved army does not
    scroll.
11. Tests 275 → 290; check/lint/build clean.

## What was done in earlier sessions (Roster armies)

1. **Roster format implemented** (the old disabled Roster tab is live): a
   roster army is units + mounts (no per-unit upgrades) plus a separate
   equipment pool built from the faction's upgrade catalog — steppers in an
   "Equipment" section of the Available panel, picked copies listed in a
   second "Equipment" block of Your Army (×qty, total cost, remove). Each
   copy costs points toward the 125 cap and is capped by the upgrade's
   per-army `limit` (domain `addRosterPick`/`removeRosterPick`/
   `rosterPickPoints` + specs).
2. **Format switching guarded**: pressing Standard/Roster with a non-empty
   list opens the shared ConfirmDialog ("…will be deleted", Yes/No); the
   store's `setFormat` clears entries and picks on an actual switch.
3. **Codes & saves are format-aware**: the share code gained an optional
   picks section (`:<upgrade36>.<qty36>` tokens, tournament only; standard
   codes with one are rejected, old codes still decode); `importArmy`
   replays picks through the limit/faction guards; saves store `format`
   (absent on pre-roster saves = standard) and the Load Army dialog filters
   Standard/Roster via a toggle. 275 tests, check/lint clean.

## What was done in earlier sessions (Save Army / Load Army)

1. **Save Army** (builder header, was a greyed teaser): opens a dialog with a
   name input (Save / Cancel, outside click or Escape cancels) and stores
   `{ id, name, factionId, code, createdAt }` in `localStorage` under
   `oni-quest-advisor:saved-armies` — the army code carries the whole list,
   so a save is just metadata plus code. New domain `savedArmy.ts`
   (`SavedArmy`, `groupSavedArmies` + spec), new `data/savedArmies.ts`,
   `armyBuilderStore.saveArmy()/refreshSavedArmies()`, new
   `SaveArmyDialog.svelte`.
2. **Load Army** (faction select, below Import Army): `LoadArmyDialog.svelte`
   lists the saved armies grouped by faction (config order, faction-colored
   bordered chips as headers), newest first, one name per row (the save date
   only drives the sort order); picking one replays the stored code through
   `importArmy` (guards intact — an import can never be invalid) and opens
   the builder on the Your-Army panel. Stale saves from before a roster
   update show the roster-mismatch error on their row instead of loading.
3. **Delete saved armies**: each load-list row carries a ✕ that opens the
   shared `ConfirmDialog` ("Delete \<name\>?" — Yes/No); confirmed deletes go
   through `data/savedArmies.ts removeSavedArmy` +
   `armyBuilderStore.deleteSavedArmy`, and the list refreshes reactively.
4. **Panel flip tabs made unmissable** (player feedback: the edge button was
   easy to miss): same positions as before (right `›` on Available Units,
   left `‹` on Your Army) but inverted to the app's primary-button look —
   solid sky-300 tab with a bold slate-950 glyph instead of the translucent
   slate tab with a sky glyph.

## What was done in earlier sessions (army builder polish: unit-card divider + compact stepper)

1. **Unit card divider fixed**: Spellcrafts sat below the divider together with
   Inventory/Stratagems, but it belongs to the model's rules — the card now
   reads Skills → Traits → Combat Arts → Spellcrafts, divider, then Inventory
   → Stratagems, and the divider only renders when something sits below it.
2. **Compact unit stepper** (Available Units panel, phone wrapping): at count
   0 the disabled `−` and the `0` are hidden — the row shows only `+` — and the
   stepper buttons shrank 40 → 36 px with tighter gaps, freeing ~75 px of row
   width for the unit name. Touch targets stay ≥ 36 px; portraits untouched.
3. **Builder header compacted**: the copy button's label shrank to
   "Copy Army Code", and toggle/copy/save now sit in one left-aligned group
   (points badge keeps the right edge) instead of spreading via
   justify-between.
4. **Header rows rebalanced**: the Standard/Roster toggle moved up beside
   `← Main Menu`, freeing the second row for Copy/Save + the points badge.
   To make the top row fit on ~360 px phones, the faction name left the
   header (its color still tints the panels/unit frames) and the Roster tab's
   visible "not yet implemented" sublabel became a tooltip on the greyed-out
   disabled tab.
5. **Touch swipe fixed**: the panel swipe only ever worked with a mouse — on
   touch, the browser fires `pointercancel` (not `pointerup`) once it claims
   the gesture for scrolling, so the handler never ran on phones. The panel
   container now sets `touch-action: pan-y` (browser keeps vertical scrolling,
   JS gets horizontal drags) plus a `pointercancel` reset; edge arrows and
   taps stay as they were.

## What was done in earlier sessions (initial-load performance: lazy army content + portrait resize)

Shipped in **v0.6.2**.

1. **Army content lazy-loaded**: the six JSON globs and both artwork globs in
   `data/units.ts` are now non-eager, so `loadArmyX()` return Promises and the
   catalogs/artwork ship as separate chunks. `contentStore` is two-phase:
   `load()` stays synchronous (missions, factions, schemes — the immediate
   flow) and a new idempotent async `loadArmy()` (with `armyLoaded` flag) fills
   everything army-related. The page triggers `loadArmy()` on the army-builder
   button and shows a "Loading army builder…" hint on the faction select until
   it resolves; the builder screen is only reachable through that gate, so
   `importArmy` (army codes) keeps its synchronous contract.
2. **First-screen portraits resized**: `Chiohime.png` 1024×1024 / 845 kB →
   212×212 / 71 kB and `Rasetsu.png` 1024×1536 / 1046 kB → 212×318 / 97 kB
   (rendered at ≤106 px, so 212 px is 2× display) — ~1.7 MB off the first
   screen. Faction logos (261–725 kB PNGs) and upgrade artwork (43–64 kB JPGs)
   remain a follow-up.
3. **Build**: the 502 kB chunk warning is gone — largest client chunks are now
   134 kB (page) + 92 kB (core), army catalogs split into on-demand chunks.
   check/lint clean, 261 tests pass.

## What was done in earlier sessions (v0.6.1 hotfix: rules-link repairs)

Today's `develop` commit: `5c9684f`.

1. **Piercing Stream link repaired**: the producer dump ships the spell's
   effect as broken markup `(Armor-Piercing([trait.ARMOR_PIERCING]` (stray
   paren), which leaked as raw text without a link. A new `SOURCE_LINK_FIXES`
   table in the import repairs known bad producer markup before parsing
   (also a `trait.POSION` typo in one item), so the spell shows the
   clickable Armor-Piercing trait link.
2. **Leveled links parsed**: Roman (`[trait.POISON.II]`) and numeric
   (`[trait.KNOCKDOWN.1]`) level suffixes are kept on the link as a level;
   Roman suffixes previously leaked as raw text in two stratagems, numeric
   ones were silently dropped on ~180 links. `rulesLinkPopup` opens leveled
   links with the levels above the suffix greyed out. Content regenerated —
   zero raw-markup leaks left. (One producer inconsistency kept as-is:
   `(Sweep I)[trait.SWEEP.2]` — text and code disagree.)
3. Tests 260 → 261; check/lint/build clean. Released as v0.6.1 hotfix.

## What was done in earlier sessions (army codes: export/import)

Today's `develop` commit: `1f82129`.

1. **Army codes** (`domain/armyCode.ts`): the whole list — faction, format,
   every copy, mounts, upgrades with their spellcraft/option/item/element
   selections — serializes to a short share code (tens of characters, far
   below JWT length): base36 indexes into the sorted content catalogs with
   `_`/`-`/`=`/`,` separators, prefixed by a version char `a` and a 3-char
   FNV-1a roster fingerprint derived from the catalogs themselves (units
   incl. mount pairings, upgrade ids + option order, spellcrafts, items,
   faction order).
2. **Roster safety**: indexes shift when the roster changes, so the decoder
   compares fingerprints first — codes built on a different roster version
   are rejected ("created with a different roster version") instead of
   silently decoding into wrong units. Decoding is strict on every range and
   structure, tolerant of case and whitespace on input.
3. **Guaranteed-valid imports**: `armyBuilderStore.importArmy` replays every
   pick through the existing domain guards (`addArmyUnit` copy limits,
   `toggleArmyMount`, `addEntryUpgrade` gating incl. selections) after a
   faction-membership check, so an import can never yield an invalid army.
   Success sets faction/format/entries and flags `startOnArmyPanel` — the
   builder opens directly on the Your-Army panel.
4. **Export UI**: "Copy Army Code to Clipboard" button beside the
   Standard/Tournament toggle (wraps below it on narrow screens, disabled
   while the army is empty). The outcome shows in a persistent panel under
   the header — "Army code copied to clipboard ✓" or a clipboard-unavailable
   hint — with the code itself selectable/long-pressable, cleared on any
   army change (the original 2 s label flash + `window.prompt` fallback
   looked like the button did nothing, especially on phones).
5. **Import UI**: a centered input + "Import Army" button below the faction
   grid on the faction select screen, with inline error messages; the handler
   catches unexpected throws and shows a "reload the app" hint (added after a
   stale hot-reloaded store in dev made the button silently dead —
   `openImportedArmy` missing from the old in-memory navigation store).
6. Tests 248 → 260; check/lint/build clean. (Note: the eagerly loaded
   content chunk crossed 500 kB and tripped Vite's size warning for the
   first time — a future lazy-loading candidate.)
7. UI polish on top: filled copy-button colors and white faction-select
   labels; the Tournament toggle was renamed **Roster** and disabled with a
   "not yet implemented" hint, and a greyed-out **Save Army** teaser button
   now sits beside the copy button (both upcoming features; the
   `tournament` format itself stays in the domain and in army codes).

## What was done in earlier sessions (Sand Kingdoms selection upgrades)

The pass over the upgrades that carry a selection inside them (the Helian
League ones shipped in the session before) reached its last faction — the
Sand Kingdoms. Today's `develop` commit: `d46ef5c`.

1. **Arcane Tome audited, unchanged**: it already carried the same
   `spellcraftLevelUp` treatment as Adept Shaper from the upgrades phase
   (choice step when several spellcrafts can advance, auto-pick when only
   one, `spellcraftLevelCap` gating, icon alias) — verified end to end, no
   code change needed. Conjured Retinue and Personal Guard likewise stay
   text-only: they affect summoned creatures, so there is nothing to pick
   on the model itself.
2. **Elemental Lineage codified** — new choice option kind `grantTrait`:
   pick 1 of 4 Affinities (Fire/Water/Earth/Air); the element merges into
   the unit's existing `affinity--element` trait ref (Djinnborn Marzban
   style) or adds the ref when the unit has none. Options for already-held
   elements are disabled ("Model already has this Affinity").
3. **Mana Catalyst codified** — new choice option kind `replaceAffinity`:
   pick the new element (Fire/Water/Earth/Air). A single current element is
   replaced automatically; multi-Affinity units (Djinnborn Marzban,
   Spelldancer Aeroturge/Voidcaster, Vizier of Conjurations) open a second
   "Replace an Affinity" picker step choosing which element goes (stored as
   `removedElement` on the choice, lowercase). Blocked for models without
   an Affinity; options for held elements disabled. Both upgrades ripple on
   automatically — unit-card trait tags, spellcraft popup spells and the
   Arcane Tome level cap all follow the changed affinities (pinned by a
   spec: Elder→Fire raises the Art of Sorcery cap 1→2).
4. **Latent gating bug fixed**: `entryUpgradeBlock` computed the upgraded
   unit without the entry's `upgradeChoices`/`itemIndex`, so stacked
   choice upgrades gated against the un-granted unit — both are passed now.
5. Tests 237 → 248; check/lint/build clean.

## What was done in earlier sessions (army builder: stratagems, inventories, upgrades)

Today's `develop` commits: `a3b0225`, `16ef7ef`, `8fdb247`, `9c18ba6` plus the
closing selections work — one continuous army-builder arc:

1. **Unit card restyle**: the spell table became element-grouped spell cards
   (Elder-first, PW/STK resolved against unit stats); the 11-column stat table
   became a tinted stat-box grid; a divider separates the unit rules (Skills,
   Traits, Combat Arts) from Spellcrafts, Inventory and Stratagems, which all
   render inline — no extra clicks.
2. **Stratagems**: `stratagems.json` ← `strategmList` (58 entries, slug-name ids
   — a third have no code); units carry id arrays (20 of 57 units, matched by
   name), rendered as cards grouped by type chip (Authority/Subterfuge/Tribe).
3. **Inventories**: `items.json` ← `itemList` (84 entries + one synthetic
   Imported Casting Amplifier); RCH parsed into structured range brackets
   (`0-20": 0`, AoE/text fallbacks); units carry `inventorySpace` + `{id, qty}`
   slots; the header shows `(used/total Space used)`; item cards show PW/RCH/
   STK/QTY/WGT stat boxes with the stat derivation kept visible (`T (8) +2`).
4. **Standard-mode upgrades**: `upgrades.json` ← `upgradeList` (45 entries;
   ids suffixed with the faction — Seasoned Combatant exists twice); faction
   access (four main factions own + neutral; oni/goblin/guild neutral-only);
   slots per copy = 1 + Resourceful level + Pouch count; rulebook exceptions
   carry `upgradesLocked` (Tomoe, Kogetsu, Seigen, Tharos, Anari, Na'ra,
   Chiyohime, Chanra — the generic Goblin Shaman is NOT locked); picker
   overlay with artwork and gating reasons; picked upgrades render as icon
   tree labels with emerald cost boxes and a red remove button; costs flow
   into the army points, including Devotion: Paimon's army-wide "other
   upgrades cost 1 less (min 1)".
5. **Conditional & choice mechanics**: conditional stat boosts
   (`insteadIfTrait`/`extraIfClasses` — the three Devotions, incl. the parsed
   "Cannot be assigned to a model with the Demon trait" requirement);
   spellcraft level-ups (Adept Shaper/Arcane Tome) gate on the affinity-based
   level cap (`spellcraftLevelCap` — spellcraft catalog specs carry no levels
   map) and open a choice step when several schools can advance; choice
   upgrades (`choice` effect with options) — Glyphscribe: Reduce Weight offers
   _Inscribed Item_ (pick a weapon/shield with weight, casting amplifiers
   excluded → STK +1, WGT −1 via per-row item overrides the unit card merges)
   or _Inscribed Armor_ (+1 AG/SPD, +1 inventory space). Selections persist on
   the entry (`spellcraftChoices`, `upgradeChoices`) and validate in
   `addEntryUpgrade`.
6. Tests 182 → 237; check/lint/build clean.

## What was done in earlier sessions (spellcrafts + spell tables)

1. **Spellcrafts & spells migrated**: `content/units/spellcrafts.json` ←
   `spellGroupList` (18 groups, id + name) and `content/units/spells.json` ←
   the groups' 100 spells — group/element/level/effect (rich links included)
   plus the parsed stat columns: **PW** (fixed numbers/symbols, or a stat
   reference with an optional `modifier` — `Int -3` → `{ stat: 'INT',
modifier: -3 }`), **type** (categories + attack mode → "Spell, Sorcery |
   Ranged"), **RCH** (whitespace-normalized display text) and **STK** (fixed
   numbers/text or a stat reference). Spell ids collide across groups nine
   times (Flare, Inferno, ...) and are disambiguated with a group suffix.
   Units carry `spellcrafts` refs (`{ id, level }`).
2. **Access semantics** (`spellcraftPopupFor`, `affinityElements`,
   `spellCostDisplay` in the domain): the popup lists only the spells the unit
   can cast — its spellcraft group, level ≤ the ref level, elements from its
   Affinity trait refs (multiple affinities merge) — sorted Elder-first, then
   level, then name, with PW/STK resolved against the unit's stats:
   "INT (12) -3", "STA (2)".
3. **UI**: Spellcrafts panel after Combat Arts (orange tags, roman level
   suffix); the popup renders a scrollable spell table (Element | Lv | Spell |
   Effect | PW | Type | RCH | STK, element as a plain per-row column); effect
   links stack further popups as before.
4. Tests 161 → 174; check/lint/build clean.

## What was done in earlier sessions (combat arts + level lists)

1. **Combat arts migrated**: `content/units/combat-arts.json` ←
   `combatArtGroupList` — Archery, Assassination, Berserk, Fencing, Metamagic
   with the full per-level rule texts. Units carry `combatArts` refs
   (`{ id, level }`), the level being the _highest_ one the unit has access to;
   the unit card's panel order is Skills → Traits → Combat Arts (orange tags).
2. **Level-list popups**: leveled entries (skills, traits, combat arts) now
   store the catalog's text per level in a `levels` map on `ArmyRulesSpec`
   (replaces the old `levelText` overrides). Their popups show every level as
   its own section — levels up to the unit's level render normally, higher ones
   greyed out (Fencing III shows I–III normally, IV–V greyed). Titles and tags
   use roman level suffixes as printed (Charm I, Fencing III).
3. **Layout**: the unit card and rules popups became scrollable
   (`max-h`/`overflow-y-auto`) — the card outgrew phone screens with the extra
   panels.
4. Tests 156 → 161; check/lint/build clean.

## What was done in earlier sessions (army builder: per-copy entries + unit rules)

1. **Per-copy army entries**: every copy of a unit is now its own `ArmyEntry`
   (`addArmyUnit` takes an injected id, `removeArmyEntry`/`removeArmyCopy`,
   `armyCopyCounts`), so a single copy can be mounted or removed independently
   (the mount toggle flipped per-unit before, affecting all copies).
2. **Rules catalogs migrated**: the producer dropped a fuller export (now
   `data-import/units.json` — it carries the global catalogs in addition to the
   same 63 characters; the only character diff was Djinnborn Marzban's Affinity
   gaining Elder/Fire/Water). The import builds the centralized content from
   those catalogs: `classes.json` ← `classList` (23 entries), `skills.json` ←
   `skillGroupList` (24), `traits.json` ← `traitGroupList` (68 — includes the
   condition traits Knockdown, Bleeding, Engaged, Panicked, ...). One entry per
   group code with `levelText` where higher levels differ (Charm, Infiltration,
   Regeneration, Stealth; Resistance, Resourceful, Undead, Menacing); groups
   without per-level entries (Flight, Vigilance, Acute Senses, Special) fall
   back to the group description.
3. **Unit card rules UI**: classes as sky-blue tags (Broken-Morale-tag style)
   below the faction name; Skills/Traits panels below the stat table with
   orange tags (Random-button style). Units carry class ids plus `{ id, level }`
   skill refs and trait refs with `dynamicValue`/`dynamicElements`, which fill
   the `(X)`/`(Element)` template placeholders at display time
   (`substituteArmyTemplate`, e.g. "Resistance (Spell) 2", "Survival (Scorching
   Environment)").
4. **Rich-text links & stacked popups**: rules texts are stored as segments;
   the producer's `(Knockdown)[trait.KNOCKDOWN]` cross-references become link
   segments. A tag or link opens a popup; a link inside a popup pushes another
   popup on top (salami-style, e.g. Rogue → Knockdown → Crouched), outside
   click/Escape unwinds one layer at a time. All 17 distinct link targets in
   the imported texts resolve against the catalogs — zero dangling.
5. Tests 134 → 156; check/lint/build clean.

## What was done in earlier sessions (abandoned-game retention + army builder)

1. **Abandoned-game lifecycle** (`cleanup.ts`): retention windows — lobbies idle
   7 days and mid-play games (rounds 1–4) idle 30 days are deleted; stale
   **round-5** games are auto-finished server-side (existing `advanceToScoring` +
   `finishGame`, `game-finished` event with actor `server` + `autoFinished`
   payload flag) so a forgotten final click keeps its result for the future KPI
   export; finished/closed retention extended 30 → 90 days as a bridge until
   that export exists. Decisions logged in `MULTIPLAYER_PLAN.md` §9/§10.
2. **Army builder** (new main-menu feature): faction select (7 factions, RAL
   colors as border/text, faction logos, 3 per row) → builder view with
   Standard/Tournament toggle (85/125 caps, green/red points badge), sliding
   Available-Units/Your-Army panels (edge arrows + swipe), per-unit +/− stepper
   with counts and copy limits.
3. **Producer unit import pipeline**: `scripts/importUnits.mjs` transforms the
   producer's Next.js dump (`data-import/units.json`, git-tracking undecided)
   into our schema — per-faction `content/units/<faction>.json` + `neutral.json`
   (NEUTRAL-tagged units available to every non-monster faction) + `mounts.json`.
   57 recruitable units, 6 faction-less summons skipped. Portraits in
   `assets/uniticons/<Faction>/` unified to 70×70, matched by normalized name
   (Renegade Rasetsu borrows Red Rasetsu's portrait via alias); Vite inlines
   them (< 4 KB each).
4. **Unit card**: tapping a unit (either panel) opens a popup — portrait, name,
   faction name, 11-column stat table (STA…M, − for null); closes on outside
   click or Escape.
5. **Mounts**: Lupus Rex moved out of the roster into `mounts.json`; the Slayer
   Dragoon carries `mount: { unitId, points }` — army rows show the mount's icon
   as a toggle (green ✓ / red ✕), points adjust live (rider + mount cost per
   copy). Mount stats are split: `stats` override the rider's (non-null only),
   `statChanges` add on top (derived from the source's + prefixes and negative
   values); the unit card shows the mounted unit's effective stats.
6. Tests 104 → 134. All on `develop`, unreleased; pushing and the
   `data-import/units.json` track-or-ignore decision are pending.

## What was done in the last session (player-feedback round after v0.5.0)

1. **Join-accept race fixed** (`onlineGame.svelte.ts` + `+page.svelte`): the joining
   phone's poll cleared `pendingJoin` the moment the leader accepted — before the
   game-state fetch resolved — which tore down `OnlineJoin`'s polling `$effect`
   (its `cancelled` guard) before `onAccepted()` could navigate into the game.
   Players sat on the join screen until a reload (which resumed via the
   already-saved seat). The attempt now stays pending until the page calls the new
   `completePendingJoin()` after transitioning; `onReturn` cancels a pending
   attempt (`cancelPendingJoin()` had been dead code).
2. **Official artwork**: background swapped to the Eldfall Chronicles key art the
   game company provided (`OniQuestAdvisorBackgroundv3.jpg`, old background
   deleted); the footer gained the agreed artwork-credit line for Freecompany
   d.o.o.
3. **Neon border** for the headline feature: `.neon-border` utility in
   `layout.css` (rotating conic-gradient beam masked to the border ring, soft
   glow, `prefers-reduced-motion` aware), applied to the "Online 2 Player Game"
   button on the mode-select screen.
4. **`.gitattributes`** (`* text=auto eol=lf`, `*.png`/`*.jpg` binary) ends the
   Windows `core.autocrlf` status noise — `git status` is clean again.
5. **Privacy notice** (EU ePrivacy/GDPR): one-time bottom banner explaining that
   the app stores game data in browser local storage (similar to cookies), never
   stores personal data and uses no tracking; the dismissal persists per device
   (`data/notices.ts`, `PrivacyNotice.svelte`, wired via `navigationStore`).
6. **Online intro notice**: one-time modal the first time "Online 2 Player Game"
   is pressed — experimental-feature heads-up; "Continue" proceeds and persists,
   "Back" returns to the mode select (`OnlineIntroNotice.svelte`).
7. Released as **v0.5.1** and deployed to Fly.

## What was done in the session before (online-mode hardening: integrity, security, ops)

Cross-cutting audit of the phase 1–4 backend, then fixes — everything below
lives on `develop` together with the online mode itself:

1. **Lost-update race fixed**: every mutating endpoint used to read state,
   compute the next state, then write — two concurrent actions on the same game
   (both players scoring in the same Scoring phase is the normal case) could
   overwrite each other. The whole auth + read + guard + write cycle now runs
   inside one write transaction via `mutateOpen` / `mutateAsSeat` /
   `mutateAsLeader` (`gameRepository.ts`), serialized behind an in-process FIFO
   queue. The queue is necessary: the libsql client fails concurrent write
   transactions with `SQLITE_BUSY` instead of queueing them — the new
   concurrency spec caught this before it shipped.
2. **HTTP hardening** (new `src/hooks.server.ts`): 64 KB body cap on API
   requests, per-IP rate limits (game creation 20/hour, other actions
   120/minute), one log line per API request (path only — query strings can
   carry seat tokens and are never logged), `handleError` logging for
   unhandled errors.
3. **Ops baseline**: new unauthenticated `/api/health` probe (games per
   status, DB file size, open SSE streams — aggregates only) wired to a Fly
   HTTP check in `fly.toml`; the 30-day cleanup scheduler logs failures instead
   of swallowing them; SQLite runs in WAL mode with a busy timeout.
4. **Abuse caps**: SSE streams capped at 8 subscribers per game; unbounded
   game-creation growth is bounded by the rate limit. Note: abandoned
   lobby/active games are still kept indefinitely (MULTIPLAYER_PLAN.md §9),
   and the seat token still travels in the `/events` + `/join/status` URLs
   (EventSource limitation; one-time tickets noted as a follow-up).

**Testing status:** 104 unit tests — the 94 existing ones plus repository
specs (auth failures, rollback on guard errors, event ordering, concurrent
mutations) and rate-limiter specs; check/lint clean.

## What was done in earlier sessions (online 2-player mode, phases 1–4)

The big iteration: two players play together, each on their own phone, with the
server as the source of truth. The backend lives **in this project** (SvelteKit
`+server.ts` endpoints on adapter-node) — no separate repo; `lib/domain` is shared
between client and server.

1. **Phase 1 — Foundation + lobby/join** (`ac1efaa`): new `src/lib/server` layer —
   SQLite via `@libsql/client` (dev: `.data/oni-quest.db`, Fly: volume at `/data`),
   document-style `games` table + append-only `game_events` history. API under
   `/api/games/...` (create/state/join/accept/deny/close), SSE change notifications
   (clients refetch the full visibility-filtered state on each notification), seat
   tokens generated client-side (only SHA-256 hashes stored). UI: third mode button
   **"Online 2 Player Game"**, nickname → "Preparing the battlefield" → lobby with
   invite link, join request → leader Accept/Deny popup, session resume via
   localStorage.
2. **Phase 2 — Setup completion** (`76166de`): leader picks season/mission
   (dropdowns + "Select Mission"), both players draft faction/intelligence, scheme
   draw happens **server-side** (hand persisted per seat, choose/delete enforced
   against it), opponent visibility = faction + "Hidden Scheme", Start Game gate,
   collapsible mission panels (`Panel` gained a `collapsible` prop).
3. **Phase 3 — Round engine** (`35ab667`): per-round Reveal → Scoring phases. Reveal
   is a toggleable intent, committed (permanent + visible) when the leader advances;
   objectives and scheme boxes editable only during Scoring (frozen otherwise);
   leader-only phase buttons ("Round N Scoring" / "Proceed to next round"); VP
   snapshot per round computed server-side; Reveal auto-skips once both schemes are
   revealed.
4. **Phase 4 — Finish & statistics** (`292e226`): "Finish Game" after round 5
   scoring — auto-reveals all schemes, computes the winner, writes a `resultSummary`
   (winner, final VP, rounds played, factions, mission) onto the game state for
   future statistics export; statistics screen (victory/draw banner, 2-column ×
   5-round cumulative VP table, both scheme cards, "Return to Main Menu"). Cleanup:
   finished/closed games are deleted 30 days after their last update (on server
   start + daily).

**Key rules decided** (full decisions log in `MULTIPLAYER_PLAN.md` §10): the creator
is the leader (advances phases, selects the mission, may close/abandon anytime with
confirmation); schemes stay hidden until revealed — the opponent sees only the
faction; **scheme boxes can only be scored once revealed** (hidden schemes earn no
scheme VP — revealing is a secrecy-vs-scoring trade-off); hot-seat mode is untouched
by all of this.

**Testing status:** 94 unit tests (the whole online state machine is pure domain
logic with colocated specs); lint/check clean; API smoke tests walked the full flow
(create → join → setup → rounds 1–5 → finish, including all guard rejections) —
all passed. The interactive browser walkthrough on two phones is the outstanding
step before release.

## What was done in earlier sessions (v0.4.0 / v0.4.1)

1. **v0.4.0 — two-player hot-seat mode**: `TwoPlayerMissionProgress` with
   per-player objectives, per-player secret schemes (`schemeRevealed`, "Hidden" for
   the inactive player), `activePlayer` gating with a 6-second `CountdownOverlay`
   swap mechanic, dedicated `*TwoPlayer` component variants, separate localStorage
   key prefix (`oni-quest-advisor:2p-progress:`).
2. **v0.4.1 — scheme draw counts corrected** to the rulebook: INT ≤13 → 2 cards,
   14–15 → 3 cards, ≥16 → 4 cards (supersedes the v0.3.0 brackets below).

## What was done in earlier sessions (v0.3.0)

1. **Rules update — Scheme draw threshold** (later superseded by v0.4.1): brackets
   changed to ≤12 → 1, 13–15 → 2, ≥16 → 3 at the time.
2. **Game Mode select screen**: `GameModeSelect.svelte` as the app's entry point.
3. **Navigation flow restructured**: `game-mode` → `season-select` →
   `mission-select` → `mission-detail`.
4. **Inverted button styling** for Return/Back (`bg-sky-300 text-slate-950`),
   Random button orange.

## What was done in earlier sessions (v0.2.0)

1. Nearest-edge ruler measurements for map markers.
2. 10 VP cap on total mission score (`MAX_TOTAL_VP`), shown in the Command Panel.
3. Two new missions: Open Hostilities and Awaiting Reinforcements.
4. `CEASEFIRE_OBJECTIVE` — automatic −4 VP red-boxed objective for ceasefire
   missions.

## What was done in earlier sessions (v0.1.0 and before)

1. Migrated 6 new Season 2 missions from pasted rulebook text into JSON (Magic
   Stones, Clue Trail, Snail Chase, Toxic Infestation, Quarter War, Supply Run).
2. Deleted 3 placeholder/dummy missions (Cinder Vault, Obelisk Strike, Twin Spires).
3. Added an "Important" callout box under Results (bullet list, amber-highlighted) —
   new optional `important?: string[]` field on the `Mission` type.
4. Added a Round Tracker (today part of the `CommandPanel`): +/- buttons tracking
   the current round (1–5), persisted per mission.
5. Added a `quarters` map feature: an optional `quarters?: boolean` on `MapSpec`
   draws a grey cross splitting the deployment map into 4 quadrants.
6. Replaced `Chiohime.png`/`Rasetsu.png` with compressed versions and swapped the
   background image to a compressed `.jpg`.
7. Set up Fly.io deployment: `Dockerfile`, `fly.toml`, `.dockerignore`,
   `adapter-node`.
8. Added Command Panel with VP tracking, rule popups, all six faction Scheme decks,
   and app versioning.
9. Fixed 3 real bugs surfaced while building the above:
   - Ruler distance labels overlapping when two markers share a coordinate — now
     staggered (`rulerLabelOffset` in `MissionMap.svelte`).
   - Marker name labels overlapping when two markers sit close together — added
     `labelPosition?: 'above' | 'below'` on `Marker`.
   - The Results panel silently pushed VP text off-screen for high box counts —
     restructured to stack checkboxes under the text.

## How things work

### Architecture

`routes/` (pages wire data to components; `routes/api/games/**` are the online-mode
endpoints) → `lib/components` (UI) + `lib/stores` (app state, Svelte 5 runes) →
`lib/domain` (pure types/logic shared by client **and** server, no Svelte/browser
APIs) + `lib/data` (localStorage + static JSON loading + the online API/session
seam) + `lib/server` (server-only: SQLite persistence, SSE registry, seat-token
auth — never imported by client code). Each layer has its own `CLAUDE.md` — read it
before adding files there.

### Mission data

One JSON file per mission in `src/lib/data/content/missions/`, auto-loaded via
`import.meta.glob` in `lib/data/missions.ts` — dropping in a new file is enough, no
registration step. Shape (see `lib/domain/mission.ts`):

```
{
  id, season, name, description, brokenMorale, ceasefire,
  setup: [{ label, description }],
  map: { zone: { type: 'horizontal' | 'radial', rangeInches }, markers: [...], quarters?: bool },
  results: [{ id, text, vp, count, round?, group? }],
  important?: [string],
  questRules: [{ label, description }]
}
```

Round-scoped Results carry **one entry per round**: `round` says which round it scores
at the end of, `group` names the card the entries belong to, and `text` is
round-neutral ("at the end of the round"). `count` then means "instances scoreable in
that round" (4 Quarters, 2 Ink Snails, 1 Obelisk check). `groupResults()`
(`lib/domain/results.ts`) collapses a group into one card carrying a row for **every**
round 1–5, `null` where nothing scores — that is how a ceasefire mission's locked
Round 1 and Magic Stones' rounds 1/3/5 are expressed. `lib/data/missions.spec.ts`
guards the invariants (unique ids, `round` in range and always grouped, group members
interchangeable apart from their round).

Markers (`lib/domain/map.ts`): `{ id, x, y, shape: 'star'|'box'|'triangle'|'circle'|'x',
label, color, showRuler, labelPosition?: 'above'|'below' }`. The map is a fixed
36"x36" square (`MAP_SIZE_INCHES`). `showRuler: true` draws dashed guide lines plus
inch labels for that marker; if two ruler markers share a coordinate, their labels
auto-stagger so they don't overlap. `labelPosition: 'above'` flips a marker's name
label above the marker instead of below.

### Round tracking

`currentRound` (integer 1–5, clamped) lives on `MissionProgress` /
`TwoPlayerMissionProgress` / `OnlineGameState`. UI: the round stepper inside the
`CommandPanel` / `CommandPanelTwoPlayer` overlay (solo/hot-seat, manual); in online
mode the server advances rounds via the phase engine (`lib/domain/online.ts`).

### Deployment

- Fly app: `oni-quest-advisor`, region `fra`, https://oni-quest-advisor.fly.dev/
- `min_machines_running = 0` in `fly.toml` — machines stop when idle and cold-start
  on the next request. Online mode is built around this: state lives in SQLite,
  phones refetch + resubscribe SSE on wake. Measured: ~9 s cold start right after
  a deploy, ~1–2 s for later auto-stop wakes.
- **The volume exists since v0.5.0**: `fly.toml` mounts `oni_quest_data` at
  `/data` (`DATA_DIR=/data`); the 1 GB volume (fra, encrypted, scheduled
  snapshots) was created 2026-08-21. A fresh app clone would need
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1` before its
  first deploy.
- **Exactly one machine**: the architecture (single SQLite file + in-process SSE
  registry + mutation queue) cannot run on two machines — their databases would
  diverge. The legacy second machine was destroyed during the v0.5.0 deploy;
  after any manual scaling, check `fly machines list` and keep it at one.
- To redeploy: `fly deploy` from the project root. Needs either `fly auth login` or
  `FLY_API_TOKEN` set in the environment.

### Known gotcha

A commit-time content gate (from a Claude Code plugin, not part of this repo's own
config) scans staged diffs for "task residue" patterns and can false-positive on
innocuous substrings. If a commit gets blocked over clearly-unrelated content, just
reword that line.
