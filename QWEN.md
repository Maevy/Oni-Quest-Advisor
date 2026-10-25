2# Oni Quest Advisor

Companion web app for the Oni Quest tabletop game. Built to run as an installable app
on any phone (Android/iOS/other) via the browser — a web app, not a
native/platform-specific one. Used on a phone screen during a game session.

## Stack

- SvelteKit (Svelte 5, runes — runes mode is force-enabled project-wide in
  `vite.config.ts`) + TypeScript (strict)
- Tailwind CSS 4 (`@tailwindcss/vite`, forms plugin); Prettier sorts Tailwind classes
  automatically against `src/routes/layout.css`
- Vitest for unit tests (node environment, no browser)
- The local modes run entirely client-side: game data ships as static JSON bundled with
  the app and session state persists via `localStorage`. Online games and tournaments are
  server-backed through `/api/**` (libsql on the Fly volume, SSE change notifications).
- Deploys to Fly.io: `@sveltejs/adapter-node` builds a standalone Node server
  (`build/index.js`), packaged by the root `Dockerfile` and configured via `fly.toml`.

## Domain model

Each entry below carries the invariants that cause a regression when forgotten. The
_descriptions_ live in `docs/` — go there for the full behaviour rather than growing this
section.

- **Season** → top-level grouping of missions. Old seasons stay selectable even when
  outdated.
- **Mission** → belongs to exactly one season: name, lore description, setup items, a map
  (`MapSpec`), Results, optional `important` callouts (rules notes shown alongside Results —
  **not** scored) and quest rules. Ceasefire missions additionally get the automatic
  red-boxed "Ceasefire broken" objective (`CEASEFIRE_OBJECTIVE`, added by
  `getScoreableResults`): −4 VP per breach, scoreable 3 times. **Their own Results carry no
  Round-1 objectives** — the ceasefire forbids VP in round 1, guarded by
  `data/missions.spec.ts`. Marker rulers (`showRuler`) are measured from the **nearest** map
  edge (`rulerAnchor`) — always the shortest path a player would actually measure (≤ 18", one
  of the 4 corner combinations); **never revert to measuring from top-left**.
  Spec: `docs/technical-spec/02-mission-data-format.md`, `03-map-rendering.md`.
- **Faction** → a player-selectable side with its own 20-card Scheme deck; cards can be shared
  across several decks. A `common` pool for cards in every deck exists (`COMMON_FACTION_ID`)
  but **no card uses it** — `shared.json` means "in 2+ decks" and its cards enumerate explicit
  faction ids instead.
- **Scheme** → secret objective card drawn from a faction's deck. Draw count depends on
  intelligence: **≤13 → 2, 14–15 → 3, ≥16 → 4**. Cards have `factionIds`, `copies` (physical
  copies — uniform or per-faction overrides, e.g. Virtuous Commander: 4 Helian / 2
  elsewhere), `maxIncrements`, and either a uniform `vpPerIncrement` or per-box
  `incrementVp`. **Rulebook wording "X VP (to a maximum of Y)" with multiple boxes ⇒
  `incrementVp`** (e.g. `[2, 1]`), never a flat `vpPerIncrement` that would overshoot the cap.
- **Faction roster** → six factions, each deck exactly **20 physical cards** drawn from 27
  unique ones: Helian League, Empire of Soga, Coalition of Thenion, Sand Kingdoms, Monster
  Factions, Adventurers' Guild (no exclusives — its whole deck is shared). One
  `schemes/<faction>.json` per faction's exclusives; **a card moves into `shared.json` as soon
  as a second deck gets it**. Spec: `docs/technical-spec/04-scheme-data-format.md`.
- **Army Builder** → separate top-level feature (own screens, in-memory only): pick one of 7
  factions and build a list under a format cap (**Standard 85 / Roster 125**). **Every copy of
  a unit is its own `ArmyEntry`** (own id, independently mountable/removable). Unit content is
  generated: `scripts/importUnits.mjs` reads the producer dump in `data-import/units.json` and
  writes `content/units/*.json` plus the centralized catalogs (classes, skills, traits, combat
  arts, spellcrafts, spells, stratagems, items, upgrades) — **re-run on every producer update
  and review the diff**. Invariants:
  - Units carry points, a copy `limit`, an 11-key statline (`STA`…`M`, **null** when a model
    has no value), and a **required `size`** on the ordered `ArmyUnitSize` ladder
    (`small`…`epic`). **Sizes are compared by rank**, because every size rule is a ceiling or
    a "two Sizes larger" test. The importer **throws** on an unknown label — content JSON is
    loaded behind a type assertion, so a bad value is invisible to `npm run check`.
  - `upgradesLocked` marks the rulebook exceptions (Tomoe, Kogetsu, Seigen, Tharos, Anari,
    Na'ra, Chiyohime, Chanra).
  - **Standard upgrades**: per-copy picks; slots = 1 + Resourceful level + Pouch count;
    faction access (four main factions own + neutral; oni/goblin/guild neutral-only). Effects
    include `costReduction` (Devotion: Paimon discounts every other upgrade army-wide by 1,
    min 1), spellcraft level-ups and `choice` upgrades; selections persist on the entry
    (`spellcraftChoices`, `upgradeChoices`).
  - **Roster format** (internal id `'roster'`, renamed from `'tournament'` — `decodeArmy`
    still reads the legacy `t` character and `savedArmyFormat()` folds an old save's string):
    units keep mounts but carry **no** upgrades; the faction's upgrade catalog becomes a
    separate equipment pool (`rosterPicks`). Switching Standard↔Roster with a non-empty list
    asks for confirmation and clears it. Saves carry a `format` field (absent = standard).
  - **Cutting a roster to a match list** (`domain/armyConstraint.ts`): three budgets — copies
    per unit, **mounted** copies per unit, assignable copies per upgrade id. The pool records
    no target and no selection, so which copy gets which upgrade is always the player's
    choice. Adds a `'roster'` block reason **after** `'limit'`, so the tighter of the two
    wins. Nothing gates the point cap (the free builder never did) — `acceptCut()` refuses an
    over-cap list instead.
  - NEUTRAL-tagged units are available to every faction **except the monster ones**
    (`NON_NEUTRAL_FACTION_IDS`); mounts are never recruitable standalone. A mounted model
    counts as the **mount's size** (`effectiveUnitSize`) — because mounting can invalidate a
    size-capped pick, `mountToggleConflicts` lists what the toggle would drop and the page
    confirms before `toggleMount` removes it.
  - **Army codes** (`domain/armyCode.ts`): base36 indexes into the sorted content catalogs
    behind a version char + **FNV-1a roster fingerprint**, so codes from a different roster
    are rejected loudly instead of decoding wrong units. `importArmy` replays every pick
    through the domain guards, so **an import can never be invalid**.
  - **Saved armies**: `{ id, name, factionId, code, createdAt }` under
    `oni-quest-advisor:saved-armies` — the code carries the whole list, so a save is metadata
    plus code, and it shares the fingerprint check. Saved **standard** armies also feed the
    mission flow as a `pickedArmy` snapshot; hot-seat has one pick and one Army view **per
    seat**, and two seats may attach the same save — their vitality maps stay separate.

  Specs: `docs/functional-spec/08-army-builder.md`, `docs/technical-spec/05-army-data-format.md`.

- **GameMode** → `'solo' | 'two-player'`, tracked in `navigationStore.gameMode`. The third
  **"Online 2 Player Game"** button opens the server-backed online flow — its own screens, not
  part of `GameMode`.
- **MissionProgress** (solo) → checked objective counts, the chosen Scheme, a `schemeDraft`
  (faction/intelligence) that **survives deleting the chosen Scheme but not a mission
  `Reset`**, `currentRound` (manual, clamped to `MIN_ROUND`..`MAX_ROUND` = 1–5), `pickedArmy`
  (a **snapshot** — `{ name, factionId, code, format? }`, shared with the online seats and
  tournament registrations; read the format through `pickedArmyFormat()`) and `vitality`
  (entry id → `{ hp, sta }`, **absent = full**). Life overheals to double its base, the extra
  hearts blue. Total VP is capped at `MAX_TOTAL_VP` = 10.
- **Battle Flower** → one army copy drawn as its icon in a circular orb ringed by two half-rings
  of boxes: STA (yellow) on the left, HP (red) on the right. The ring always carries the
  **base** stat's boxes — a lost point empties its box from the bottom end and an overhealed
  Life **repaints** its extra points blue from the top end (an over-Stamina violet), so the ring
  never grows (`vitalityRingStates`). The States a copy carries hang off the flower as a **band of orbs over its
  shoulders**, just outside the ring — four slots down the left, four down the right, own glyph
  in its own colour, a `+n` chip in the last right slot past eight, absent on a clean copy,
  display-only. One flower per copy; a mounted copy is one flower on the mount's
  stats. Hot-seat's Army view is one panel split into a sky and an orange half, one flower per
  row, and **two gestures with two jobs** (reworked 2026-10-11). A **tap opens the Self
  Interaction dialog** — the same shell as the cross-model panel but with **one model, inert, at
  the top** between two _Self Interaction_ labels, and six buttons below: Assign Damage, Assign
  Healing, Assign/Remove Status, Assign/Remove Buff (_inert_), Model Info and Activation
  Management. The model at the top is a picture, not a control — no box taps, no tap-for-card — so
  every self action is a button: Damage/Healing open the shared **amount pad** (a calculator grid
  1…9 + OK, tinted red/green) and land on the dialog's own model; Status opens the shared **boxed
  State picker** (fourteen orbs, tooltip, Accept) whose Accept writes the draft to that model;
  Model Info opens the `UnitCard` above the dialog; Activation Management opens a **−1 / +1 /
  Accept** box that commits the net Stamina change (`onStamina`, over-Stamina to double the base)
  and walks the bars. **A drag acts on another model**: lifting a strip flower past an 8px
  threshold fades the States bands, follows the finger with a measured clone at the screen root
  and rings the hovered flower with a crosshair; dropping on one opens the **Interaction panel**
  (origin left, target right, an _Interaction_ arrow between), dropping on nothing returns the
  clone and fades the bands back. The panel offers seven actions regardless of friend or foe —
  Assign Damage, Assign Healing, Assign/Remove Status, Assign/Remove Buff (_inert_), Deal Stagger,
  Deal Stun, Trade Item (_inert_) — the first three reusing the pad and the boxed State picker,
  Stagger and Stun a confirmation; on confirm the glyph flies origin→target, the commit lands in
  the target seat's vitality map and its boxes walk before the panel folds. **Stagger spends one
  activation, Stun every one** (`vitalityAfterStagger`/`vitalityAfterStun`) — Stamina only, no
  State of their own; the self dialog swaps those three for Model Info and Activation Management.
  Both dialogs render at the screen root because the strip's transform traps `fixed` overlays. A
  drag is never the strip's view-swipe and never a self dialog (the click it leaves is swallowed).
  Incapacitated is **not a pick**: zero Life forces it (with Crouched) onto a living model and
  straight **Dead** onto an Undead one, a heal of at least 1 drops it again, and a second hit on a
  fallen model kills it; Dead — a pick of its own, never sharing a copy with Incapacitated — stays
  reachable because any flower is a valid drop target and the self dialog acts on its own model.
  Neither rides the band: the fallen wear a **yellow wash with the Incapacitated glyph** on their
  icon, the Dead a **red wash with the skull**.
- **OpenGame** (solo and hot-seat) → `{ missionId, mode }`, the marker that a local run is
  live, and the reason the app can offer to resume. The stored `mode` decides which progress
  store and which tracker the resume lands in; **records written before hot-seat joined the
  lifecycle carry no mode and read as solo**. Abandoning deletes it **and** that run's saved
  progress, so a run either resumes whole or is gone. Online has no equivalent — its state
  lives on the server.
- **TwoPlayerMissionProgress** → a `PlayerProgress` per seat plus a shared `currentRound`. Each
  seat is the shared `SeatProgress` (checked objectives, scheme, schemeDraft,
  `schemeRevealed` — the same shape online's seats use) plus two local-only fields:
  `pickedArmy` and `vitality`. Loaded through `hydrateTwoPlayerProgress()`, never by spreading
  a stored record — a shallow spread would leave a field added later as `undefined`.
  Objectives and schemes are tracked **per active seat**: Results binds to `activePlayer`, and
  only the active player sees their scheme (the other sees "Hidden" or "No schemes"). "Reveal"
  is permanent. **Only Player 1 may move the round.** The violet **Swap Player** button runs a
  6-second countdown then flips `activePlayer`; it is hot-seat's only game-level action —
  **there is no Reset**, a fresh play is Return → Abandon → re-pick. Per-seat VP is capped
  independently.
- **OnlineGameState** (server-authoritative; `domain/online.ts`) → statuses
  `lobby`/`active`/`finished`/`closed` × phases `armies`/`prep`/`setup`/`playing`. A game is
  **born set up** — the creator picks mission and army on a frontend-only draft screen and
  **Open Lobby** is the first server call — and Start Game is gated on both seats' **Ready**.
  Invariants:
  - **The preparation steps are phases, not statuses**, because `cleanup.ts` buckets retention
    by status literal — a new status would match no bucket and **leak forever**.
  - A seat carries a registered `army` and a **`combatArmy`**; `createEmptySeat` sets the
    latter to the registration when that is already Standard and to `null` for a Roster, which
    is what makes a seat read _"Needs a match list"_.
  - `leavePrep` seeds each seat's Scheme **faction from its combat army** via
    `schemeFactionForArmy()` and its **intelligence from the Leader's INT**, as a transition
    rather than a client call, so no seat can draw from a deck its army does not belong to.
    There is no `/draft` — the app knows both numbers.
  - **`schemeFactionForArmy()` is the monster-faction bridge**: five of the seven army ids are
    also scheme ids, but Oni Clans and Goblin Wartribes have no deck of their own — they are
    the two halves of Monster Factions and share its deck. Note `PublicSeatState.factionId` is
    a **scheme** faction (6 ids) while `army.factionId` is an `ArmyFactionId` (7 ids); they
    overlap on five and resolve against different catalogs.
  - **`startGame` is a total function** — a caller that forgets readiness gets no error, it
    silently keeps a lobby. Test fixtures go through a `readyUp()` helper.
  - The **client declares** the Leader's M and INT, because the game flow loads no army catalogs
    and cannot compute effective stats from a code — the same "client's word" ruling army
    legality rests on. Only those two numbers are published, only from `setup` on; the
    identity never travels.
  - Revealing a scheme is **one-way, at any moment** in a running round, behind a
    confirmation; hidden schemes earn no scheme VP.
  - The visibility filter (`viewForSeat`/`toPublicSeat`, which takes a `SeatReveal` record so
    a caller cannot forget to decide either half) publishes `rosterCode` only once the game is
    out of the lobby **and** the registration is a Roster — **a Standard registration's code
    is withheld forever**, and the cut army's code never leaves the server. `ready` and
    `combatReady` _are_ public, because leader buttons are gated on them.
  - **There is no `hydrateOnlineGameState`.** Online state is one server-side JSON document
    with no migration mechanism, so a shape change means **wiping the database**, not merging.
  - **The flower board's vitality is the interaction log folded**, not a state field: every
    commit is a `vitality-committed` row in `game_events` (round server-stamped), both devices
    fold the log into their boards (`foldHistory`), and an undo is an appended
    `vitality-reverted` that the fold skips — **actor-only, and only while their action is still
    the last one**. Each seat **publishes its own combat list as board entries** once the round
    runs (`publishedRoster`, exposed as `combatRoster`), because the server cannot derive entry
    ids from a code: the composition opens at play, the code never travels. Online, **only your
    own flowers lift and open the Self Interaction dialog**; the opponent's are drop targets.

  Spec: `docs/functional-spec/07-online-two-player.md`,
  `docs/technical-spec/06-online-architecture.md`. `MULTIPLAYER_PLAN.md` (local-only) is
  design history.

- **Tournament** → an event run by a Tournament Organizer (TO).
  Configuration is a **local three-pane wizard** on a `TournamentDraft`
  (`domain/tournament.ts`, panes in `TOURNAMENT_SETUP_STEPS`): basics, Missions & Tables,
  Overview. **Nothing is persisted or sent while configuring**; Create Tournament first shows
  the retention notice (data kept 48 hours _after the tournament concludes_ so a report can be
  generated) and only then makes the first server call. The field is **4–32 stepping in
  pairs** — an even field needs no bye rule — and a playing TO **holds one of those seats**
  rather than adding to them, and must attach a Roster army to continue.
- **TournamentState** (`domain/tournamentEvent.ts`) → the server-authoritative event: status
  `lobby`/`active`/`concluded`/`closed`, the configuration, and one seat per pairing slot.
  Pure `create`/`join`/`leave`/`cancel` transitions with `can*` guards, plus
  `viewForTournamentToken` (organizer and seated players see army **names and factions**,
  never codes or tokens) and `peekTournament` (what the join screen may show before joining).
  Invariants:
  - Players arrive through `/tournament-join/[code]`; **Join takes the first free seat** — a
    full field refuses joins, there is no waitlist and no per-join approval. A seat session is
    stored under `oni-quest-advisor:tournament-session`.
  - A stored session makes the next app start **prompt** rather than drop the player in, and
    **Abandon is the only way out and always calls the server** — a participant frees their
    seat (`/leave`), the organizer cancels (`/cancel` → status `closed`, **seats kept** so
    every device still authenticates). There is no local-only exit, because that is what
    stranded seats. Players may not leave once the event is `active` (a seat in a pairing
    needs a forfeit rule first); the organizer may still cancel it.
  - `/start` needs **≥ 2 registered players with at most one seat empty** — the configured
    tables must all get a pairing, and one empty seat is exactly the BYE's case. An **occupant**
    is `{ kind: 'seat', seatIndex }` or `{ kind: 'bye' }`; the BYE is a first-class occupant
    the organizer assigns like anyone else.
  - **The assignment gate is not just "everybody assigned"**: with four tables and six
    players, 2/2/1/1 assigns everybody and still strands two of them without an opponent, so a
    table holding a single occupant blocks Start Round.
  - **A round walks `setup` → `game` → `scoring`** (`TOURNAMENT_ROUND_PHASES`) and the phase
    is server state. `/start-round` moves it to `game`, which **locks the tables** for
    everybody — a pairing cannot change under a match being played, and there is no way back.
    `scoring` is **nobody's click**: the round lands there when its last table reports, and from
    there the organizer's `/next-round` (or `/conclude` after the last mission) is the only way on.
  - **A table's match is an ordinary online game the tournament owns.** `round.tables` and
    `round.matches` are parallel arrays created together; the game id is **derived**
    (`tournamentGameId` = `CODE-R{round}T{table}A{attempt}`), never allocated, so two devices
    pressing Enter Game at once aim at one row — the second insert meets a primary-key conflict
    and joins the first game. `createTournamentGame` fills **both seats** from the registrations
    (no join, no invite code, mission from the round), and `/enter-game` re-mints the caller's
    seat token, which is the recovery path for a device that lost its session. A finished game
    reports its VP into the **cumulative** standing (`recordTableResult`, idempotent — a stale
    game auto-finished by retention and a leader's last click can both arrive); the table's
    occupant order _is_ the game's player1/player2 order. A closed game **replays** (the attempt
    bumps, giving the replay a fresh id) — there is no organizer score override. A BYE table is
    settled at round start with `BYE_VICTORY_POINTS` = 5, so it never holds a round open.
  - **The megaphone** (`state.messages`, newest first, capped, each with `readBy`) reaches a
    player inside the match it interrupts: per-table composers on the round board plus a
    broadcast in the organizer's header, and an inbox in a player's header on the board and on
    all six online screens. Messages belong to the round they were sent in; reading is per seat.
  - **A concluded event frees no seat.** Its exits (Leave / End Tournament) are local-only,
    because a freed seat would drop that player out of the archived standing the 48-hour report
    window exists to keep — which is also why `/leave` still refuses after the conclusion.
    `completedRounds` (pairing, results, cumulative totals) is the report's raw material.
  - **The report is a client-side PDF** (`domain/tournamentReport.ts`, on the shared writer in
    `domain/pdf.ts`): the organizer's conclusion screen fetches `GET /report` — organizer token
    only — which returns the archived rounds **plus every played match's interaction log** under
    its derived game id; the device folds the event-wide damage/healing rankings (model with its
    owner in brackets, self-recorded hits unattributed, undone out) and downloads. Nothing is
    persisted; a table nobody entered reports an empty log rather than failing.
  - The roadmap (`tournamentRoadmap`) is **derived, not stored**: three steps per configured
    mission plus a final conclusion.
  - **The QR symbol is encoded in-app** (`domain/qr.ts`: byte mode, EC level M, versions 1–6,
    mask 0, rendered as SVG) — no third-party generator, because the link is the credential to
    join.

  Spec: `docs/functional-spec/09-tournament.md`.

## Architecture

Layered structure. Dependencies only point downward — never sideways, never up.

```
src/
  routes/          → presentation: the page(s), just wire stores to components
                      (+ api/games/** and api/tournaments/** endpoints)
  lib/
    components/    → presentation: reusable UI pieces (props in, callbacks out)
    stores/        → application/state layer (class-based singletons)
    server/        → server-only: SQLite persistence, SSE, auth, rate limiting
                      (online games and tournaments)
    domain/         → domain: types + pure logic functions (shared client/server)
    data/            → infrastructure: content loading + localStorage/API wrappers
```

Rule of thumb: **routes → components/stores → domain/data**; for the online API:
**routes/api → server → domain**. `server` never imports stores/components.

- `domain` never imports from `stores`, `data`, or Svelte; no `window`/`document`,
  no `Math.random()`/`Date.now()` — randomness/time are injected (`Rng` parameter)
  so every function is pure and unit-testable.
- `data` never contains business logic. Static content is loaded eagerly via
  `import.meta.glob` from `src/lib/data/content/{missions,factions,schemes}/*.json`; unit
  content is generated by `scripts/importUnits.mjs`. The `localStorage` keys, all prefixed
  `oni-quest-advisor:` — `mission-progress:<id>` (solo), `2p-progress:<id>` (hot-seat),
  `open-game` (the single live-run marker, with its mode), `saved-armies`, `online-session`,
  `tournament-session`, `notice:<id>` (one-time acknowledgements). The remote seam is
  `onlineApi.ts` / `tournamentApi.ts` (fetch wrappers over `/api/games/...` and
  `/api/tournaments/...`, the latter including the unauthenticated peek the join screen
  uses).
- `stores` are classes in `.svelte.ts` files (`armyBuilderStore`, `contentStore`,
  `navigationStore`, `missionProgressStore`, `twoPlayerProgressStore`, `onlineGameStore`,
  `tournamentStore`, `tournamentEventStore`), exported as singletons from `stores/index.ts`.
  They orchestrate — decisions live in `domain`, side effects in `data` — and expose
  purposeful methods, not raw mutable state. `onlineGameStore` and `tournamentEventStore` are
  **server-driven**: they send intents to the API and refetch the visibility-filtered view
  (SSE notifications trigger refetches), and **never mutate game state locally**. Persisted
  progress is loaded by merging onto empty defaults (`domain.createEmptyProgress()` for solo,
  `domain.hydrateTwoPlayerProgress()` for hot-seat, which merges **each seat** separately) —
  keep that pattern when extending either progress type. `navigationStore` owns
  `builderReturn` — `borrowArmyBuilder(returnScreen)` hands
  the army builder to another flow (the online prep step cutting a roster) so both its exits
  go back there instead of `game-mode`.
- `routes` (`+page.svelte`) switches screens on `navigationStore.screen` and wires store
  state/methods to component props/callbacks. It holds no business logic, no direct
  `fetch`/`localStorage` and no new type definitions. Two things are easy to get wrong: the
  `online-game` id renders **six** different views chosen by the fetched state rather than by
  a click, and the tournament screens follow the fetched event **status** through an effect —
  so a leader's or organizer's action moves every device without a reload. On mount the page
  resumes a stored online seat, then a stored tournament seat, and otherwise offers to resume
  an open local game. `api/**/+server.ts` are thin handlers over `lib/server`;
  `api/health/` is the unauthenticated ops probe; `join/[code]/` and
  `tournament-join/[code]/` are the invite-link entry points. Cross-cutting API concerns (body
  cap, rate limits, request logging) live in `src/hooks.server.ts`. `+layout.svelte` renders
  the fixed background, the site-wide footer (fan-project disclaimer, artwork credit for
  Freecompany d.o.o., and `__APP_VERSION__` — injected by `vite.config.ts` from
  `package.json`; **bump the version there for releases**) and the one-time `PrivacyNotice`.
  The full screen map is `docs/functional-spec/01-navigation-flow.md`.
- `components` are presentational: `$props()` in, callbacks up. Avoid importing stores
  directly — the page wires them. Domain _types_ are fine for prop typing, domain _logic_ is
  not. Rules that have caused regressions:
  - Seat colours (P1 sky / P2 orange) come from `playerAccent.ts` as **literal class strings**
    — never build them by interpolation, Tailwind only sees whole names.
  - **Full-height screens** (`ArmyBuilderView`, `MissionDetail`, `MissionDetailTwoPlayer`,
    `OnlineTracker`) are an `h-dvh overflow-hidden` root with a pinned header and per-panel
    `overflow-y-auto overscroll-contain` lists. Going back to `min-h-dvh` makes the document
    the one scroller shared by all panels and strands the player far below a short panel after
    scrolling a long one. Every other screen scrolls the document normally.
  - **Any transformed _or_ backdrop-filtered ancestor becomes the containing block for a
    `fixed` descendant**, so overlays render as siblings of `Panel` with the parent holding
    the open state — or better, at the screen root. This has shipped as a regression twice
    (the sliding strip's `translateX` trapped `RuleCalloutDialog` off-screen behind its own
    backdrop). See `docs/technical-spec/01-visual-theme.md`.
  - `ScreenHeader` is the shared top bar for every screen with somewhere to go back to; its
    actions container wraps so a four-up switcher fits a 320 px phone, and its red ← Return is
    `shrink-0 whitespace-nowrap` (squeezed by a wide switcher it used to wrap onto two lines
    and silently grow every header). On a live online screen Return **keeps the seat session**
    so the next launch resumes; only terminal exits — End game, a closed/finished lobby's
    Return to Main Menu, the reconnect-error button — drop it.
  - Svelte **eats whitespace at an inline `{#if}` boundary**: `every player{#if odd} and the
BYE{/if}` renders as "playerand the BYE".

Each layer folder has its own `CLAUDE.md` with the specific rules for that layer —
read it before adding files there.

## Conventions

- TypeScript strict, no `any`. Domain types in `lib/domain` are the single source of
  truth — don't redefine
  `Mission`/`SchemeCard`/`MissionProgress`/`TwoPlayerMissionProgress`/`SeatProgress`/
  `PlayerProgress` shapes elsewhere.
- Svelte 5 runes only (`$state`, `$derived`, `$props`) — no legacy
  `writable`/`export let` style.
- Mobile-first, touch-friendly layouts, large touch targets. Visual theme: dark,
  cold, blueish; outlined buttons; translucent "frosted glass" panels (see
  `docs/technical-spec/01-visual-theme.md`). In 2-player mode, Player 1 uses the
  standard sky-blue accent and Player 2 uses orange — the pair is defined once in
  `components/playerAccent.ts` (`SEAT_ACCENTS`, `PLAYER_SEATS`) and every component
  that shows a seat reads its recipe from there. The `.neon-border` utility in
  `layout.css` (reduced-motion aware, `prefers-reduced-motion` falls back to a static
  glow) marks **one** entry point at a time — currently the Solo button on the mode
  select, in sky; `.neon-violet` re-colours the beam for the hot-seat Swap Player
  button, violet being the swap mechanic's hue.
- Prefer pure functions in `domain` over logic in components/stores/routes. Game
  rules (draw counts, clamping, VP math, unique draws) belong there, covered by a
  colocated `*.spec.ts`.
- Formatting is Prettier: tabs, single quotes, no trailing commas, print width 100.
  Run `npm run format` rather than hand-formatting.
- Repo files are committed with LF endings (Prettier enforces LF). `.gitattributes`
  (`* text=auto eol=lf`, `*.png`/`*.jpg` binary) pins LF checkouts on every machine,
  so `core.autocrlf=true` on Windows no longer produces phantom `git status` noise.

## Commands

- `npm run dev` — dev server (http://localhost:5173) · `npm run build` /
  `npm run preview`
- `npm run check` — svelte-kit sync + svelte-check (type check, strict)
- `npm run lint` — prettier --check + eslint · `npm run format` — prettier --write
- `npm run test` — vitest run (tests: `src/**/*.{test,spec}.ts` — `lib/domain`,
  `lib/server`, `lib/stores`, plus a mission-content spec in `lib/data`)

After code changes, verify with `npm run check`, `npm run lint`, and `npm run test`.
**`npm install` is blocked on this machine** — no new dependencies.

## Git & releases

- Day-to-day work happens on **`develop`** (remote: GitHub `Maevy/Oni-Quest-Advisor`).
  Releases fast-forward merge `develop` into `main`, tag **`vX.Y.Z`** (annotated),
  and push branch + tag. Commit messages here are detailed by design — they are the
  authoritative record of why a change was made.
- Current release: **v0.10.0** (2026-10-25 — summoning across all three modes, and attaching an
  army by pasting its code), tagged on `main` and deployed the same day with **no database wipe**:
  it touches neither `domain/online.ts`, `lib/server` nor `routes/api`.
- **The persisted online shape has no migration mechanism** — no `hydrateOnlineGameState`
  exists, so a field added to an online seat or game leaves older rows reading as corrupt (a
  missing combat army reads as combat-ready). v0.9.0 needed a database-wide wipe for exactly
  that, and a wipe takes the tournament tables with it. It is destructive on shared
  infrastructure: **confirm explicitly before every one**. The procedure that worked is in
  `PROGRESS.md`; `flyctl` on this machine needs the user's own interactive `flyctl auth login`
  first.
- **Online mode needs a Fly volume**: before the first deploy containing it, run
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1` (the `[mounts]`
  entry in `fly.toml` expects it; the deploy fails without it). It has existed since v0.5.0,
  so a deploy from this clone only needs `fly deploy`.
- Don't stage local tooling state: `.idea/` and `.qwen/` are untracked and not yet
  gitignored — exclude them when staging (or add them to `.gitignore`).
- The first push on a fresh machine may hang until GitHub sign-in (Git Credential
  Manager) is completed.

## Docs

- `QWEN.md` (this file) — stack, the domain invariants, layered architecture, conventions,
  commands and the release process. Loaded every session, so it stays rules-only.
- `PROGRESS.md` — live state: where things stand, what is next, the wipe rule,
  verification traps and ops facts.
- `ARCHIVE.md` — what shipped per release, with the decisions and traps still worth knowing
  and the `git log` range for full detail.
- `docs/functional-spec/` — behaviour: navigation flow, the mission panels, Results, Schemes,
  the score/round controls, hot-seat mode, the online player journey, the army builder and the
  tournament. Entity glossary and screen map in its README.
- `docs/technical-spec/` — visual theme, mission JSON format, map rendering, faction and
  Scheme JSON, army content and the import pipeline, and the online architecture (state model,
  API, SSE, SQLite, lifecycle).
- `src/lib/*/CLAUDE.md` — the binding rules for adding files to a layer. Where a layer file
  and a spec disagree, **the layer file wins**: it is closer to the code and reviewed on every
  change.

Consult the specs before changing behaviour or visuals. Spec docs end with **Open questions**
sections that double as the behavioural backlog; keep them updated when decisions get made, and
record a known inconsistency there rather than leaving it undocumented. `docs/` was caught up
against the code in September 2026 and has been kept current since.
