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
                    ┆
                    ┆ "Start Game" — disabled (phase 2)
                    ▼
             mission-detail


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
values). Old seasons stay clickable even when outdated; nothing is hidden or disabled.

Selecting a season → `selectSeason(season)`: stores `selectedSeason`, goes to `mission-select`.

## Screen 3 — Mission Select (`mission-select`)

The selected season's missions as a grid of clickable tiles
(`getMissionsForSeason()`), plus two controls:

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

> **Current solo behaviour (phase 1 of the solo-view iteration).** Solo opens the read-only
> **Mission Briefing**, not the interactive tracker. The briefing's **Start Game** button — the
> intended transition into `mission-detail` — is still disabled, so **solo `mission-detail` is
> unreachable by clicking**. That is expected until phase 2 wires it up. Hot-seat play is
> unaffected and still goes straight to `mission-detail`.

## Screen 4a — Mission Briefing (`mission-briefing`, solo only)

A read-only walkthrough of the mission: no scheme selection, no VP scoring, no Command Panel.
See [02-mission-detail-static-panels.md](./02-mission-detail-static-panels.md) for the panel
stack. Its sticky top bar carries **← Return** (→ `returnToMissionSelect()`), **Upload Army**
(disabled — a later feature) and **Start Game** (disabled — phase 2).

## Screen 4b — Mission Detail (`mission-detail`)

The interactive tracker: static panels plus Results, Schemes and the Command Panel overlay.
Its **Return** → `returnToMissionSelect()`: back to `mission-select` for the mission's season,
clearing `selectedMissionId` — never all the way back to Season Select. This holds whether the
player arrived by tile click or by **Random**.

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

- **Play progress is not discarded on Return.** `returnToMissionSelect()` clears only the
  _selection_; the checked objectives, chosen scheme and round live in `localStorage` keyed by
  mission id (`oni-quest-advisor:mission-progress:` solo, `oni-quest-advisor:2p-progress:`
  hot-seat). Re-entering the mission restores them.
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

- **Deep linking**: should a mission/season be reachable by URL, so closing and reopening the
  browser resumes the same screen? Today navigation is in-memory only; progress survives (via
  `localStorage`) but the player lands back on the mode select and must re-click through. The
  online flow already has a URL entry point (`/join/[code]`) — the same trick could serve solo.
- **Browser back**: because screens are not routes, the hardware/browser back button exits the
  app instead of going up a level. On a phone this is a real mis-tap risk. Is intercepting it
  wanted?
- **`gameMode` resets to solo** in `returnToGameMode()`, so a hot-seat player who returns to the
  main menu must re-pick their mode. Intentional, or should the last mode be remembered?
- **Season ordering** is glob/file order, not semantic — see
  [../technical-spec/02-mission-data-format.md](../technical-spec/02-mission-data-format.md).
  Invisible with one bundled season, wrong the day a second one ships.
