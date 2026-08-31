# Progress & how things work

Handoff notes for picking this project back up. See `QWEN.md` and the per-layer
`CLAUDE.md` files for the authoritative architecture rules.

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/
- Latest release: **v0.5.1** (tag on `main`) — v0.5.0 (online 2-player mode,
  phases 1–4, plus the cross-cutting hardening pass — both summarized below)
  plus the player-feedback round summarized further down (join-accept fix,
  official artwork, neon border, one-time notices, LF pin), deployed to Fly.io.
  Day-to-day work happens on `develop`, pushed to
  `git@github.com:Maevy/Oni-Quest-Advisor.git` (note the working branch is
  `develop`, not `main`).
- The Fly volume `oni_quest_data` (1 GB, mounted at `/data`) exists since the
  v0.5.0 deploy — future deploys only need `fly deploy`. (A fresh app clone
  would have to create the volume first:
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1`.)
- The planning basis for the online mode lives in `MULTIPLAYER_PLAN.md` at the
  project root — **gitignored, local-only, never pushed**. It holds the full player
  journey spec, the phase/state model, the phasing table and the decisions log.
- Missions currently in the app (`src/lib/data/content/missions/`): Treasure Hunt,
  Clue Trail, Magic Stones, Quarter War, Snail Chase, Supply Run, Toxic Infestation,
  Open Hostilities, Awaiting Reinforcements.
- Army builder feature is on `develop` (unreleased): faction select, producer unit
  import (`scripts/importUnits.mjs`), unit cards with classes, skills and traits
  (centralized rules entries, clickable tags, stacked rules popups), mounts.

## What was done in the last session (army builder: per-copy entries + unit rules)

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

## What was done in the session before (abandoned-game retention + army builder)

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
  results: [{ id, text, vp, count }],
  important?: [string],
  questRules: [{ label, description }]
}
```

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
