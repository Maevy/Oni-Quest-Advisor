# 11 · Guildhall export

> **Status: built, not yet released.** The serializer, the server-side catalog artifact, the download
> route and the second button on the Chiyo-Bot card are all implemented and verified against
> Freecompany's own exports. Nothing is deployed yet, and **granted traits are refused rather than
> written** — see _What it refuses_ for the one sample that would unlock them.

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

Characters are 456 KB of that and irreducible: fidelity requires the whole object. Trait groups are
narrowed to the seven an upgrade can actually _grant_ (4.4 KB instead of 60.4 KB), because every
other trait reaches the export inside its character. That set is derived from `UPGRADE_EFFECTS`
rather than listed twice, and the importer **throws** if a granted trait is missing from the dump —
a catalog that silently could not build one trait would surface only as a refusal at export time
with no hint why.

Factions are keyed by **our** faction id, not their row id: their `code` kebabs to exactly our id
(`COALITION_OF_THENION` → `coalition-of-thenion`), and a decoded army carries nothing else.

## What it refuses

Every unrepresentable case is a typed error, never a best guess.

- **`granted-trait`** — an upgrade gave a model a trait it was not born with. Emitting one means
  assembling a trait entry from their trait catalog, and the only evidence for that shape is
  minified bundle code. **This is a real gap, not an edge case**: it covers Poisoned Weapons,
  Seasoned Combatant, Tactical Expertise and Traveling Duelist.
- **`unknown-unit` / `unknown-mount` / `unknown-upgrade` / `unknown-item` / `missing-faction`** —
  content drift between our catalog and the artifact. The message names what is missing, because
  that is what makes it actionable.
- **`roster-mismatch`** (409, from `decodeArmy`) — the code was built against older content. This is
  the one a whole Discord hits at once on re-import day, and the message says what to do about it.

## Verification

The serializer is pure and covered by unit tests, but the unit tests were **not** sufficient and it
is worth recording why. A throwaway harness rebuilt each of Freecompany's own exports from the picks
the file described, ran the real `resolveArmyEntries` → `buildGuildhallArmy` pipeline, and diffed
leaf by leaf. Three of seven reproduce byte-for-byte; every remaining difference is array ordering,
a stale producer dump, or a choice upgrade the harness declined to reconstruct.

That harness found two bugs the 21 synthetic tests could not:

1. Element objects were emitted with their `spells` arrays — and the first fix for it was **wrong**,
   blanket-stripping `spells`, because the three samples that then matched byte-for-byte contained no
   granted element. Reading the element objects directly is what revealed the two-provenance rule.
2. Mount entries were missing `appliedArmyCharacterUpgrades: []`. The test fixture's mount happened
   to include the key, so the suite passed against a serializer that was wrong. **A fixture that
   already contains the field under test hides its absence.**

The route itself was exercised end to end against a running dev server: a minted Standard code and a
minted Roster code both returned `200` with the right `content-disposition`, `no-store`, correct
`mode`/variant, and — for the Roster — `armyCharacterList: []`, no upgrade key on the roster unit,
and `["ADEPT_SHAPER","ADEPT_SHAPER"]` for a qty-2 pick. The three refusal paths return 400 / 400 /
409 as described above.

`GET` requests are not rate limited by default in `hooks.server.ts`; this one is (30/min per IP),
because it does real work, streams a large body, and sits behind a Discord button that anyone in the
channel can click.

## Open questions

- **Granted traits** need one ground-truth export: a model given a trait it does not start with
  (Traveling Duelist on a non-Duelist, or Poisoned Weapons). Until then four upgrades refuse.
- **Two upgrades diverge from their builder.** We model effects for `expedition-leader` (stratagem)
  and `journeyman-adventurer` (two traits); their client has **no handler** for either, so their
  builder records them without applying anything. Unresolved: export our rulebook-correct
  interpretation, or mirror their record-only behaviour? Baking ours in is more accurate but means an
  exported army differs from the same army built natively — and risks a double-display if their UI
  also renders granted traits from the upgrade list.
- **The producer dump is stale.** `data-import/units.json` is dated 2026-08-31, but their catalog has
  edits from 2026-09-10 (Lupus Rex's item `attack_mode` changed from `MELEE` to
  `NATURAL_AND_MELEE`). This affects the whole app's content, not just this export, and it explains
  the array-ordering differences the round-trip surfaced. A fresh dump is needed before
  byte-fidelity claims mean much.
- **One unexplained sample.** In a Glyphscribe: Reduce Weight export, Flameshaper gained a
  _Mastercrafted Helrin Sword_ from an empty inventory — but neither of that upgrade's two options
  adds an item. Most likely their current catalog gives Flameshaper a starting sword our stale dump
  lacks. A fresh dump settles it; until then it is unexplained, not assumed away.
- **`structureVersion` drift.** Everything observed says `"2.0.0"`. If they bump it, exports may be
  rejected silently. The constant is exported from the domain module so a guard has somewhere to
  live, but nothing currently compares it against anything.
- **No permanent route test.** The end-to-end pass above was a throwaway harness plus curl. A
  committed test would need a route-handler test pattern this repo does not have yet.
