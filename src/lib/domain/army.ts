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

/** A class, skill or trait entry with its rules text; shared across units. */
export type ArmyRulesSpec = {
	id: string;
	name: string;
	description: ArmyTextSegment[];
	/** Rule text per level, for levels whose text differs from the base. */
	levelText?: Record<number, ArmyTextSegment[]>;
};

/** A skill on a unit, referencing the centralized skill entry. */
export type ArmySkillRef = {
	id: string;
	level: number;
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
	/** Mounts only: additive stat bonuses/maluses applied on top of the rider. */
	statChanges?: Partial<Record<ArmyStatKey, number>>;
	mount?: { unitId: string; points: number };
	icon?: string;
};

/** A resolved rules popup: heading plus rich rule text. */
export type ArmyRulesPopup = {
	title: string;
	body: ArmyTextSegment[];
};

/** One copy of a unit in the current army - every copy is its own entry. */
export type ArmyEntry = {
	id: string;
	unitId: string;
	mounted?: boolean;
};

/** One army copy joined with its unit spec, ready for display. */
export type ArmyRosterRow = {
	entryId: string;
	unitId: string;
	name: string;
	/** Cost of this copy, including the mount when mounted. */
	points: number;
	icon?: string;
	mounted: boolean;
	mount?: ArmyUnitSpec;
	/** The rider's stats with mount overrides and changes applied when mounted. */
	effectiveStats: ArmyStats;
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

/** Joins the army entries with their unit specs for display - one row per copy. */
export function resolveArmyEntries(
	entries: ArmyEntry[],
	units: ArmyUnitSpec[],
	mounts: ArmyUnitSpec[]
): ArmyRosterRow[] {
	return entries.flatMap((entry) => {
		const unit = units.find((candidate) => candidate.id === entry.unitId);
		if (!unit) return [];
		const mounted = entry.mounted === true && unit.mount !== undefined;
		const mountSpec = unit.mount;
		const mount = mountSpec
			? mounts.find((candidate) => candidate.id === mountSpec.unitId)
			: undefined;
		const points = unit.points + (mounted && mountSpec ? mountSpec.points : 0);
		const effectiveStats = mounted && mount ? effectiveMountedStats(unit, mount) : unit.stats;
		return [
			{
				entryId: entry.id,
				unitId: entry.unitId,
				name: unit.name,
				points,
				icon: unit.icon,
				mounted,
				mount,
				effectiveStats
			}
		];
	});
}

export function armyPoints(entries: ArmyEntry[], units: ArmyUnitSpec[]): number {
	return entries.reduce((total, entry) => {
		const unit = units.find((candidate) => candidate.id === entry.unitId);
		if (!unit) return total;
		return total + unit.points + (entry.mounted && unit.mount ? unit.mount.points : 0);
	}, 0);
}

/** Copies per unit id, feeding the stepper counts in the available-units list. */
export function armyCopyCounts(entries: ArmyEntry[]): Record<string, number> {
	return entries.reduce<Record<string, number>>((counts, entry) => {
		counts[entry.unitId] = (counts[entry.unitId] ?? 0) + 1;
		return counts;
	}, {});
}

/** Rules entries keyed by id, for resolving a unit's class/skill/trait references. */
export function indexArmyRules(entries: ArmyRulesSpec[]): Record<string, ArmyRulesSpec> {
	return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
}

/** Display title of a rules entry at a level - a level suffix only above 1. */
export function armyRulesTitle(name: string, level: number): string {
	return level > 1 ? name + ' ' + level : name;
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

/** The popup content for a unit's skill reference; null for a missing entry. */
export function skillPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmySkillRef
): ArmyRulesPopup | null {
	if (!entry) return null;
	return {
		title: armyRulesTitle(entry.name, ref.level),
		body: entry.levelText?.[ref.level] ?? entry.description
	};
}

/** The popup content for a unit's trait reference, placeholders filled; null for a missing entry. */
export function traitPopupFor(
	entry: ArmyRulesSpec | undefined,
	ref: ArmyTraitRef
): ArmyRulesPopup | null {
	if (!entry) return null;
	const value = ref.dynamicValue ?? ref.dynamicElements?.join(', ');
	const segments = entry.levelText?.[ref.level] ?? entry.description;
	return {
		title: armyRulesTitle(substituteArmyTemplate(entry.name, value, true), ref.level),
		body: segments.map((segment) => ({
			...segment,
			text: substituteArmyTemplate(segment.text, value, false)
		}))
	};
}

/** The three rules indexes the popup stack resolves its links against. */
export type ArmyRulesIndexes = {
	classes: Record<string, ArmyRulesSpec>;
	skills: Record<string, ArmyRulesSpec>;
	traits: Record<string, ArmyRulesSpec>;
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
					: undefined;
	const entry = index?.[link.id];
	if (!entry) return null;
	return { title: entry.name, body: entry.description };
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
