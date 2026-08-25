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

export type ArmyUnitSpec = {
	id: string;
	name: string;
	points: number;
	limit: number;
};

/** One unit type in the current army plus how many copies were added. */
export type ArmyEntry = {
	unitId: string;
	count: number;
};

/** Selected entry joined with its unit spec, ready for display. */
export type ArmyRosterRow = {
	unitId: string;
	name: string;
	unitPoints: number;
	count: number;
	totalPoints: number;
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
export function resolveArmyEntries(entries: ArmyEntry[], units: ArmyUnitSpec[]): ArmyRosterRow[] {
	return entries.flatMap((entry) => {
		const unit = units.find((candidate) => candidate.id === entry.unitId);
		if (!unit) return [];
		return [
			{
				unitId: entry.unitId,
				name: unit.name,
				unitPoints: unit.points,
				count: entry.count,
				totalPoints: unit.points * entry.count
			}
		];
	});
}

export function armyPoints(entries: ArmyEntry[], units: ArmyUnitSpec[]): number {
	return resolveArmyEntries(entries, units).reduce((total, row) => total + row.totalPoints, 0);
}

/** True once the army costs strictly more than the format allows. */
export function isOverArmyLimit(points: number, format: ArmyFormat): boolean {
	return points > ARMY_FORMAT_POINTS[format];
}

/** Unit content as loaded: exclusive units per faction plus the neutral pool. */
export type ArmyUnitContent = {
	factionUnits: Partial<Record<ArmyFactionId, ArmyUnitSpec[]>>;
	neutralUnits: ArmyUnitSpec[];
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
