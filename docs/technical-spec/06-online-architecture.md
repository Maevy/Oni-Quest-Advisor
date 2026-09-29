# Online Architecture

The server-authoritative backend for online 2-player play. Player-facing behaviour is in
[../functional-spec/07-online-two-player.md](../functional-spec/07-online-two-player.md); this
document is the as-built implementation.

**The backend lives in this project** — SvelteKit `+server.ts` endpoints on `adapter-node`. No
separate service, no extra runtime. `lib/domain` is shared between client and server, so every
game rule is written once and enforced where it matters.

## Layering

```
routes/api/games/**  →  lib/server  →  lib/domain
        (thin HTTP)     (persist,      (pure rules:
                         auth,          state, guards,
                         transport)     transitions)
```

`lib/server` may import `lib/domain` and read bundled content through the `lib/data` loaders
(`content.ts` wraps them). It **never** imports `lib/stores`, `lib/components` or Svelte client
APIs, and never touches `localStorage` or `window`. No game rules live in the server layer or in
the route handlers — validation of an action _is_ a domain `can*` guard.

| Module                  | Responsibility                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `db.ts`                 | the libsql file database; lazy schema bootstrap; WAL + busy timeout; starts the cleanup schedule |
| `gameRepository.ts`     | **the only module that speaks SQL**; the transactional mutation helpers                          |
| `sse.ts`                | in-process change-notification registry + heartbeat                                              |
| `ids.ts`                | game codes, seat tokens, token hashing                                                           |
| `http.ts` / `errors.ts` | the `api()` wrapper, `ApiError`, shared auth/error handling                                      |
| `rateLimit.ts`          | fixed-window in-memory limiter                                                                   |
| `cleanup.ts`            | retention windows and the round-5 auto-finish                                                    |
| `content.ts`            | bundled mission/scheme content for server-side validation                                        |

Cross-cutting HTTP concerns live in `src/hooks.server.ts`, not in individual handlers.

## State model

`OnlineGameState` (`lib/domain/online.ts`):

```
id, status, player1: OnlineSeatState, player2: OnlineSeatState | null,
pendingJoin: { nickname, tokenHash, army } | null,
season, missionId, currentRound, phase,
roundSnapshots: Record<round, { player1, player2 }>,
winner: 'player1' | 'player2' | 'draw' | null,
resultSummary: ResultSummary | null,
createdAt, updatedAt
```

`OnlineSeatState`:

```
nickname, tokenHash,
army: PickedArmy,
combatArmy: PickedArmy | null,
leader: SeatLeader | null,
ready: boolean,
progress: { checkedObjectiveCounts, scheme, schemeDraft, schemeRevealed },
revealIntent: boolean,
drawnSchemeIds: string[]
```

`status` ∈ `lobby | active | finished | closed`; `phase` ∈ `armies | prep | setup | reveal |
scoring`;
`currentRound` clamped to `MIN_ROUND..MAX_ROUND` (1–5); `MAX_NICKNAME_LENGTH` = 24 (the field is
still named `nickname` throughout the wire protocol and the domain — only the **user-visible**
labels say "Player Name").

The two preparation steps are **phases**, not statuses. `cleanup.ts` buckets retention by status
string literal (`['lobby']` 7 days, `['finished','closed']` 90, `status='active'` 30), so a new
status would match no bucket and its rows would never be collected. As phases, a game sits in
`active` throughout and ages out normally.

`season` and `missionId` are set by `createOnlineGame` from its `OnlineGameSetup` argument
(`{ season, missionId, army }`), so a game is born set up. They stay typed `| null` because the
client resolves the id against the bundled content and must tolerate a mission that is not there.

`army` is the seat's **registration**: a `PickedArmy` snapshot (`{ name, factionId, code,
format? }`) supplied by the create/join payload. The code is that seat's secret and is only ever
echoed back to its owner.

`combatArmy` is the Standard list the seat actually fields. `createEmptySeat` sets it to the
registration when that is already Standard, and to `null` for a Roster — which is what makes the
seat "needs a match list" until `/combat-army` lands. It is editable for the whole `prep` phase, so
a cut can be redone; `leavePrep` is what makes it final.

`leader` is the copy of the combat army chosen as Leader (`SeatLeader` = `{ entryId, m, int }`),
assigned during `prep` and cleared by any re-cut, because a new list renumbers its copies on decode
and the old `entryId` would dangle. The two statistics are **declared by the client**: the server
loads no army catalogs and cannot compute effective stats from a code, so this rests on the same
"client's word" ruling as army legality. Only `m` and `int` are ever published, and only from
`setup` on (`isLeaderStatsRevealed`); the `entryId` never leaves the seat's own view.

`ready` is the seat's lobby readiness, toggled by its own seat only and meaningful only while
`status === 'lobby'`. It is public in the filtered view because `canStartGame` is gated on it —
hiding it would leave the leader's Start Game locked for a reason no client could name. The same
argument makes `combatReady` public: it gates the leader's Proceed.

Note that a seat's `progress` is the **same `SeatProgress` type hot-seat uses**, which is why
`calculateTwoPlayerVP` is shared by both modes. The armies are _not_ part of that shared type —
hot-seat keeps its `pickedArmy` and live `vitality` on `PlayerProgress`, locally, while an online
seat keeps both of its in server state.

### Transitions

Every transition is a pure function with a `can*` guard. Guards return booleans; the transition
functions are total (they return the state unchanged when the guard fails), and the endpoints
turn a failed guard into `409`.

| Function                                                   | Guard                                                                      | Side effects                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `createOnlineGame`                                         | —                                                                          | `lobby`, seat 1 filled with its army, season + mission set, round 1, phase `reveal` (a lobby placeholder — `startGame` is what sets `prep`) |
| `requestJoin`                                              | `lobby` ∧ no seat 2 ∧ no pending                                           | sets `pendingJoin` (name, token hash **and army**)                                                                                          |
| `acceptJoin`                                               | `lobby` ∧ no seat 2 ∧ pending exists                                       | seat 2 filled from pending, army included; `pendingJoin` cleared                                                                            |
| `denyJoin`                                                 | pending exists                                                             | `pendingJoin` cleared                                                                                                                       |
| `toggleReady`                                              | `canToggleReady`: `lobby` ∧ that seat is filled                            | flips that seat's `ready`; a seat can only flip its own                                                                                     |
| `startGame`                                                | `canStartGame`: `lobby` ∧ mission ∧ seat 2 ∧ `bothReady`                   | `active`, round 1, **phase `armies`**                                                                                                       |
| `leaveArmies`                                              | `canLeaveArmies`: `active` ∧ `armies`                                      | phase `prep`; the reveal is one-way                                                                                                         |
| `setCombatArmy`                                            | `canSetCombatArmy`: `active` ∧ `prep` ∧ that seat registered a **Roster**  | stores the cut Standard list on that seat, **clearing its Leader**                                                                          |
| `setLeader`                                                | `canSetLeader`: `active` ∧ `prep` ∧ that seat has a combat army            | stores the chosen copy and its declared M/INT                                                                                               |
| `leavePrep`                                                | `canLeavePrep`: `active` ∧ `prep` ∧ `bothCombatReady`                      | phase `setup`, **and each seat's `schemeDraft.factionId` seeded from its combat army**                                                      |
| `setSeatDraft` / `setSeatDrawnSchemes` / `clearSeatScheme` | `canEditSetup`: `active` ∧ `setup`                                         | edits that seat                                                                                                                             |
| `chooseSeatScheme`                                         | `canEditSetup` ∧ draft complete ∧ `schemeId ∈ drawnSchemeIds`              | sets `scheme`, **clears the hand**                                                                                                          |
| `startRounds`                                              | `canStartRounds`: `active` ∧ `setup` ∧ `bothSchemesChosen`                 | phase `reveal`, still round 1                                                                                                               |
| `toggleRevealIntent`                                       | `active` ∧ `reveal` ∧ seat has a scheme                                    | flips `revealIntent`                                                                                                                        |
| `advanceToScoring`                                         | `active` ∧ `reveal`                                                        | every seat with scheme ∧ intent → `schemeRevealed = true`; all intents cleared; phase `scoring`                                             |
| `setSeatObjectiveChecked`                                  | `active` ∧ `scoring`                                                       | own seat only, count clamped to `0..maxCount`                                                                                               |
| `setSeatSchemeChecked`                                     | `canScoreSeatScheme`: `active` ∧ `scoring` ∧ scheme ∧ **`schemeRevealed`** | own `checkedIncrements`, clamped                                                                                                            |
| `snapshotAndProceed`                                       | `active` ∧ `scoring` ∧ round < 5                                           | writes the round snapshot; round + 1; phase `reveal`, or `scoring` when both schemes are already revealed                                   |
| `finishGame`                                               | `active` ∧ `scoring` ∧ round = 5                                           | snapshot round 5; **auto-reveal all**; compute winner; write `resultSummary`; `finished`                                                    |
| `closeGame`                                                | not `finished` ∧ not `closed`                                              | `closed`                                                                                                                                    |

There is no `selectMission` transition: the mission arrives with the creation and cannot change.

`leavePrep` is where the Scheme faction gets decided, and it is a transition rather than a client
call so no seat can end up drawing from a deck its army does not belong to. It seeds through
`schemeFactionForArmy()`, which passes the five ids shared by both catalogs through and maps
`oni-clans`/`goblin-wartribes` onto the `monster-factions` deck they share. `/draft` accordingly
accepts **only** an intelligence — a `factionId` in the body is a 400, not a silent ignore.

`bothReady`, `bothCombatReady` and `bothSchemesChosen` are separate named predicates because each
gates a different leader button and the client has to say which one is still missing. All three are
false while seat 2 is empty, which is what keeps a lone leader from starting anything.

**The reveal gate on scoring is enforced twice**: by `canScoreSeatScheme` in the domain and by an
explicit check in the `/scheme-box` endpoint. `calculateTwoPlayerVP` itself does _not_ check
`schemeRevealed` — a hidden scheme scores 0 only because its `checkedIncrements` can never leave 0. That is a real invariant, not a coincidence, but it is worth knowing that the VP function is
not itself the gate.

### Visibility filter

`viewForSeat(state, seat)` produces the `OnlineGameView` a phone receives. The requesting seat is
returned **in full**, secrets included. The opponent goes through `toPublicSeat`, which exposes
only:

`nickname`, `army` (a `PublicArmy` = `{ name, factionId, format }`), `rosterCode`, `ready`,
`combatReady`, `leaderStats`,
`factionId` (= `scheme?.factionId ?? schemeDraft.factionId`), `hasScheme`, `schemeRevealed`,
`revealedScheme` (**null unless the scheme is both chosen and revealed**),
`checkedObjectiveCounts`.

It strips `tokenHash`, `drawnSchemeIds`, `revealIntent`, `intelligence`, the unrevealed
`scheme` object **and the cut's code**. `combatReady` is a bare boolean: the opponent learns
that a match list exists, never what is in it. **The opponent's unrevealed scheme content never
leaves the server** — this is the enforcement point, not the UI.

`rosterCode` is the one code that travels, and only under two conditions: the game is no longer in
the lobby (`isRosterRevealed`, i.e. the reveal step has been reached) **and** the registration's
format is `roster`. A Standard registration's code is withheld forever, because for it the
registered list is the match list and the rulebook keeps parties secret until deployment. The
filter takes the reveal flag as a parameter rather than reading a field, so a caller cannot forget
to decide.

The two `factionId`s in that list are **different id spaces**: `army.factionId` is an
`ArmyFactionId` (7 ids, `oni-clans` and `goblin-wartribes` among them) resolving against
`contentStore.armyFactions`, while the seat-level `factionId` is a _scheme_ faction (6 ids,
`monster-factions` among them) resolving against `contentStore.factions`. They overlap on five
ids; conflating them mis-resolves exactly the two monster factions.

`PublicArmy.format` is derived with `pickedArmyFormat()`, because the server never decodes a code
— it has no army catalogs loaded — so the format has to travel explicitly in the payload.

> Gap: `pendingJoinNickname` is placed in the view for _any_ seat and only hidden by the client.
> It should be filtered to the leader. The pending join's army is not exposed at all, so the
> leader's accept popup cannot show what list the joiner brought.

## API surface

Auth: **none** = unauthenticated · **seat** = `Authorization: Bearer <token>`, resolved by
matching `sha256(token)` against a seat's `tokenHash` · **leader** = seat auth **and** must be
`player1` (otherwise 403) · **query-token** = the seat token in `?token=`, used only where
`EventSource` cannot set a header.

| Method | Path                            | Auth        | Purpose                                                                                                                           |
| ------ | ------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/games`                    | none        | create from `{ nickname, season, missionId, army }`; returns `{ gameId, seat: 'player1', token }` — the plain token, exactly once |
| GET    | `/api/health`                   | none        | ops probe: `{ ok, games: {status→count}, dbBytes, sseStreams }` — aggregates only                                                 |
| GET    | `/api/games/[id]/state`         | seat        | the per-seat filtered view                                                                                                        |
| GET    | `/api/games/[id]/events`        | query-token | SSE change notifications                                                                                                          |
| POST   | `/api/games/[id]/join`          | none        | request to join, carrying the joiner's own token and their army                                                                   |
| GET    | `/api/games/[id]/join/status`   | query-token | `accepted \| pending \| denied \| closed \| full`                                                                                 |
| POST   | `/api/games/[id]/join/accept`   | leader      | seat the joiner                                                                                                                   |
| POST   | `/api/games/[id]/join/deny`     | leader      | clear the pending request                                                                                                         |
| POST   | `/api/games/[id]/draft`         | seat        | set the intelligence — **not** the faction, which `leavePrep` seeds from the combat army                                          |
| POST   | `/api/games/[id]/draw`          | seat        | server-side scheme draw                                                                                                           |
| POST   | `/api/games/[id]/choose-scheme` | seat        | commit a chosen scheme                                                                                                            |
| POST   | `/api/games/[id]/delete-scheme` | seat        | clear the chosen scheme                                                                                                           |
| POST   | `/api/games/[id]/ready`         | seat        | toggle this seat's lobby readiness                                                                                                |
| POST   | `/api/games/[id]/start`         | leader      | lobby → active, opening `armies`                                                                                                  |
| POST   | `/api/games/[id]/combat-army`   | seat        | register the Standard list cut from this seat's Roster; refuses a non-Standard format and a seat that had nothing to cut          |
| POST   | `/api/games/[id]/leader`        | seat        | assign or clear this seat's Leader, declaring its M and INT; refuses a malformed entry id or statistic                            |
| POST   | `/api/games/[id]/reveal-intent` | seat        | toggle the reveal intent                                                                                                          |
| POST   | `/api/games/[id]/objective`     | seat        | set an objective's checked count                                                                                                  |
| POST   | `/api/games/[id]/scheme-box`    | seat        | set own scheme increments                                                                                                         |
| POST   | `/api/games/[id]/advance-phase` | leader      | armies → prep → setup → round 1 reveal, then reveal → scoring, or scoring → next round                                            |
| POST   | `/api/games/[id]/finish`        | leader      | finish after round-5 scoring                                                                                                      |
| POST   | `/api/games/[id]/close`         | leader      | close/abandon                                                                                                                     |

Error conventions: `400` malformed or unknown content ids · `401` missing/invalid token · `403`
seat is not the leader · `404` unknown game · `409` a domain guard refused · `413` body too large
· `429` rate-limited or too many SSE subscribers · `500` bundled content missing for the game's
mission/scheme (a deploy that drops content while games reference it).

Identifiers: a game code is 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no `I`, `L`,
`O`, `0`, `1` — ambiguous when read aloud in a messenger); a seat token is
`randomBytes(32).toString('hex')`; only its SHA-256 hex is stored.

## SSE

`GET /api/games/[id]/events?token=…`, `text/event-stream`. The token travels in the query string
because `EventSource` cannot set headers — which is why request logging omits query strings.

- On connect: `: connected\n\n`, then a `: heartbeat\n\n` comment every **25 s**
  (`HEARTBEAT_MS`) to keep proxies and mobile radios from dropping the stream.
- On a change: `event: change\ndata: {"type":"<eventType>"}\n\n`.
- **No sequence number and no payload.** Notifications are hints only.
- Capped at **8 subscribers per game** (`MAX_SUBSCRIBERS_PER_GAME`), over which the endpoint
  returns 429.
- The registry is an in-process `Map<gameId, Set<Sender>>` — **one Node process**. A
  multi-machine deployment would need a real broker.

The client listens on both `change` and `open` and responds by **refetching the full state**. No
event replay exists anywhere, which is what makes reconnection trivial: whatever was missed, the
next fetch repairs.

## Persistence

```sql
CREATE TABLE games (
  id         TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  state      TEXT NOT NULL,   -- JSON: the whole match
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE game_events (    -- append-only history
  game_id    TEXT NOT NULL REFERENCES games(id),
  seq        INTEGER NOT NULL,
  type       TEXT NOT NULL,
  actor      TEXT,            -- player1 | player2 | server
  payload    TEXT NOT NULL,   -- JSON
  created_at TEXT NOT NULL,
  PRIMARY KEY (game_id, seq)
);
```

Document-style: a relational shell with JSON innards. Chosen over a document store because
transactions and history queries are stronger here, while the JSON column keeps the state shape
free to evolve.

- File: `resolve(process.env.DATA_DIR ?? '.data', 'oni-quest.db')`. Dev → `.data/oni-quest.db`
  (gitignored); Fly → `DATA_DIR=/data`, the mounted volume.
- Pragmas on open: `journal_mode = WAL`, `busy_timeout = 5000`.
- Bootstrap is **lazy and idempotent** — `getDb()` memoizes a `ready` promise running
  `CREATE TABLE IF NOT EXISTS`, then starts the cleanup schedule.
- **There is no migration mechanism.** The schema has never had to change in production. The
  first change will need one; see Open questions.

### The mutation queue

Every mutating endpoint used to read state, compute the next state, then write — so two
concurrent actions on the same game (both players scoring in the same Scoring phase is the
_normal_ case) could overwrite each other. The whole cycle now runs inside one write transaction:

`mutateOpen` / `mutateAsSeat` / `mutateAsLeader` → `serializeMutation` → `executeMutation`:

```
SELECT state → authenticate (seat / leader) → run domain guards + transition
  → SELECT COALESCE(MAX(seq),0)+1 → UPDATE games → INSERT events → commit
```

with `rollback()` and a rethrow on any error, so a guard failure leaves nothing written.

These are chained behind a **module-level FIFO promise** (`mutationTail`). The queue is not an
optimisation — the libsql client _fails_ concurrent write transactions with `SQLITE_BUSY` instead
of queueing them, which the concurrency spec caught before it shipped. One Node process means the
queue is complete; a multi-process deployment would need database-level locking instead.

Game **creation** bypasses the queue (there is nothing to serialise against): `insertGame` uses
`db.batch` with a three-attempt retry on a primary-key collision.

## Event history

Append-only, written inside the same transaction as the state change. Actor is `player1`,
`player2` or `server`; leader-only actions record `player1`.

| Type                                               | Payload                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `game-created`                                     | `{ nickname, season, missionId }`                                                  |
| `join-requested` / `join-accepted` / `join-denied` | `{ nickname }`                                                                     |
| `intelligence-drafted`                             | `{ intelligence }` — the faction is seeded, never drafted                          |
| `schemes-drawn`                                    | `{ count }` — the hand itself stays in state and is private                        |
| `scheme-chosen`                                    | `{ schemeId }`                                                                     |
| `scheme-deleted`                                   | —                                                                                  |
| `seat-ready-toggled`                               | `{ ready }` — the seat's own new value                                             |
| `combat-army-set`                                  | `{ name }` — never the code                                                        |
| `leader-assigned`                                  | `{ assigned }` — never the entry id, never the statistics                          |
| `game-started`                                     | —                                                                                  |
| `reveal-intent-toggled`                            | `{ intent }`                                                                       |
| `phase-changed`                                    | `{ round, phase }`                                                                 |
| `objective-toggled`                                | `{ objectiveId, checkedCount }` (clamped)                                          |
| `scheme-box-toggled`                               | `{ checkedIncrements }`                                                            |
| `round-snapshotted`                                | `{ round, player1, player2 }`                                                      |
| `game-finished`                                    | `{ winner, finalVp1, finalVp2 }`, plus `autoFinished: true` when the server did it |
| `game-closed`                                      | —                                                                                  |

`advance-phase` writes `phase-changed` on reveal → scoring, and **both** `round-snapshotted` and
`phase-changed` on scoring → next round. `finish` writes the round-5 snapshot plus
`game-finished`.

**There is no `applyEvent` and no replay.** State is produced by calling the transition functions
directly and persisted alongside the events; `game_events` is write-only history for statistics
and auditing. Nothing reconstructs state from it.

## Hardening (`src/hooks.server.ts`)

- **Body cap** `MAX_API_BODY_BYTES = 65536` on every POST under `/api/`; any `transfer-encoding`
  header (chunked) or oversized `content-length` → **413**. GETs are not body-capped.
- **Rate limits**, fixed-window per client IP, in memory: creating a game **20 per hour**; every
  other POST action **120 per minute**. GETs (state, events, join status, health) are unlimited —
  they are what a reconnecting phone needs.
- **Logging**: one line per API request except `/api/health`, formatted
  `api <METHOD> <pathname> -> <status> (<ms>ms)`. **Path only** — query strings are deliberately
  never logged, because `/events` and `/join/status` carry seat tokens in them.
- `handleError` logs `unhandled error on <METHOD> <pathname>` and returns `{ message: 'Internal
error' }`. `ApiError`s are converted to JSON inside the `api()` wrapper and never reach it.

## Lifecycle and cleanup

Retention by `updated_at` (`cleanup.ts`):

| State                       | Retention                                    |
| --------------------------- | -------------------------------------------- |
| `lobby`, idle               | **7 days** → deleted                         |
| `active`, rounds 1–4, idle  | **30 days** → deleted                        |
| `active`, **round 5**, idle | **auto-finished**, then retained as finished |
| `finished` / `closed`       | **90 days** → deleted (game + its events)    |

Runs once on startup (inside `getDb()`) and then every **24 h** via
`setInterval(...).unref()`. Failures are caught and logged, never fatal.

The round-5 auto-finish exists so a forgotten final click does not lose a result the KPI export
would otherwise have had: `autoFinishStaleGame` re-checks eligibility _inside_ the mutation
(`active` ∧ round 5 ∧ older than the cutoff, else it throws and is skipped), then runs the
existing `advanceToScoring` → `computeRoundVp` → `finishGame` path and writes both events with
`actor: 'server'` and `autoFinished: true`. It reuses the real transition functions rather than
duplicating finish logic, so an auto-finished game is indistinguishable from a manually finished
one apart from that flag.

The 90-day finished/closed window is deliberately longer than it needs to be — it is a bridge
until the statistics export exists.

## Operations

- **Exactly one machine.** The architecture (single SQLite file + in-process SSE registry +
  in-process mutation queue) cannot run on two: their databases would diverge and their
  notification registries would not see each other. After any manual scaling, check
  `fly machines list` and keep it at one.
- `min_machines_running = 0` — the machine auto-stops when idle and cold-starts on the next
  request (~9 s straight after a deploy, ~1–2 s later). An idle stop severs SSE; the
  refetch-and-resubscribe policy absorbs it.
- `/api/health` is the unauthenticated Fly HTTP check. It reports **aggregates only** — counts per
  status, DB file size, open SSE streams — never game ids, nicknames or tokens.

## Divergences from `MULTIPLAYER_PLAN.md`

The local planning doc (gitignored) is the design basis; the code has moved on in these places.
Recorded here so the plan is not mistaken for the spec:

1. **SSE notifications carry no `seq`** — §2.4 specifies "type + seq". Only `type` is sent; the
   client's full refetch makes a sequence number unnecessary.
2. **The joiner's seat token is client-generated, not server-issued** — §2.4 says the server
   issues tokens on create _and_ accept. As built only the leader's is server-issued; the joiner
   generates their own in the browser and sends it with the join request, and `accept` moves the
   stored hash into seat 2. No token ever travels back to the joiner.
3. **`round-snapshotted` payload keys** are `{ round, player1, player2 }`, not §3's
   `{ round, vp1, vp2 }`. (`game-finished` does use `finalVp1`/`finalVp2` as planned.)
4. **`faction-drafted` became `intelligence-drafted`** — §3 planned one event carrying both draft
   keys, and the store used to send them as two calls. The Scheme faction is no longer drafted at
   all (it is seeded from the combat army when preparation ends), so the event carries only
   `{ intelligence }`.
5. **No `applyEvent` / event replay** — §3 implies state is maintained event-sourced. It is not;
   events are history beside a directly-maintained state document.
6. **`closeGame` is not allowed from "any status"** — §2.2 says any; the code refuses once
   `finished` or `closed` (409 "This game has already ended").
7. **§2.2's "Toggle scheme box" row omits the reveal gate** that §8 later added. The row is stale
   relative to both §8 and the code.
8. **§9's "finished/closed cleaned up after 30 days"** is superseded by the 90-day value shipped
   under the 2026-08-25 decision — §9 is internally inconsistent with §8/§10.

## Open questions

- **No migration mechanism.** `CREATE TABLE IF NOT EXISTS` only. The first schema change to a
  production database with live rows needs a real story (version column? numbered SQL files?).
- **No database backup.** The volume has scheduled snapshots; there is no Litestream or equivalent
  continuous replication. A bad deploy that corrupts the file loses in-flight games.
- **The seat token still travels in the `/events` and `/join/status` URLs.** Short-lived one-time
  SSE tickets would remove it from logs, proxies and browser history. Deferred since 2026-08-21.
- **Rate limits and the SSE registry are per-process memory**, so both reset on restart and
  neither survives a second machine. Fine at one machine; a blocker for scaling out.
- **`pendingJoinNickname` should be leader-filtered server-side** (see Visibility filter).
- Every notification triggers a **full state refetch**. Correct and simple, and cheap at this
  event rate — but it is O(state size) per action, and a chatty game would amplify it. Revisit
  only if it shows up in metrics.
- **Statistics export is unbuilt.** Until it exists, `resultSummary` is written and never read,
  and finished games are kept 90 days on spec.
