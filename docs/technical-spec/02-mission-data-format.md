# Mission Data Format

All mission content is authored as **JSON**, one file per mission, in
`src/lib/data/content/missions/`. Files are picked up eagerly by
`import.meta.glob('./content/missions/*.json')` in `lib/data/missions.ts` — dropping in a
new file is the whole registration step, there is no index to update.

The typed shape lives in `lib/domain/mission.ts` (`Mission`) and `lib/domain/map.ts`
(`MapSpec`). Content is loaded behind a type assertion, so **the JSON is not type-checked
by `npm run check`** — the content guards in `lib/data/missions.spec.ts` (below) are what
catch a malformed mission.

## No separate season file

Each mission carries its own `season` string. `lib/domain/season.ts` derives the season
list with `getSeasons()` (distinct `season` values) and scopes a season's missions with
`getMissionsForSeason()`. Adding a mission to a new season means only setting that string.

> Ordering caveat: `getSeasons()` preserves first-seen order, which is the glob's
> alphabetical-by-filename order — not a semantic sort. With one bundled season this is
> invisible; if several seasons ever ship, season buttons will be ordered by whichever
> mission file sorts first, not by season number.

## Schema

```jsonc
{
	"id": "clue-trail", // unique, kebab-case; also the localStorage progress key
	"season": "Season 2",
	"name": "Clue Trail",
	"description": "…", // lore/flavour prose, no rules content
	"brokenMorale": false, // informational only — drives the "Broken Morale" rule label
	"ceasefire": true, // appends the automatic "Ceasefire broken" objective

	"setup": [
		{ "label": "Clues", "description": "Place 4 Objective Markers on the center line." },
		{ "label": "Standard Deployment", "description": "8\" Deployment Zones." }
	],

	"map": {/* see 03-map-rendering.md */},

	"results": [
		{ "id": "control-round-2", "text": "…", "vp": 1, "count": 4, "round": 2, "group": "control" }
	],

	"important": ["…", "…"], // optional rules callouts, not scored

	"questRules": [
		{ "label": "", "description": "…" } // empty label = one flowing paragraph, no subheading
	]
}
```

### `results[]` — `ResultObjectiveDef`

| Field   | Type    | Meaning                                                                                                                                                            |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | string  | Unique **within the mission**. Keyed into `checkedObjectiveCounts`, so a duplicate id would make two rows share one checked count.                                 |
| `text`  | string  | The objective as printed.                                                                                                                                          |
| `vp`    | number  | VP per scored instance. Negative for penalties.                                                                                                                    |
| `count` | number  | How many independent instances are scoreable (4 Quarters, 2 Ink Snails, 1 end-of-game check). `count: 1` renders a single checkbox; `> 1` renders that many boxes. |
| `round` | number? | The round this scores **at the end of**. Must be 1–5 and must come with a `group`.                                                                                 |
| `group` | string? | Names the card that several per-round entries collapse into.                                                                                                       |

### Round-scoped Results: one entry per round

A round-scoped objective is authored as **one `results` entry per round**, all sharing a
`group`, each with its own `round`, and with **round-neutral `text`** ("at the end of the
round", never "at the end of Round 3"). The entries in a group must be identical apart from
`round` and `id` — the grouped card takes its heading text and VP from the first member and
then renders one row per round, so a member that differed would silently mis-state the other
rounds.

Because the objective **id already encodes the round**, per-round progress needs no extra
state: `checkedObjectiveCounts` keys it exactly like any other objective, and VP math,
hot-seat mode, the online state and the wire protocol all stay untouched.

`groupResults()` (`lib/domain/results.ts`) does the display-side collapse into
`ResultsEntry[]`: ungrouped objectives pass through in mission order; a group becomes one
card at its first member's position carrying a row for **every** round 1–5, with
`objective: null` where nothing scores. Always five rows — so round colours line up across
missions, and a round that cannot score (round 1 under a ceasefire, the rounds Magic Stones
skips) is shown explicitly as locked rather than merely absent.

### `ceasefire` and the automatic penalty objective

`ceasefire: true` does two things, neither of which is authored in `results`:

- `getScoreableResults(mission)` appends `CEASEFIRE_OBJECTIVE` —
  `{ id: 'ceasefire-broken', text: 'Ceasefire broken', vp: -4, count: 3 }`. The penalty is
  incurred **per breach**, so it is scoreable three times (up to −12 VP); it renders as red
  penalty boxes.
- The mission displays the `CEASEFIRE_RULE` callout ("1st Round Ceasefire"), and must offer
  **no Round-1 VP** — the ceasefire forbids scoring in round 1.

Total VP is capped at `MAX_TOTAL_VP` (10) but **not floored at 0** — the rule allows a party
to drop below zero, so e.g. three breaches can show as "−11 / 10".

### `important[]`

Amber rules callouts rendered alongside Results (e.g. "Players cannot score VP during
Round 1 (Ceasefire)."). Display only — never counted for VP. Already wired into every
Results view (solo, hot-seat, online), so adding one needs no component change.

### `brokenMorale`

Purely informational: no app logic reads it. It drives the "Broken Morale" label next to the
description, which opens the `BROKEN_MORALE_RULE` popup.

## Content guards (`lib/data/missions.spec.ts`)

Runs against the real bundled content on every `npm run test`:

1. Missions load, ceasefire ones included.
2. Every mission's objective ids are unique.
3. A `round` is within `MIN_ROUND..MAX_ROUND` and always accompanied by a `group`.
4. Group members are interchangeable apart from `round` (same `text`, `vp`, `count`; no two
   members share a round).
5. **A ceasefire mission ships no Round-1 objective** — neither `round: 1` nor text matching
   `/\bRound 1\b/i`.
6. Awaiting Reinforcements stays split into its three groups × rounds 2–5 at `count: 1`.

Guards 3–6 exist because those invariants are invisible to the type system and each one has
already been broken once in production content.

## Adding a mission — checklist

1. Create `src/lib/data/content/missions/<id>.json` following the schema above.
2. Round-scoped scoring: one entry per scoreable round, shared `group`, round-neutral text,
   identical `vp`/`count` across the group.
3. Ceasefire mission: set `ceasefire: true`, add **no** Round-1 objective, and add the amber
   `important` note that round 1 cannot score.
4. Markers: set `showRuler` only where a player would actually measure; use `labelPosition`
   to avoid label collisions (see [03-map-rendering.md](./03-map-rendering.md)).
5. `npm run test` — the content guards are the real validation step.

## Open questions

- Should mission `id` uniqueness be enforced **across** missions, not just within one? Today
  a duplicated id in two files would collide in nothing (progress is keyed per mission) but
  would be confusing in the online state and any future statistics export.
- Season ordering (see the caveat above) — needs an explicit sort or a season manifest once a
  second season ships.
- The `label`/`description` split in `setup[]` and `questRules[]` is authoring convention, not
  enforced; an empty `label` is the only special case (no subheading). Worth a guard if
  content grows.
