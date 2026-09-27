# Tournament

A tournament is an event run by a **Tournament Organizer (TO)**: players join, are paired round by
round, play their games at tables, and the event concludes with a victor. It is the app's fourth
way to play and its first multi-table one — everything before it was a single match between two
sides.

> **Under construction.** This document grows with the feature, step by step. What exists today is
> the entry point and the configuration wizard's three panes; everything from creation onward is
> planned, and the plan's undecided parts are listed at the end.

## The shape of the feature (planned)

1. **Create & configure** — the TO names the tournament, names themselves, decides whether they
   play, sets the field size and who pairs each round; then configures missions and tables.
2. **Invite** — a link and a QR code bring the players in.
3. **Pair** — each round the field is paired, automatically by a Swiss system or by the TO by
   hand.
4. **Overwatch** — the TO watches the tables' games as they run.
5. **Conclude** — the tournament ends with its victor.

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
opened this pane. As of this iteration it is the seam only: pressing it validates and stops,
because creating the tournament on the server is the next step of the feature.

Decisions taken here:

- **The overview is the only review.** Step 2's summary panel of step 1 is gone: every fact it
  repeated is reviewable here, in full, right before creation.
- **Creation will ask before it happens.** The next step wraps **Create Tournament** in a notice
  that the tournament's data is kept for 48 hours afterwards for report generation — a printable
  tournament report is planned — and only a proceed from that notice touches the server.

Navigation within the wizard: **Return** steps back one pane at a time — overview to missions &
tables, missions & tables to basics — keeping the whole draft intact; on step 1 it leaves the
wizard and discards it.

## Open questions

- **How do missions map onto rounds?** The list added here is ordered, but nothing yet says what
  the order means: one mission per round for every table in list order, a pool the TO assigns per
  round or per table in a later step, or something else entirely.
- **Mixing mission kinds needs a scoring story.** Ceasefire missions carry the automatic −4 VP
  penalty and forbid round-1 scoring, and Broken Morale changes how a game ends; a tournament
  that mixes them into one points table has to say how.
- **What does a table hold?** Two players and a mission is the obvious shape; whether a table also
  carries its own round counter, or the tournament runs all tables in lockstep, is undecided.
- **Swiss details.** Pairing rules (score groups, first-player balance, rematch avoidance), how a
  table's result is reported (by the players' own devices, or entered by the TO), and what a
  win/draw/loss is worth in tournament points.
- **Manual pairing.** What the TO sees and does when pairing by hand — a drag between player
  cards, a row of dropdowns, something else — and whether manual mode still scores Swiss-style.
- **The organizer's army is a display snapshot today**, exactly like a mission run's picked army.
  Whether a playing TO's list is ever enforced (Roster cap, faction) — and whether the other
  players' armies arrive with their join, so tables can show both lists — is open.
- **Where do the tables' games actually run?** Presumably each table is a normal match on the
  players' own devices through the online machinery, with the tournament server overwatching;
  whether a table may instead be hot-seat on one device is open.
- **Concluding.** What decides the victor — tournament points, match wins, tie-breaks — and what
  the final screen shows.
- **Persistence and identity.** The tournament will need server state (like online games) and the
  TO a session; whether the TO's device doubles as a player's device when they tick the box is
  part of that.
- **Naming collision.** The army builder's 125-point Roster format is internally `'tournament'`
  (`ArmyFormat`), and that string is baked into the army-code wire format and saved-army JSON —
  so "tournament" currently means two unrelated things in the codebase. Worth renaming the
  format's id (behind a decode migration) before this feature grows server payloads of its own.
