import type { ArmyFactionId, ArmyFormat } from './army';
import type {
	ArmyFactionConfig,
	ArmyItemSpec,
	ArmyRosterRow,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	UnitVitality
} from './army';

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
	/**
	 * Absent on saves written before the roster format existed (= standard), and
	 * the legacy string 'tournament' on saves written before it was renamed.
	 * Always read through `savedArmyFormat()`.
	 */
	format?: ArmyFormat;
};

/** The roster format's id before it was renamed; still sitting in older saves. */
const LEGACY_ROSTER_FORMAT = 'tournament';

/** The format a save belongs to; saves predating the field are standard. */
export function savedArmyFormat(army: SavedArmy): ArmyFormat {
	if ((army.format as string | undefined) === LEGACY_ROSTER_FORMAT) return 'roster';
	return army.format ?? 'standard';
}

export type SavedArmyGroup = {
	factionId: ArmyFactionId;
	/** Newest first. */
	armies: SavedArmy[];
};

/**
 * The army attached to a mission run: a snapshot taken at pick time, so later edits
 * or deletion of the save cannot change a run that is already under way.
 */
export type PickedArmy = {
	name: string;
	factionId: ArmyFactionId;
	code: string;
};

/**
 * Everything the read-only army view needs, resolved once per render: the snapshot,
 * its copies joined with unit specs, and the catalogs the unit card resolves against.
 */
export type ArmyView = {
	army: PickedArmy;
	rows: ArmyRosterRow[];
	faction: ArmyFactionConfig;
	classIndex: Record<string, ArmyRulesSpec>;
	skillIndex: Record<string, ArmyRulesSpec>;
	traitIndex: Record<string, ArmyRulesSpec>;
	combatArtIndex: Record<string, ArmyRulesSpec>;
	spellcraftIndex: Record<string, ArmyRulesSpec>;
	spells: ArmySpellSpec[];
	stratagemIndex: Record<string, ArmyStratagemSpec>;
	itemIndex: Record<string, ArmyItemSpec>;
	/** Live Life/stamina per copy (entry id); absent entries are untouched, i.e. full. */
	vitality: Record<string, UnitVitality>;
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
