# Army Data Format & Import Pipeline

Army content is **generated, not authored**. A script reads the game producer's export and writes
every JSON file the builder consumes. Nobody edits `src/lib/data/content/units/*.json` by hand.

```
data-import/units.json  ──▶  scripts/importUnits.mjs  ──▶  src/lib/data/content/units/*.json
     (producer dump)              (the only gate)                 (18 generated files)
```

Re-run the import on every producer update and **review the diff** — that diff is the changelog of
what the producer altered.

> `data-import/` also contains a `units2.json`; the importer reads **only** `units.json`.
> `data-import/` is currently untracked — the track-or-ignore decision is still open.

## Generated files

| File                        | Source catalog                               | Entries |
| --------------------------- | -------------------------------------------- | ------- |
| `helian-league.json`        | `characterList` (faction-tagged)             | 7       |
| `coalition-of-thenion.json` | "                                            | 5       |
| `sand-kingdoms.json`        | "                                            | 7       |
| `empire-of-soga.json`       | "                                            | 6       |
| `oni-clans.json`            | "                                            | 10      |
| `goblin-wartribes.json`     | "                                            | 6       |
| `adventurers-guild.json`    | "                                            | **0**   |
| `neutral.json`              | `characterList` (NEUTRAL tag)                | 15      |
| `mounts.json`               | `characterList` (`MOUNT_CODES`)              | 1       |
| `classes.json`              | `classList`                                  | 23      |
| `skills.json`               | `skillGroupList`                             | 24      |
| `traits.json`               | `traitGroupList`                             | 68      |
| `combat-arts.json`          | `combatArtGroupList`                         | 5       |
| `spellcrafts.json`          | `spellGroupList` (groups)                    | 18      |
| `spells.json`               | `spellGroupList` (their spells)              | 100     |
| `stratagems.json`           | `strategmList` _(sic — producer's spelling)_ | 58      |
| `items.json`                | `itemList` (+1 synthetic)                    | 85      |
| `upgrades.json`             | `upgradeList`                                | 45      |

`adventurers-guild.json` is generated **empty on purpose**: the guild has no exclusive units, so
its whole pool is the neutral list. An empty array is the correct output, not a failed import.

`items.json` includes one synthetic entry (`imported-casting-amplifier`) that the producer dump
does not carry as an item but that upgrade effects reference.

### Bucketing rules

A character goes to `mounts.json` if its code is in `MOUNT_CODES` (currently just `LUPUS_REX`);
else to `neutral.json` if it carries the NEUTRAL tag; else to its faction file if it has exactly
one known faction; else it is **skipped and logged** (faction-less summons and tokens — Colossus,
Elementals, Gargoyle, Golem, Blighted Riftspawn).

NEUTRAL units are recruitable by every faction **except** the monster ones
(`NON_NEUTRAL_FACTION_IDS = ['oni-clans', 'goblin-wartribes']`). Mounts are never recruitable
standalone; a rider carries the mount denormalized onto itself.

## Loading

All army globs in `lib/data/units.ts` are **non-eager** — unit JSON, the five rule catalogs,
spells/stratagems/items/upgrades, and both artwork globs (`../assets/uniticons/*/*.jpg`,
`../assets/upgrades/*/*.jpg`). They ship as separate chunks fetched on demand by
`contentStore.loadArmy()`, which is single-flight (an `armyLoading` promise plus an `armyLoaded`
flag) and idempotent.

Mission, faction and scheme content stays **eager** — the immediate flow needs it. So does
`armyFactions.ts` (faction names, colours and logos), which the faction select renders before any
unit data is required.

Content is loaded **behind a type assertion**, so `npm run check` cannot see a bad value in these
files. The importer's `throw`s are the only gate — see below.

## Unit shape

`ArmyUnitSpec` carries: id, name, faction, `points`, a copy `limit`, the 11-key `stats` record
(any key may be `null` when a model has no value), a **required** `size`, an optional portrait,
catalog refs (`classes`, and `{ id, level }` refs for skills / traits / combat arts /
spellcrafts), `stratagems`, `inventorySpace` + inventory `{ id, qty }` slots, optional
`upgradesLocked`, and an optional `mount: { unitId, points, size }`.

Trait refs may carry `dynamicValue` / `dynamicElements`, which fill the `(X)` and `(Element)`
placeholders in a rule's text at display time (`substituteArmyTemplate`).

Rules catalogs are `ArmyRulesSpec`: id, name, `description`, and — for entries whose text differs
by level — a `levels` map keyed by level. Entries without `levels` fall back to `description` as a
single section.

Rich text is stored as **segments**, with the producer's `(Text)[type.CODE]` cross-references
parsed into link segments. Roman (`[trait.POISON.II]`) and numeric (`[trait.KNOCKDOWN.1]`) level
suffixes are kept as a level on the link. `SOURCE_LINK_FIXES` repairs known-broken producer
markup before parsing (a stray paren in Piercing Stream, a `trait.POISON` typo in one item).
Every link target in the imported texts resolves against the catalogs — zero dangling.

Spells carry parsed stat columns: **PW** and **STK** as either a fixed value or a stat reference
with an optional modifier (`Int -3` → `{ stat: 'INT', modifier: -3 }`), plus a derived `type`
("Spell, Sorcery | Ranged") and whitespace-normalized `RCH` display text. Spell ids collide across
groups nine times (Flare, Inferno, …) and are disambiguated with a group suffix.

Items carry `category`, `toughness` (the producer's PW column), structured `reach` brackets parsed
from RCH (`0-20": 0`, AoE/text fallbacks), `strike`, and `weight` (nullable).

## Upgrades

`upgrades.json` ids are `kebab(code)` with a **faction suffix** where needed — Seasoned Combatant
exists twice in the producer's list, so ids would otherwise collide.

Requirements are **parsed from the description text**:

- `Only a …[class.X]` → required classes
- `Cannot be assigned to a model with the …[trait.X]` → forbidden traits (`notTraits`)
- `…may be equipped by a model of Size X or smaller` → `maxSize`

Effects are **not** parsed — they come from a curated `UPGRADE_EFFECTS` table in the importer,
because the rulebook prose is too varied to parse safely. An upgrade with no curated entry gets
`effects: []` and a **warning**, so it renders as text-only rather than silently doing nothing.

Effect kinds: `stat` (with optional `insteadIfTrait` / `extraIfClasses` conditionals), `class`,
`trait`, `skill`, `combatArt`, `item`, `replacePrimaryWeapon`, `pouch`, `stratagem`,
`spellcraftLevelUp`, `costReduction`, and `choice` (whose options carry `statChanges`,
`inventorySpace`, `grantTrait`, `replaceAffinity` or `inscribeItem`).

## Domain constants

These are the ordered/curated lists the rules depend on. Changing one is a rules change.

```
ARMY_STAT_KEYS   STA, SPD, OFF, DEF, ACC, INT, AG, T, ARM, HP, M
ARMY_UNIT_SIZES  small, medium, large, huge, gigantic, colossal, epic     (smallest first)
ARMY_FORMAT_POINTS  standard 85 · tournament 125
CODE_VERSION     'a'
UPGRADE_FACTION_IDS     helian-league, empire-of-soga, coalition-of-thenion, sand-kingdoms
NON_NEUTRAL_FACTION_IDS oni-clans, goblin-wartribes
ELEMENT_ORDER = CODE_ELEMENTS   elder, air, earth, divine, fire, profane, water
AFFINITY_TRAIT_ID    'affinity--element'
RESOURCEFUL_TRAIT_ID 'resourceful'
STRATAGEM_TYPE_ORDER authority, subterfuge, tribe
ROMAN_VALUES         10 X · 9 IX · 5 V · 4 IV · 1 I
```

**The size ladder is ordered, and the order is inferred.** Nothing in the producer dump states it;
it was derived from the value set plus spell text that excludes exactly Colossal and Epic from
Knockback. Order matters because every size rule in the game is a comparison — "Size Medium or
smaller", "two or more Sizes larger" — which a free-form string cannot answer. Sizes are compared
by `armyUnitSizeRank` (their index).

`upgradesLocked` units (the rulebook's named exceptions): Tomoe, Kogetsu, Seigen, Tharos, Anari,
Na'ra, Chiyohime, Chanra.

## Artwork matching

Portraits live in `assets/uniticons/<Faction>/*.jpg` and upgrade art in
`assets/upgrades/<Faction>/*.jpg` (including a `Neutral` folder). Matching is by **normalized
filename**: extension stripped, lowercased, alphanumeric only.

Because the producer's filenames contain typos, two alias tables bridge the gap —
`ICON_ALIASES` for units (Renegade Rasetsu borrows Red Rasetsu's portrait) and
`UPGRADE_ICON_ALIASES` for nine upgrades whose filenames misspell the upgrade
(`arcancetome`, `conjuredretniue`, `expedtionarytacticssurgeorder`, `giftlongevity`,
`gpyhscribereduceweight`, `importedcrossbox`, `journeymandadventurer`,
`kingofthebattlefiedl`, `seasonedcombatanthelian`).

When adding art, fix the alias table rather than renaming the producer's files — the next import
would otherwise reintroduce the mismatch.

## Army code serialization

`lib/domain/armyCode.ts`. Layout:

```
a<fp3>:<faction36><s|t>:<entries>[:<picks>]
```

- `a` — `CODE_VERSION`, **lowercase**. (The file's header comment says `A<fp3>`; the comment is
  wrong. Decoding lowercases its input, so uppercase codes still work.)
- `<fp3>` — a 3-character base36 roster fingerprint.
- `<faction36>` — index into `catalog.factions` order; `s` or `t` selects standard / tournament.
- entries joined by `_`; one entry is `<unit36>[*]` (`*` = mounted) followed by
  `-<upgrade36>[=<choice>]` per upgrade. A choice is a spellcraft group index, an option index, or
  an option index plus `,` and an item index (inscribe) or element index (replace Affinity).
- picks (tournament only) joined by `_`, each `<upgrade36>.<qty36>`.

Index pools are **sorted by id** (`localeCompare`): units = the faction's units plus neutrals;
upgrades, spellcrafts and items likewise. Imported entries get deterministic ids
(`'imported-' + (position + 1)`).

**Fingerprint**: FNV-1a 32-bit over the faction ids, unit ids (with `>mountId` for a mount
pairing), upgrade ids with their effect kinds (a `choice` expands to its option ids), spellcraft
ids, item ids and `CODE_ELEMENTS` — then `% 46656` and zero-padded to 3 base36 characters. Because
indexes shift whenever the roster changes, comparing fingerprints first is what stops a stale code
from decoding into _wrong but plausible_ units. A mismatch is reported as `roster-mismatch`;
anything structurally malformed as `invalid`. Decoding is strict on every range and structure,
tolerant of case and whitespace.

Encoding throws on: unknown faction / unit / upgrade, a missing spellcraft choice, option choice,
inscribed item or replaced element, `Standard armies carry no roster picks`, and an empty pick.

Adding a unit, upgrade, spellcraft or item **changes the fingerprint** and therefore invalidates
every previously issued code and saved army. That is the intended trade: a loud rejection beats a
silently wrong list.

## The importer's data gates

The import **throws** on:

- an unknown or missing model size — `'unknown model size <label> - extend UNIT_SIZES'`, for any
  label outside `Small, Medium, Large, Huge, Gigantic, Colossal, Epic`.

This is the only thing standing between a producer typo and a silently wrong size gate, precisely
because the content is loaded behind a type assertion. **Do not soften it to a warning.**

It **warns** (without failing) on upgrades with no curated effects and on skipped faction-less
units.

## Saved armies and the picked-army snapshot

Saved armies live under `oni-quest-advisor:saved-armies` as a newest-first array of
`SavedArmy`: `{ id, name, factionId, code, createdAt, format? }`. The metadata exists only so
saves can be listed without decoding; the **code carries the whole list**. `format` is absent on
saves written before the Roster format existed, and `savedArmyFormat()` reads that as `standard`.

A mission run attaches one of them as a **snapshot**, `PickedArmy` = `{ name, factionId, code }`,
stored on `MissionProgress.pickedArmy` and therefore persisted with the run, restored on resume,
and deleted with the run on abandon. Snapshotting (rather than referencing the save's id) is
deliberate: editing or deleting the save afterwards must not change a game in progress.

- The briefing's **Pick Army** picker lists only saves whose `savedArmyFormat` is `standard`.
- Display resolves the snapshot with `decodeArmy` + `resolveArmyEntries`
  (`missionProgressStore.pickedArmyRows()`), so the read-only Army view shows exactly what the
  code encodes, upgrades and mount included.
- A roster change that moves the fingerprint makes the snapshot **undecodable**; the Army view
  then says no army can be shown rather than guessing at wrong units — the same loud-rejection
  trade the share code makes.
- Army catalogs are lazy chunks, so anything that shows a picked army must have called
  `contentStore.loadArmy()` first; the page triggers it when a run carries a pick.

## Open questions

- **`data-import/` is untracked** and its track-or-ignore decision is still open. Tracking it
  makes producer diffs reviewable in git; ignoring it keeps a ~39k-line dump out of the repo.
- **Mount assignment is unguarded**: the importer looks up the mount character with
  `characters.find(...).attributes`, which would throw a `TypeError` if a mount code ever
  vanished from the dump. A clear error message would beat a stack trace.
- **`limit_if_recruited_neutral`** exists in the producer dump for distinct mercenary caps and is
  still unused — neutral copies currently use the same `limit` as faction copies.
- **Upgrade effects are hand-curated**, so a producer update that adds an upgrade ships it inert
  until someone writes its entry. Only a warning surfaces that. Worth a hard failure for a _new_
  unmapped upgrade (as opposed to a known text-only one)?
- **Faction logos (261–725 kB PNGs) and upgrade artwork (43–64 kB JPGs) are unoptimized** — the
  unit portraits were resized in v0.6.2 but these were left.
- No content spec covers the generated army JSON, unlike missions. The importer's throws are the
  only gate; a spec asserting invariants (every trait ref resolves, every upgrade effect kind is
  known, sizes are valid) would catch a bad import at test time rather than at runtime.
