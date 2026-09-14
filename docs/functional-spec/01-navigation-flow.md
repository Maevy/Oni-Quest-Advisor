# Navigation Flow

The app is a **single page** (`/`) whose visible screen is switched by
`navigationStore.screen`. There is no router-level navigation between screens, no URL per
mission and no browser-history integration — the back button leaves the app.

The one extra route is `/join/[code]`, the invite-link entry point for online play: it hands
the code to `navigationStore.prepareOnlineJoin()` and immediately
`goto('/', { replaceState: true })`, so the player continues in the single-page flow.

`Screen` values (`lib/stores/navigation.svelte.ts`):

```
game-mode | season-select | mission-select | mission-briefing | mission-detail
army-faction-select | army-builder
online-create | online-join | online-game
```

## Screen map

```
                                   ┌──────────────────────┐
                                   │      game-mode       │  ← entry screen
                                   └──────────────────────┘
             ┌───────────────────────┼───────────────────────────┐
             │                       │                           │
      "1 Player"              "2 Player"                "Online 2 Player Game"
      (solo)                  (two-player)                       │
             │                       │              [one-time online intro modal]
             └───────────┬───────────┘                           │
                         ▼                                       ▼
                  season-select                            online-create
                         │                                       │
                         ▼                                       ▼
                  mission-select                           online-join
                    │           │                                │
             (solo) │           │ (two-player)                    ▼
                    ▼           ▼                            online-game
          mission-briefing   mission-detail
                    │        (all panels + the Command Panel drawer)
                    │ "Start Game" — records the open game
                    ▼
             mission-detail  ══▶  [ Scoring | Army | Mission ]  (Scoring is the default)
                    │
                    │ "← Return" → confirm "Abandon this game?"
                    ├── Keep playing ─▶ stays put
                    └── Abandon ──────▶ mission-select  (open game + progress deleted)

  app start ──open game found──▶ "You have an open game: {mission}"
                                   ├── Resume Game ─▶ mission-detail (progress restored)
                                   └── Abandon ─────▶ stays on game-mode (progress deleted)


  game-mode ──"Army Builder"──▶ army-faction-select ──pick faction──▶ army-builder
                                        │  ▲                             │
                                Import Army code ───────────────────────┘
                                        │                          "Main Menu"
                                        └──────────────────────────────┘
```

## Screen 1 — Game Mode (`game-mode`)

The entry screen, shown on every app start. `navigationStore.screen` initialises to
`'game-mode'`. Three mode buttons plus the army builder:

- **Solo** → `selectSoloMode()`: sets `gameMode = 'solo'`, goes to `season-select`.
- **Two-player (hot seat)** → `selectTwoPlayerMode()`: sets `gameMode = 'two-player'`, goes to
  `season-select`.
- **Online 2 Player Game** → `selectOnlineMode()`. This is the headline feature and carries the
  rotating neon border. On the **first** press it shows the one-time `OnlineIntroNotice` modal
  (an experimental-feature heads-up) instead of navigating: **Continue** persists the
  acknowledgement and proceeds to `online-create`, **Back** returns here. Afterwards it goes
  straight to `online-create`.
- **Army Builder** → `selectArmyBuilder()`: goes to `army-faction-select`. The army builder is a
  standalone feature — it does not set `gameMode` and never enters the mission flow.

`gameMode` (`'solo' | 'two-player'`) is what later decides which mission screen a mission click
opens. Online mode is deliberately **not** a `GameMode` — it has its own screens and its own
server-authoritative state.

## Screen 2 — Season Select (`season-select`)

One button per season, derived from the bundled missions (`getSeasons()` — distinct `season`
values). Old seasons stay clickable even when outdated; nothing is hidden or disabled. The screen
opens under the shared top bar (`ScreenHeader`): a red **← Return** (→ `returnToGameMode()`) and
nothing else — the hero title block below keeps the screen's name.

Selecting a season → `selectSeason(season)`: stores `selectedSeason`, goes to `mission-select`.

## Screen 3 — Mission Select (`mission-select`)

The selected season's missions as a grid of clickable tiles (`getMissionsForSeason()`), under the
same shared top bar: red **← Return** on the left, the season's name as the bar's title, and
**Random** on the right. The two controls:

- **Return** → `returnToSeasonSelect()`: back to `season-select`, clearing `selectedSeason` and
  `selectedMissionId`.
- **Random** → `rollRandomMission(rng)`: picks one of the _currently listed_ missions at random
  and opens it — identical in effect to clicking that mission's tile, so it lands on the same
  screen a manual click would. Does nothing if no season is selected or the season has no
  missions. The RNG is injected (`domain.Rng`, defaulting to `Math.random`) so the pick is
  testable.

Clicking a mission → `selectMission(missionId)`, which **branches on `gameMode`**:

| Mode         | Loads progress into                         | Goes to            |
| ------------ | ------------------------------------------- | ------------------ |
| `two-player` | `twoPlayerProgressStore.loadForMission(id)` | `mission-detail`   |
| `solo`       | `missionProgressStore.loadForMission(id)`   | `mission-briefing` |

Solo therefore reaches the tracker in **two steps**: the mission click opens the read-only
**Mission Briefing**, and its **Start Game** button (`startGame()`) switches to `mission-detail`.
Progress is loaded once, at the mission click, so Start Game changes only the screen — nothing is
re-initialised, and any previously saved state for that mission is already in place. Hot-seat
skips the briefing entirely and goes straight to `mission-detail`.

## Screen 4a — Mission Briefing (`mission-briefing`, solo only)

A read-only walkthrough of the mission: no scheme selection, no VP scoring, no score panel. See
[02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md) for the panel stack.
It carries the shared top bar: red **← Return** (→ `returnToMissionSelect()`) on the left, and
**Pick Army** and **Start Game** (→ `startGame()`) on the right.

**Pick Army** opens a picker listing the device's saved **standard**-format armies (Roster saves
are excluded — a mission run fields a standard list). With none saved it instead asks _"It seems
you don't have any saved armies. Do you want to create one?"_ — **Create one** jumps to the army
builder, **Not now** closes. Picking attaches a **snapshot** (`PickedArmy`: name, faction, code)
to the run, shown as a **Selected Army** panel between the Description and Setup panels with an
**✕** that detaches it again. The snapshot means later edits or deletion of the save cannot change
a run that is already under way.

**Start Game is the boundary between browsing and playing**: it records the mission as the **open
game** and switches to `mission-detail`. From then on the run has a lifecycle — see below.

Pressing **Start Game with no army attached** asks first: _"You are starting this game without a
selected army. Do you want to proceed?"_ — **Start anyway** starts the run, **Not now** (and
Escape) stays on the briefing, where Pick Army is one press away. The warning exists because the
tracker's Army view is read-only: a run fields whatever it started with for its whole life. With
an army attached, Start Game is direct and no dialog appears.

## Screen 4b — Mission Detail (`mission-detail`)

The interactive tracker. In **solo** it is a **three-view screen** under the same shared top bar
as the briefing: red **← Return** on the left, and three **Scoring / Army / Mission**
buttons on the right with a glowing **spotlight** that slides under whichever is active
(`aria-pressed` marks it for assistive tech). A started game always
opens on **Scoring**; the other two are reference views the player can switch to at any time.

| View        | Contents                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Scoring** | score panel (VP total, round stepper, Reset) → Results (editable) → Schemes (editable)                  |
| **Army**    | the picked army, **read-only**: copies with portraits and upgrade pills, all inspectable, none mutable  |
| **Mission** | the static panels only: Description (with its rule-label popups) → Setup → Deployment Map → Quest Rules |

Results and Schemes live **only** in Scoring, so nothing appears twice: the Mission view is the
reference sheet, not a second read-only copy of the score.

The **Army** view renders the attached snapshot: one row per copy with its portrait, name, points
and mount, plus a pill per picked upgrade. Tapping a portrait opens the unit card and a pill opens
the upgrade detail — both purely informational — but there are no steppers, no upgrade slots, no
mount toggle and no remove buttons, so the list cannot change. With no army attached it says so
and points back at the briefing's Pick Army.

Each row also carries the model's **vitality** on its right edge: red hearts for HP and yellow
orbs for stamina, four per line before wrapping, drawn from the copy's effective stats.

Hovering a row tints its border and gives it a slight glow; clicking it — or pressing Enter/Space
on it — opens the **vitality menu**: three panels. **Life** and **Stamina** each hold their track,
larger, flanked by circular step buttons; the sign sits _inside_ the marker glyph — a heart
carrying a − on the damage side and a + on the heal side, an orb carrying the same pair for
stamina — so each button reads as the thing it does. Life may be **overhealed up to double** its
base, and the extra hearts render **blue**; stamina has no headroom and caps at its base. Damage
shows as an outlined marker with a black fill at 70 % opacity.

The third panel, **Statuses**, holds one round toggle per State the run tracks: Bleeding, Blinded,
Confused, Crippled, Crouched, Dead, Flying, Fatigued, Immobilized, Incapacitated, Panicked, Weak
Poison, Strong Poison, Slowed and Weakened — Shrouded is deliberately absent, it is handled by
other means. Off, every glyph is grey; a click lights it in the State's own colour and a second
click greys it again. The two Poison strengths are one condition, so picking one drops the other.
Each toggle carries its name in small white type above the icon, so no glyph has to be recognised
from memory; fifteen labelled toggles no longer fit a short phone in one view, so the card scrolls
its body and keeps Cancel/Accept pinned at the bottom.

Nothing changes until **Accept**; **Cancel**, Escape or a backdrop click discards. Accepted values
— Life, stamina and the lit States — persist with the run under `MissionProgress.vitality`, keyed
by entry id, so they survive reloads and die with the run on abandon; progress saved before
statuses existed simply carries none. Each row shows the States its copy carries as a wrapping
line of coloured glyphs under the points — the same size as the menu's, so they stay readable on
a phone — and a bleeding or poisoned model reads from the list without opening the menu.
Accepting a copy at **0 Life** assigns **Incapacitated** and **Crouched** on its behalf — the
rulebook's fall — whether or not the player lit them in the menu; the row then shows the empty
hearts beside the two glyphs.

On a phone, a **horizontal swipe** across the screen steps between the views in the same order —
swipe left for the next view, right for the previous — clamped at both ends. The views live in one
sliding strip, so the outgoing view physically leaves the way the gesture came from and the
incoming one arrives from the opposite edge; the header's spotlight slides along in step. Each
view keeps its own scroll position. A mostly-vertical drag scrolls instead and cancels the swipe.
The three buttons remain the accessible path; the swipe is a shortcut, never the only way.

In **hot-seat** the same screen id renders `MissionDetailTwoPlayer` instead — one long scrolling
screen with every panel, plus the right-edge Command Panel drawer and the swap countdown. It has no
view switcher. See [06-two-player-hot-seat.md](./06-two-player-hot-seat.md).

### Return means abandon (solo)

The tracker's **← Return** does not navigate directly — it asks _"Abandon this game? All progress
will be lost."_ with **Keep playing** (the prominent branch, and what Escape takes) and **Abandon**.
Confirming calls `abandonGame()`, which deletes the open-game record **and** that mission's saved
progress, then returns to `mission-select`. There is deliberately no path back to the briefing from
the tracker, because leaving the tracker ends the run.

## Open game lifecycle (solo)

A solo run is an explicit session, not "whatever progress happens to be saved for this mission".
One game can be open at a time, recorded under `oni-quest-advisor:open-game`
(`lib/data/openGame.ts`).

| Event                             | Effect                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start Game** in the briefing    | records the open game, enters the tracker                                                                                                      |
| **← Return → Abandon**            | deletes the open game _and_ the mission's progress, back to the mission list                                                                   |
| **← Return → Keep playing** / Esc | nothing changes                                                                                                                                |
| **Reload or reopen the app**      | the record is still there → the resume prompt appears                                                                                          |
| **Resume Game**                   | `resumeOpenGame(mission)` restores season, mission and progress and enters the tracker **directly** — not the briefing, that decision was made |
| **Abandon** from the prompt       | deletes the record and the progress, stays on the main menu                                                                                    |

The prompt reads _"You have an open game: {mission name}. Abandoning it loses all progress."_ and
deliberately makes **Resume Game** the prominent button _and_ the Escape branch — losing a run is
never the accidental choice. It is skipped when an online seat resumed instead, so an online game
wins; the solo record survives and is offered on a later start.

A record pointing at a mission the bundled content no longer has is **stale**:
`findResumableGame()` drops it silently rather than offering a game that cannot render.

Progress written before this feature existed has no open-game record. It is not discarded — it is
picked up when that mission is next started, so no one loses an old run to the upgrade.

Hot-seat and online have no open-game record: hot-seat progress simply persists per mission, and
online state lives on the server.

## Army builder flow

- `army-faction-select` — the faction grid, the **Import Army** code input and the **Load Army**
  list. Selecting a faction → `selectArmyFaction(id)` (calls `armyBuilderStore.selectFaction`,
  then `army-builder`). A successful code import → `openImportedArmy()`, which enters the builder
  with faction and list already loaded.
- `army-builder` — **Main Menu** → `leaveArmyBuilder()`: calls `armyBuilderStore.leave()`
  (discarding the in-memory list; the builder is not persisted) and returns to `game-mode`.

The builder is in-memory only, so leaving it always loses the unsaved list — saves and army
codes are the persistence mechanism. See [08-army-builder.md](./08-army-builder.md).

## Online flow

`online-create` (nickname → lobby) → `online-join` (invite code + nickname → request →
pending) → `online-game` (lobby, setup, rounds, statistics — one screen driven by server
status). `enterOnlineGame()` moves into it; `leaveOnline()` clears `onlineJoinCode` and returns
to `game-mode`. Full journey in [07-online-two-player.md](./07-online-two-player.md).

## Returning to the start

`returnToGameMode()` is the hard reset back to `game-mode`: it clears `selectedSeason` and
`selectedMissionId` and resets `gameMode` to `'solo'`. Used by the online flow's "Return to Main
Menu".

## State on navigation

- **Solo progress belongs to the open game.** Ticking a box writes
  `oni-quest-advisor:mission-progress:{missionId}`; abandoning deletes it together with the
  `oni-quest-advisor:open-game` record. Merely viewing the briefing writes nothing — a progress
  record only appears once the run actually mutates.
- **Hot-seat progress is not session-scoped.** `returnToMissionSelect()` clears only the
  _selection_; checked objectives, schemes and the round stay under
  `oni-quest-advisor:2p-progress:{missionId}` and are restored on re-entry. Hot-seat has no
  abandon flow and no resume prompt.
- The scheme **draft** (faction + intelligence inputs) is part of that persisted progress and
  survives a scheme delete/reset, so the player only re-presses Draw.
- Online state lives on the **server**; the seat (game code + seat + token) is in `localStorage`
  under `oni-quest-advisor:online-session`, and the page resumes it on mount.
- The army builder list is **not** persisted at all.

## One-time notices

Both are per-device, stored under `oni-quest-advisor:notice:` (`lib/data/notices.ts`):

| Notice                         | Key             | Trigger                                      | Dismissal                                                                                  |
| ------------------------------ | --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Privacy notice (bottom banner) | `:privacy`      | first visit; `initNotices()` on layout mount | persists permanently                                                                       |
| Online intro (modal)           | `:online-intro` | first press of "Online 2 Player Game"        | **Continue** persists and proceeds; **Back** returns to the mode select without persisting |

Both treat unavailable `localStorage` as "already seen" when reading and fail silently when
writing, so a blocked-storage browser simply shows the notice again next visit rather than
breaking.

## Open questions

- **Healing a fallen model does not cancel its fall.** Accepting at 0 Life assigns Incapacitated
  and Crouched, but the rulebook also cancels Incapacitated once the model regains Life — the app
  leaves both lit until the player toggles them off. Automatic cancellation on heal was
  deliberately not built; is it wanted?
- **Should the picked army influence anything beyond display?** Today it is a reference sheet in
  the Army view; nothing checks the list against the mission (points, faction, required units).
  The snapshot is already there if such a rule ever arrives.
- **Should hot-seat get the three-view layout too?** Solo now splits Scoring / Army / Mission
  behind a sticky bar; hot-seat is still one long scrolling screen with a drawer. See
  [05-score-and-round-controls.md](./05-score-and-round-controls.md).
- **Only one open game can exist**, and nothing enforces it — `beginGame()` simply overwrites the
  record. Unreachable by clicking today (the tracker's Return abandons before the mission list is
  reachable again), but a deep link or a "switch mission" control would need a rule.
- **Deep linking**: should a mission/season be reachable by URL? Navigation is still in-memory
  only. Solo is now partly covered — an open game is offered on the next app start — but a player
  who merely _browsed_ to a mission (briefing, never pressed Start Game) lands back on the mode
  select and must re-click through. The online flow already has a URL entry point
  (`/join/[code]`) — the same trick could serve solo.
- **Browser back**: because screens are not routes, the hardware/browser back button exits the
  app instead of going up a level. On a phone this is a real mis-tap risk. Is intercepting it
  wanted?
- **`gameMode` resets to solo** in `returnToGameMode()`, so a hot-seat player who returns to the
  main menu must re-pick their mode. Intentional, or should the last mode be remembered?
- **Season ordering** is glob/file order, not semantic — see
  [../technical-spec/02-mission-data-format.md](../technical-spec/02-mission-data-format.md).
  Invisible with one bundled season, wrong the day a second one ships.
