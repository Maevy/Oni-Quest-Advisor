# Faction & Scheme Data Format

Scheme (secret objective card) content is authored as JSON in
`src/lib/data/content/schemes/`, faction content in `src/lib/data/content/factions/`. Both
are loaded eagerly via `import.meta.glob` (`lib/data/schemes.ts`, `lib/data/factions.ts`).
The typed shape is `SchemeCard` in `lib/domain/scheme.ts`.

## File layout

```
content/factions/<faction-id>.json   → { "id", "name" }            6 files
content/schemes/shared.json          → cards in 2 or more decks    11 cards
content/schemes/<faction-id>.json    → that faction's exclusives    5 files
```

A card lives in **exactly one** file: it moves into `shared.json` as soon as a second deck
gets it. There is no duplication across files — 27 files-rows are 27 unique cards.

`adventurers-guild.json` does not exist under `schemes/`: the Adventurers' Guild has no
exclusive cards, its whole deck is shared.

### Current composition

| Faction              | Exclusives | From `shared.json` | Unique cards | Physical deck |
| -------------------- | ---------- | ------------------ | ------------ | ------------- |
| Helian League        | 3          | 8                  | 11           | 20            |
| Empire of Soga       | 3          | 9                  | 12           | 20            |
| Coalition of Thenion | 4          | 7                  | 11           | 20            |
| Sand Kingdoms        | 4          | 7                  | 11           | 20            |
| Monster Factions     | 2          | 6                  | 8            | 20            |
| Adventurers' Guild   | 0          | 10                 | 10           | 20            |

**Every faction's deck is exactly 20 physical cards.** Unique-card counts differ because
`copies` varies per card and per faction.

## `SchemeCard` schema

```jsonc
{
	"id": "virtuous-commander",
	"title": "Virtuous Commander",
	"ruleText": "Receive 1 VP (to a maximum of 3 VP) for each of your models that is Alive…",
	"factionIds": ["helian-league", "empire-of-soga" /* … */],
	"copies": { "helian-league": 4, "empire-of-soga": 2 /* … */ }, // or a plain number
	"maxIncrements": 3,
	"vpPerIncrement": 1 // OR "incrementVp": [2, 1]
}
```

| Field            | Type                             | Meaning                                                                               |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `id`             | string                           | Unique across all scheme files. Keyed into progress as `schemeId`.                    |
| `title`          | string                           | Card name as printed.                                                                 |
| `ruleText`       | string                           | Full rules text.                                                                      |
| `factionIds`     | string[]                         | Whose decks contain the card.                                                         |
| `copies`         | number \| Record<string, number> | Physical copies — one number for every faction that has it, or per-faction overrides. |
| `maxIncrements`  | number                           | How many checkboxes the card gets once chosen. Currently 1, 2 or 3.                   |
| `vpPerIncrement` | number                           | Flat VP per checked box. Mutually exclusive with `incrementVp`.                       |
| `incrementVp`    | number[]                         | Per-box VP, checked left to right. Mutually exclusive with `vpPerIncrement`.          |

The VP model is a discriminated union in `scheme.ts` (`SchemeVpModel`): exactly one of
`vpPerIncrement` / `incrementVp` must be present, the other is typed `never`.

### Per-faction `copies`

Seven cards need overrides: `opportunistic-manipulation`, `assassination-contract`,
`virtuous-commander`, `stand-your-ground`, `stalwart-defender`, `blood-for-blood`,
`peacekeeping-paragon`. Examples: Virtuous Commander is 4 copies for Helian and 2 elsewhere;
Stand Your Ground is 4 for Sand Kingdoms and 2 elsewhere. `copiesForFaction(card, factionId)`
resolves either form, returning `0` for a faction not listed in an override map.

### `incrementVp` vs `vpPerIncrement` — the rulebook wording rule

Rulebook text of the form **"X VP (to a maximum of Y)"** with **multiple** boxes must be
authored as `incrementVp`, never as a flat `vpPerIncrement` — a flat value would overshoot the
printed cap. Seven cards use it, all `[2, 1]` with `maxIncrements: 2` (2 VP for the first box,
1 VP for the second, 3 VP maximum): `martial-valor`, `cunning-tenacity`,
`breach-their-defenses`, `unhindered-expedition`, `strength-in-numbers`,
`spreading-infestation`, `territorial-aggression`.

`schemeVp(card, checkedIncrements)` implements this: `incrementVp` sums the first N entries,
otherwise it multiplies `checkedIncrements × vpPerIncrement`.

## The `common` pool is unused

`COMMON_FACTION_ID` (`'common'`) exists in the domain and `getSchemePool()` includes any card
whose `factionIds` contains it — but **no card in the content actually uses it**. All 11
`shared.json` cards enumerate explicit faction ids instead, and 5 of them are deliberately not
in all six decks (`fierce-as-fire-immovable-as-a-mountain`, `stalwart-defender`,
`blood-for-blood`, `peacekeeping-paragon`, `pursuit-of-glory`).

So `shared.json` means "in two or more decks", **not** "in every deck". The `common` tag is a
live mechanism with no content; a card genuinely in all six decks could use either form.

## Draw rules (`lib/domain/scheme.ts`)

- `drawCountForIntelligence(intelligence)` — **≤ 13 → 2, 14–15 → 3, ≥ 16 → 4** cards.
  (Corrected to the rulebook in v0.4.1; the older ≤12 → 1 bracket no longer exists.)
- `getSchemePool(schemes, factionId)` — the faction's cards plus any `common`-tagged card.
- `drawUniqueSchemes(...)` — draws `count` **distinct** cards, weighting by each card's
  faction-specific physical copy count; a duplicate of an already-drawn card is discarded and
  redrawn transparently. Randomness is injected (`Rng`), so the draw is pure and testable.

## Persistence

A chosen scheme is stored as `ChosenScheme` — `{ schemeId, factionId, intelligence,
checkedIncrements }` — on `MissionProgress.scheme` (solo) or `PlayerProgress.scheme`
(hot-seat / online). The **card content is never persisted**, only its id; the card is looked
up in the bundled content on load. The faction/intelligence inputs are kept separately as
`schemeDraft` so they survive a delete/reset and stay prefilled.

Persisted progress is merged onto `createEmptyProgress()` / `createEmptyTwoPlayerProgress()`,
so fields added later get their defaults — keep that pattern when extending either type.

## Open questions

- **No content guard for schemes.** Unlike missions (`lib/data/missions.spec.ts`), nothing
  tests the scheme content: the 20-physical-cards-per-deck invariant, `id` uniqueness across
  files, the `vpPerIncrement`/`incrementVp` exclusivity, and `incrementVp.length ===
maxIncrements` are all unverified. A `lib/data/schemes.spec.ts` mirroring the mission guards
  would be cheap and would catch a mis-authored card — recommended.
- Should the unused `common` tag be removed, or should genuinely-universal cards migrate to
  it? Today it is dead weight in the data model that reads as if it were load-bearing.
- `maxIncrements` is authored per card and duplicated in `incrementVp.length`; deriving one
  from the other would remove a way to get a card wrong.
