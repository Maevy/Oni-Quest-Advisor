# Mission Panels — Static Content

The read-only panels that describe a mission. They are shared unchanged across **all four**
mission views (solo briefing, solo tracker, hot-seat, online), which is the point: a mission
should read identically wherever it appears. The interactive panels are documented separately
— [03-results-panel.md](./03-results-panel.md), [04-schemes-panel.md](./04-schemes-panel.md),
[05-score-and-round-controls.md](./05-score-and-round-controls.md).

## Panel order per screen

| Screen                                         | Panels, top to bottom                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mission Briefing** (solo, read-only)         | MissionTitlePanel → Mission Description → Selected Army (only when an army is picked) → Setup → Deployment Map → Results (briefing) → Schemes (briefing) → Quest Rules                     |
| **Mission Detail** (solo tracker)              | three views behind a sticky tab bar — **Scoring**: score panel → Results → Schemes · **Army**: the picked army read-only · **Mission**: Description → Setup → Deployment Map → Quest Rules |
| **Mission Detail** (hot-seat)                  | Description → Setup → Deployment Map → Results (2P) → Schemes (2P) → Quest Rules (+ the fixed Command Panel drawer, + Countdown Overlay while swapping)                                    |
| **Online game view**                           | Description → Setup → Deployment Map → Results → Schemes → Quest Rules                                                                                                                     |
| **Online lobby preview** (`OnlineMissionView`) | Description → Setup → Deployment Map → Results (read-only) → Quest Rules — no Schemes panel                                                                                                |

Every panel is a `Panel` (frosted card, uppercase sky title) except `MissionTitlePanel` — and the
tracker's score panel, which passes **no title at all**: its centred hero VP number is
self-evident, so a heading above it would be noise.

In the solo tracker those four static panels are the **whole** of the Mission view — Results and
Schemes moved to the Scoring view, so no panel is rendered twice and the Mission view stays a pure
reference sheet.

**Collapsibility:** the online screens pass `collapsible` to Description, Setup, Deployment Map
and Quest Rules; the local screens do not. Phone screens get crowded once both players' seats,
the phase header and the round controls share them, and collapsing is how the player buys space.
`defaultOpen` seeds the initial state only — a later prop change never overrides what the
player has toggled.

## Mission title

Two treatments, because two screens need different things:

- **`MissionTitlePanel`** (briefing only) — the mission name alone, centred, `text-3xl`, not
  wrapped in a `Panel`. The briefing leads with the name as a headline.
- **`DescriptionPanel`** (everywhere else) — the mission name **is the panel title**, so the
  description card is headed by the mission it describes and no separate title card is needed.
- **`MissionDescriptionPanel`** (briefing only) — a fixed title `Mission Description`, because
  the briefing already spent a card on the name.

## Description

Lore/flavour prose about the mission — no rules content. Rendered from `mission.description`.

Above (DescriptionPanel) or below (MissionDescriptionPanel) the text sits the **rule labels
row**.

### Rule labels and callout popups

`RuleLabels` renders two sky pill buttons reflecting the mission's boolean flags:

- **`Broken Morale: Yes`** / **`Broken Morale: No`** — from `mission.brokenMorale`
- **`Ceasefire: Yes`** / **`Ceasefire: No`** — from `mission.ceasefire`

Both are always shown (a "No" is information too — it tells the player this mission has no
ceasefire). Clicking either opens `RuleCalloutDialog` with the corresponding rule text:

- `BROKEN_MORALE_RULE` — title _Broken Morale_: if a party is in Broken Morale at the start of
  their Strategic phase, the Quest ends at the end of that Turn.
- `CEASEFIRE_RULE` — title _Ceasefire_, heading _1st Round Ceasefire_: no VP may be scored in
  round 1; targeting an enemy with an Attack or damaging one with an Action costs that player's
  party **−4 VP**; summoned models may be targeted and damaged, but Attacks or Wounds _caused
  by_ summons still incur the penalty; a party's score may drop below 0.

The dialog closes on a click anywhere outside **or** `Escape`.

`brokenMorale` is **informational only** — no app logic reads it. `ceasefire` additionally
drives the automatic penalty objective and the Round-1 content guard (see
[03-results-panel.md](./03-results-panel.md) and
[../technical-spec/02-mission-data-format.md](../technical-spec/02-mission-data-format.md)).

> **Structural rule:** the dialog renders at the **screen root**, above every transformed or
> backdrop-filtered ancestor. A non-`none` `backdrop-filter` _or_ `transform` makes that ancestor
> the containing block for its `position: fixed` descendants: nested in a `Panel` the overlay
> covers only that panel, and nested in the solo tracker's sliding strip its backdrop dims the
> screen while the card lands off-screen. Both were real regressions, hence the split into
> `RuleLabels` (buttons, emits `onOpenRule`) + `RuleCalloutDialog` (overlay), with the **screen**
> holding the open state. See `src/lib/components/CLAUDE.md`.

## Setup

`SetupPanel`, titled **Setup**. A bullet list from `mission.setup[]`, each item rendered as
**`{label}:`** followed by `{description}` — e.g.

- **Clues:** Place 4 Objective Markers on the center line. These represent Clues.
- **Standard Deployment:** 8" Deployment Zones.

The label/description split is authoring convention; the renderer just bolds the label.

## Deployment Map

`MissionMap`, titled **Deployment Map**: the 36″ × 36″ board with deployment zones, objective
markers and optional rulers. Fully data-driven from `mission.map`. Rendering behaviour, the
nearest-edge ruler rule and the label-staggering are specified in
[../technical-spec/03-map-rendering.md](../technical-spec/03-map-rendering.md).

Read-only — no click targets, no player annotations.

## Quest Rules

`QuestRulesPanel`, titled **Quest Rules**. Prose rules specific to this mission, distinct from
the Description's flavour text. Rendered from `mission.questRules[]`: each section gets its
`label` as a subheading (omitted when the label is an empty string, which is how a mission with
one flowing paragraph is authored) and its `description` with **line breaks preserved**
(`whitespace-pre-line`), so authored paragraph breaks survive.

## Online lobby preview

`OnlineMissionView` reuses the same panels but is **fully read-only** and collapses by default.
Two differences from a started game:

- Its Results panel shows objectives with **no boxes at all**, plus the footer note
  **"Objectives unlock once the game has started."**
- It renders **no Schemes panel** — scheme drafting happens in the lobby's seat cards
  (`OnlineSchemeSetup`), not in the mission view.

## Open questions

- **Should the local screens be collapsible too?** The asymmetry exists because online screens
  are crowded, but a mission with long Quest Rules is equally long on a phone in solo play.
  Making `collapsible` uniform would simplify the panel wiring.
- **The rule-label popups are the only rules reference in the app.** Broken Morale and Ceasefire
  are covered; other general rules a player might need mid-game are not. Is a general rules
  reference wanted, or is that deliberately out of scope (the app tracks, it does not teach)?
- `RuleLabels` shows both labels even when both are `No`, which is two grey pills carrying no
  information on most missions. Worth hiding the negative case?
- The online preview's `OnlineMissionView` still contains branches for `active` and `finished`
  statuses that `+page.svelte` never routes to it (those go to `OnlineGameView` / `OnlineStats`)
  — dead code worth removing.
