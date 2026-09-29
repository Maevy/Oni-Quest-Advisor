# Oni Quest Advisor

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

- **Season** → top-level grouping of missions (e.g. "Season 1", "Season 2"). Old
  seasons stay selectable even when outdated.
- **Mission** → belongs to exactly one season. Has a name, lore description, setup
  items, a map (`MapSpec`: deployment zones + objective markers on a 36" board,
  optional `quarters` center cross, per-marker `labelPosition`), Results (scoreable
  objectives with VP and a scoreable-instance `count`), optional `important` callouts
  (rules notes shown alongside Results — not scored), and quest rules (prose sections).
  Ceasefire missions additionally get the automatic red-boxed "Ceasefire broken"
  objective (`CEASEFIRE_OBJECTIVE`, added by `getScoreableResults`): −4 VP per
  breach, scoreable 3 times, rendered as red boxes. Their own Results carry **no
  Round-1 objectives** — the ceasefire forbids VP in round 1 (guarded by
  `data/missions.spec.ts`).
  Marker rulers (`showRuler`) are measured from the **nearest** map edge
  (`rulerAnchor`) — always the shortest path a player would actually measure (≤ 18",
  one of the 4 corner combinations); never revert to measuring from top-left.
- **Faction** → a player-selectable side with its own 20-card Scheme deck; cards can
  be shared across several factions' decks. A `common` pool for cards in every
  faction's deck exists too (`COMMON_FACTION_ID`) but **no card uses it** — `shared.json`
  means "in 2+ decks", and its cards enumerate explicit faction ids instead.
- **Scheme** → secret objective card drawn from a faction's deck (+ common pool).
  Draw count depends on intelligence: ≤13 → 2, 14–15 → 3, ≥16 → 4. Cards have
  `factionIds` (whose decks contain the card), `copies` (physical copies — a uniform
  number or per-faction overrides, e.g. Virtuous Commander: 4 Helian / 2 elsewhere;
  Stand Your Ground: 4 Sand / 2 elsewhere), `maxIncrements` (checkboxes), and either
  a uniform `vpPerIncrement` or per-box `incrementVp` values (e.g. Martial Valor:
  2 VP, then 1 VP).
- **Faction roster (as of v0.1.0)** → six factions, each deck exactly 20 physical
  cards drawn from 27 unique cards: Helian League, Empire of Soga, Coalition of
  Thenion, Sand Kingdoms, Monster Factions, Adventurers' Guild (no exclusive cards —
  its whole deck is shared). Card data: `data/content/schemes/shared.json` holds
  every card in 2+ decks, one `schemes/<faction>.json` per faction's exclusives —
  a card moves into `shared.json` as soon as a second deck gets it. Rulebook wording
  "X VP (to a maximum of Y)" with multiple boxes ⇒ `incrementVp` (e.g. `[2, 1]`),
  never a flat `vpPerIncrement` that would overshoot the cap.
- **Army Builder** → separate top-level feature (own screens, in-memory only): pick one
  of 7 factions (their RAL color as border/text + logo) and build a list under a
  format cap (Standard 85 / Tournament 125). Every copy of a unit is its own
  `ArmyEntry` (own id, independently mountable/removable). Unit content is
  imported from the producer's export: `scripts/importUnits.mjs` reads
  `data-import/units.json` and writes `content/units/<faction>.json` +
  `neutral.json` + `mounts.json` plus the centralized catalogs
  `classes.json` / `skills.json` / `traits.json` / `combat-arts.json` /
  `spellcrafts.json` (`ArmyRulesSpec`, leveled texts in a `levels` map),
  `spells.json`, `stratagems.json`, `items.json` (RCH parsed into structured
  range brackets) and `upgrades.json` (cost, per-army limit, faction, curated
  effects in the import's `UPGRADE_EFFECTS` table, requirements parsed from
  the descriptions: class, forbidden trait, size ceiling) — re-run on every
  producer update and review the diff.
  Units carry points, a copy `limit`, an 11-key statline (`STA`…`M`, null when
  a model has no value), a required `size` on the ordered `ArmyUnitSize`
  ladder (`small`…`epic` — sizes are compared by rank because every size rule
  is a ceiling or a "two Sizes larger" test, and the import **throws** on an
  unknown label since content JSON is loaded behind a type assertion), an
  optional portrait, catalog refs (class ids,
  `{ id, level }` skill/trait/combat-art/spellcraft refs; trait refs add
  `dynamicValue`/`dynamicElements` that fill `(X)`/`(Element)` templates at
  display time), stratagem ids, `inventorySpace` + inventory `{ id, qty }`
  slots, and optionally `upgradesLocked` (rulebook exceptions: Tomoe, Kogetsu,
  Seigen, Tharos, Anari, Na'ra, Chiyohime, Chanra). The unit card renders the
  rules refs as clickable tags (panels ordered Skills → Traits → Combat Arts →
  Spellcrafts, divider, then Inventory, Stratagems) opening stacked popups —
  leveled ones list every level white up to the unit's level and greyed beyond
  (roman suffixes); spellcraft popups show element-grouped spell cards with
  PW/STK resolved against the unit's stats; inventories and stratagems render
  inline (stat-box grid / type-grouped cards), upgrade effects applied via
  `upgradedArmyUnit`. **Upgrades (standard format)**: per-copy picks through a
  picker overlay with artwork and gating reasons; slots = 1 + Resourceful
  level + Pouch count; faction access (four main factions own + neutral;
  oni/goblin/guild neutral-only); effects automate stat boosts (incl.
  `insteadIfTrait`/`extraIfClasses` conditionals), grants, items, primary
  weapon replacement, stratagems, `costReduction` (Devotion: Paimon discounts
  every other upgrade army-wide by 1, min 1), spellcraft level-ups
  (`spellcraftLevelCap` from the affinity-filtered spell catalog + a choice
  step when several schools can advance) and `choice` upgrades —
  Glyphscribe: Reduce Weight (inscribe an item: STK +1/WGT −1 via per-row
  item overrides, or +1 AG/SPD/+1 space), Elemental Lineage (`grantTrait`
  option: pick 1 of 4 Affinities, merged into the unit's affinity trait ref)
  and Mana Catalyst (`replaceAffinity` option: swap one Affinity element for
  Fire/Water/Earth/Air — a single element auto-resolves, several open a
  second picker step); selections persist on the entry
  (`spellcraftChoices`, `upgradeChoices`). **Roster format** (125 pts, internal id
  `'roster'` — renamed from `'tournament'`, with `decodeArmy` still reading the old
  `t` format character and `savedArmyFormat()` folding an old save's string):
  units keep mounts but carry no upgrades — the faction's upgrade catalog
  becomes a separate equipment pool (`rosterPicks`, steppers with per-army
  `limit` caps, costs count toward the cap; `addRosterPick`/`removeRosterPick`/
  `rosterPickPoints` in domain). Switching Standard↔Roster with a non-empty
  list asks for confirmation and clears it. Army codes carry the pool in an
  optional picks section (roster only); saves carry a `format` field
  (absent on old saves = standard) and the Load Army dialog filters by it.
  **Cutting a roster down to a match list** (`domain/armyConstraint.ts`): a match is
  85 points, so a Roster registration is cut to a Standard list restricted to what
  the roster held — three budgets (copies per unit, **mounted** copies per unit,
  assignable copies per upgrade id from the pool's `qty`). The pool records no target
  and no selection, so which copy gets which upgrade is always the player's choice.
  `entryUpgradeBlock`/`addEntryUpgrade` take an optional constraint and add a
  `'roster'` block reason after `'limit'`; the builder's `units`/`upgrades` getters
  filter to the roster's ids. Nothing gates the point cap (the free builder never
  did) — `acceptCut()` refuses an over-cap list instead. The result is an ordinary
  Standard list, so it encodes to a normal `s` code.
  Upgrade artwork lives in `assets/upgrades/<Faction>/`,
  matched by normalized filename + `UPGRADE_ICON_ALIASES`.
  NEUTRAL-tagged units are available to every faction except the monster ones
  (`NON_NEUTRAL_FACTION_IDS`); mounts are never recruitable standalone — a
  rider's `mount` adds the mount's cost when toggled, mount `stats` override
  the rider's (non-null only), `statChanges` add on top and a mounted model
  counts as the **mount's size** (`mount.size` via `effectiveUnitSize`) —
  because mounting can invalidate a size-capped pick, `mountToggleConflicts`
  lists what the toggle would drop and the page confirms before `toggleMount`
  removes it. **Army codes**
  (`domain/armyCode.ts`): a whole list (faction, format, copies, mounts,
  upgrades incl. all selections) serializes to a short share code — base36
  indexes into the sorted content catalogs behind a version char + FNV-1a
  roster fingerprint, so codes from a different roster are rejected loudly
  instead of decoding wrong units. `armyBuilderStore.importArmy` replays
  every pick through the domain guards (an import can never be invalid) and
  opens the builder on the Your-Army panel; export is the "Copy Army Code"
  button in the builder header (clipboard API; when the clipboard is
  unavailable the code is shown inline for manual copying). **Saved armies**:
  the builder's "Save Army" button opens a name dialog and stores
  `{ id, name, factionId, code, createdAt }` under
  `oni-quest-advisor:saved-armies` — the code carries the whole list, so a
  save is only metadata plus code (and shares the fingerprint check: saves
  from before a roster update refuse to load instead of decoding wrong).
  "Load Army" on the faction select lists them grouped by faction, newest
  first (`groupSavedArmies`), replays the stored code through `importArmy`,
  and deletes them via a per-row ✕ behind a Yes/No confirmation. Saved
  **standard**-format armies also feed the mission flow: the briefing's
  "Pick Army" button attaches one to the run as a `pickedArmy` snapshot,
  shown read-only in the tracker's Army view. Hot-seat has one pick button
  and one Army view **per seat** ("Pick P1 Army" / "Pick P2 Army"), and two
  seats may attach the same save — their vitality maps stay separate.
- **GameMode** → `'solo' | 'two-player'`, set by `GameModeSelect` and tracked in
  `navigationStore.gameMode`. Solo is the original single-player tracker; two-player
  is a hot-seat mode where both players share one device. The third
  **"Online 2 Player Game"** button opens the server-backed online flow — its own
  screens (`online-create`/`online-join`/`online-game`), not part of `GameMode`.
- **MissionProgress** (solo) → per-mission play state: checked objective counts, the
  chosen Scheme, a `schemeDraft` (faction/intelligence) that survives deleting the
  chosen Scheme — but not a mission `Reset`, which rebuilds progress from empty —
  `currentRound` (tracked manually by the players, clamped to `MIN_ROUND`..`MAX_ROUND`
  = 1–5), and `pickedArmy`: a **snapshot** (`{ name, factionId, code, format? }` —
  `PickedArmy`, shared with the online seats and tournament registrations; read the
  format through `pickedArmyFormat()`) of a saved
  standard army attached from the briefing's **Pick Army** button, rendered read-only
  in the tracker's Army view. Each copy's live Life/stamina lives in `vitality`
  (entry id → `{ hp, sta }`, absent = full): an Army row opens a vitality menu on
  click that damages, heals (Life overheals to double its base, the extra hearts
  blue) and spends stamina, committing only on Accept. Total VP = checked Results VP + checked Scheme increments, capped at
  `MAX_TOTAL_VP` = 10 (a player cannot earn more per mission); the tracker's untitled score
  panel shows the total against that cap.
- **OpenGame** (solo and hot-seat) → `{ missionId, mode }`, the marker that a local
  run is live. Written by `startGame()`, and the reason the app can offer to resume on
  the next launch — the stored `mode` decides which progress store and which tracker
  the resume lands in (records written before hot-seat joined the lifecycle carry no
  mode and read as solo). Abandoning deletes it **and** that run's saved progress, so
  a run either resumes whole or is gone — solo's Reset restarts the mission,
  abandoning ends it. Online has no equivalent (its state lives on the server).
- **TwoPlayerMissionProgress** → 2-player equivalent: a `PlayerProgress` per seat for
  `player1` and `player2`, plus a shared `currentRound`. Each `PlayerProgress` is the
  shared `SeatProgress` (checked objectives, scheme, schemeDraft, `schemeRevealed` —
  the same shape online's seats use) plus two local-only fields: `pickedArmy` and
  `vitality`. Loaded through `hydrateTwoPlayerProgress()`, which merges **each seat**
  onto its own empty defaults — a shallow spread would leave a field added later as
  `undefined`. Objectives are tracked **per active seat**, not on one shared sheet:
  the Results panel binds to `activePlayer` and the swap hands the sheet over, so
  nobody edits a sheet that is not theirs. Schemes are gated the same way — only the
  active player sees/interacts with their scheme; the other sees "Hidden" (chosen but
  unrevealed) or "No schemes" (not yet chosen). "Reveal" is permanent. The round is
  one counter for the table and **only Player 1 may move it**. The score panel's
  violet **Swap Player** button triggers a 6-second countdown overlay, then flips
  `activePlayer`; it is hot-seat's only game-level action — there is no Reset, a
  fresh play is Return → Abandon → re-pick the mission. Per-seat VP is calculated
  independently via `calculateTwoPlayerVP`; each is capped at `MAX_TOTAL_VP`.
- **OnlineGameState** (online 2-player, server-authoritative; `domain/online.ts`) →
  statuses `lobby`/`active`/`finished`/`closed`; two seats (nickname, seat-token
  hash, a **registered `army`** and a **`combatArmy`**, `ready`, a `SeatProgress`,
  `revealIntent`, private `drawnSchemeIds`); `pendingJoin` (which also carries the
  joiner's army); season/mission **fixed at creation**; round × phase
  (`prep`/`setup`/`reveal`/`scoring`); round VP snapshots; winner. A game is born
  set up — the creator picks the mission and their army on a **frontend-only draft
  screen** and **Open Lobby** is the first server call — and Start Game (leader-only,
  gated on both seats' **Ready**) opens `prep`, not round 1. In `prep` a seat that
  registered a **Roster** cuts it down to a Standard ≤85 list in the borrowed army
  builder and registers it through `/combat-army`; a Standard registration _is_ its
  own combat army from `createEmptySeat`. `leavePrep` (leader, needs both combat-ready)
  seeds each seat's Scheme **faction from its combat army** via `schemeFactionForArmy()`
  and moves to `setup`, where only the intelligence is drafted (`/draft` refuses a
  `factionId`); `startRounds` then opens round 1's `reveal`. The two preparation steps
  are **phases, not statuses**, because `cleanup.ts` buckets retention by status
  literal — a new status would match no bucket and leak forever. Scheme boxes are
  scoreable **only once revealed** (hidden schemes earn no scheme VP); `finishGame`
  auto-reveals everything and writes a `resultSummary` (winner, final VP, factions,
  mission) onto the state for later statistics export. Pure transition functions with
  `can*` guards plus the per-seat visibility filter (`viewForSeat` — the opponent's
  unrevealed scheme **and both armies' codes** never leave the server; `ready` and
  `combatReady` _are_ public because leader buttons are gated on them). Note
  `PublicSeatState.factionId` is a **scheme** faction while `army.factionId` is an
  `ArmyFactionId` — different id spaces, overlapping on five of seven. The full player
  journey lives in `docs/functional-spec/07-online-two-player.md`;
  `MULTIPLAYER_PLAN.md` (local-only) is design history.
- **Tournament** (under construction) → an event run by a Tournament Organizer
  (TO): players join, are paired round by round at tables, and the event
  concludes with a victor. Reached from the mode select's red **Organize
  Tournament** button; configuration is a local three-pane wizard on a
  `TournamentDraft` (`domain/tournament.ts`, the panes in
  `TOURNAMENT_SETUP_STEPS`): name, optional **external link**
  (normalized to an http(s) URL, unusable input blocks Continue), organizer
  name, and a "TO also plays" tick that reveals a **Roster**-format army pick
  (the saved-army picker filtered to 125-point lists; giving up the seat drops
  the army, and a playing TO must attach one to continue). The field is 4–32 stepping **in pairs** — an even field needs no
  bye rule — and a playing TO holds one of those seats rather than adding to
  them. The second pane collects an ordered, deduplicated mission list through
  an **Add Quest** popup (season dropdown + clickable missions) and one
  editable name per table, the table count derived as half the field so custom
  names stay with their table number; its **Overview** button — enabled at one
  mission — opens the third pane, a read-only review of the whole draft in
  four panels. Nothing is persisted or sent while configuring; **Create
  Tournament** (same one-mission gate) first shows the retention notice — the
  data is kept 48 hours _after the tournament concludes_ so a report can be
  generated — and only then makes the first server call.
- **TournamentState** (`domain/tournamentEvent.ts`) → the server-authoritative
  event behind the lobby: status `lobby`/`active`/`concluded`/`closed`, the
  whole configuration, and one seat per pairing slot (a playing TO fills seat 0
  at creation). Pure `createTournamentEvent`/`joinTournament`/`leaveTournament`/
  `cancelTournament` transitions with `can*` guards plus the visibility filters
  — `viewForTournamentToken` for the organizer and seated players (army **names
  and factions**, never codes or tokens) and `peekTournament` for what the join
  screen may show before joining. The **lobby** (`tournament-lobby`) is shared
  by both roles: the event, one row per seat (name + army, `you`/`organizer`
  marks, or _Empty seat_), and for the organizer **Share Link** (clipboard,
  with the URL shown inline when copying is blocked), **QR Code** and a **Start
  Tournament** button that unlocks at two registered players with at most one
  seat still empty, an odd field told about the BYE before it starts.
  Players arrive through `/tournament-join/[code]` (link or QR): a name plus a
  **Roster** army unlocks **Join**, which takes the first free seat — a full
  field refuses joins, there is no waitlist and no per-join approval — stores a
  seat session (`oni-quest-advisor:tournament-session`: code, role, token) and
  lands in the same lobby read-only; joins reach every open lobby live over
  SSE. A stored seat session makes the next app start **prompt** instead of
  dropping the player in: "You are participating in {name}" (the organizer:
  "…Abandoning it cancels the tournament and deletes it for everyone"), with
  **Return** — the prominent button and the Escape branch — entering the freshly
  refetched lobby and **Abandon** the only way out of a tournament: a
  participant frees their seat for the next joiner (`/leave`), the organizer
  cancels the event (`/cancel` → status `closed`, seats kept so every device
  still authenticates), and the other lobbies learn it over SSE, drop their
  session and show a dismissible banner on the main menu. The lobby's ← Return
  opens the same prompt, so there is no local-only exit that would strand a
  seat, and a failed abandon keeps the dialog open rather than clearing the
  session. Players may not leave once the event is `active` (a seat in a
  pairing needs a forfeit rule first); the organizer may still cancel it.
  **Starting it** (`/start`, organizer-only, ≥ 2 registered players and at most
  one seat empty — the configured tables must all get a pairing, and one empty
  seat is exactly the BYE's case) flips lobby → `active`, closes joining and
  leaving for good and opens round 1 on the first configured mission as a
  `TournamentRound` (number, missionId, **phase**, one occupant list per table,
  per-seat victory points, `hydrateTournamentState` giving rows written before
  it a null — and a phaseless round its `setup`). An **occupant** is
  `{ kind: 'seat', seatIndex }` or `{ kind: 'bye' }` — the BYE being the
  imaginary player an odd registered field needs, assigned by the organizer
  like anyone else, and whoever it lands with sits the round out. Every device
  follows the **status** onto `tournament-round`: the **Progress roadmap**,
  Round Control (round, mission, the VP standing at zero), **Start Round** and
  the Table Assignment board (a pool plus a card per table, moved by
  pointer-drag or by tap-then-"Place here", organizer-only, every drop an
  `/assign` mutation echoed to all devices over SSE, nothing patched locally).
  The assignment gate: the pool empty, BYE included, **and** no table holding a
  single occupant — 2/2/1/1 assigns everybody and still strands two of them
  without an opponent. **A round walks `setup` → `game` → `scoring`**
  (`TOURNAMENT_ROUND_PHASES`), and the phase is server state: **Start Round**
  (`/start-round`, organizer-only, gated on a complete pairing) moves it to
  `game`, which **locks the tables** for everybody — a pairing cannot change
  under a match being played, and there is no way back to `setup`. The roadmap
  (`tournamentRoadmap`, derived not stored) is three steps per configured
  mission plus a final Tournament Conclusion, with `currentIndex` pointing at
  the step the event is on; players see the same board read-only and no Start
  Round button at all.
  Server tables `tournaments`/`tournament_events`, endpoints
  `/api/tournaments/**`, retention (lobby 7 days, abandoned 30, concluded
  exactly the 48-hour report window, cancelled 24 hours). The **QR symbol is
  encoded in-app** (`domain/qr.ts`: byte mode, EC level M, versions 1–6, mask 0,
  rendered as SVG) — no third-party generator, because the link is the
  credential to join. Spec: `docs/functional-spec/09-tournament.md`.

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
  `import.meta.glob` from `src/lib/data/content/{missions,factions,schemes}/*.json`
  (all bundled missions currently belong to Season 2); unit content (incl.
  mounts) is generated by `scripts/importUnits.mjs` from the producer dump in
  `data-import/`; progress persists to
  `localStorage` under the `oni-quest-advisor:mission-progress:` prefix (solo) and
  `oni-quest-advisor:2p-progress:` prefix (two-player), keyed by mission ID;
  `openGame.ts` holds the single `oni-quest-advisor:open-game` marker saying a local run
  is live (with the mode), read on app start to offer a resume. Online
  mode adds the remote seam: `onlineApi.ts` (fetch wrapper for `/api/games/...`) and
  `onlineSession.ts` (seat session under `oni-quest-advisor:online-session`), plus
  `notices.ts` (one-time acknowledgements for the privacy notice and the online
  intro, under `oni-quest-advisor:notice:`). Tournaments add the same pair:
  `tournamentApi.ts` (`/api/tournaments/...`, including the unauthenticated peek
  the join screen uses) and `tournamentSession.ts` (`oni-quest-advisor:tournament-session`).
- `stores` are classes in `.svelte.ts` files (`armyBuilderStore`, `contentStore`, `navigationStore`,
  `missionProgressStore`, `twoPlayerProgressStore`, `onlineGameStore`,
  `tournamentStore`, `tournamentEventStore`), exported as
  singletons from `stores/index.ts`. They orchestrate — decisions live in `domain`,
  side effects in `data` — and expose purposeful methods (`selectSeason()`,
  `rollRandomMission()`, `startGame()`, `findResumableGame()`, `drawSchemes()`,
  `setRound()`, `swapPlayer()`, `revealScheme()`, ...), not raw mutable state. `onlineGameStore` is
  server-driven: it sends intents to the API and refetches the visibility-filtered
  game view (SSE change notifications trigger refetches) — it never mutates game
  state locally. `tournamentEventStore` is the same shape for a live tournament
  (`create()`, `join()`, `loadPeek()`, `resumeSession()`, `retry()`, `start()`,
  `startRound()`, `assign()`, `abandon()`, `cancelJoin()`, `dismissNotice()` —
  `abandon()` is the only way
  out and always calls the server, and a `notice` survives the teardown that
  follows a remote cancellation so the page can say why the lobby is gone),
  while `tournamentStore` stays the local wizard draft. Persisted progress is loaded by merging it onto
  `domain.createEmptyProgress()` (solo — a shallow spread suffices, the fields are
  top-level) or `domain.hydrateTwoPlayerProgress()` (hot-seat — it merges **each
  seat** onto its own defaults, since the new fields live inside `player1`/`player2`).
  Keep this pattern when extending either progress type. **Online has no such
  hydrate function** — its state is one server-side JSON document with no migration
  mechanism, so a shape change there means wiping the database rather than merging.
  `navigationStore` tracks
  `gameMode`, routes `selectMission()` to the correct progress store, gates the
  one-time notices (privacy banner on first visit,
  online intro before first entering the online mode), and owns `builderReturn` —
  `borrowArmyBuilder(returnScreen)` hands the army builder to another flow (the online
  prep step cutting a roster) so both its exits go back there instead of `game-mode`.
  `armyBuilderStore` is the one store with **unit tests**: the `sveltekit()` vite plugin
  applies the runes transform under vitest, so a `$state` class works in the node
  environment — `armyBuilder.svelte.spec.ts` is the working example, and its fixtures
  are built from whatever the bundled content offers rather than naming unit ids.
- `routes` (`+page.svelte`) switches screens on `navigationStore.screen` and wires
  store state/methods to component props/callbacks: the local flow
  (`game-mode` → `season-select` → `mission-select`, then both modes through the
  read-only `mission-briefing` and its **Start Game** button — which records the open
  game and enters `mission-detail`, rendering `MissionDetail` or
  `MissionDetailTwoPlayer` by `navigationStore.gameMode`;
  army builder is `army-faction-select` → `army-builder`) plus the online screens
  (`online-create` → `online-join` → `online-game`; that last id renders **five**
  different views chosen by the fetched state rather than by a click — the lobby,
  Army Preparation (`phase prep`), Scheme Selection (`phase setup`), the game view
  and the statistics view — so a leader's Start Game / Proceed / Begin Round 1 moves
  every device without a reload, and `army-builder` is borrowed mid-flow for a cut)
  and the tournament flow
  (`tournament-setup`, all three panes on one screen id → `tournament-lobby` →
  `tournament-round` once the event is active, with `tournament-join` reached
  from an invite link or QR code; which of lobby/round shows follows the fetched
  event **status** through an effect, not a click, so starting the event moves
  every participant). On mount it
  resumes a stored online seat, then a stored tournament seat, and otherwise
  offers to resume an open local game.
  `api/games/**/+server.ts` and `api/tournaments/**/+server.ts` are the
  server-backed endpoints (thin handlers over `lib/server`), `api/health/` is the
  unauthenticated ops probe, and `join/[code]/` plus `tournament-join/[code]/`
  are the invite-link entry points.
  No business logic, no direct `fetch`/`localStorage`, no new type definitions.
  Cross-cutting API concerns (body cap, rate limits, request logging) live in
  `src/hooks.server.ts`. `+layout.svelte` renders the fixed background (official
  Eldfall Chronicles key art), the site-wide footer (fan-project disclaimer +
  artwork credit for Freecompany d.o.o. + app version — `__APP_VERSION__`, injected
  by `vite.config.ts` from `package.json`; bump the version there for releases) and
  the one-time `PrivacyNotice`.
- `components` are presentational: `$props()` in, callbacks up. Avoid importing
  stores directly — the page wires them. Domain _types_ are fine for prop typing,
  domain _logic_ is not. The trackers' **view switcher** (Scoring / Army / Mission)
  is a glowing spotlight sliding under a `grid-cols-{n}` of equal buttons — 3 in
  solo, 4 in hot-seat — and swiping left/right steps views. Solo's `MissionDetail`
  keeps `ScoreSummaryPanel` (VP total, round stepper, Reset) inline at the top of
  Scoring and a ← Return that abandons the run behind a `ConfirmDialog`.
  2-player mode has dedicated variants only where the seat model changes a panel
  (`SchemesPanelTwoPlayer`, `ScoreSummaryPanelTwoPlayer`, `ActivePlayerPanel`,
  `MissionDetailTwoPlayer`) plus a `CountdownOverlay` for the swap transition;
  it reuses the shared ones unchanged (`ResultsPanel` bound to the active seat,
  `ArmyReadonlyPanel` with a seat title/colour and a frozen mode,
  `DescriptionPanel`, `SetupPanel`, `MissionMap`, `QuestRulesPanel`, `Panel`,
  `IncrementBoxes`). Seat colours (P1 sky / P2 orange) come from
  `playerAccent.ts` as literal class strings — never build them by interpolation,
  Tailwind only sees whole names. Online mode has its own set (`OnlineCreate` — the
  local three-field draft, `OnlineJoin`, `OnlineLobby`, `OnlineArmyPrep`,
  `OnlineSchemeSelect`, `OnlineGameView`, `OnlineStats`, `OnlineSchemeSetup` — the
  per-seat draw-and-choose area, faction read-only, `OnlineMissionView`,
  `OnlineResultsPanel`, `OnlineSchemesPanel`, `ConfirmDialog`, plus the one-time
  `OnlineIntroNotice` shown before first entry), also reusing the
  shared panels (collapsible there via `Panel`'s `collapsible` prop) and `ArmyBadge`
  (an army's name, faction colour and Standard/Roster tag — never its code).
  `OnlineArmyPrep` and `OnlineSchemeSelect` render both seats from one `{#snippet}`,
  because the own/opponent branches otherwise duplicate. The army
  builder adds `ArmyFactionSelect`, `ArmyBuilderView` (sliding panels, swipe,
  mount toggles, and a **borrowed** shape from its `constrained` prop: ← Back, no
  format tabs, **Accept** in place of Copy/Save, a Limit chip showing the roster's
  ceiling and a "Still in your roster" chip list) and the `UnitCard` statline popup;
  the tournament wizard adds
  `TournamentSetup` (all three panes, with the Add Quest popup and the retention
  notice inside it), the read-only `TournamentOverview` it renders on the last
  one, the shared `TournamentLobby` (organizer and players), `TournamentJoin`,
  `TournamentRoundPrep` (the match-prep board: pointer-drag **and** tap-to-place,
  because a phone needs both and only the second is keyboard-reachable),
  `TournamentRoadmap` (the glowing step strip, scrollable and self-centring),
  `TournamentUnavailable` (the retry-or-abandon panel when a session has no view)
  and `QrCode` (the in-app encoder's SVG).
  `ArmyBuilderView` and the two
  local trackers (`MissionDetail`, `MissionDetailTwoPlayer` — each of whose views
  sits in one sliding strip) are the app's three **full-height screens**: an
  `h-dvh overflow-hidden` root with a
  pinned header and per-panel `overflow-y-auto overscroll-contain` lists. Going
  back to `min-h-dvh` lets the root grow to the length of the longest panel, which
  makes the document the one scroller shared by all panels and strands the
  player far below a short panel after scrolling a long one; every other screen
  scrolls the document normally. `ScreenHeader` is the shared top bar those six
  screens use (season/mission select, briefing ×2, tracker ×2); its actions
  container wraps so the briefing's four buttons and the four-up switcher fit a
  320 px phone.

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

## Git & releases

- Day-to-day work happens on **`develop`** (remote: GitHub `Maevy/Oni-Quest-Advisor`).
  Releases fast-forward merge `develop` into `main`, tag **`vX.Y.Z`** (annotated),
  and push branch + tag.
- **Unreleased on `develop`: the online-mode redesign** (`da407c1`…`abf7779`) — the
  create screen is a local draft carrying mission + army, both seats register an army,
  Start Game is gated on per-seat **Ready**, and a match opens with Army Preparation
  (a Roster is cut to ≤85 in the borrowed builder) and Scheme Selection (faction from
  the combat army). Details in `PROGRESS.md`. **Its first deploy must wipe the
  production database** — online state is one JSON document with no migration path and
  seats gained required `army`/`combatArmy` fields, so an older row would read a
  missing combat army as combat-ready. The app is in beta and the wipe is authorized in
  principle, but it is destructive on shared infrastructure: confirm explicitly, and
  note `flyctl` on this machine needs the user's own interactive `flyctl auth login`
  first.
- Current release: **v0.8.0** — the hot-seat parity
  release: the 2-player tracker now matches the solo one. Both local modes go
  through the Mission Briefing, whose army slots are per seat in hot-seat ("Pick
  P1 Army" / "Pick P2 Army", seat-coloured panels, and a warning when either seat
  starts without a list); the tracker is a four-view **Scoring / P1 Army /
  P2 Army / Mission** sliding strip opening on an Active Player panel and an
  inline score panel (two **Player 1/2 Total VP** blocks, a round stepper only
  Player 1 may move, and a violet neon **Swap Player** — hot-seat's Reset is
  gone, a fresh play is Return → Abandon); Results binds to the active seat and
  so gains the grouped per-round cards, each army pane is editable for its own
  seat and frozen for the other, and the open-game lifecycle (Return abandons
  behind a confirmation, app start offers to resume) now covers hot-seat via a
  `mode` on the record. v0.7.1 was the rules-link hotfix — the Broken Morale /
  Ceasefire rule cards are visible again in the tracker's Mission view (the
  sliding strip's `translateX` had become the containing block for the dialog's
  `fixed` positioning, so the backdrop dimmed the screen while the centred card
  landed off-screen; the panels now emit `onOpenRule` and all five screens render
  `RuleCalloutDialog` at their root); v0.7.0 was the solo view release: the
  read-only Mission Briefing on the additive v2 Results schema (`round`/`group`)
  with per-round cards, a working Start Game that warns before a run begins
  without an army, the tracker rebuilt as a Scoring / Army / Mission three-view
  screen behind a sliding spotlight switcher with the open-game lifecycle (Return
  abandons behind a confirmation, app start offers to resume), Pick Army
  attaching a saved standard army as a read-only snapshot with per-copy vitality
  tracks and the vitality menu (damage, heal with overheal to double, stamina,
  fifteen States), the shared `ScreenHeader` top bar across four screens, the
  leveled-grant fix (a "receives the Stealth I skill" upgrade no longer invents
  Stealth II) and the glowing Solo entry button; v0.6.2 finished the army builder
  (saved armies with the Save Army name dialog and the Load Army list with delete
  and Standard/Roster filter, the Roster format at 125 pts with a separate
  equipment pool and a guarded format switch, format-aware codes and saves,
  lazy-loaded army content, resized first-screen portraits and the phone-polish
  round), v0.6.3 migrated model size (`size_info` → a required, ordered
  `ArmyUnitSize`; Flying Carpet's "Medium or smaller" ceiling automated; a
  mounted model counts as its mount's size, with a confirmation before an
  invalidated upgrade is dropped) and fixed the builder's panel scrolling, and
  v0.6.4 was a scoring hotfix: "Ceasefire broken" is scoreable three times at
  −4 VP each (red boxes) and the ceasefire missions no longer offer Round-1 VP.
  Deployed to Fly.io.
- **Online mode needs a Fly volume**: before the first deploy containing it, run
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1` (the `[mounts]`
  entry in `fly.toml` expects it; the deploy fails without it).
- Don't stage local tooling state: `.idea/` and `.qwen/` are untracked and not yet
  gitignored — exclude them when staging (or add them to `.gitignore`).
- The first push on a fresh machine may hang until GitHub sign-in (Git Credential
  Manager) is completed.

## Docs

`docs/` holds the specs the app is built against — consult them before changing
behavior or visuals:

- `docs/functional-spec/` — behavior: navigation flow, the static mission panels,
  Results, Schemes, the score/round controls, hot-seat mode, the online player
  journey and the army builder. Entity glossary and screen map in its README.
- `docs/technical-spec/` — visual theme, mission JSON format, map rendering, faction
  and Scheme JSON, army content and the import pipeline, and the online architecture
  (state model, API, SSE, SQLite, lifecycle).

Spec docs end with **Open questions** sections that double as the behavioral backlog;
keep them updated when decisions get made. The specs were **caught up against the code
in September 2026**, having previously lagged everything from v0.1.0 through v0.6.4
plus the unreleased Mission Briefing. Keep them current as behavior changes, and
record a known inconsistency there rather than leaving it undocumented — several
strike-through, confirmation-dialog and dead-branch gaps are already listed.
