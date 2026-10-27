# 11 · Guildhall export

> **Status: released in v0.12.0.** The serializer, the server-side catalog artifact, the download
> route and the second button on the Chiyo-Bot card are all shipped, and **six of the eight
> ground-truth exports reproduce byte-for-byte** — including the granted-trait and mount cases.
> Every remaining difference is catalog drift or a harness limitation, not a serializer fault; see
> _Verification_.

Exports an army list as a file that Freecompany's own army builder
(`guildhall.eldfall-chronicles.com`) can import. Reachable from the second button on a Chiyo-Bot
card, and directly at `GET /api/guildhall-export?code=<army code>`.

The point is that a player who builds a list in this app can take it into the game's official
builder without retyping it — and that what arrives there is the same list, not an approximation.

## Why a file and not a link

Their builder cannot be deep-linked. This was established by reading its client bundles rather than
guessing, and it is the reason the feature is shaped the way it is:

- **Six static routes** — `/`, `/army`, `/army-saving`, `/service-work`, `/_app`, `/_error`. No
  dynamic route, so there is no `/army/<id>`, and **no `router.query` read anywhere** in the army
  bundle, so there is no query parameter to seed one from.
- **Saved armies live in browser `localStorage`**, not on a server. A link from our origin cannot
  write another origin's localStorage; that is a browser boundary, not a missing feature.
- **`armyId` is `Date.now()`** — a client-side timestamp matched with `find(e => e.armyId === id)`
  against that browser's own array. There is no server-side army registry, so forging an id buys
  nothing.
- **Import is a file drop** (`type:"file"` plus `onDrop`) on `/army-saving`.

So the player's journey is: tap **Download for Guildhall** → a `.json` lands → open
`/army-saving` → drop it → select. Two more clicks than a deep link would be, and the only door
their builder has.

## What the file must look like

Their format stores the **already-mutated** character. `appliedArmyCharacterUpgrades` is only a
record of what was picked; the statline, trait levels, spellcraft levels and inventory have already
been changed in place by their upgrade handlers. An export that listed the upgrades without applying
their effects would show a Rangers-Guild Hunter at DEF 8 where our own Army view shows DEF 9 — two
apps disagreeing about one list, which is the single failure this feature must not have.

The rules below were all read off ground-truth exports diffed against the producer catalog, not
inferred from their minified code. Each one was a way to be plausibly wrong.

- **Copy the producer object verbatim, patch only the leaf.** Their character entries are the full
  nested Strapi documents — descriptions, image metadata, per-stat row ids. Our reduced content
  cannot produce them, so a generated artifact holds the originals (§ _The artifact_).
- **Copies duplicate; upgrades and items aggregate.** A second copy of a unit is a second array
  entry. A second copy of an upgrade is `QTY: 2` on one entry, and likewise for inventory items.
  Same concept, opposite representation, one document.
- **A mounted model is two unlinked entries.** Rider and mount sit side by side with nothing joining
  them; `mount_character.data` stays `null` — it is dead Strapi residue. Each keeps **its own**
  statline, so `effectiveStats` (rider plus mount) must never be written into either: their app
  combines them at display time, and writing the combined value double-counts the mount.
- **Display caches are not refreshed.** A spellcraft bumped to level 4 still reads
  `name__: "Art of Sorcery, lvl 3"`. Regenerating that string would make our file differ from what
  their own builder writes.
- **Elements have two provenances with two shapes.** An element the model was born with rides inside
  the character object and carries **no** `spells`; one an upgrade granted is pulled from their
  `elementList` and carries **all** of them (Elder nests 19 spells with full rules text). Academy
  Expeditioner after Elemental Lineage is stored as `[ELDER bare, WATER with 20]`. Elemental Lineage
  **appends**; Mana Catalyst **replaces**.
- **Wrapper asymmetry.** An upgrade entry is `{upgrade, QTY}` with **no** outer id. An inventory row
  that came with the character **has** an outer `id` and `name__`; one an upgrade added is written
  bare as `{item:{data}, QTY}`.
- **Roster format inverts the document.** `mode: "TOURNAMENT"`, `armyCharacterList: []` empty, units
  in `roster.characterList` with the `appliedArmyCharacterUpgrades` key **absent entirely** (not
  `[]`), and the equipment pool as raw upgrade objects in `roster.upgradeList` — one entry per copy,
  not aggregated.
- **`armyPts` / `rosterPts` are caps, not totals.** Their builder computes the total itself, and
  there is an "Edit Your Army" modal for the caps. So this side does no points arithmetic.
- **`bonuses.upgradesCostDecreaseValue`** is the Devotion: Paimon discount. Their handler sets it to
  1 _and_ bumps the bearer's INT by 1; the INT bump arrives via our own effect application.

`mode` is the discriminator, not `tournamentVariant` — their guard is
`mode === TOURNAMENT && variant === TOURNAMENT_ROSTER`, and their own default state pairs `NORMAL`
with `TOURNAMENT_ROSTER`, so the variant is vestigial unless mode is `TOURNAMENT`.

## The artifact

`src/lib/server/guildhall/catalog.json` — ~590 KB, generated by `scripts/importUnits.mjs` from the
same producer dump as `content/units`, minified and listed in `.prettierignore`.

It lives under `lib/server` rather than `lib/data` deliberately. `lib/data` content reaches the phone
through eager `import.meta.glob`; `$lib/server/**` makes a client import a **build error**. That is a
structural guarantee rather than a convention someone has to remember, which is what you want when
the thing being kept out is half a megabyte of someone else's rules prose. `guildhallContent.ts`
loads it lazily behind a memoized promise, so boot does not parse it and an online game never pays
for a feature it does not use — measured, a first export costs ~0.24 s and every one after ~0.005 s.

Characters are 456 KB of that and irreducible: fidelity requires the whole object. Everything else
is narrowed to only what an upgrade can **grant** — trait groups, classes, skill groups, combat-art
groups and stratagems — because every other instance of those reaches the export inside its own
character object. The set is derived from `UPGRADE_EFFECTS` rather than listed twice, so it tracks
the curation, and the importer **throws** if a granted row is missing from the dump: a catalog that
silently could not build one grant would surface only as a refusal at export time, with no hint why.
Narrowing is cheap — the four rule catalogs add ~10 KB — and keeps the artifact near 600 KB.

Two keying conventions, both matching our content's own: factions, trait groups, classes, skill
groups and combat-art groups key by **`kebab(code)`**, which is exactly our id
(`COALITION_OF_THENION` → `coalition-of-thenion`). **Stratagems key by `slug(name)`** instead,
because a third of theirs have no usable code — several contain spaces (`"active support"`,
`"solemn- presence"`) and some are `null`. A decoded army carries only our ids, so keying the
artifact our way is what makes it addressable without every caller resolving a mapping first.

## Granted rules

An upgrade can grant five kinds of thing a model was not born with — a **trait** (Poisoned Weapons,
Seasoned Combatant, Tactical Expertise, Traveling Duelist), a **class** and a **combat art** (Bujutsu
and Kyujutsu Expertise), a **skill** (Climbing Expertise, Muffled Movement), and a **stratagem**
(Expedition Leader). None of these is sitting inside the character object, so each has to be
assembled. Ground truth for the trait case is the Nightshade + Poisoned Weapons export, whose base
traits are empty so the whole entry is new:

```json
{
	"trait": {
		"data": {
			"id": 58,
			"attributes": {
				"description": "WEAK POISON; If a model suffers a Wound…",
				"level": 1,
				"name__": "Poison 1",
				"trait_group": { "data": { "id": 46, "attributes": { "code": "POISON" } } }
			}
		}
	},
	"dynamic_value": null,
	"dynamic_elements": { "data": [] }
}
```

(`trait_group.data` is elided here but is the **whole** group object, nested `traits` included.)

**No outer join-row id**, same as an upgrade-granted inventory item. `trait.data` is the group's
per-level entry **verbatim** with `trait_group` injected. Innate entries are patched in place and
keep the catalog's order — reordering was the largest source of noise in every round-trip diff — and
granted ones are appended, which is where their own builder puts them. The level is matched strictly
against the group's entries: guessing the nearest one would write the wrong rules text into a
player's army, which is worse than refusing.

The other four kinds follow the same two patterns, but **the nested-group rule differs between
them**, and getting it backwards ships a group object their builder never writes:

| Granted    | Shape                                | Injected group keeps its nested level list? |
| ---------- | ------------------------------------ | ------------------------------------------- |
| trait      | per-level entry + `trait_group`      | **yes**                                     |
| skill      | per-level entry + `skill_group`      | **no** — stripped                           |
| combat art | per-level entry + `combat_art_group` | **no** — stripped                           |
| class      | flat catalog row                     | n/a                                         |
| stratagem  | flat catalog row                     | n/a                                         |

Only the **trait** case can be confirmed by diffing against one of their exports, because their
builder has no handler for any of the five upgrades that grant these — so no file of theirs contains
a granted class, skill, combat art or stratagem. Those four were built by analogy with **innate**
entries in the dump, which are byte-identical to their group's per-level entry plus the injected
group.

All five are now **confirmed by import** (2026-10-27). Two test armies covering all six
grant-bearing upgrades were exported and dropped into Guildhall, and every grant rendered:
Armsmaster + Fencing 1 on Bushi Attendant, Marksman + Archery 1 on Kitsune Spellmaiden, Advance! and
Back to Back on Helrin Expatriate, Climbing 1 and Stealth 1 on their respective models, and
Resourceful II with Survival (Difficult) on an Eonian Runner that has **no innate traits at all**, so
nothing on it could have come from the character object. Both totals read 56/85, so their cost model
agrees with ours. Import is the only verification available for these four shapes, since there is no
file of theirs to diff against.

## What it refuses

Every unrepresentable case is a typed error, never a best guess.

- **`unknown-unit` / `unknown-mount` / `unknown-upgrade` / `unknown-item` / `unknown-element` /
  `unknown-trait` / `unknown-class` / `unknown-skill` / `unknown-combat-art` / `unknown-stratagem` /
  `missing-faction`** — content drift between our catalog and the artifact. The message names what is
  missing, because that is what makes it actionable.
- **`malformed-catalog`** — the artifact lacks a shape the serializer needs, such as a group with no
  entry at the requested level. Refusing beats taking the nearest level, which would write the wrong
  rules text into a player's army.
- **`unsupported-effect`** — a picked upgrade carries an effect kind the serializer does not write.
  This is a **tripwire, not a live case**: all twelve kinds in `ArmyUpgradeEffect` are covered today.
  It exists so that adding a thirteenth fails here, instead of silently shipping an army that lists
  the upgrade in `appliedArmyCharacterUpgrades` while the model lacks the thing it grants.
- **`unrepresentable-inscription`** — Glyphscribe: Reduce Weight's inscribed item carries per-copy
  stat overrides (`ArmyRosterRow.itemOverrides`) that their format has no observed representation
  for. Refusing is better than exporting the un-inscribed item and calling it the same thing.
- **`roster-mismatch`** (409, from `decodeArmy`) — the code was built against older content. This is
  the one a whole Discord hits at once on re-import day, and the message says what to do about it.

## Verification

The serializer is pure and covered by unit tests, but the unit tests were **not** sufficient and it
is worth recording why. A throwaway harness rebuilt each of Freecompany's own exports from the picks
the file described, ran the real `resolveArmyEntries` → `buildGuildhallArmy` pipeline, and diffed
leaf by leaf. **Six of the eight characters reproduce byte-for-byte**, including the granted-trait
and mount cases; every remaining difference is array ordering or a stale producer dump — both
catalog drift, not serializer faults — or a choice upgrade the harness declined to reconstruct.

That harness found two bugs the 21 synthetic tests could not:

1. Element objects were emitted with their `spells` arrays — and the first fix for it was **wrong**,
   blanket-stripping `spells`, because the three samples that then matched byte-for-byte contained no
   granted element. Reading the element objects directly is what revealed the two-provenance rule.
2. Mount entries were missing `appliedArmyCharacterUpgrades: []`. The test fixture's mount happened
   to include the key, so the suite passed against a serializer that was wrong. **A fixture that
   already contains the field under test hides its absence.**

A third defect was found by neither, and the reason matters more than the defect. Four effect kinds —
`class`, `skill`, `combatArt`, `stratagem` — were applied by our domain and written by no part of the
serializer, so five upgrades exported with the upgrade listed in `appliedArmyCharacterUpgrades` and
the grant silently absent. **The round-trip could not have caught it**: none of the eight samples
used any of those five upgrades, so every diff was clean. It surfaced only by auditing the kinds in
`ArmyUpgradeEffect` against the kinds the serializer writes — which is why the `unsupported-effect`
tripwire now exists. A corpus of ground-truth samples covers only the cases the samples happen to
contain; coverage of the _input space_ has to be checked separately.

The route itself was exercised end to end against a running dev server: a minted Standard code and a
minted Roster code both returned `200` with the right `content-disposition`, `no-store`, correct
`mode`/variant, and — for the Roster — `armyCharacterList: []`, no upgrade key on the roster unit,
and `["ADEPT_SHAPER","ADEPT_SHAPER"]` for a qty-2 pick. The three refusal paths return 400 / 400 /
409 as described above.

`GET` requests are not rate limited by default in `hooks.server.ts`; this one is (30/min per IP),
because it does real work, streams a large body, and sits behind a Discord button that anyone in the
channel can click.

## Open questions

- **Two upgrades diverge from their builder — a fairness call, not a technical one.** We model
  effects for `expedition-leader` (two stratagems) and `journeyman-adventurer` (two traits); their
  client has **no handler** for either, so their builder records the upgrade without applying
  anything. The export bakes in **our** rulebook-correct reading, and the import test confirmed it
  renders **exactly once** — the double-display risk that made this uncomfortable is empirically
  gone. Their upgrade objects carry no structured relation to a trait or stratagem at all, only prose
  inside `description`, which is why they can neither apply the grant nor duplicate it. What remains
  is the maintainer's call: an army imported from us is stronger than the same list built natively in
  Guildhall, and in a tournament that difference is visible to both players. Worth raising with
  Freecompany as a bug report, since their own card text promises grants their builder does not make.
- **The producer dump is stale, and the replacement offered so far is partial.**
  `data-import/units.json` is dated 2026-08-31, but their catalog has edits from 2026-09-10 (Lupus
  Rex's item `attack_mode` changed from `MELEE` to `NATURAL_AND_MELEE`). `units3.json` confirms the
  drift but carries only **3 of 12** sections — no `upgradeList`, `itemList`, `traitGroupList`,
  `skillGroupList`, `classList`, `combatArtGroupList`, `strategmList` or `elementList` — so it
  **cannot** be imported: the importer does not guard against an empty list and would write nine
  valid-looking empty catalogs. Its three sections do reveal two live rules errors we carry:
  Cryomancy's attack mode is `RANGED`, not `MELEE_AND_RANGED`, and Art of Sorcery's Armor-Piercing
  markup was repaired upstream. This affects the whole app's content, not just this export, and it
  explains the array-ordering differences the round-trip surfaced. A **full** fresh dump is needed
  before byte-fidelity claims mean much.
- **One unexplained sample.** In a Glyphscribe: Reduce Weight export, Flameshaper gained a
  _Mastercrafted Helrin Sword_ from an empty inventory — but neither of that upgrade's two options
  adds an item. Most likely their current catalog gives Flameshaper a starting sword our stale dump
  lacks. A fresh dump settles it; until then it is unexplained, not assumed away.
- **`structureVersion` drift.** Everything observed says `"2.0.0"`. If they bump it, exports may be
  rejected silently. The constant is exported from the domain module so a guard has somewhere to
  live, but nothing currently compares it against anything.
- **No permanent route test.** The end-to-end pass above was a throwaway harness plus curl. A
  committed test would need a route-handler test pattern this repo does not have yet.
