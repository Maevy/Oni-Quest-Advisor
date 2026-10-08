# Progress

Handoff notes for picking this project back up: where things stand, what is next, and the
things that bite. For architecture rules see `QWEN.md` and the per-layer `CLAUDE.md` files;
for behaviour see `docs/`. Released history lives in [`ARCHIVE.md`](./ARCHIVE.md).

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/ — latest release **v0.8.0** (tagged on `main`,
  2026-09-26), the hot-seat parity release. Day-to-day work happens on **`develop`**, pushed
  to `git@github.com:Maevy/Oni-Quest-Advisor.git`.
- **`develop` is ahead of v0.8.0** (2026-09-27 … today) with **two unreleased features**, in this
  order:
  1. **Tournament** (`9367fc1`…, extended 2026-10-02) — the configuration wizard, server-side
     creation, the shared lobby, joining by link or QR, resume/abandon, the match-preparation
     screen with its roadmap and table assignment, **and now the round's `game` and `scoring`
     phases**: a table's match is an ordinary online game the tournament creates and overwatches
     (Enter Game, the megaphone, results reporting themselves into a cumulative standing, replays
     of dead tables, the next round and the conclusion screen with its medal standings). What is
     left of the feature is the **tournament report** — the button exists and is inert.
  2. **The online-mode redesign** (`da407c1`…`4ddd789`) — a game is born set up, both seats
     bring an army, Start Game is gated on per-seat **Ready**, and a match opens with Army
     Reveal → Army Preparation (a Roster is cut to ≤85 in a _borrowed_ army builder) → Scheme
     Selection. The Roster format's internal id changed from `'tournament'` to `'roster'`
     behind a decode migration.
- Both are described in `ARCHIVE.md`'s unreleased section, which also carries their traps and
  open questions.
- Missions bundled (`src/lib/data/content/missions/`, all Season 2): Treasure Hunt, Clue
  Trail, Magic Stones, Quarter War, Snail Chase, Supply Run, Toxic Infestation, Open
  Hostilities, Awaiting Reinforcements.
- `docs/` was caught up against the code on 2026-09-11 and has been kept current since: 14
  spec documents plus two READMEs. Where the code and `MULTIPLAYER_PLAN.md` disagree, **`docs/`
  is the spec and the plan is design history** — the eight as-built divergences are listed in
  `docs/technical-spec/06-online-architecture.md`.

## Before deploying the unreleased work

**It needs the production database wiped.** `combatArmy` and `leader` are new required fields
on an online seat, the phase union changed, and there is no `hydrateOnlineGameState` — online
state is one server-side JSON document with no migration mechanism, so a row written before
the change would read `undefined !== null` as combat-ready with no army behind it. The dev
`.data/oni-quest.db` was deleted four times for exactly this reason.

Nothing has been run against Fly yet, and two decisions are outstanding:

- **A wipe is database-wide**, so it takes the tournament tables with it. Decide whether that
  is acceptable or the wipe should be games-only.
- The app is in beta and the wipe is authorized in principle, but it is destructive on shared
  infrastructure — **confirm explicitly** before doing it. `flyctl` on this machine needs the
  user's own interactive `flyctl auth login` first (the agent's shell is headless and the
  browser flow cannot complete there).

## What's next

The **tournament report** is deferred by agreement (2026-10-05): `completedRounds` already holds
everything it needs (each round's pairing, its results and the cumulative totals), concluded
events are kept 48 hours for it, and the **Prepare Tournament Report** button is on the
conclusion screen waiting. What a report contains, in what shape, and whether it is generated on
the device or on the server is the open half.

The current feature is the **Battle Flowers** — the army panel's redesign: every copy drawn as
its icon in a circular orb ringed by Stamina boxes (yellow, left half) and Life boxes (red,
right half). Phase 1 shipped in `e895afe`: the hot-seat tracker's two army panes became a single
Army view holding one panel split into a sky and an orange half, one flower per row, and
clicking a flower focuses it — backdrop blur, a 1.3× clone gliding to the viewport centre, the
rest faded; once landed, a ring of petals blooms outside the ring and retracts before the flower
glides home on click-outside or Escape. The ring is now **five petals** (2026-10-07): the model's
card, deal damage, heal, edit statuses and manage Stamina — one dark-blue glass, a pressed petal
lighting a yellow rim (one at a time; the light is the selection a later sub-ring will bloom from
— except the info petal, whose light is the open card's and drops when the card closes), and the
card petal opening the copy's unit card above the flower, which a click outside dismisses while
the flower stays centred until the next one. The glyphs: a grey bang in a ring for the card, a red
sword, a green medic's cross, an orange star for the States and a yellow disc for Stamina; the
assign/remove pair collapsed into the one star when the status flow made both directions one
ring. The damage flow landed 2026-10-05 as the first petal function: pressing the sword blooms a
third ring (1…6 and X, blooming from behind the action ring, with X's own amount entry), an
amount brings the living field forward as a target row (seat rims, copy badges, the focused
copy's twin among them), one tap selects under a turning crosshair, the second confirms, the
sword flies, the Life boxes darken one by one and the overlay closes with the hit committed to
the seat's vitality map. The heal flow followed the same day, the shape turned around: the row
offers every copy below its overheal cap (the fallen and the whole alike), the green cross flies,
and the boxes refill one by one, past full into the blue overheal up to double the base. The
**status flow** (2026-10-07) is the third petal function and the first that moves the focus: the
star's row holds every copy of both seats, one tap moves the focus onto the target — its flower
takes the centre while the flower it left glides home and stays **lit** in its slot — and a beat
later all fifteen States bloom around it as tappable orbs on a ring of their own (44 px each,
radius fitted to the smaller screen dimension; the petals went home with the flower they belonged
to and this flow has no amount ring, so nothing competes for the space). A carried State lights
the yellow rim and wears its own colour, the rest are the petals' glass with a grey glyph, and
Incapacitated and Crouched are locked orbs while Life is 0, because the store re-applies them to
every commit. Taps edit a **draft**; the model icon commits it — the first tap arms the crosshair,
the second writes the whole draft in one go and sends the flower home into **the target's** slot —
and toggling an orb disarms a pending commit. The States a copy carries also hang off its strip
flower as a **band of orbs over its shoulders** — four slots down the left, four down the right,
the `+n` chip taking the last right slot past eight (own glyph, own colour, absent on a clean
copy) — which is the default state's read of them. The **Stamina flow** (2026-10-08) is the
fourth petal function and the only one with no row: the disc blooms a third ring of two steps,
−1 and +1, dead at the floor and at the over-Stamina cap; each tap commits at once onto the
centred flower and walks its Stamina boxes one step — a spend emptying from the bottom end like
Life, a gain refilling the same way, and past the base the extra point repainting its box
**violet** from the top end, over-Stamina running to double the base like Life's blue. The step
ring stays out between taps, so several points cost several taps; a model with no Stamina gets a
dead disc instead of two disabled steps. **Box taps** (2026-10-08) closed the flower
interaction: on the focused flower the ring's boxes are themselves tappable while the petals
hold their place — the n-th box of a half sets that stat straight to n, walking and committing
at once — live only while the ring is idle; the strip flowers stay display-only and
over-Stamina stays the disc's +1. What remains of the flowers is carrying them to the other
modes' army panels. Behaviour spec:
`docs/functional-spec/06-two-player-hot-seat.md`. **Next: the flowers carry to the solo and
online army panels.**

Smaller open threads:

- **Healing can raise the fallen** — the heal row includes copies at 0 Life, so a heal revives
  them and the zero-Life States lift again with the hp change. Whether that is legal is an open
  ruling (2026-10-06), to be revisited; if not, `healableTargetsFor` gains a `current > 0` guard.
- **The online tracker's Army view is an empty list on purpose** — a placeholder for per-copy
  tracking, which is where the vitality work from v0.7.0 would land.
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

`npm run check`, `npm run lint`, `npm run test` after every change (636 tests as of the tournament
round's game/scoring phases). Beyond that, the habit here has been **throwaway browser and API
passes** — a real multi-context Playwright run asserting the journey, deleted afterwards; the
unreleased work was verified by a dozen of them, from 8 to 65 assertions. Five traps cost a run
each and recur:

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
