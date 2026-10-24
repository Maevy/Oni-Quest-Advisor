# Progress

Handoff notes for picking this project back up: where things stand, what is next, and the
things that bite. For architecture rules see `QWEN.md` and the per-layer `CLAUDE.md` files;
for behaviour see `docs/`. Released history lives in [`ARCHIVE.md`](./ARCHIVE.md).

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/ — latest release **v0.9.0** (tagged on `main`,
  2026-10-13, deployed the same day), the big one: the tournament, the ground-up online
  redesign, the Battle Flowers, the interaction log and both PDF reports. Day-to-day work
  happens on **`develop`**, pushed to `git@github.com:Maevy/Oni-Quest-Advisor.git`.
- **`develop` is ahead of v0.9.0 with one unreleased feature in progress: summoning.** The data
  layer (`2fab769`) and the local-mode UI (`e25105f`) are committed and verified; **online is not
  built yet** — see What's next. The rest of the lead is housekeeping: `ba775c3` (the doc fold
  that stopped these notes describing v0.8.0 as current), `46fb48d` (the wipe procedure below)
  and `e316fc9` (the lockfile version fields the release commit missed). What shipped in v0.9.0,
  with its decisions and traps, is `ARCHIVE.md`'s section for it; that file is the index into
  `git log`, not a replacement.
- Missions bundled (`src/lib/data/content/missions/`, all Season 2): Treasure Hunt, Clue
  Trail, Magic Stones, Quarter War, Snail Chase, Supply Run, Toxic Infestation, Open
  Hostilities, Awaiting Reinforcements.
- `docs/` was caught up against the code on 2026-09-11 and has been kept current since: 15
  spec documents plus two READMEs. Where the code and `MULTIPLAYER_PLAN.md` disagree, **`docs/`
  is the spec and the plan is design history** — the eight as-built divergences are listed in
  `docs/technical-spec/06-online-architecture.md`.

## Changing the persisted online shape means a database wipe

v0.9.0 is the precedent to follow. Both of its outstanding decisions were answered at release
time: the wipe was **database-wide** (the tournament tables went with it, by choice), and the
user confirmed it explicitly in the release turn. The procedure that worked: deploy the new
image first, then `flyctl machines start` (the machine auto-stops, and ssh needs a started VM),
`flyctl ssh console -C "rm -f /data/oni-quest.db /data/oni-quest.db-wal /data/oni-quest.db-shm"`
(one command per `-C`; chaining with `&&` mangles in transit), then `flyctl machines restart` —
the restart is not optional: the running process keeps serving the deleted inode from its open
handle, so health keeps reporting the old counts until it reopens the file. Afterwards
`/api/health` reads `games: {}` with a fresh 4 KB database.

The reason the wipe was needed, for the record: `combatArmy` and `leader` are required fields on
an online seat, the phase union changed, and there is no `hydrateOnlineGameState` — online state
is one server-side JSON document with no migration mechanism, so a row written before the change
would read `undefined !== null` as combat-ready with no army behind it. Any future change to the
persisted online shape needs the same conversation.

## What's next

v0.9.0 closed both feature threads. The **tournament** now runs its rounds as ordinary online
games it owns — pairing and the BYE, Enter Game, the megaphone, results reporting themselves
into a cumulative standing, replays of dead tables, and the conclusion screen's medal standings
with its report. An **online match opens the way the rulebook does**: born set up, Start Game
gated on per-seat **Ready**, then Army Reveal → Army Preparation (a Roster cut to ≤85 in a
_borrowed_ army builder) → Scheme Selection, the draw count coming from the Leader's INT.

On top of them landed the **Battle Flowers** (every copy an icon in a ring of Stamina and Life
boxes; a tap opens the Self Interaction dialog, a drag the cross-model Interaction panel; on all
three boards), the **interaction log** (online stores no vitality at all — every commit is a
`game_events` row both devices fold, and an undo is an appended revert, actor-only and only
while it is still the last one) and the **two reports** (battle and tournament PDFs, written on
the device by the hand-rolled `domain/pdf.ts`, persisted nowhere). Build stories, decisions and
traps: `ARCHIVE.md`. Behaviour specs: `docs/functional-spec/06-two-player-hot-seat.md`,
`07-online-two-player.md`, `09-tournament.md` and
`docs/technical-spec/06-online-architecture.md`.

The live thread is **summoning** (2026-10-24). Phase 1 (data) and phase 2 (local UI) are
committed: the six faction-less tokens are content now, in their own bucket **outside
`codeUnitPool()`** so no army code shifts; `SUMMON_SPECS` in the importer stamps tier and route
onto all nine summonable creatures; `domain/summoning.ts` gates who may call what (Conjuration by
Affinity element and tier, Necromancy by tier and faction-agnostically, the Deathweaving Fan
lifting that cap); and the Self Interaction dialog carries **Summon Creature** and **Dismiss**,
with a summoned creature hanging below its caller in a lilac beam. **Phase 3 — online — is not
built**: it needs a summon event type in `game_events` and fold support in `vitalityHistory` so
both devices derive the same board. That is additive to the log, so unlike v0.9.0 it needs **no
database wipe**. Behaviour is specified in `docs/functional-spec/06-two-player-hot-seat.md`
(_Summoning_), the content shape in `docs/technical-spec/05-army-data-format.md`.

The older deferred thread is the two buttons those dialogs still render inert — **Trade Item** and
**Assign / Remove Buff** (`enabled: false` in `FlowerInteraction.svelte`'s action lists) — one of
which the v0.9.0 announcement already promised the players. Everything else that is open was
deferred on purpose; the list follows.

Smaller open threads:

- **Healing can raise the fallen** — the heal row includes copies at 0 Life, so a heal revives
  them and the zero-Life States lift again with the hp change. Whether that is legal is an open
  ruling (2026-10-06), to be revisited; if not, `healableTargetsFor` gains a `current > 0` guard.
- **The initiative roll** (rulebook step 8) is unmodelled; its formula and prize are rulebook
  text we do not have. The exposure it exists for (the Leader's M and INT) is already in place.
- **`activePlayer` is not persisted** in hot-seat. `twoPlayerProgress.svelte.ts` keeps it as
  store-only `$state` and `loadForMission()` resets it to `player1`, so now that a reload
  resumes a run through the open-game prompt the hole is one accidental refresh wide: whoever
  holds the phone after the reload sees Player 1's hidden scheme. Persist it, or force a
  countdown on load.
- **The picked army is display-only.** `pickFormatFor()` in `+page.svelte` filters mission-flow
  slots to `'standard'`, so Roster saves cannot be picked there at all, and nothing validates
  an attached list against the mission (points, faction, required units). Both deliberate for
  now; revisit if the army should matter beyond reference.
- **Online's resume/leave flow is deliberately not aligned with the tournament's**
  prompt-and-abandon pattern: `resumeSession()` drops the device straight onto the screen with
  no prompt, and `leave()` is local-only, so the server-side game stays alive and the seat
  stays held. Deferred on purpose ("commit this, we will focus on updating online mode
  later") — it survived the redesign because the redesign was scoped to the front door, not
  because it was overlooked.
- **Visual sign-off still pending** on the radial "Deployment Zone" label fit (Quarter War,
  Toxic Infestation), 4-box rows at phone width, and whether the filled `bg-red-500` Return is
  notable enough.
- **`MULTIPLAYER_PLAN.md`** (project root, gitignored, local-only, never pushed) holds the
  online mode's planning basis and decisions log. Read it for the _why_, not for current
  behaviour. Note it is CRLF.

Cross-cutting gaps are recorded as **Open questions** at the end of each spec doc, which double
as the behavioural backlog — among them: no content guard for schemes or units (missions have
six), season ordering is glob order rather than semantic, no schema migration mechanism for the
online database, and no design tokens (the palette is the Tailwind scale and button recipes are
copy-pasted class strings, which is why disabled styling has drifted between screens).

## Verification on this machine

`npm run check`, `npm run lint`, `npm run test` after every change (743 tests as of v0.9.0).
Beyond that, the habit here has been **throwaway browser and API passes** — a real multi-context
Playwright run asserting the journey, deleted afterwards; v0.9.0 alone was verified by a dozen of
them, from 8 to 65 assertions. Five traps cost a run each and recur:

- **`npm install` is blocked**, so no new dependencies. This is why the QR encoder is in-app
  (`domain/qr.ts`) rather than a package.
- **Playwright's `hasText`/`text=` matching is case-insensitive substring**, so `'Game Leader'`
  also matched "waiting for _the game leader_", and a prep screen's own note mentioning "Scheme
  selection" matched the next screen's title.
- **`innerText` returns CSS-uppercased text**, so `waitForFunction` needles must be compared
  case-blind.
- **A fresh browser context shows the privacy banner**, which intercepts clicks until
  dismissed. Also: the first unit in the Helian catalog is `upgradesLocked`, so it renders no
  upgrade slot at all.
- **Keep throwaway scripts outside the project root.** Vite's dev server watches the whole tree,
  and any write under it — including editing a `.mjs` harness in `.qwen/tmp/` while a pass is in
  flight — logs `[vite] (ssr) page reload` and **full-page-reloads every connected browser**,
  which drops mid-journey devices back onto the startup prompt and reads as a flaky app. The
  harnesses live in `~/.qwen/tmp/oni-verify/` now (importing Playwright by absolute path into this
  project's `node_modules`), and "press outside the popup" must click something inert — the
  header's title — or it lands on a table panel's Enter Game and walks the device into its match.

## Deployment & ops

- Fly app `oni-quest-advisor`, region `fra`. Redeploy with `fly deploy` from the project root.
- **The volume `oni_quest_data` exists since v0.5.0** (1 GB, mounted at `/data`,
  `DATA_DIR=/data`, created 2026-08-21), so future deploys only need `fly deploy`. A fresh app
  clone would first need
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1` — the `[mounts]` entry in
  `fly.toml` expects it and the deploy fails without it.
- **Exactly one machine.** The architecture (single SQLite file + in-process SSE registry +
  mutation queue) cannot run on two — their databases would diverge. The legacy second machine
  was destroyed during the v0.5.0 deploy; after any manual scaling, check `fly machines list`
  and keep it at one.
- `min_machines_running = 0` in `fly.toml` — machines stop when idle and cold-start on the next
  request. Online mode is built around this: state lives in SQLite, phones refetch and
  resubscribe SSE on wake. Measured: ~9 s cold start right after a deploy, ~1–2 s for later
  auto-stop wakes.
- Bump the version in `package.json` for a release; `vite.config.ts` injects it as
  `__APP_VERSION__` into the site-wide footer.
- Don't stage local tooling state: `.idea/` and `.qwen/` are untracked and not gitignored.

### Known gotcha

A commit-time content gate (from a Claude Code plugin, not part of this repo's own config)
scans staged diffs for "task residue" patterns and can false-positive on innocuous substrings.
If a commit gets blocked over clearly-unrelated content, just reword that line.

## Where the history is

- [`ARCHIVE.md`](./ARCHIVE.md) — what shipped per release, the decisions and traps still worth
  knowing, and the `git log` range for each.
- **`git log` is the authoritative record.** Commit messages here are detailed by design, so
  the archive is an index into them rather than a replacement.
- `docs/` — the specs the app is built against.
