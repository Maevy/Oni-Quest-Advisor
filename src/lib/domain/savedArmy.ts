import type { ArmyFactionId, ArmyFormat } from './army';

/**
 * A persisted army list. The code carries the whole list (faction, format,
 * copies, mounts, upgrades with their selections, roster equipment); the
 * metadata exists only so saves can be listed without decoding.
 */
export type SavedArmy = {
	id: string;
	name: string;
	factionId: ArmyFactionId;
	code: string;
	/** ISO timestamp of when the army was saved. */
	createdAt: string;
	/** Absent on saves written before the roster format existed (= standard). */
	format?: ArmyFormat;
};

/** The format a save belongs to; saves predating the field are standard. */
export function savedArmyFormat(army: SavedArmy): ArmyFormat {
	return army.format ?? 'standard';
}

export type SavedArmyGroup = {
	factionId: ArmyFactionId;
	/** Newest first. */
	armies: SavedArmy[];
};

/** Groups saved armies by faction (in `factionOrder`), newest first within each group. */
export function groupSavedArmies(
	armies: SavedArmy[],
	factionOrder: ArmyFactionId[]
): SavedArmyGroup[] {
	const byFaction = new Map<ArmyFactionId, SavedArmy[]>();
	for (const army of armies) {
		const group = byFaction.get(army.factionId);
		if (group) group.push(army);
		else byFaction.set(army.factionId, [army]);
	}
	const groups: SavedArmyGroup[] = [];
	for (const factionId of factionOrder) {
		const group = byFaction.get(factionId);
		if (!group) continue;
		group.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
		groups.push({ factionId, armies: group });
	}
	return groups;
}
