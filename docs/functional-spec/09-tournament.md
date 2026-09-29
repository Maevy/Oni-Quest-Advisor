# Tournament

A tournament is an event run by a **Tournament Organizer (TO)**: players join, are paired round by
round, play their games at tables, and the event concludes with a victor. It is the app's fourth
way to play and its first multi-table one — everything before it was a single match between two
sides.

> **Under construction.** This document grows with the feature, step by step. What exists today is
> the entry point, the configuration wizard's three panes, creation behind the retention notice,
> the lobby with its link and QR invites, joining, returning to a held seat after a reload —
> including abandoning it again — starting the event (with the BYE announcement for an odd field),
> the match-preparation screen with its table assignment and progress roadmap, and starting a round
> (which locks its tables); playing and scoring a round, overwatch and the conclusion are planned,
> and the plan's undecided parts are listed at the end.

## The shape of the feature (planned)

1. **Create & configure** — the TO names the tournament, names themselves, decides whether they
   play, sets the field size and who pairs each round; then configures missions and tables.
2. **Invite** — a link and a QR code bring the players in.
3. **Pair** — each round the field is paired, automatically by a Swiss system or by the TO by
   hand. Manual pairing exists for the round being prepared; the Swiss system does not yet.
4. **Overwatch** — the TO watches the tables' games as they run. The round reaches its `game`
   phase; what happens there does not exist yet.
5. **Conclude** — the tournament ends with its victor. It is the roadmap's last step and nothing
   more today.

## Entry point

The mode select gains a fifth button, **Organize Tournament**, in the red outlined recipe, placed
with the play modes and above the Army Builder tool. It carries no neon treatment — the beam stays
the Solo button's, one entry point at a time.

It opens `tournament-setup`, a wizard on the shared `ScreenHeader`.

## Step 1 — the basics

Two panels, then a **Continue** button:

**Tournament** — the tournament's name; an optional **External Link** to wherever the event is
listed outside the app; the organizer's name; and a tickbox _"I am also a participant"_. Ticking
it reveals the organizer's army control: a **Pick Roster Army** button opening the saved-army
picker filtered to **Roster**-format lists (125 points), which becomes a row with the list's name,
faction and a ✕ once one is attached.

**Participants & Pairing** — a −/+ stepper over the field size with a help line explaining the
pair rule; a tickbox _"I assign the pairings myself each round"_, whose help line names the Swiss
system as the default.

Decisions taken so far:

- **The field steps in pairs, 4 to 32.** Every round pairs players off, so an even field means no
  byes and no rule for who sits a round out. Odd counts are unreachable rather than handled: the
  stepper moves two at a time, and any other input is snapped to the nearest even count inside the
  range.
- **A playing TO holds one of the configured seats.** "8 participants" always means 8 pairing
  slots; the organizer's tick does not add a ninth. The panel says so while the tick is on: _"You
  hold one of these 8 seats."_ Giving the seat up again drops the picked army — a seat not held
  has no list to bring, and re-ticking does not resurrect it.
- **A held seat must come with a list.** Continue stays blocked while the tick is on and no army
  is attached: without a list the organizer cannot participate. The pick is marked red with the
  reason beside it, and the line under the disabled Continue repeats it. Giving the seat up drops
  the army and unblocks the wizard again.
- **The external link is optional but, once typed, must be usable.** It is normalized to an
  http(s) URL (a bare `tabletop.events/x` gains `https://`), and anything else — spaces, foreign
  schemes, a scheme with no host — blocks Continue and marks the field red with a hint. Whitespace
  is rejected before parsing because engines disagree about spaces inside a host: Chromium
  percent-encodes them into a "valid" URL where Node throws.
- **Continue needs both names and a usable link.** The field size and the tickboxes are always
  legal, so they never gate the wizard.
- **The wizard is local.** Nothing is persisted and nothing is sent anywhere while configuring;
  leaving the wizard discards the draft. The server enters the picture when the tournament is
  actually created at the end of configuration — which is also where invites, pairings and
  overwatch will live.

## Step 2 — missions & tables

Reached by **Continue** from step 1.

**Missions** — the added missions in the order they were added, each a row with its name, its
season and a ✕; and an **Add Quest** button. Add Quest opens a popup with a **Season** dropdown
and that season's missions as clickable rows: clicking one adds it and closes the popup, while
Escape, **Cancel** and a click on the dimmed backdrop close it without adding. A mission already
on the list is disabled in the popup and marked _already on the list_ — a mission plays once per
tournament. With no missions the panel says so plainly.

**Tables** — one editable name per table, numbered, defaulting to **Table 1**, **Table 2**, … The
count is derived, not configured: **half the participants**, so every round seats the whole field
at once. Growing the field on step 1 appends default-named tables, shrinking drops the surplus —
a custom name therefore always stays with its table number.

**Overview** — enabled once at least one mission is on the list; it opens step 3. This is the last
pane that edits the draft.

Decisions taken here:

- **Tables follow the field.** The TO never sets a table count; renaming is the only table
  configuration.
- **The mission list is ordered and deduplicated**, and removable — a list you can only grow
  would be a dead end, so each row carries a ✕ even though removal was not specified.
- **The popup groups by season** rather than listing every mission at once, because the mission
  list will only grow and a flat list of everything would bury the current season.

## Step 3 — the overview

Reached by **Overview** from step 2. A read-only review of everything configured so far, in four
panels: **Tournament** (the name, the external link, the organizer, whether they play and the army
picked for their seat), **Participants & Pairing** (the field size and who pairs each round),
**Missions** (the list in the order it was added) and **Tables** (the numbered names). Nothing on
this pane edits the draft — a change means stepping back — so the organizer sees exactly what will
be created.

**Create Tournament** — enabled once at least one mission is on the list, the same gate that
opened this pane. It does not create anything yet: the retention notice below comes first, and
only its **Create** talks to the server.

Decisions taken here:

- **The overview is the only review.** Step 2's summary panel of step 1 is gone: every fact it
  repeated is reviewable here, in full, right before creation.

Navigation within the wizard: **Return** steps back one pane at a time — overview to missions &
tables, missions & tables to basics — keeping the whole draft intact; on step 1 it leaves the
wizard and discards it.

## Creation — the retention notice

Pressing **Create Tournament** opens a confirmation first: _"Create this tournament? Its data —
players, tables and results — is kept on the server for 48 hours after the tournament concludes so
a report can be generated, and deleted afterwards."_ **Create** performs the first server contact
and opens the lobby; **Not yet** stays on the overview with the draft untouched.

Decisions taken here:

- **The notice is the TO's consent to retention**, and it names the reason: a printable tournament
  report is a later step of this feature, and a report needs the data to outlive the event.
- **The 48 hours run from the conclusion**, not from creation — an event that runs long is never
  deleted mid-play. An abandoned lobby goes after 7 days and a tournament abandoned mid-play after
  30, the windows online games already use.
- **The server re-validates everything.** Names, optional link, field size, mission list and table
  list are checked again on `POST /api/tournaments`; the wizard's gates are a courtesy, not a
  boundary. A playing organizer without an army is refused there too.

## The lobby (the initial tournament screen)

The screen both the TO and every player land on after creating or joining. It shows the whole
event: the name, the external link (openable), the organizer, the pairing mode, the join code, the
mission list, the table names, and the **participants panel** — one row per pairing slot, either a
name with their registered army's name and faction colour (marked `you` on the viewer's own row and
`organizer` on the TO's) or _Empty seat_. A playing TO's seat is filled from creation.

The organizer additionally gets the **Invite Players** panel: **Share Link** copies the join URL to
the clipboard with a "copied" confirmation — and shows the URL inline for manual copying when the
clipboard is unavailable — and **QR Code** opens the same URL as a scannable symbol. At the bottom
the **Start Tournament** button moves everyone on to the match-preparation screen; it unlocks at
two registered players and says why it is locked below itself (see Starting the tournament).

Decisions taken here:

- **One screen for both roles.** A player sees exactly what the TO sees minus the invite controls
  and the start button, so nobody has to ask who is in or what is being played.
- **The lobby updates live.** Joins reach every open lobby over the same SSE change-notification
  mechanism online games use: a notification triggers a refetch of the viewer's filtered view.
- **Army codes and seat tokens never leave the server.** The lobby shows a registered army's name
  and faction; the code stays with its owner, so nobody can import somebody else's list from the
  participants panel.
- **A device that already holds a seat goes straight to the lobby** when it opens its own invite
  link again, instead of being offered a second seat.
- **The QR symbol is encoded in the app** (a small byte-mode, level-M, versions 1–6 encoder in
  `domain/qr.ts`, rendered as an SVG). Nothing is sent to a third-party generator, because the link
  _is_ the credential to join.

## Joining a tournament

The invite link (`/tournament-join/<code>`, reached by link or by scanning the QR code) hands the
code to the app and opens a join screen: what the tournament is (name, organizer, how many of the
field's seats are taken) and the joiner's registration — a name and a **Roster** army from their
own saved lists, with **Join** unlocking only when both are given and a seat is free. On success
the device stores a seat session (`oni-quest-advisor:tournament-session`: code, role, token) and
lands in the lobby, read only; a reload resumes straight back into it.

Decisions taken here:

- **A joiner must bring a Roster list**, exactly like a playing TO: the same saved-army picker
  filtered to 125-point lists, and the same offer to build one when the device has none.
- **Seats fill first-come-first-served and the field refuses overflow.** Once every slot is taken the
  join screen says so and further joins are refused — no waitlist and no per-join approval, so the
  TO does not have to babysit the door.
- **The joiner's token is generated on their own device** and only its SHA-256 hash is stored, the
  pattern online seats already use; one token holds one seat, so a replayed join is refused.

## Returning to a tournament, and abandoning it

A device that holds a seat session (`oni-quest-advisor:tournament-session`) is offered it back on
every app start, the same way an open local game is: the app fetches the current view first, so the
prompt can name the tournament, and then asks.

> _"You are participating in "Eldfall Cup". Abandoning it gives up your seat."_ — **Return** /
> **Abandon**

**Return** (the prominent button, and the Escape branch — walking away is never the accidental
choice) enters `tournament-lobby`, which resynchronizes itself from the fetched view and then stays
current over SSE: a player who reloads mid-lobby sees the seats as they are now, not as they were
when the app closed. **Abandon** is the only way out of a tournament, and it always reaches the
server — what it does depends on the role:

- **A participant** gives up their seat (`POST /api/tournaments/<code>/leave`): the row goes back to
  _Empty seat_, the count drops, every other lobby sees it live, and the seat is open to the next
  joiner again.
- **The organizer** cancels the event (`POST /api/tournaments/<code>/cancel`): its status becomes
  `closed`, and every device in the lobby is taken back to the main menu with a dismissible banner
  reading _"The organizer cancelled this tournament."_ The invite link answers with _"This
  tournament was cancelled by its organizer"_ and refuses further joins.

The lobby's own **← Return** opens exactly the same prompt with exactly the same consequences —
there is no local-only way to walk out of a tournament, because that would strand a seat nobody can
take (or an event nobody can start) on the server.

Decisions taken here:

- **The prompt is the resynchronization point.** The view is fetched before the prompt appears, so
  "Return" never lands in a stale lobby and a tournament that ended while the app was shut is
  reported instead of offered.
- **Abandoning is a server call, and a failure keeps the dialog open** with the reason. Silently
  clearing the session locally would free the player while the server still counts them in — so a
  device that cannot reach the server stays where it is and can retry.
- **A cancelled event keeps its seats.** Deleting the rows at once would leave every open device
  with a bare 404 and no way to tell a cancellation from a retention cleanup or a mistyped code;
  `closed` plus a change notification lets each of them say what actually happened. Retention then
  deletes a cancelled event after 24 hours — it has no report to keep, unlike a concluded one's 48.
- **A cancelled or deleted tournament is not offered on app start.** The dead session is dropped,
  the reason is shown as a banner on the main menu, and the normal startup order carries on (an open
  local game is offered next).
- **Leaving is a lobby-only rule for players.** Once the event runs, a seat is part of a pairing;
  releasing it mid-round needs a forfeit rule that does not exist yet, so `leave` refuses with a
  clear message. The organizer may cancel a running event — a broken one has to be killable — but
  never a concluded one.

When the server cannot be reached at all, the session is kept and the prompt still appears — it
just cannot name the tournament ("this tournament") and carries the reason. **Return** then lands
on a retry panel (the failure, **Try Again**, **Abandon**) rather than an empty screen, and a
successful retry both refetches the view and re-opens the change stream, so the lobby is live again
without a reload.

## Starting the tournament

**Start Tournament** is the organizer's, and it needs at least **two registered players** with **at
most one seat still empty**: the configured tables are the tables that will play — one per pair of
seats — so two empty seats would leave a table with nobody at it, while exactly one is what the BYE
fills. The lobby names whichever gate is missing (_"2 of 4 seats are still empty — at most one may
stay open, or a table would go unplayed."_), and an event that cannot start has to wait for joiners
or be cancelled and recreated smaller, because the field is fixed at creation. Pressing it moves the
event from `lobby` to `active` (`POST /api/tournaments/<code>/start`), which closes the door for
good — joining and leaving are both refused from here on — and opens round 1 on the **first mission
of the configured list**.

With an **odd number of registered players** an info panel comes first:

> _"Start with 3 players? The field is odd, so the missing spot is filled with a BYE — an imaginary
> player who takes a seat but is never played against. Whoever you assign the BYE to sits this round
> out and takes it as a win."_ — **Start** / **Not yet**

An even field starts straight away. Every device in the lobby is moved to the match-preparation
screen by the change notification, without a reload and without a click.

Decisions taken here:

- **At most one seat may stay empty.** The table count is configured up front and shown to everyone
  in the lobby, so a round that leaves a table dark would break the promise the configuration made.
  One empty seat is exactly the BYE's case, zero is a full field; two or more means the event was
  sized wrong, and the honest fix is a new, smaller one.
- **A BYE is an occupant, not a skipped round.** It sits in the pool and is assigned to a table
  exactly like a player, which keeps every pairing round uniform and keeps the table count
  meaningful. A table holding one player and the BYE says so in place: _"The BYE sits at this
  table: its player sits this round out and takes it as a win."_
- **The organizer chooses who takes the BYE.** Not the lowest score and not a rotation — the TO
  drags it wherever they like, which is the manual-pairing mode's whole point. (What that win is
  worth in points is still open.)
- **It is announced before it happens**, so the TO can still go back and wait for one more player
  instead of starting an odd field by accident.
- **Round n plays mission n.** The wizard's ordered mission list is the round order; a round with
  no mission left cannot be created. Whether a tournament outlives its mission list is open.

## The match-preparation screen

`tournament-round`, one screen for both roles, in four parts:

1. **Progress** — the event's **roadmap**: a line of dots, one per step, that glows green from grey
   as the tournament advances. The steps are the three phases of every round — _Round 1 Setup_,
   _Round 1 Game_, _Round 1 Scoring_, then _Round 2 Setup_ … — and a final _Tournament Conclusion_,
   so a tournament with _n_ missions has 3*n* + 1 of them. Reached steps and the connector leading
   to them are green, the current one pulses (reduced-motion aware), the rest stay grey. A caption
   under the strip names the current step and its state (_· now_, _· done_, _· upcoming_); tapping
   any dot names that one instead, and tapping it again returns to the current. The strip is
   centred in its panel and scrolls horizontally when it does not fit, centring itself on the
   current step, so a nine-mission tournament's 28 dots still fit a 320 px phone without the page
   overflowing. The panel is the shared `Panel`'s darker `tone="dark"` variant — slate-900 at 80%
   instead of the frosted slate-800 at 40% — with a centred title, because thin grey dots over the
   translucent key-art background were the least readable thing on the screen.
2. **Round Control** — the round number (**Round 1**), the mission it plays (name and season), and
   the **Victory Points** standing: one row per registered player, in seat order, all at 0 until
   matches are scored. The viewer's own row is marked `(you)`.
3. **Start Round** — a big green button, **the organizer's alone**: a player does not see it, only
   _"The organizer starts the round once every player is paired."_ It is locked until the
   assignment gate below is met, and pressing it moves the round from **setup** to **game**
   (`POST /api/tournaments/<code>/start-round`): the roadmap advances one step on every device at
   once and the tables lock.
4. **Table Assignment** — the **pool** of everybody without a table (the registered players in seat
   order, then the BYE when the field is odd) and one card per configured table showing its name,
   its occupant count out of two, and its occupants as chips in their army's faction colour (the
   BYE in amber).

Only the organizer assigns; a player sees the identical board read-only — plain text chips, no
placement controls — and the line _"The organizer assigns the tables."_ Every move is a server
mutation (`POST /api/tournaments/<code>/assign`, organizer-only), so each drop reaches every device
over the change notification: the players watch the TO fill the tables live.

Two ways to move an occupant, because the app is used on a phone:

- **Drag** — pointer events (so a finger works as well as a mouse), a floating ghost chip under the
  pointer, the container under it highlighted, and `touch-action: none` on the chips so the drag is
  not stolen by page scrolling. Dropping on a table seats the occupant there, dropping on the pool
  sends a seated one back, dropping nowhere leaves it where it was.
- **Tap to place** — tap a chip to select it, then tap **Place {name} here** under any table that
  has room (or **Move {name} back here** in the pool). This is the path for a long list, where the
  pool and the target table are not on screen at once, and the only one a keyboard or screen reader
  can use.

The board is frozen while a move is in flight, so drops cannot overtake each other, and the view
that comes back is the server's — nothing is patched locally.

**The gate:** Start Round unlocks when the pool is empty — the BYE included — **and** no table
holds a single occupant. The second half matters: with four tables and six players, 2/2/1/1 assigns
everybody and still strands two of them without an opponent. The hint under the button names
whichever half is missing.

A refused move (a full table, a seat nobody holds, an unknown table, a BYE the field does not need)
comes back as an error line at the top of the screen; the board simply stays as it was.

### Round phases

A round walks through **setup → game → scoring**, and the phase is server state, so every device
shows the same step of the roadmap and the same screen affordances:

| Phase     | The board                                                                       | Start Round                                        |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `setup`   | the organizer may assign, players watch                                         | shown to the organizer, gated on the pairing       |
| `game`    | **locked** for everybody — _"The tables are locked — this round is under way."_ | gone; the screen says _"Round n is being played."_ |
| `scoring` | locked                                                                          | gone; _"Round n is being scored."_                 |

Locking at the start of the game phase is deliberate: a pairing must not change underneath a match
that is already being played. A mistake means cancelling the event — undoing a started round is not
offered. Rows written before the phase model existed hydrate to `setup`, which was all a round
could be then.

## Next — playing and scoring the round

The round reaches `game` and stops there. The next step gives the phase content: the tables' matches
begin (presumably each table is a normal match on the players' own devices, with the tournament
server overwatching), the results are reported, `scoring` turns them into victory points in the
standing, and the round after it opens on the next mission — which is what moves the roadmap from
_Round 1 Scoring_ to _Round 2 Setup_.

## Open questions

- **How do missions map onto rounds?** Round _n_ plays mission _n_ of the configured list, for every
  table at once — decided for the round being prepared. Still open: what happens when a tournament
  outlives its mission list (stop, repeat, or let the TO pick), and whether a table may ever play
  something else than the round's mission.
- **Mixing mission kinds needs a scoring story.** Ceasefire missions carry the automatic −4 VP
  penalty and forbid round-1 scoring, and Broken Morale changes how a game ends; a tournament
  that mixes them into one points table has to say how.
- **What does a table hold?** For the round being prepared: up to two occupants, either two players
  or one player and the BYE, and nothing else — no mission of its own (it plays the round's) and no
  score of its own yet. Whether a table carries its own round counter once matches run, or the
  tournament runs all tables in lockstep, is undecided.
- **Swiss details.** Pairing rules (score groups, first-player balance, rematch avoidance), how a
  table's result is reported (by the players' own devices, or entered by the TO), and what a
  win/draw/loss is worth in tournament points.
- **Manual pairing beyond the first round.** The assignment board exists (drag, or tap to place),
  and it is what the manual tick always meant for round 1. Open: whether the TO re-assigns by hand
  every round on the same board, whether manual mode still scores Swiss-style, and whether an
  automatic pairing should ever be offered as a suggestion the TO can adjust.
- **Registered armies are snapshots, not validated lists.** The TO's and every joiner's Roster list
  arrives as a `{ name, factionId, code }` snapshot and is shown by name and faction; the server
  never decodes the code, so nothing enforces the 125-point cap yet. Whether creation and join
  should verify it (the code is self-describing) is open.
- **What a BYE win is worth.** Who takes it is decided — the organizer assigns it like any other
  occupant — but not what the sit-out scores: the same tournament points as a played win, fewer, or
  a separate marker that tie-breaks treat differently.
- **A field that cannot fill cannot shrink.** With at most one empty seat allowed, two no-shows
  make the event unstartable and the only way out is cancelling it and recreating a smaller one.
  Whether the organizer may shrink the field of a lobby that has not started — and whether the
  table list shrinks with it — is open.
- **Undoing a started round.** Starting it locks the tables and there is no way back to `setup`, so
  a mis-pairing discovered a moment too late means cancelling the event. Whether the organizer
  should get an unlock (and until when — before any table reports a result?) is open.
- **Leaving a running tournament.** A player's abandon is refused once the event is `active`:
  releasing a seat mid-pairing needs a forfeit rule first (what the opponent at that table scores,
  whether the table is dissolved, whether the field goes odd and a BYE appears). The organizer can
  cancel a running event, so a broken one is killable today.
- **Where do the tables' games actually run?** Presumably each table is a normal match on the
  players' own devices through the online machinery, with the tournament server overwatching;
  whether a table may instead be hot-seat on one device is open.
- **Concluding.** What decides the victor — tournament points, match wins, tie-breaks — and what
  the final screen shows.
- **Identity beyond the seat token.** A device holds exactly one tournament seat session; whether a
  name can be reused across tournaments, whether a TO can hand their seat over, or whether players
  ever get an account, is open.

Resolved since the last revision: the army builder's Roster format is no longer internally named
`'tournament'` — it is `'roster'`, with a decode migration for existing codes and saves (see
`08-army-builder.md` §Formats).
