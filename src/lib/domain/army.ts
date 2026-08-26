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

export type ArmyUnitSpec = {
	id: string;
	name: string;
	points: number;
	limit: number;
	stats: ArmyStats;
	/** Mounts only: additive stat bonuses/maluses applied on top of the rider. */
	statChanges?: Partial<Record<ArmyStatKey, number>>;
	mount?: { unitId: string; points: number };
	icon?: string;
};

/** One unit type in the current army plus how many copies were added. */
export type ArmyEntry = {
	unitId: string;
	count: number;
	mounted?: boolean;
};

/** Selected entry joined with its unit spec, ready for display. */
export type ArmyRosterRow = {
	unitId: string;
	name: string;
	unitPoints: number;
	count: number;
	totalPoints: number;
	icon?: string;
	mounted: boolean;
	mount?: ArmyUnitSpec;
	/** The rider's stats with mount overrides and changes applied when mounted. */
	effectiveStats: ArmyStats;
};

/** Adds one copy of a unit, creating the entry on first use; stops at the unit limit. */
export function addArmyUnit(
	entries: ArmyEntry[],
	unitId: string,
	units: ArmyUnitSpec[]
): ArmyEntry[] {
	const existing = entries.find((entry) => entry.unitId === unitId);
	const limit = units.find((unit) => unit.id === unitId)?.limit;
	if (existing && limit !== undefined && existing.count >= limit) return entries;
	if (!existing) return [...entries, { unitId, count: 1 }];
	return entries.map((entry) =>
		entry.unitId === unitId ? { ...entry, count: entry.count + 1 } : entry
	);
}

/** Removes one copy of a unit, dropping the entry once the last copy is gone. */
export function removeArmyUnit(entries: ArmyEntry[], unitId: string): ArmyEntry[] {
	const existing = entries.find((entry) => entry.unitId === unitId);
	if (!existing) return entries;
	if (existing.count <= 1) return entries.filter((entry) => entry.unitId !== unitId);
	return entries.map((entry) =>
		entry.unitId === unitId ? { ...entry, count: entry.count - 1 } : entry
	);
}

/** Joins the selected entries with their unit specs for display. */
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
		const each = unit.points + (mounted && mountSpec ? mountSpec.points : 0);
		const effectiveStats = mounted && mount ? effectiveMountedStats(unit, mount) : unit.stats;
		return [
			{
				unitId: entry.unitId,
				name: unit.name,
				unitPoints: unit.points,
				count: entry.count,
				totalPoints: each * entry.count,
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
		const each = unit.points + (entry.mounted && unit.mount ? unit.mount.points : 0);
		return total + each * entry.count;
	}, 0);
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

/** Flips the mount on an entry; units without a mount option stay untouched. */
export function toggleArmyMount(
	entries: ArmyEntry[],
	unitId: string,
	units: ArmyUnitSpec[]
): ArmyEntry[] {
	const unit = units.find((candidate) => candidate.id === unitId);
	if (!unit?.mount) return entries;
	return entries.map((entry) =>
		entry.unitId === unitId ? { ...entry, mounted: !entry.mounted } : entry
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
