# Functional Spec — Oni Quest Advisor

**What the app does from the player's perspective.** Behaviour, not implementation — for data
shapes, rendering geometry, colours and server architecture see
[../technical-spec/](../technical-spec/README.md). For the layered code architecture and the
rules each layer must follow, see the root [QWEN.md](../../QWEN.md) and the `CLAUDE.md` inside
each `src/lib/` folder.

> These specs describe the app **as built**, verified against the code at v0.6.4 plus the
> unreleased solo Mission Briefing on `develop`. Where the app is mid-iteration or internally
> inconsistent, the relevant document says so explicitly and lists it under **Open questions** —
> those sections are live to-do lists, not rhetorical.

## Entity glossary

### Content

- **Season** — a top-level grouping of missions (e.g. "Season 2"). Derived from the missions
  themselves; there is no season registry. Old seasons stay selectable even when outdated.
- **Mission** — belongs to exactly one season. Carries a name, lore description, setup items, a
  map, Results (scoreable objectives), optional _Important_ callouts, and quest rules prose.
  Two boolean flags — `brokenMorale` (informational) and `ceasefire` (drives the automatic
  penalty objective and forbids Round-1 scoring).
- **Results objective** — one scoreable entry: text, a VP value, and a `count` of independent
  scoreable instances. Round-scoped objectives are authored **one entry per round** sharing a
  `group`.
- **Ceasefire broken** — the automatic −4 VP penalty objective added to every ceasefire mission.
  Scoreable three times (one per breach), rendered as red penalty boxes. Never authored in JSON.
- **Important callout** — an amber rules note shown alongside Results (e.g. "round 1 cannot
  score"). Display only, never counted for VP.
- **Faction** — a player-selectable side with its own 20-card Scheme deck. Six exist; cards can
  be shared across several decks.
- **Scheme** — a secret objective card drawn from a faction's deck. Has a title, rule text, a
  number of **increments** (checkboxes) and a VP value per increment (flat, or per-box for capped
  cards). A player holds exactly one per mission.
- **Increment** — one scoreable step of a chosen Scheme. Ticking increments earns its VP.
- **Round** — 1 to 5. Tracked manually by the players in solo and hot-seat; driven by the
  server's phase engine online.

### Play state

- **Game mode** — `'solo'` or `'two-player'` (hot-seat). Decides which mission screen a click
  opens. Online play is **not** a game mode; it is a separate flow with its own screens.
- **Mission progress** (solo) — checked objective counts, the chosen Scheme, the Scheme draft
  (faction + intelligence) and the current round, persisted per mission in `localStorage`.
- **Two-player progress** (hot-seat) — a `PlayerProgress` per seat (checked objectives, scheme,
  draft, `schemeRevealed`) plus a shared round, persisted under a separate key prefix.
- **Active player** (hot-seat only) — whose secret is currently showable. In memory only;
  switched by the Swap Player countdown.
- **Reveal** — making a hidden Scheme visible. Permanent and one-press in hot-seat; online it is
  a **toggleable intent** during the Reveal phase, committed when the leader advances to Scoring,
  and a hidden scheme **cannot be scored at all**.
- **Total VP** — Results VP + Scheme VP, capped at 10, not floored at 0 (ceasefire penalties can
  push a party negative).
- **Open game** (solo) — a run started from the briefing and not yet abandoned, recorded under
  `oni-quest-advisor:open-game`. Its existence is what makes the app offer to resume on the next
  launch; abandoning deletes it together with that mission's progress.
- **Game view** (solo tracker) — one of the three tabs the tracker splits into: **Scoring** (the
  default, holding the score panel, Results and Schemes), **Army** and **Mission** (the static
  reference panels).

### Online

- **Game** — a server-side match identified by a short code (`Game#K3FQZ2`), in one of four
  statuses: `lobby`, `active`, `finished`, `closed`.
- **Seat** — one of the two player slots, authenticated by a token whose hash only the server
  stores. A seat's view of the game is filtered: the opponent's unrevealed Scheme never reaches
  it.
- **Leader** — the player who created the game. Alone may pick the mission, advance phases,
  finish and close it.
- **Phase** — within an active game, each round is `reveal` then `scoring`. Objectives and scheme
  boxes are editable **only** during Scoring.
- **Round snapshot** — each player's cumulative VP recorded at every round end; feeds the
  statistics table.

### Army builder

- **Army** — an in-memory list built for one faction under a format's point cap. Not persisted
  except as a code or a save.
- **Format** — `standard` (85 points, per-model upgrades) or the UI's **Roster** (internally
  `tournament`, 125 points, upgrades become a shared equipment pool instead).
- **Army entry** — **one copy** of a unit. Every copy is its own entry with its own id, so a
  single copy can be mounted, upgraded or removed independently.
- **Upgrade slot** — a per-copy budget for upgrades: 1 + the unit's Resourceful level + its Pouch
  count.
- **Mount** — a rider unit may be mounted; the mount adds its cost, overrides stats and **changes
  the model's size**, which can invalidate a size-capped upgrade.
- **Army code** — a short share string encoding an entire list, fingerprinted against the content
  catalog so a code built on a different roster is rejected rather than mis-decoded.
- **Saved army** — a named army code in `localStorage`, listed and loadable from the faction
  select.

## Screen map

```
game-mode ──┬── Solo ────────────▶ season-select ▶ mission-select ▶ mission-briefing ▶ mission-detail
            ├── 2 Player ────────▶ season-select ▶ mission-select ▶ mission-detail
            ├── Online 2 Player ─▶ [intro notice] ▶ online-create ▶ online-join ▶ online-game
            └── Army Builder ────▶ army-faction-select ▶ army-builder
```

`/join/[code]` is the invite-link entry point; it hands the code to navigation and continues in
the single-page flow on `/`.

The solo `mission-detail` is itself a **three-view screen** — **Scoring** (the default), **Army**
and **Mission** — behind a sticky tab bar, and is entered either by pressing Start Game or by
resuming an **open game** at app start. Full detail, including the open-game lifecycle and what
each transition clears, in [01-navigation-flow.md](./01-navigation-flow.md).

## Documents

1. [01-navigation-flow.md](./01-navigation-flow.md) — the screen map, every transition, the solo
   open-game lifecycle (start / abandon / resume), state on navigation, one-time notices.
2. [02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md) — Description (incl.
   the rule-label popups), Setup, Deployment Map, Quest Rules; panel order per screen;
   collapsibility.
3. [03-results-panel.md](./03-results-panel.md) — objectives, boxes vs checkboxes, round-scoped
   groups, the ceasefire penalty, Important callouts, total VP, per-mode editability, persistence
   and reset.
4. [04-schemes-panel.md](./04-schemes-panel.md) — faction/intelligence/draw/select/track, the draw
   brackets, hidden vs revealed in each mode.
5. [05-score-and-round-controls.md](./05-score-and-round-controls.md) — where the running score,
   round stepper and reset live: an inline panel in solo's Scoring view, a right-edge drawer in
   hot-seat (with its swap mechanic), and nothing at all in online.
6. [06-two-player-hot-seat.md](./06-two-player-hot-seat.md) — one device, two secrets: state
   model, seat colours, the swap countdown, and how it differs from online.
7. [07-online-two-player.md](./07-online-two-player.md) — the online player journey: create,
   invite, join, setup, rounds and phases, finish and statistics, reconnection, closing.
8. [08-army-builder.md](./08-army-builder.md) — faction select, the builder, unit cards, mounts,
   upgrades, the Roster equipment pool, army codes and saved armies.

## Open questions

Each document ends with its own **Open questions** section — keep them updated as decisions get
made, and treat them as the backlog of behavioural gaps. The cross-cutting ones:

- **The shared header component.** Every screen invents its own button constellation; one header
  (title slot + left/right action slots) should replace them all. Tracked in
  [../technical-spec/01-visual-theme.md](../technical-spec/01-visual-theme.md).
- **Upload Army / the Army view.** Two halves of one missing feature: the briefing's disabled blue
  button, and the tracker's **Army** tab, which is a stub. Both wait on the same decision — what it
  means to attach a built or saved army to a run.
- **Grouped Results in hot-seat and online.** Solo renders per-round cards in both the briefing
  and the tracker; the other two modes still show one card per round-entry (Awaiting
  Reinforcements: 12 cards).
- **Three views in hot-seat?** Solo's tracker now splits into Scoring / Army / Mission behind a
  sticky tab bar; hot-seat is still one long scrolling screen with a right-edge drawer — see
  [05-score-and-round-controls.md](./05-score-and-round-controls.md).
