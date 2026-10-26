import type {
	ArmyFormat,
	ArmyItemSpec,
	ArmyRosterRow,
	ArmyStatKey,
	ArmyUpgradeSpec,
	ArmyUnitSpec
} from './army';

/**
 * Export to Freecompany's Guildhall army builder (guildhall.eldfall-chronicles.com).
 *
 * Their builder has no URL entry point - six static routes, saved armies in browser localStorage,
 * and import by file drop - so the only way in is to hand the player a file in their own format.
 * That format stores the **already-mutated** character: `appliedArmyCharacterUpgrades` is only a
 * record of what was picked, while the statline, traits, spellcraft levels and inventory have been
 * changed in place. Established by diffing six ground-truth exports against the producer catalog.
 *
 * Three rules that are easy to get backwards, all read off those samples:
 *
 * - A second **copy** of a unit is a second array entry, but a second **upgrade** or **item** is a
 *   `QTY` bump on the entry already there.
 * - A mounted model is a rider entry plus a mount entry with **no link between them**, and each
 *   keeps its own statline. `effectiveStats` (rider plus mount) must not be written into either -
 *   their app combines them at display time, so writing the combined value double-counts the mount.
 * - Display caches are not refreshed: a level-4 spellcraft still reads `name__: "… lvl 3"`. Copy the
 *   catalog object verbatim and change only the leaf, or the file stops matching what their own
 *   builder would have written.
 *
 * This module is pure: the catalog is injected, and so are the army name and id, because their
 * `armyId` is `Date.now()` on their side and the domain reads no clock. Anything it cannot represent
 * faithfully is an error rather than a best guess - a silently wrong army contradicts our own Army
 * view for the same code, which is the one thing this integration must not do.
 */

/** A JSON value. The catalog is copied out of, never reinterpreted, so no richer type is needed. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * The producer's own catalog objects, keyed by their row ids. These are the verbatim Strapi
 * documents their builder expects - descriptions, image metadata and all - which our reduced
 * content deliberately does not carry, so they come from a separate server-side artifact.
 */
export type GuildhallCatalog = {
	characters: Record<number, Json>;
	upgrades: Record<number, Json>;
	items: Record<number, Json>;
	factions: Record<number, Json>;
	/** Element wrappers keyed by our title-cased element name ('Fire', 'Elder', ...). */
	elements: Record<string, Json>;
};

/** The structure version their importer expects. Refuse rather than emit a stale one. */
export const GUILDHALL_STRUCTURE_VERSION = '2.0.0';

/** Point caps, not totals - their builder computes the total itself. */
export const GUILDHALL_STANDARD_CAP = 85;
export const GUILDHALL_ROSTER_CAP = 125;

export type GuildhallExportOptions = {
	armyName: string;
	/** Their id is a client-side timestamp; injected so this stays pure. */
	armyId: number;
	/** Producer row id of the army's faction. */
	factionProducerId: number;
	/** Roster equipment pool, as upgrade ids resolved through `upgradeIndex`. */
	rosterUpgradeIds?: string[];
};

export type GuildhallExportError =
	| { kind: 'unknown-unit'; unitId: string }
	| { kind: 'unknown-mount'; unitId: string }
	| { kind: 'unknown-upgrade'; upgradeId: string }
	| { kind: 'unknown-item'; itemId: string }
	| { kind: 'unknown-element'; element: string }
	| { kind: 'missing-faction' }
	| { kind: 'malformed-catalog'; path: string }
	/** An upgrade grants a trait the base model lacks; emitting it needs their trait catalog. */
	| { kind: 'granted-trait'; traitId: string };

export type GuildhallExportResult =
	{ ok: true; document: Json } | { ok: false; error: GuildhallExportError };

export type GuildhallExportInput = {
	/** One row per copy, from `resolveArmyEntries` - the same rows our own Army view renders. */
	rows: ArmyRosterRow[];
	format: ArmyFormat;
	catalog: GuildhallCatalog;
	/** Our item specs by id, used to reach each item's producer row. */
	itemIndex: Record<string, ArmyItemSpec>;
	/** Our upgrade specs by id, used to reach the Roster pool's producer rows. */
	upgradeIndex: Record<string, ArmyUpgradeSpec>;
	options: GuildhallExportOptions;
};

const STAT_KEYS: ArmyStatKey[] = [
	'STA',
	'SPD',
	'OFF',
	'DEF',
	'ACC',
	'INT',
	'AG',
	'T',
	'ARM',
	'HP',
	'M'
];

/** Thrown while walking a catalog object and turned into one error result at the boundary. */
class MalformedCatalog extends Error {
	readonly path: string;
	constructor(path: string) {
		super(`guildhall catalog is malformed at ${path}`);
		this.path = path;
	}
}

function isRecord(value: Json | undefined): value is { [key: string]: Json } {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: Json | undefined, path: string): { [key: string]: Json } {
	if (!isRecord(value)) throw new MalformedCatalog(path);
	return value;
}

/** Deep copy, so patching one export can never mutate the shared catalog. */
function clone<T>(value: T): T {
	return structuredClone(value);
}

function kebab(code: unknown): string {
	return String(code ?? '')
		.toLowerCase()
		.replace(/_/g, '-');
}

/**
 * Mirrors the importer's element naming: our `dynamicElements` hold `titleCase(code)`, so 'ELDER'
 * becomes 'Elder'. Has to match `scripts/importUnits.mjs` exactly or inherited elements stop being
 * recognised as inherited and get re-fetched from the catalog in the wrong shape.
 */
function titleCase(code: unknown): string {
	const text = String(code ?? '');
	return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Walks `a.b.c` through unknown JSON, throwing one error naming the path that broke. */
function path(value: Json | undefined, steps: string[]): Json | undefined {
	let current = value;
	for (const step of steps) {
		if (!isRecord(current)) throw new MalformedCatalog(steps.join('.'));
		current = current[step];
	}
	return current;
}

/** `trait.data.attributes.trait_group.data.attributes.code`; our trait ids are kebab'd codes. */
function traitGroupCode(entry: Json): string {
	return kebab(
		path(entry, ['trait', 'data', 'attributes', 'trait_group', 'data', 'attributes', 'code'])
	);
}

/** `spell_group.data.attributes.code` of one spellcraft entry. */
function spellcraftGroupCode(entry: Json): string {
	return kebab(path(entry, ['spell_group', 'data', 'attributes', 'code']));
}

/** `item.data.attributes.code` of one inventory row, kebab'd to match our item ids. */
function inventoryItemCode(entry: Json): string {
	return kebab(path(entry, ['item', 'data', 'attributes', 'code']));
}

type ItemResolver = (itemId: string) => Json | undefined;

function makeItemResolver(
	itemIndex: Record<string, ArmyItemSpec>,
	catalog: GuildhallCatalog
): ItemResolver {
	return (itemId) => {
		const producerId = itemIndex[itemId]?.producerId;
		return producerId === undefined ? undefined : catalog.items[producerId];
	};
}

/**
 * Patches one producer character object with what our own domain resolved for that copy. The base
 * is copied verbatim and only the leaves their builder would have changed are touched, which keeps
 * their Strapi row ids, per-stat ids and display caches intact.
 */
function buildCharacter(
	row: ArmyRosterRow,
	unit: ArmyUnitSpec,
	catalog: GuildhallCatalog,
	resolveItem: ItemResolver,
	applyUpgrades: boolean
): { character: Json } | { error: GuildhallExportError } {
	const producerId = unit.producerId;
	if (producerId === undefined) return { error: { kind: 'unknown-unit', unitId: unit.id } };
	const base = catalog.characters[producerId];
	if (base === undefined) return { error: { kind: 'unknown-unit', unitId: unit.id } };

	const character = clone(base);
	const attrs = asRecord(path(character, ['attributes']), 'attributes');

	// The statline keeps each stat's own producer row id and prefix; only `value` is ours.
	const statline = asRecord(attrs.attributes, 'attributes.attributes');
	for (const key of STAT_KEYS) {
		asRecord(statline[key], `attributes.${key}`).value = unit.stats[key];
	}

	// Spellcraft levels: match by group code and change only `level`.
	if (Array.isArray(attrs.spellcrafts) && unit.spellcrafts) {
		for (const entry of attrs.spellcrafts) {
			const ours = unit.spellcrafts.find((ref) => ref.id === spellcraftGroupCode(entry));
			if (ours && isRecord(entry)) entry.level = ours.level;
		}
	}

	// Traits already on the model are patched in place. One the model does not start with would
	// have to be assembled from their trait catalog, which this artifact does not carry yet - so
	// refuse rather than quietly export a model missing a trait it should have.
	const traitEntries = Array.isArray(attrs.traits) ? attrs.traits : [];
	const present = new Set(traitEntries.map(traitGroupCode));
	for (const ref of unit.traits ?? []) {
		if (!present.has(ref.id)) return { error: { kind: 'granted-trait', traitId: ref.id } };
		const entry = traitEntries.find((candidate) => traitGroupCode(candidate) === ref.id);
		if (!isRecord(entry)) continue;
		asRecord(path(entry, ['trait', 'data', 'attributes']), 'trait.data.attributes').level =
			ref.level;
		if (ref.dynamicValue !== undefined) entry.dynamic_value = ref.dynamicValue;
		if (ref.dynamicElements) {
			// Two provenances, two shapes, and their exports preserve the difference. An element the
			// model was born with rides inside the character object and carries no `spells`; one an
			// upgrade granted is pulled from their elementList and does - Elder alone nests 19 spells
			// with full rules text. Academy Expeditioner after Elemental Lineage is stored as
			// [ELDER without spells, WATER with 20]: the inherited element untouched, only the new one
			// full size. So reuse whatever the base already carries and reach for the catalog only for
			// elements that are not there yet. Trimming every element, which an earlier revision did,
			// matches the no-grant case and silently corrupts every granted one.
			const current = entry.dynamic_elements;
			const currentList = isRecord(current) && Array.isArray(current.data) ? current.data : [];
			const inherited = new Map<string, Json>();
			for (const element of currentList) {
				const code = path(element, ['attributes', 'code']);
				if (typeof code === 'string') inherited.set(titleCase(code), element);
			}
			const elements: Json[] = [];
			for (const name of ref.dynamicElements) {
				const carried = inherited.get(name);
				if (carried !== undefined) {
					elements.push(clone(carried));
					continue;
				}
				const element = catalog.elements[name];
				if (element === undefined) return { error: { kind: 'unknown-element', element: name } };
				elements.push(clone(element));
			}
			entry.dynamic_elements = { data: elements };
		}
	}

	// Inventory: a row the model already carries keeps its join-row id and takes a QTY patch; a row
	// an upgrade added is written bare, exactly as their own builder writes it.
	if (unit.inventory) {
		const inventory = asRecord(attrs.inventory, 'attributes.inventory');
		if (typeof unit.inventorySpace === 'number') inventory.space = unit.inventorySpace;
		const existing = Array.isArray(inventory.items) ? inventory.items : [];
		const next: Json[] = [];
		for (const slot of unit.inventory) {
			const match = existing.find(
				(candidate) => isRecord(candidate) && inventoryItemCode(candidate) === slot.id
			);
			if (isRecord(match)) {
				const patched = clone(match);
				patched.QTY = slot.qty;
				next.push(patched);
				continue;
			}
			const item = resolveItem(slot.id);
			if (item === undefined) return { error: { kind: 'unknown-item', itemId: slot.id } };
			next.push({ item: { data: clone(item) }, QTY: slot.qty });
		}
		inventory.items = next;
	}

	if (applyUpgrades) {
		// Upgrades aggregate by QTY on one entry; they do not duplicate the way copies do.
		const aggregated = new Map<number, { upgrade: Json; QTY: number }>();
		for (const upgrade of row.upgrades) {
			const id = upgrade.producerId;
			if (id === undefined) return { error: { kind: 'unknown-upgrade', upgradeId: upgrade.id } };
			const producer = catalog.upgrades[id];
			if (producer === undefined) {
				return { error: { kind: 'unknown-upgrade', upgradeId: upgrade.id } };
			}
			const seen = aggregated.get(id);
			if (seen) seen.QTY += 1;
			else aggregated.set(id, { upgrade: clone(producer), QTY: 1 });
		}
		attrs.appliedArmyCharacterUpgrades = [...aggregated.values()];
	} else {
		// Roster units carry no upgrades: their own exports omit the key rather than write [].
		delete attrs.appliedArmyCharacterUpgrades;
	}

	return { character };
}

function buildMount(
	mount: ArmyUnitSpec | undefined,
	catalog: GuildhallCatalog,
	applyUpgrades: boolean
): { character: Json } | { error: GuildhallExportError } | null {
	if (!mount) return null;
	const producerId = mount.producerId;
	if (producerId === undefined) return { error: { kind: 'unknown-mount', unitId: mount.id } };
	const base = catalog.characters[producerId];
	if (base === undefined) return { error: { kind: 'unknown-mount', unitId: mount.id } };
	// Verbatim: the sample shows a mount's statline untouched, its bonuses living in `prefix`.
	const character = clone(base);
	const attrs = asRecord(path(character, ['attributes']), 'attributes');
	// A mount takes no upgrades, but their standard-format exports still carry the key as an empty
	// array on every character - and roster exports omit it. Caught by the round-trip harness, which
	// is the only reason this is right: nothing about a mount suggests the key is expected.
	if (applyUpgrades) attrs.appliedArmyCharacterUpgrades = [];
	else delete attrs.appliedArmyCharacterUpgrades;
	return { character };
}

/**
 * Builds their army document from our resolved rows.
 *
 * Standard puts one entry per copy in `armyCharacterList` with an empty `roster`; Roster does the
 * opposite - `armyCharacterList` empty, units in `roster.characterList` with no upgrade key at all,
 * and the equipment pool as raw upgrade objects in `roster.upgradeList`, one entry per copy.
 */
export function buildGuildhallArmy(input: GuildhallExportInput): GuildhallExportResult {
	const { rows, format, catalog, options } = input;
	const resolveItem = makeItemResolver(input.itemIndex, catalog);
	const isRoster = format === 'roster';

	try {
		const faction = catalog.factions[options.factionProducerId];
		if (faction === undefined) return { ok: false, error: { kind: 'missing-faction' } };

		const characters: Json[] = [];
		for (const row of rows) {
			const built = buildCharacter(row, row.upgradedUnit, catalog, resolveItem, !isRoster);
			if ('error' in built) return { ok: false, error: built.error };
			characters.push(built.character);

			// A mounted copy is two unlinked entries: the rider, then its mount.
			if (row.mounted) {
				const mount = buildMount(row.mount, catalog, !isRoster);
				if (mount && 'error' in mount) return { ok: false, error: mount.error };
				if (mount) characters.push(mount.character);
			}
		}

		const rosterUpgradeList: Json[] = [];
		if (isRoster) {
			for (const upgradeId of options.rosterUpgradeIds ?? []) {
				const producerId = input.upgradeIndex[upgradeId]?.producerId;
				if (producerId === undefined) {
					return { ok: false, error: { kind: 'unknown-upgrade', upgradeId } };
				}
				const producer = catalog.upgrades[producerId];
				if (producer === undefined) {
					return { ok: false, error: { kind: 'unknown-upgrade', upgradeId } };
				}
				rosterUpgradeList.push(clone(producer));
			}
		}

		// Devotion: Paimon is the one upgrade reaching a top-level field. Their handler pairs it
		// with an INT bump on the bearer, which resolveArmyEntries has already applied above.
		const hasCostReduction = rows.some((row) =>
			row.upgrades.some((upgrade) =>
				upgrade.effects.some((effect) => effect.kind === 'costReduction')
			)
		);

		const document: Json = {
			armyCharacterList: isRoster ? [] : characters,
			armyName: options.armyName,
			bonuses: { upgradesCostDecreaseValue: hasCostReduction ? 1 : 0 },
			faction: clone(faction),
			armyPts: GUILDHALL_STANDARD_CAP,
			rosterPts: GUILDHALL_ROSTER_CAP,
			armyId: options.armyId,
			mode: isRoster ? 'TOURNAMENT' : 'NORMAL',
			tournamentVariant: 'TOURNAMENT_ROSTER',
			config: { meta: { structureVersion: GUILDHALL_STRUCTURE_VERSION } },
			roster: {
				characterList: isRoster ? characters : [],
				upgradeList: rosterUpgradeList
			}
		};

		return { ok: true, document };
	} catch (error) {
		if (error instanceof MalformedCatalog) {
			return { ok: false, error: { kind: 'malformed-catalog', path: error.path } };
		}
		throw error;
	}
}
