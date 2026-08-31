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

/** A resolved rules popup: heading plus its level sections. */
export type ArmyRulesPopup = {
	title: string;
	sections: ArmyRulesSection[];
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
