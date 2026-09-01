export type ArmyFormat = 'standard' | 'tournament';

/** Points cap per army format. */
export const ARMY_FORMAT_POINTS: Record<ArmyFormat, number> = {
	standard: 85,
	tournament: 125
};

export type ArmyFactionId =
	| 'helian-league'
	| 'coalition-of-thenion'
	| 'sand-kingdoms'
	| 'empire-of-soga'
	| 'oni-clans'
	| 'goblin-wartribes'
	| 'adventurers-guild';

export type ArmyFactionConfig = {
	id: ArmyFactionId;
	name: string;
	/** Dominant faction color, its RAL Classic value (see data/armyFactions). */
	color: string;
	/** Faction logo asset URL. */
	logo: string;
};

export const ARMY_STAT_KEYS = [
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
] as const;

export type ArmyStatKey = (typeof ARMY_STAT_KEYS)[number];

/** Flat statline; null when the model has no value for that stat. */
export type ArmyStats = Record<ArmyStatKey, number | null>;

/** A reference from rules text to another rules entry, e.g. `(Knockdown)[trait.KNOCKDOWN]`. */
export type ArmyRulesLink = {
	type: string;
	id: string;
};

/** One piece of rules text; `link` marks it as a clickable cross-reference. */
export type ArmyTextSegment = {
	text: string;
	link?: ArmyRulesLink;
};

/** A class, skill, trait or combat-art entry with its rules text; shared across units. */
export type ArmyRulesSpec = {
	id: string;
	name: string;
	/** Rules text for entries without per-level texts (classes, level-less groups). */
	description?: ArmyTextSegment[];
	/** Rules text per level, for entries whose rules are leveled. */
	levels?: Record<number, ArmyTextSegment[]>;
};

/** A skill on a unit, referencing the centralized skill entry. */
export type ArmySkillRef = {
	id: string;
	level: number;
};

/** A combat art on a unit; the level is the highest level the unit has access to. */
export type ArmyCombatArtRef = {
	id: string;
	level: number;
};

/** A spellcraft on a unit; the level is the highest spell level it grants. */
export type ArmySpellcraftRef = {
	id: string;
	level: number;
};

/** A cost-like spell value: fixed text, or a character stat with optional modifier. */
export type ArmySpellCost = {
	fixed?: string;
	stat?: ArmyStatKey;
	modifier?: number;
};

/** A spell from the producer's spell catalogs. */
export type ArmySpellSpec = {
	id: string;
	name: string;
	/** Spellcraft group id the spell belongs to. */
	group: string;
	/** Element id (elder, fire, ...). */
	element: string;
	level: number;
	effect: ArmyTextSegment[];
	pw?: ArmySpellCost;
	/** Display value, e.g. 'Spell, Sorcery | Ranged'. */
	type?: string;
	rch?: string;
	stk?: ArmySpellCost;
};

/** The rulebook category of a stratagem. */
export type ArmyStratagemType = 'authority' | 'subterfuge' | 'tribe';

/** A stratagem from the producer's stratagem catalog. */
export type ArmyStratagemSpec = {
	id: string;
	name: string;
	type: ArmyStratagemType;
	effect: ArmyTextSegment[];
};

/** The rulebook category of an item. */
export type ArmyItemCategory = 'weapon' | 'shield' | 'accessory' | 'consumable';

/** One range bracket of an item's reach: distance band and hit modifier. */
export type ArmyRangeBracket = { range: string; modifier: number };

/** Structured reach of an item, parsed from the producer's RCH cell. */
export type ArmyItemReach = {
	brackets: ArmyRangeBracket[];
	aoe?: string;
	text?: string;
};

/** An item from the producer catalog; toughness/stk reuse the spell cost shape. */
export type ArmyItemSpec = {
	id: string;
	name: string;
	category: ArmyItemCategory;
	/** Attack mode, e.g. 'melee', 'ranged', 'natural-and-melee'. */
	mode?: string;
	toughness?: ArmySpellCost;
	reach?: ArmyItemReach;
	stk?: ArmySpellCost;
	effect: ArmyTextSegment[];
	weight?: number;
};

/** A unit's inventory slot: how many copies of one item it carries. */
export type ArmyInventorySlot = { id: string; qty: number };

/**
 * One mechanical upgrade effect the app applies automatically. Free choices
 * stay in the description text for the player; trait/class conditions are
 * resolved against the unit.
 */
export type ArmyUpgradeEffect =
	| {
			kind: 'stat';
			changes: Partial<Record<ArmyStatKey, number>>;
			/** Applied instead of `changes` when the unit has this trait. */
			insteadIfTrait?: { traitId: string; changes: Partial<Record<ArmyStatKey, number>> };
			/** Applied on top when the unit has any of these classes. */
			extraIfClasses?: { classIds: string[]; changes: Partial<Record<ArmyStatKey, number>> };
	  }
	| { kind: 'class'; classId: string }
	| { kind: 'trait'; traitId: string; level: number; dynamicValue?: string }
	| { kind: 'skill'; skillId: string; level: number }
	| { kind: 'combatArt'; artId: string; level: number }
	| { kind: 'item'; itemId: string }
	| { kind: 'replacePrimaryWeapon'; itemId: string }
	| { kind: 'pouch' }
	| { kind: 'spellcraftLevelUp' }
	| { kind: 'stratagem'; stratagemIds: string[] }
	| { kind: 'costReduction'; amount: number };

/** Requirements parsed from the upgrade's description. */
export type ArmyUpgradeRequirement = {
	/** The unit needs at least one of these classes. */
	classes?: string[];
	/** The unit must not have any of these traits. */
	notTraits?: string[];
};

/** An upgrade from the producer catalog. */
export type ArmyUpgradeSpec = {
	id: string;
	name: string;
	/** Points this upgrade adds to the army total. */
	cost: number;
	/** Per-army copy cap; absent means unlimited. */
	limit?: number;
	/** Faction-exclusive upgrades; neutral upgrades have no faction. */
	factionId?: ArmyFactionId;
	description: ArmyTextSegment[];
	requirement?: ArmyUpgradeRequirement;
	effects: ArmyUpgradeEffect[];
	icon?: string;
};

/** A trait on a unit; dynamic values fill the entry's (X)/(Element) placeholders. */
export type ArmyTraitRef = {
	id: string;
	level: number;
	dynamicValue?: string;
	dynamicElements?: string[];
};

export type ArmyUnitSpec = {
	id: string;
	name: string;
	points: number;
	limit: number;
	stats: ArmyStats;
	/** Class ids, resolved against the centralized class list. */
	classes: string[];
	/** Skill references; a few units have none. */
	skills?: ArmySkillRef[];
	/** Trait references; a few units have none. */
	traits?: ArmyTraitRef[];
	/** Combat-art references; most units have none. */
	combatArts?: ArmyCombatArtRef[];
	/** Spellcraft references; casters only. */
	spellcrafts?: ArmySpellcraftRef[];
	/** Stratagem ids; only some units carry stratagems. */
	stratagems?: string[];
	/** Inventory capacity in space units. */
	inventorySpace?: number;
	/** Equipped items in the producer's order; ids resolve the item catalog. */
	inventory?: ArmyInventorySlot[];
	/** Rulebook exception: this unit can never receive upgrades. */
	upgradesLocked?: boolean;
	/** Mounts only: additive stat bonuses/maluses applied on top of the rider. */
	statChanges?: Partial<Record<ArmyStatKey, number>>;
	mount?: { unitId: string; points: number };
	icon?: string;
};

/** One block of rules text in a popup, optionally tied to a level. */
export type ArmyRulesSection = {
	level?: number;
	/** False when the unit's level does not grant access - rendered greyed out. */
	available: boolean;
	text: ArmyTextSegment[];
};

/** One spell row in a spellcraft popup, values resolved against the unit. */
export type ArmySpellRow = {
	element: string;
	elementName: string;
	level: number;
	name: string;
	effect: ArmyTextSegment[];
	pw?: string;
	type?: string;
	rch?: string;
	stk?: string;
};

/** A resolved rules popup: heading plus level sections or a spell list. */
export type ArmyRulesPopup = {
	title: string;
	sections: ArmyRulesSection[];
	spells?: ArmySpellRow[];
};

/** One copy of a unit in the current army - every copy is its own entry. */
export type ArmyEntry = {
	id: string;
	unitId: string;
	mounted?: boolean;
	/** Upgrade ids picked for this copy (standard format only). */
	upgrades?: string[];
};

/** One army copy joined with its unit spec, ready for display. */
export type ArmyRosterRow = {
	entryId: string;
	unitId: string;
	name: string;
	/** Cost of this copy, including the mount when mounted and all upgrades. */
	points: number;
	icon?: string;
	mounted: boolean;
	mount?: ArmyUnitSpec;
	/** The rider's stats with upgrade and mount effects applied. */
	effectiveStats: ArmyStats;
	/** The unit with all picked upgrade effects applied. */
	upgradedUnit: ArmyUnitSpec;
	/** The picked upgrades, resolved. */
	upgrades: ArmyUpgradeSpec[];
};

/** Adds one copy of a unit as its own entry; stops at the unit limit. */
export function addArmyUnit(
	entries: ArmyEntry[],
	unitId: string,
	units: ArmyUnitSpec[],
	entryId: string
): ArmyEntry[] {
	const limit = units.find((unit) => unit.id === unitId)?.limit;
	const copies = entries.filter((entry) => entry.unitId === unitId).length;
	if (limit !== undefined && copies >= limit) return entries;
	return [...entries, { id: entryId, unitId }];
}

/** Removes one specific copy from the army. */
export function removeArmyEntry(entries: ArmyEntry[], entryId: string): ArmyEntry[] {
	if (!entries.some((entry) => entry.id === entryId)) return entries;
	return entries.filter((entry) => entry.id !== entryId);
}

/** Removes the most recently added copy of a unit. */
export function removeArmyCopy(entries: ArmyEntry[], unitId: string): ArmyEntry[] {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		if (entries[index].unitId === unitId) {
			return [...entries.slice(0, index), ...entries.slice(index + 1)];
		}
	}
	return entries;
}

/**
 * Total reduction other upgrades receive while any costReduction upgrade
 * (e.g. Devotion: Paimon) is picked somewhere in the army.
 */
export function armyUpgradeCostReduction(
	entries: ArmyEntry[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>
): number {
	return entries.reduce(
		(total, entry) =>
			total +
			(entry.upgrades ?? []).reduce((sum, id) => {
				const effect = upgradeIndex[id]?.effects.find(
					(candidate): candidate is Extract<ArmyUpgradeEffect, { kind: 'costReduction' }> =>
						candidate.kind === 'costReduction'
				);
				return sum + (effect?.amount ?? 0);
			}, 0),
		0
	);
}

/** One upgrade's cost after the army-wide reduction; providers keep their cost. */
function discountedUpgradeCost(upgrade: ArmyUpgradeSpec, reduction: number): number {
	if (upgrade.effects.some((effect) => effect.kind === 'costReduction')) return upgrade.cost;
	return Math.max(1, upgrade.cost - reduction);
}

/**
 * The effective cost of one upgrade inside the army: reduced by every
 * costReduction upgrade picked (minimum 1). An upgrade providing the
 * reduction itself keeps its normal cost.
 */
export function upgradeCostInArmy(
	upgrade: ArmyUpgradeSpec,
	entries: ArmyEntry[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>
): number {
	return discountedUpgradeCost(upgrade, armyUpgradeCostReduction(entries, upgradeIndex));
}

/** Joins the army entries with their unit specs for display - one row per copy. */
export function resolveArmyEntries(
	entries: ArmyEntry[],
	units: ArmyUnitSpec[],
	mounts: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec> = {},
	itemIndex: Record<string, ArmyItemSpec> = {}
): ArmyRosterRow[] {
	const costReduction = armyUpgradeCostReduction(entries, upgradeIndex);
	return entries.flatMap((entry) => {
		const unit = units.find((candidate) => candidate.id === entry.unitId);
		if (!unit) return [];
		const upgrades = (entry.upgrades ?? [])
			.map((id) => upgradeIndex[id])
			.filter((upgrade): upgrade is ArmyUpgradeSpec => upgrade !== undefined);
		const upgradedUnit = upgradedArmyUnit(unit, upgrades, itemIndex);
		const mounted = entry.mounted === true && unit.mount !== undefined;
		const mountSpec = unit.mount;
		const mount = mountSpec
			? mounts.find((candidate) => candidate.id === mountSpec.unitId)
			: undefined;
		const points =
			unit.points +
			(mounted && mountSpec ? mountSpec.points : 0) +
			upgrades.reduce((sum, upgrade) => sum + discountedUpgradeCost(upgrade, costReduction), 0);
		const effectiveStats =
			mounted && mount ? effectiveMountedStats(upgradedUnit, mount) : upgradedUnit.stats;
		return [
			{
				entryId: entry.id,
				unitId: entry.unitId,
				name: unit.name,
				points,
				icon: unit.icon,
				mounted,
				mount,
				effectiveStats,
				upgradedUnit,
				upgrades
			}
		];
	});
}

export function armyPoints(
	entries: ArmyEntry[],
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec> = {}
): number {
	const costReduction = armyUpgradeCostReduction(entries, upgradeIndex);
	return entries.reduce((total, entry) => {
		const unit = units.find((candidate) => candidate.id === entry.unitId);
		if (!unit) return total;
		const upgradeCosts = (entry.upgrades ?? []).reduce((sum, id) => {
			const upgrade = upgradeIndex[id];
			return sum + (upgrade ? discountedUpgradeCost(upgrade, costReduction) : 0);
		}, 0);
		return (
			total + unit.points + (entry.mounted && unit.mount ? unit.mount.points : 0) + upgradeCosts
		);
	}, 0);
}

/** Copies per unit id, feeding the stepper counts in the available-units list. */
export function armyCopyCounts(entries: ArmyEntry[]): Record<string, number> {
	return entries.reduce<Record<string, number>>((counts, entry) => {
		counts[entry.unitId] = (counts[entry.unitId] ?? 0) + 1;
		return counts;
	}, {});
}

/** Rules entries keyed by id, for resolving a unit's class/skill/trait/stratagem references. */
export function indexArmyRules<T extends { id: string }>(entries: T[]): Record<string, T> {
	return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
}

/** The four main factions carry their own upgrades; the rest use the neutral pool only. */
const UPGRADE_FACTION_IDS: ArmyFactionId[] = [
	'helian-league',
	'empire-of-soga',
	'coalition-of-thenion',
	'sand-kingdoms'
];

/** Upgrades available to a faction: the neutral pool plus its own exclusives. */
export function upgradesForFaction(
	factionId: ArmyFactionId,
	upgrades: ArmyUpgradeSpec[]
): ArmyUpgradeSpec[] {
	const own = UPGRADE_FACTION_IDS.includes(factionId) ? factionId : undefined;
	return upgrades.filter((upgrade) => upgrade.factionId === undefined || upgrade.factionId === own);
}

/** The trait that grants additional upgrade slots, one per level. */
const RESOURCEFUL_TRAIT_ID = 'resourceful';

/**
 * How many upgrades a unit may carry: one base slot, one per Resourceful
 * level (including Resourceful granted by upgrades) and one per Pouch.
 * Units on the rulebook exception list have no slots at all.
 */
export function upgradeSlotsFor(unit: ArmyUnitSpec, picked: ArmyUpgradeSpec[]): number {
	if (unit.upgradesLocked) return 0;
	const resourceful = unit.traits?.find((ref) => ref.id === RESOURCEFUL_TRAIT_ID);
	const pouches = picked.filter((upgrade) =>
		upgrade.effects.some((effect) => effect.kind === 'pouch')
	).length;
	return 1 + (resourceful?.level ?? 0) + pouches;
}

/** Highest level of a leveled rules entry; 1 for entries without levels. */
function armyRulesMaxLevel(entry: ArmyRulesSpec | undefined): number {
	if (!entry?.levels) return 1;
	return Math.max(...Object.keys(entry.levels).map(Number));
}

/** Adds a leveled reference, bumping an existing one to the next level. */
function bumpLeveledRef<T extends { id: string; level: number }>(
	refs: T[] | undefined,
	ref: T
): T[] {
	const existing = refs?.find((candidate) => candidate.id === ref.id);
	if (!existing) return [...(refs ?? []), ref];
	return (refs ?? []).map((candidate) =>
		candidate.id === ref.id ? { ...candidate, level: candidate.level + 1 } : candidate
	);
}

/**
 * The unit with all picked upgrade effects applied: stat boosts, granted
 * classes/traits/skills/combat arts, items, primary weapon replacement
 * (the first weapon in the inventory), pouch space and stratagems.
 * 'spellcraftLevelUp' is a table-side choice and applies nothing here.
 */
export function upgradedArmyUnit(
	unit: ArmyUnitSpec,
	upgrades: ArmyUpgradeSpec[],
	itemIndex: Record<string, ArmyItemSpec>
): ArmyUnitSpec {
	if (upgrades.length === 0) return unit;
	let stats = unit.stats;
	let classes = unit.classes;
	let traits = unit.traits ?? [];
	let skills = unit.skills;
	let combatArts = unit.combatArts;
	let stratagems = unit.stratagems;
	let inventory = unit.inventory;
	let inventorySpace = unit.inventorySpace;
	for (const upgrade of upgrades) {
		for (const effect of upgrade.effects) {
			switch (effect.kind) {
				case 'stat': {
					let applied = effect.changes;
					const instead = effect.insteadIfTrait;
					if (instead && traits.some((ref) => ref.id === instead.traitId)) {
						applied = instead.changes;
					}
					const extra = effect.extraIfClasses;
					if (extra && extra.classIds.some((classId) => classes.includes(classId))) {
						const merged = { ...applied };
						for (const key of Object.keys(extra.changes) as ArmyStatKey[]) {
							merged[key] = (merged[key] ?? 0) + (extra.changes[key] ?? 0);
						}
						applied = merged;
					}
					const next = { ...stats };
					for (const key of Object.keys(applied) as ArmyStatKey[]) {
						const value = next[key];
						if (value !== null) next[key] = value + (applied[key] ?? 0);
					}
					stats = next;
					break;
				}
				case 'class':
					if (!classes.includes(effect.classId)) {
						classes = [...classes, effect.classId];
					}
					break;
				case 'trait':
					traits = bumpLeveledRef(traits, {
						id: effect.traitId,
						level: effect.level,
						dynamicValue: effect.dynamicValue
					});
					break;
				case 'skill':
					skills = bumpLeveledRef(skills, { id: effect.skillId, level: effect.level });
					break;
				case 'combatArt':
					combatArts = bumpLeveledRef(combatArts, { id: effect.artId, level: effect.level });
					break;
				case 'item':
					inventory = [...(inventory ?? []), { id: effect.itemId, qty: 1 }];
					break;
				case 'replacePrimaryWeapon': {
					const slots = inventory ?? [];
					const primaryIndex = slots.findIndex((slot) => itemIndex[slot.id]?.category === 'weapon');
					const replacement = { id: effect.itemId, qty: 1 };
					inventory =
						primaryIndex === -1
							? [...slots, replacement]
							: slots.map((slot, index) => (index === primaryIndex ? replacement : slot));
					break;
				}
				case 'pouch':
					inventorySpace = (inventorySpace ?? 0) + 2;
					break;
				case 'stratagem': {
					const current = stratagems ?? [];
					const missing = effect.stratagemIds.filter((id) => !current.includes(id));
					if (missing.length > 0) stratagems = [...current, ...missing];
					break;
				}
				case 'spellcraftLevelUp':
					break;
			}
		}
	}
	return {
		...unit,
		stats,
		classes,
		traits,
		skills,
		combatArts,
		stratagems,
		inventory,
		inventorySpace
	};
}

/** Why an upgrade cannot be picked for an entry right now, when it cannot. */
export type ArmyUpgradeBlock = 'locked' | 'owned' | 'slots' | 'limit' | 'requirement' | 'max-level';

/**
 * Block reason for picking an upgrade for an entry: already owned by this
 * copy, no free slot, the per-army limit is reached, the unit misses the
 * class requirement, or every level-up effect already sits at max level.
 */
export function entryUpgradeBlock(
	entries: ArmyEntry[],
	entryId: string,
	upgrade: ArmyUpgradeSpec,
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>,
	rules: ArmyRulesIndexes
): ArmyUpgradeBlock | null {
	const entry = entries.find((candidate) => candidate.id === entryId);
	const unit = units.find((candidate) => candidate.id === entry?.unitId);
	if (!entry || !unit) return 'slots';
	if (unit.upgradesLocked) return 'locked';
	const picked = (entry.upgrades ?? [])
		.map((id) => upgradeIndex[id])
		.filter((pickedUpgrade): pickedUpgrade is ArmyUpgradeSpec => pickedUpgrade !== undefined);
	if (picked.some((pickedUpgrade) => pickedUpgrade.id === upgrade.id)) return 'owned';
	if (picked.length >= upgradeSlotsFor(upgradedArmyUnit(unit, picked, {}), picked)) {
		return 'slots';
	}
	if (upgrade.limit !== undefined) {
		const total = entries.reduce(
			(sum, candidate) => sum + (candidate.upgrades ?? []).filter((id) => id === upgrade.id).length,
			0
		);
		if (total >= upgrade.limit) return 'limit';
	}
	if (upgrade.requirement) {
		const { classes: required, notTraits } = upgrade.requirement;
		if (required && !required.some((classId) => unit.classes.includes(classId))) {
			return 'requirement';
		}
		if (notTraits && notTraits.some((traitId) => unit.traits?.some((ref) => ref.id === traitId))) {
			return 'requirement';
		}
	}
	const upgraded = upgradedArmyUnit(unit, picked, {});
	const levelEffects = upgrade.effects.filter(
		(effect) =>
			effect.kind === 'trait' ||
			effect.kind === 'skill' ||
			effect.kind === 'combatArt' ||
			effect.kind === 'spellcraftLevelUp'
	);
	if (levelEffects.length > 0) {
		const maxed = levelEffects.every((effect) => {
			if (effect.kind === 'spellcraftLevelUp') {
				// No spellcraft to advance counts as maxed - nothing to pick.
				return (upgraded.spellcrafts ?? []).every(
					(ref) => ref.level >= armyRulesMaxLevel(rules.spellcrafts[ref.id])
				);
			}
			const refs =
				effect.kind === 'trait'
					? (upgraded.traits ?? [])
					: effect.kind === 'skill'
						? (upgraded.skills ?? [])
						: (upgraded.combatArts ?? []);
			const index =
				effect.kind === 'trait'
					? rules.traits
					: effect.kind === 'skill'
						? rules.skills
						: rules.combatArts;
			const id =
				effect.kind === 'trait'
					? effect.traitId
					: effect.kind === 'skill'
						? effect.skillId
						: effect.artId;
			const ref = refs.find((candidate) => candidate.id === id);
			if (!ref) return false;
			return ref.level >= armyRulesMaxLevel(index[id]);
		});
		if (maxed) return 'max-level';
	}
	return null;
}

/** Adds an upgrade to an entry unless blocked (see entryUpgradeBlock). */
export function addEntryUpgrade(
	entries: ArmyEntry[],
	entryId: string,
	upgrade: ArmyUpgradeSpec,
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>,
	rules: ArmyRulesIndexes
): ArmyEntry[] {
	if (entryUpgradeBlock(entries, entryId, upgrade, units, upgradeIndex, rules) !== null) {
		return entries;
	}
	return entries.map((entry) =>
		entry.id === entryId ? { ...entry, upgrades: [...(entry.upgrades ?? []), upgrade.id] } : entry
	);
}

/** Removes one upgrade from an entry. */
export function removeEntryUpgrade(
	entries: ArmyEntry[],
	entryId: string,
	upgradeId: string
): ArmyEntry[] {
	return entries.map((entry) =>
		entry.id === entryId && entry.upgrades?.includes(upgradeId)
			? { ...entry, upgrades: entry.upgrades.filter((id) => id !== upgradeId) }
			: entry
	);
}

const ROMAN_VALUES: [number, string][] = [
	[10, 'X'],
	[9, 'IX'],
	[5, 'V'],
	[4, 'IV'],
	[1, 'I']
];

/** Roman numeral for a rules level (the game prints Fencing III, Charm II, ...). */
export function romanNumeral(level: number): string {
	let remaining = level;
	let numeral = '';
	for (const [value, symbol] of ROMAN_VALUES) {
		while (remaining >= value) {
			numeral += symbol;
			remaining -= value;
		}
	}
	return numeral;
}

/** Display title of a rules entry - a roman level suffix when it is leveled. */
export function armyRulesTitle(name: string, level?: number): string {
	return level === undefined ? name : name + ' ' + romanNumeral(level);
}

/**
 * Fills a trait template with its concrete dynamic value. Parenthesized
 * placeholders keep their parens for display names, become the bare value in
 * rules text; a bare X always becomes the value.
 */
export function substituteArmyTemplate(
	text: string,
	value: string | undefined,
	keepParens: boolean
): string {
	if (!value) return text;
	const parenthesized = '(' + value + ')';
	return text
		.replace(/\(X\)/g, () => (keepParens ? parenthesized : value))
		.replace(/\(Element\)/g, () => (keepParens ? parenthesized : value))
		.replace(/\bX\b/g, () => value);
}

/** The popup for a class entry: its rules text as a single section. */
export function classPopupFor(entry: ArmyRulesSpec | undefined): ArmyRulesPopup | null {
	if (!entry) return null;
	return { title: entry.name, sections: [{ available: true, text: entry.description ?? [] }] };
}

function leveledSections(
	entry: ArmyRulesSpec,
	level: number,
	transform?: (text: string) => string
): ArmyRulesSection[] {
	const apply = (segments: ArmyTextSegment[]): ArmyTextSegment[] =>
		transform
			? segments.map((segment) => ({ ...segment, text: transform(segment.text) }))
			: segments;
	const levels = entry.levels ?? {};
	const numbers = Object.keys(levels)
		.map(Number)
		.sort((a, b) => a - b);
	if (numbers.length === 0) {
		return [{ available: true, text: apply(entry.description ?? []) }];
	}
	return numbers.map((entryLevel) => ({
		level: entryLevel,
		available: entryLevel <= level,
		text: apply(levels[entryLevel])
	}));
}

/**
 * The popup for a leveled rules reference (skill, trait, combat art): every
 * catalog level as its own section, accessible up to the unit's level and
 * greyed out beyond it. Null for a missing entry.
 */
export function skillPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmySkillRef
): ArmyRulesPopup | null {
	if (!entry) return null;
	return {
		title: armyRulesTitle(entry.name, ref.level),
		sections: leveledSections(entry, ref.level)
	};
}

/** The popup for a unit's combat-art reference; the level is its highest accessible one. */
export function combatArtPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmyCombatArtRef
): ArmyRulesPopup | null {
	if (!entry) return null;
	return {
		title: armyRulesTitle(entry.name, ref.level),
		sections: leveledSections(entry, ref.level)
	};
}

/** The popup for a unit's trait reference, placeholders filled; null for a missing entry. */
export function traitPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmyTraitRef
): ArmyRulesPopup | null {
	if (!entry) return null;
	const value = ref.dynamicValue ?? ref.dynamicElements?.join(', ');
	return {
		title: armyRulesTitle(substituteArmyTemplate(entry.name, value, true), ref.level),
		sections: leveledSections(entry, ref.level, (text) =>
			substituteArmyTemplate(text, value, false)
		)
	};
}

/** The rules indexes the popup stack resolves its links against. */
export type ArmyRulesIndexes = {
	classes: Record<string, ArmyRulesSpec>;
	skills: Record<string, ArmyRulesSpec>;
	traits: Record<string, ArmyRulesSpec>;
	combatArts: Record<string, ArmyRulesSpec>;
	spellcrafts: Record<string, ArmyRulesSpec>;
};

/** Resolves a rules link to a popup; null when the target is not in the imported content. */
export function rulesLinkPopup(
	indexes: ArmyRulesIndexes,
	link: ArmyRulesLink
): ArmyRulesPopup | null {
	const index =
		link.type === 'class'
			? indexes.classes
			: link.type === 'skill'
				? indexes.skills
				: link.type === 'trait'
					? indexes.traits
					: link.type === 'combat-art'
						? indexes.combatArts
						: undefined;
	const entry = index?.[link.id];
	if (!entry) return null;
	const levels = entry.levels ?? {};
	const numbers = Object.keys(levels)
		.map(Number)
		.sort((a, b) => a - b);
	const sections: ArmyRulesSection[] =
		numbers.length > 0
			? numbers.map((level) => ({ level, available: true, text: levels[level] }))
			: [{ available: true, text: entry.description ?? [] }];
	return { title: entry.name, sections };
}

/** Popup order of the elements: Elder first, then the rulebook order. */
const ELEMENT_ORDER = ['elder', 'air', 'earth', 'divine', 'fire', 'profane', 'water'];

/** The trait carrying a unit's element affinities. */
const AFFINITY_TRAIT_ID = 'affinity--element';

/** Element ids a unit can cast, gathered from its Affinity trait references. */
export function affinityElements(unit: ArmyUnitSpec): string[] {
	const elements = new Set<string>();
	for (const ref of unit.traits ?? []) {
		if (ref.id !== AFFINITY_TRAIT_ID) continue;
		for (const element of ref.dynamicElements ?? []) elements.add(element.toLowerCase());
		const value = ref.dynamicValue?.toLowerCase();
		if (value && value !== 'any') elements.add(value);
	}
	return [...elements];
}

/**
 * Display of a cost-like value against the unit's stats (spell PW/STK and
 * item T/STK columns): 'INT (12) -3', 'T (10) +2', 'STA (2)' or the fixed
 * text ('8', '-', 'x', 'QTY', ...).
 */
export function spellCostDisplay(
	cost: ArmySpellCost | undefined,
	stats: ArmyStats
): string | undefined {
	if (!cost) return undefined;
	if (cost.fixed !== undefined) return cost.fixed;
	if (!cost.stat) return undefined;
	const value = stats[cost.stat];
	let display = value === null ? cost.stat : cost.stat + ' (' + value + ')';
	if (cost.modifier !== undefined && cost.modifier !== 0) {
		display += cost.modifier > 0 ? ' +' + cost.modifier : ' -' + Math.abs(cost.modifier);
	}
	return display;
}

/** Display of a reach bracket: '0-20": 0', '25-48: -6' or a plain reach '2'. */
export function rangeBracketDisplay(bracket: ArmyRangeBracket): string {
	if (!bracket.range.includes('-')) return bracket.range;
	const modifier = bracket.modifier > 0 ? '+' + bracket.modifier : String(bracket.modifier);
	return bracket.range + ': ' + modifier;
}

/** Value lines of the reach box: brackets, then AoE template, then raw text. */
export function reachBoxLines(reach: ArmyItemReach | undefined): string[] {
	if (!reach) return ['–'];
	const lines = reach.brackets.map(rangeBracketDisplay);
	if (reach.aoe) lines.push('AoE: ' + reach.aoe);
	if (reach.text) lines.push(reach.text);
	return lines.length > 0 ? lines : ['–'];
}

/** Space an inventory occupies: each copy counts its weight, weightless items are free. */
export function inventorySpaceUsed(
	slots: ArmyInventorySlot[],
	index: Record<string, ArmyItemSpec>
): number {
	return slots.reduce((sum, slot) => sum + (index[slot.id]?.weight ?? 0) * slot.qty, 0);
}

/** Display type of an item: 'Natural and Melee, Weapon' or just 'Accessory'. */
export function itemTypeDisplay(category: ArmyItemCategory, mode?: string): string {
	const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
	if (!mode) return categoryLabel;
	const modeLabel = mode
		.split('-')
		.map((word, index) =>
			index > 0 && word === 'and' ? word : word.charAt(0).toUpperCase() + word.slice(1)
		)
		.join(' ');
	return modeLabel + ', ' + categoryLabel;
}

/**
 * The popup for a unit's spellcraft reference: the spells the unit can
 * actually cast - its group, at or below its level, in its affinity
 * elements - as rows sorted Elder-first, then level, then name.
 */
export function spellcraftPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmySpellcraftRef,
	unit: ArmyUnitSpec,
	stats: ArmyStats,
	spells: ArmySpellSpec[]
): ArmyRulesPopup | null {
	if (!entry) return null;
	const elements = new Set(affinityElements(unit));
	const rank = (element: string): number => {
		const index = ELEMENT_ORDER.indexOf(element);
		return index === -1 ? ELEMENT_ORDER.length : index;
	};
	const rows = spells
		.filter(
			(spell) => spell.group === ref.id && spell.level <= ref.level && elements.has(spell.element)
		)
		.sort(
			(a, b) =>
				rank(a.element) - rank(b.element) || a.level - b.level || a.name.localeCompare(b.name)
		)
		.map((spell) => ({
			element: spell.element,
			elementName: spell.element.charAt(0).toUpperCase() + spell.element.slice(1),
			level: spell.level,
			name: spell.name,
			effect: spell.effect,
			pw: spellCostDisplay(spell.pw, stats),
			type: spell.type,
			rch: spell.rch,
			stk: spellCostDisplay(spell.stk, stats)
		}));
	return { title: armyRulesTitle(entry.name, ref.level), sections: [], spells: rows };
}

/** Display order of the stratagem types: rulebook categories, most common first. */
const STRATAGEM_TYPE_ORDER: ArmyStratagemType[] = ['authority', 'subterfuge', 'tribe'];

/**
 * A unit's stratagem ids resolved against the catalog, sorted by type
 * (Authority, Subterfuge, Tribe), then by name; unknown ids are skipped.
 */
export function stratagemsFor(
	ids: string[],
	index: Record<string, ArmyStratagemSpec>
): ArmyStratagemSpec[] {
	return ids
		.map((id) => index[id])
		.filter((entry): entry is ArmyStratagemSpec => entry !== undefined)
		.sort(
			(a, b) =>
				STRATAGEM_TYPE_ORDER.indexOf(a.type) - STRATAGEM_TYPE_ORDER.indexOf(b.type) ||
				a.name.localeCompare(b.name)
		);
}

/** Rider stats when mounted: non-null mount stats override, statChanges add on top. */
export function effectiveMountedStats(unit: ArmyUnitSpec, mount: ArmyUnitSpec): ArmyStats {
	const stats = { ...unit.stats };
	for (const key of ARMY_STAT_KEYS) {
		const override = mount.stats[key];
		if (override !== null) stats[key] = override;
	}
	for (const key of ARMY_STAT_KEYS) {
		const change = mount.statChanges?.[key];
		if (change !== undefined && stats[key] !== null) {
			stats[key] = (stats[key] as number) + change;
		}
	}
	return stats;
}

/** Flips the mount on one copy; units without a mount option stay untouched. */
export function toggleArmyMount(
	entries: ArmyEntry[],
	entryId: string,
	units: ArmyUnitSpec[]
): ArmyEntry[] {
	const entry = entries.find((candidate) => candidate.id === entryId);
	if (!entry) return entries;
	const unit = units.find((candidate) => candidate.id === entry.unitId);
	if (!unit?.mount) return entries;
	return entries.map((candidate) =>
		candidate.id === entryId ? { ...candidate, mounted: !candidate.mounted } : candidate
	);
}

/** True once the army costs strictly more than the format allows. */
export function isOverArmyLimit(points: number, format: ArmyFormat): boolean {
	return points > ARMY_FORMAT_POINTS[format];
}

/** Unit content as loaded: exclusive units per faction plus the neutral pool. */
export type ArmyUnitContent = {
	factionUnits: Partial<Record<ArmyFactionId, ArmyUnitSpec[]>>;
	neutralUnits: ArmyUnitSpec[];
	mounts: ArmyUnitSpec[];
};

/** Monster factions cannot recruit from the neutral pool. */
export const NON_NEUTRAL_FACTION_IDS: ArmyFactionId[] = ['oni-clans', 'goblin-wartribes'];

/** All units available to a faction: its exclusives plus the neutral pool. */
export function unitsForFaction(
	factionId: ArmyFactionId,
	content: ArmyUnitContent
): ArmyUnitSpec[] {
	const exclusives = content.factionUnits[factionId] ?? [];
	if (NON_NEUTRAL_FACTION_IDS.includes(factionId)) return exclusives;
	return [...exclusives, ...content.neutralUnits];
}
