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

/**
 * A copy's live Life and stamina during a run. Absent from the run's vitality map means
 * untouched, i.e. full. `hp` may exceed the model's base HP (overheal, up to double the
 * base); `sta` never exceeds its base.
 */
export type UnitVitality = { hp: number; sta: number };

/**
 * The size ladder, smallest first. The order is rules-relevant: upgrades gate
 * on "Size Medium or smaller" and traits on "two or more Sizes larger", so
 * sizes are compared by rank rather than by name. Colossal and Epic only occur
 * on the producer's faction-less summons, but they are real rungs (spell texts
 * exclude exactly those two from Knockback) and keep the ladder total.
 */
export const ARMY_UNIT_SIZES = [
	'small',
	'medium',
	'large',
	'huge',
	'gigantic',
	'colossal',
	'epic'
] as const;

export type ArmyUnitSize = (typeof ARMY_UNIT_SIZES)[number];

/** Position on the size ladder; higher means larger. */
export function armyUnitSizeRank(size: ArmyUnitSize): number {
	return ARMY_UNIT_SIZES.indexOf(size);
}

/** Whether a model is the given size or smaller ("Size Medium or smaller"). */
export function armyUnitSizeAtMost(size: ArmyUnitSize, max: ArmyUnitSize): boolean {
	return armyUnitSizeRank(size) <= armyUnitSizeRank(max);
}

/** The size as the rulebook prints it. */
export function armyUnitSizeLabel(size: ArmyUnitSize): string {
	return size.charAt(0).toUpperCase() + size.slice(1);
}

/** A reference from rules text to another rules entry, e.g. `(Knockdown)[trait.KNOCKDOWN]`. */
export type ArmyRulesLink = {
	type: string;
	id: string;
	/** The level a suffixed link names (`[trait.POISON.II]`); higher levels grey out. */
	level?: number;
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
	| { kind: 'costReduction'; amount: number }
	| { kind: 'choice'; options: ArmyUpgradeOption[] };

/** One selectable option of a choice upgrade. */
export type ArmyUpgradeOption = {
	id: string;
	label: string;
	/** Stat changes applied when this option is chosen. */
	statChanges?: Partial<Record<ArmyStatKey, number>>;
	/** Extra inventory space granted by this option. */
	inventorySpace?: number;
	/** Option inscribes a chosen inventory item: Wgt -1, Strike +1. */
	inscribeItem?: { except: string[] };
	/** Grants a trait; elements merge into an existing reference of the trait. */
	grantTrait?: { traitId: string; dynamicElements: string[] };
	/** Replaces one of the unit's Affinity elements with this element. */
	replaceAffinity?: { element: string };
};

/**
 * The player's pick for a choice upgrade, plus the target details when the
 * option needs one (the inscribed item, the replaced Affinity element).
 */
export type ArmyUpgradeChoice = { option: string; itemId?: string; removedElement?: string };

/** Requirements parsed from the upgrade's description. */
export type ArmyUpgradeRequirement = {
	/** The unit needs at least one of these classes. */
	classes?: string[];
	/** The unit must not have any of these traits. */
	notTraits?: string[];
	/** The unit must be this size or smaller ("Size Medium or smaller"). */
	maxSize?: ArmyUnitSize;
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
	/** Position on the size ladder; every model in the producer data has one. */
	size: ArmyUnitSize;
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
	/**
	 * Riders only: the mount this unit may take. Points and size are carried
	 * here as well as in the mount catalog so army math and the upgrade gates
	 * can resolve a mounted model without the mounts list.
	 */
	mount?: { unitId: string; points: number; size: ArmyUnitSize };
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
	/** Spellcraft chosen per spellcraftLevelUp upgrade (upgrade id -> group id). */
	spellcraftChoices?: Record<string, string>;
	/** Option picked per choice upgrade (upgrade id -> option and target item). */
	upgradeChoices?: Record<string, ArmyUpgradeChoice>;
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
	/** The size the model counts as - the mount's size while mounted. */
	effectiveSize: ArmyUnitSize;
	/** The unit with all picked upgrade effects applied. */
	upgradedUnit: ArmyUnitSpec;
	/** The picked upgrades, resolved. */
	upgrades: ArmyUpgradeSpec[];
	/** Items modified by picked upgrades (e.g. inscribed), keyed by item id. */
	itemOverrides: Record<string, ArmyItemSpec>;
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

/** Whether an item can be inscribed: a weapon or shield with weight to lose. */
export function isInscribableItem(
	item: ArmyItemSpec | undefined,
	except: string[]
): item is ArmyItemSpec {
	if (!item) return false;
	if (except.includes(item.id)) return false;
	if (item.category !== 'weapon' && item.category !== 'shield') return false;
	return (item.weight ?? 0) > 0;
}

/** The unit's inscribable inventory items for one inscribe option. */
export function inscribableItems(
	unit: ArmyUnitSpec,
	itemIndex: Record<string, ArmyItemSpec>,
	except: string[]
): ArmyItemSpec[] {
	return (unit.inventory ?? [])
		.map((slot) => itemIndex[slot.id])
		.filter((item): item is ArmyItemSpec => isInscribableItem(item, except));
}

/** Whether a choice option is usable for the unit right now. */
export function upgradeOptionUsable(
	option: ArmyUpgradeOption,
	unit: ArmyUnitSpec,
	itemIndex: Record<string, ArmyItemSpec>
): boolean {
	if (option.statChanges || option.inventorySpace) return true;
	if (option.inscribeItem) {
		return inscribableItems(unit, itemIndex, option.inscribeItem.except).length > 0;
	}
	const elements = affinityElements(unit);
	if (option.grantTrait) {
		// Useless once the unit already holds every element the option grants.
		return !option.grantTrait.dynamicElements.every((element) =>
			elements.includes(element.toLowerCase())
		);
	}
	if (option.replaceAffinity) {
		// Needs an Affinity to change, and the new element must be a change.
		return elements.length > 0 && !elements.includes(option.replaceAffinity.element.toLowerCase());
	}
	return false;
}

/** The item after inscription: Strike +1 (stat modifier or numeric fixed), Wgt -1. */
export function inscribedItem(item: ArmyItemSpec): ArmyItemSpec {
	const next: ArmyItemSpec = { ...item, weight: Math.max(0, (item.weight ?? 0) - 1) };
	if (item.stk) {
		if ('stat' in item.stk) {
			next.stk = { ...item.stk, modifier: (item.stk.modifier ?? 0) + 1 };
		} else if (item.stk.fixed !== undefined && /^\d+$/.test(item.stk.fixed)) {
			next.stk = { fixed: String(Number(item.stk.fixed) + 1) };
		}
	}
	return next;
}

/** Item modifications from picked choice upgrades (inscribed items), by item id. */
export function upgradeItemOverrides(
	upgrades: ArmyUpgradeSpec[],
	choices: Record<string, ArmyUpgradeChoice>,
	itemIndex: Record<string, ArmyItemSpec>
): Record<string, ArmyItemSpec> {
	const overrides: Record<string, ArmyItemSpec> = {};
	for (const upgrade of upgrades) {
		for (const effect of upgrade.effects) {
			if (effect.kind !== 'choice') continue;
			const choice = choices[upgrade.id];
			if (!choice?.itemId) continue;
			const option = effect.options.find((candidate) => candidate.id === choice.option);
			if (!option?.inscribeItem) continue;
			const item = itemIndex[choice.itemId];
			if (item) overrides[item.id] = inscribedItem(item);
		}
	}
	return overrides;
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
		const upgradedUnit = upgradedArmyUnit(
			unit,
			upgrades,
			itemIndex,
			entry.spellcraftChoices ?? {},
			entry.upgradeChoices ?? {}
		);
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
		const effectiveSize = effectiveUnitSize(upgradedUnit, mounted);
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
				effectiveSize,
				upgradedUnit,
				upgrades,
				itemOverrides: upgradeItemOverrides(upgrades, entry.upgradeChoices ?? {}, itemIndex)
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

/** A roster (tournament format) equipment pick: copies of one upgrade in the pool. */
export type ArmyRosterPick = { id: string; qty: number };

/**
 * Adds one copy of an upgrade to the roster pool unless the upgrade is not
 * available to the faction or its per-army limit is reached.
 */
export function addRosterPick(
	picks: ArmyRosterPick[],
	upgradeId: string,
	available: ArmyUpgradeSpec[]
): ArmyRosterPick[] {
	const upgrade = available.find((candidate) => candidate.id === upgradeId);
	if (!upgrade) return picks;
	const qty = picks.find((pick) => pick.id === upgradeId)?.qty ?? 0;
	if (upgrade.limit !== undefined && qty >= upgrade.limit) return picks;
	return picks.some((pick) => pick.id === upgradeId)
		? picks.map((pick) => (pick.id === upgradeId ? { ...pick, qty: pick.qty + 1 } : pick))
		: [...picks, { id: upgradeId, qty: 1 }];
}

/** Removes one copy of a roster pool upgrade (the most recently added). */
export function removeRosterPick(picks: ArmyRosterPick[], upgradeId: string): ArmyRosterPick[] {
	return picks
		.map((pick) => (pick.id === upgradeId ? { ...pick, qty: pick.qty - 1 } : pick))
		.filter((pick) => pick.qty > 0);
}

/** Total points of the roster equipment pool. */
export function rosterPickPoints(
	picks: ArmyRosterPick[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>
): number {
	return picks.reduce((total, pick) => total + (upgradeIndex[pick.id]?.cost ?? 0) * pick.qty, 0);
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

/** Grants a trait; dynamic elements merge into an existing reference of it. */
function grantTraitRef(
	traits: ArmyTraitRef[],
	grant: { traitId: string; dynamicElements: string[] }
): ArmyTraitRef[] {
	const existing = traits.find((candidate) => candidate.id === grant.traitId);
	if (!existing) {
		return [
			...traits,
			{ id: grant.traitId, level: 1, dynamicElements: [...grant.dynamicElements] }
		];
	}
	return traits.map((candidate) => {
		if (candidate.id !== grant.traitId) return candidate;
		const merged = [...(candidate.dynamicElements ?? [])];
		for (const element of grant.dynamicElements) {
			if (!merged.some((held) => held.toLowerCase() === element.toLowerCase())) {
				merged.push(element);
			}
		}
		return { ...candidate, dynamicElements: merged };
	});
}

/** Swaps one element of the unit's Affinity trait for another. */
function replaceAffinityElement(
	traits: ArmyTraitRef[],
	removed: string,
	added: string
): ArmyTraitRef[] {
	let replaced = false;
	return traits.map((candidate) => {
		if (replaced || candidate.id !== AFFINITY_TRAIT_ID) return candidate;
		const elements = candidate.dynamicElements ?? [];
		const index = elements.findIndex((element) => element.toLowerCase() === removed.toLowerCase());
		if (index === -1) return candidate;
		replaced = true;
		return {
			...candidate,
			dynamicElements: elements.map((element, position) => (position === index ? added : element))
		};
	});
}

/**
 * The unit with all picked upgrade effects applied: stat boosts, granted
 * classes/traits/skills/combat arts, items, primary weapon replacement
 * (the first weapon in the inventory), pouch space and stratagems.
 * 'spellcraftLevelUp' raises the spellcraft the player chose for that
 * upgrade (spellcraftChoices maps upgrade id -> spellcraft group id);
 * choice options apply their picked effect, e.g. granting an Affinity
 * element or replacing one (upgradeChoices maps upgrade id -> choice).
 */
export function upgradedArmyUnit(
	unit: ArmyUnitSpec,
	upgrades: ArmyUpgradeSpec[],
	itemIndex: Record<string, ArmyItemSpec>,
	spellcraftChoices: Record<string, string> = {},
	upgradeChoices: Record<string, ArmyUpgradeChoice> = {}
): ArmyUnitSpec {
	if (upgrades.length === 0) return unit;
	let stats = unit.stats;
	let classes = unit.classes;
	let traits = unit.traits ?? [];
	let skills = unit.skills;
	let combatArts = unit.combatArts;
	let spellcrafts = unit.spellcrafts;
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
				case 'spellcraftLevelUp': {
					const chosen = spellcraftChoices[upgrade.id];
					if (chosen) {
						spellcrafts = (spellcrafts ?? []).map((ref) =>
							ref.id === chosen ? { ...ref, level: ref.level + 1 } : ref
						);
					}
					break;
				}
				case 'choice': {
					// The inscribed-item half applies through upgradeItemOverrides.
					const choice = upgradeChoices[upgrade.id];
					const option = choice
						? effect.options.find((candidate) => candidate.id === choice.option)
						: undefined;
					if (!option) break;
					if (option.statChanges) {
						const next = { ...stats };
						for (const key of Object.keys(option.statChanges) as ArmyStatKey[]) {
							const value = next[key];
							if (value !== null) next[key] = value + (option.statChanges[key] ?? 0);
						}
						stats = next;
					}
					if (option.inventorySpace) {
						inventorySpace = (inventorySpace ?? 0) + option.inventorySpace;
					}
					if (option.grantTrait) {
						traits = grantTraitRef(traits, option.grantTrait);
					}
					if (option.replaceAffinity && choice?.removedElement !== undefined) {
						traits = replaceAffinityElement(
							traits,
							choice.removedElement,
							option.replaceAffinity.element
						);
					}
					break;
				}
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
		spellcrafts,
		stratagems,
		inventory,
		inventorySpace
	};
}

/** Why an upgrade cannot be picked for an entry right now, when it cannot. */
export type ArmyUpgradeBlock = 'locked' | 'owned' | 'slots' | 'limit' | 'requirement' | 'max-level';

/**
 * Block reason for picking an upgrade for an entry: already owned by this
 * copy, no free slot, the per-army limit is reached, the unit misses a
 * requirement (class, forbidden trait, size ceiling), or every level-up
 * effect already sits at max level.
 */
export function entryUpgradeBlock(
	entries: ArmyEntry[],
	entryId: string,
	upgrade: ArmyUpgradeSpec,
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>,
	rules: ArmyRulesIndexes,
	spells: ArmySpellSpec[] = [],
	itemIndex: Record<string, ArmyItemSpec> = {}
): ArmyUpgradeBlock | null {
	const entry = entries.find((candidate) => candidate.id === entryId);
	const unit = units.find((candidate) => candidate.id === entry?.unitId);
	if (!entry || !unit) return 'slots';
	if (unit.upgradesLocked) return 'locked';
	const picked = (entry.upgrades ?? [])
		.map((id) => upgradeIndex[id])
		.filter((pickedUpgrade): pickedUpgrade is ArmyUpgradeSpec => pickedUpgrade !== undefined);
	if (picked.some((pickedUpgrade) => pickedUpgrade.id === upgrade.id)) return 'owned';
	const choices = entry.spellcraftChoices ?? {};
	const upgradeChoices = entry.upgradeChoices ?? {};
	if (
		picked.length >=
		upgradeSlotsFor(upgradedArmyUnit(unit, picked, itemIndex, choices, upgradeChoices), picked)
	) {
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
		const { classes: required, notTraits, maxSize } = upgrade.requirement;
		if (required && !required.some((classId) => unit.classes.includes(classId))) {
			return 'requirement';
		}
		if (notTraits && notTraits.some((traitId) => unit.traits?.some((ref) => ref.id === traitId))) {
			return 'requirement';
		}
		if (maxSize && !armyUnitSizeAtMost(effectiveUnitSize(unit, entry.mounted === true), maxSize)) {
			return 'requirement';
		}
	}
	const upgraded = upgradedArmyUnit(unit, picked, itemIndex, choices, upgradeChoices);
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
				// No spellcraft to advance counts as maxed - nothing to pick (an
				// empty list is vacuously "all at cap"). The cap is the group's
				// highest spell in the unit's affinity elements.
				return (upgraded.spellcrafts ?? []).every(
					(ref) => ref.level >= spellcraftLevelCap(ref.id, upgraded, spells)
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
	for (const effect of upgrade.effects) {
		if (effect.kind !== 'choice') continue;
		if (!effect.options.some((option) => upgradeOptionUsable(option, upgraded, itemIndex))) {
			return 'requirement';
		}
	}
	return null;
}

/**
 * Player selections made while adding an upgrade (spellcraft, option, item,
 * replaced Affinity element).
 */
export type ArmyUpgradeSelection = {
	spellcraftId?: string;
	optionId?: string;
	itemId?: string;
	removedElement?: string;
};

/**
 * Adds an upgrade to an entry unless blocked (see entryUpgradeBlock).
 * spellcraftLevelUp upgrades resolve their target here: the only candidate
 * is picked automatically, otherwise selection.spellcraftId must name one of
 * the unit's upgradable spellcrafts. Choice upgrades need selection.optionId
 * (plus selection.itemId for an inscribe option, validated against the
 * unit's inventory, and selection.removedElement for an Affinity
 * replacement when the unit has several elements - a single element is
 * replaced automatically).
 */
export function addEntryUpgrade(
	entries: ArmyEntry[],
	entryId: string,
	upgrade: ArmyUpgradeSpec,
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>,
	rules: ArmyRulesIndexes,
	spells: ArmySpellSpec[] = [],
	itemIndex: Record<string, ArmyItemSpec> = {},
	selection: ArmyUpgradeSelection = {}
): ArmyEntry[] {
	if (
		entryUpgradeBlock(entries, entryId, upgrade, units, upgradeIndex, rules, spells, itemIndex) !==
		null
	) {
		return entries;
	}
	const entry = entries.find((candidate) => candidate.id === entryId);
	const unit = units.find((candidate) => candidate.id === entry?.unitId);
	if (!entry || !unit) return entries;
	const picked = (entry.upgrades ?? [])
		.map((id) => upgradeIndex[id])
		.filter((candidate): candidate is ArmyUpgradeSpec => candidate !== undefined);
	const upgraded = upgradedArmyUnit(
		unit,
		picked,
		itemIndex,
		entry.spellcraftChoices ?? {},
		entry.upgradeChoices ?? {}
	);
	let spellcraftChoice: string | undefined;
	if (upgrade.effects.some((effect) => effect.kind === 'spellcraftLevelUp')) {
		const upgradable = (upgraded.spellcrafts ?? []).filter((ref) => {
			const cap = spellcraftLevelCap(ref.id, upgraded, spells);
			return cap > 0 && ref.level < cap;
		});
		if (upgradable.length === 1) {
			spellcraftChoice = upgradable[0].id;
		} else if (
			selection.spellcraftId !== undefined &&
			upgradable.some((ref) => ref.id === selection.spellcraftId)
		) {
			spellcraftChoice = selection.spellcraftId;
		} else {
			return entries;
		}
	}
	let upgradeChoice: ArmyUpgradeChoice | undefined;
	const choiceEffect = upgrade.effects.find(
		(effect): effect is Extract<ArmyUpgradeEffect, { kind: 'choice' }> => effect.kind === 'choice'
	);
	if (choiceEffect) {
		const option = choiceEffect.options.find((candidate) => candidate.id === selection.optionId);
		if (!option || !upgradeOptionUsable(option, upgraded, itemIndex)) return entries;
		if (option.inscribeItem) {
			const item = selection.itemId ? itemIndex[selection.itemId] : undefined;
			if (
				!selection.itemId ||
				!isInscribableItem(item, option.inscribeItem.except) ||
				!(upgraded.inventory ?? []).some((slot) => slot.id === selection.itemId)
			) {
				return entries;
			}
			upgradeChoice = { option: option.id, itemId: selection.itemId };
		} else if (option.replaceAffinity) {
			// The only Affinity is replaced automatically; otherwise the
			// player must pick which of the unit's elements goes.
			const candidates = affinityElements(upgraded);
			let removedElement: string | undefined;
			if (candidates.length === 1) {
				removedElement = candidates[0];
			} else if (
				selection.removedElement !== undefined &&
				candidates.includes(selection.removedElement.toLowerCase())
			) {
				removedElement = selection.removedElement.toLowerCase();
			} else {
				return entries;
			}
			upgradeChoice = { option: option.id, removedElement };
		} else {
			upgradeChoice = { option: option.id };
		}
	}
	return entries.map((candidate) => {
		if (candidate.id !== entryId) return candidate;
		const next: ArmyEntry = { ...candidate, upgrades: [...(candidate.upgrades ?? []), upgrade.id] };
		if (spellcraftChoice !== undefined) {
			next.spellcraftChoices = {
				...(candidate.spellcraftChoices ?? {}),
				[upgrade.id]: spellcraftChoice
			};
		}
		if (upgradeChoice !== undefined) {
			next.upgradeChoices = {
				...(candidate.upgradeChoices ?? {}),
				[upgrade.id]: upgradeChoice
			};
		}
		return next;
	});
}

/** Removes one upgrade from an entry, dropping its selections too. */
export function removeEntryUpgrade(
	entries: ArmyEntry[],
	entryId: string,
	upgradeId: string
): ArmyEntry[] {
	return entries.map((entry) => {
		if (entry.id !== entryId || !entry.upgrades?.includes(upgradeId)) return entry;
		const next: ArmyEntry = {
			...entry,
			upgrades: entry.upgrades.filter((id) => id !== upgradeId)
		};
		if (entry.spellcraftChoices?.[upgradeId] !== undefined) {
			const remaining = { ...entry.spellcraftChoices };
			delete remaining[upgradeId];
			next.spellcraftChoices = Object.keys(remaining).length > 0 ? remaining : undefined;
		}
		if (entry.upgradeChoices?.[upgradeId] !== undefined) {
			const remaining = { ...entry.upgradeChoices };
			delete remaining[upgradeId];
			next.upgradeChoices = Object.keys(remaining).length > 0 ? remaining : undefined;
		}
		return next;
	});
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
	if (link.level !== undefined) {
		return {
			title: armyRulesTitle(entry.name, link.level),
			sections: leveledSections(entry, link.level)
		};
	}
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

/** One spellcraft a unit could advance, for the upgrade picker's choice step. */
export type ArmySpellcraftOption = {
	id: string;
	name: string;
	level: number;
	upgradable: boolean;
};

/**
 * Highest spellcraft level a unit can reach in one group: the max spell
 * level of that group in any of the unit's affinity elements (0 when none).
 */
export function spellcraftLevelCap(
	groupId: string,
	unit: ArmyUnitSpec,
	spells: ArmySpellSpec[]
): number {
	const elements = new Set(affinityElements(unit));
	let cap = 0;
	for (const spell of spells) {
		if (spell.group !== groupId || !elements.has(spell.element)) continue;
		if (spell.level > cap) cap = spell.level;
	}
	return cap;
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

/**
 * The size a model counts as in play: while mounted it is the mount's size,
 * mirroring how the mount's stats override the rider's. A rider whose mount
 * cannot be resolved keeps its own size.
 */
export function effectiveUnitSize(unit: ArmyUnitSpec, mounted: boolean): ArmyUnitSize {
	return mounted ? (unit.mount?.size ?? unit.size) : unit.size;
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

/**
 * The picked upgrades a mount toggle would newly invalidate - today that means
 * a size-capped upgrade on a rider that takes on the size of its mount. Each
 * pick is judged as a fresh one, so the 'owned' guard stays out of the way,
 * against both the current and the toggled state; only upgrades that are legal
 * now and blocked afterwards are reported. Empty for units without a mount and
 * when unmounting, which can only relax a size ceiling.
 */
export function mountToggleConflicts(
	entries: ArmyEntry[],
	entryId: string,
	units: ArmyUnitSpec[],
	upgradeIndex: Record<string, ArmyUpgradeSpec>,
	rules: ArmyRulesIndexes,
	spells: ArmySpellSpec[] = [],
	itemIndex: Record<string, ArmyItemSpec> = {}
): ArmyUpgradeSpec[] {
	const entry = entries.find((candidate) => candidate.id === entryId);
	if (!entry) return [];
	const toggled = toggleArmyMount(entries, entryId, units);
	if (toggled === entries) return [];
	const withoutUpgrade = (base: ArmyEntry[], upgradeId: string): ArmyEntry[] =>
		base.map((candidate) =>
			candidate.id === entryId
				? { ...candidate, upgrades: (candidate.upgrades ?? []).filter((id) => id !== upgradeId) }
				: candidate
		);
	const blockIn = (base: ArmyEntry[], upgrade: ArmyUpgradeSpec): ArmyUpgradeBlock | null =>
		entryUpgradeBlock(
			withoutUpgrade(base, upgrade.id),
			entryId,
			upgrade,
			units,
			upgradeIndex,
			rules,
			spells,
			itemIndex
		);
	return (entry.upgrades ?? [])
		.map((id) => upgradeIndex[id])
		.filter((upgrade): upgrade is ArmyUpgradeSpec => upgrade !== undefined)
		.filter((upgrade) => blockIn(entries, upgrade) === null && blockIn(toggled, upgrade) !== null);
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
