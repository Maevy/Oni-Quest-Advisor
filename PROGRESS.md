# Progress & how things work

Handoff notes for picking this project back up. See `QWEN.md` and the per-layer
`CLAUDE.md` files for the authoritative architecture rules.

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/
- Latest release: **v0.5.0** (tag on `main`) — the online 2-player mode
  (phases 1–4) plus the cross-cutting hardening pass (integrity, security,
  operability — both summarized below), deployed to Fly.io. Day-to-day work
  happens on `develop`, pushed to `git@github.com:Maevy/Oni-Quest-Advisor.git`
  (note the working branch is `develop`, not `main`).
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

## What was done in the last session (online-mode hardening: integrity, security, ops)

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

## What was done in the session before (online 2-player mode, phases 1–4)

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
