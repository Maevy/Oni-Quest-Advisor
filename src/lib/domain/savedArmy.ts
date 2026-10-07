import type { ArmyFactionId, ArmyFormat } from './army';
import { unitStatuses, vitalityRingStates } from './army';
import type {
	ArmyFactionConfig,
	ArmyItemSpec,
	ArmyRosterPick,
	ArmyRosterRow,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	ArmyUpgradeSpec,
	UnitStatus,
	UnitVitality,
	VitalityRingState
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
	/**
	 * Absent on snapshots taken before the field existed (= standard). The code carries it
	 * too, but reading it back needs the catalogs, which a list or a lobby does not have.
	 */
	format?: ArmyFormat;
};

/** The format a picked army was built for; snapshots predating the field are standard. */
export function pickedArmyFormat(army: PickedArmy): ArmyFormat {
	if ((army.format as string | undefined) === LEGACY_ROSTER_FORMAT) return 'roster';
	return army.format ?? 'standard';
}

/**
 * Everything the read-only army view needs, resolved once per render: the snapshot,
 * its copies joined with unit specs, and the catalogs the unit card resolves against.
 */
export type ArmyView = {
	army: PickedArmy;
	rows: ArmyRosterRow[];
	/** The roster's equipment pool; empty for Standard lists, which carry no pool. */
	picks: ArmyRosterPick[];
	faction: ArmyFactionConfig;
	upgradeIndex: Record<string, ArmyUpgradeSpec>;
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

/** One half of a Battle Flower's ring: the stat it tracks and the state of each box. */
export type BattleRingSpec = {
	current: number;
	max: number;
	states: VitalityRingState[];
};

/**
 * One army copy as a Battle Flower: the orb's identity, its two ring halves - stamina on
 * the left, Life on the right - and the States it carries. A half is null when the model
 * carries no value for that stat.
 */
export type BattleFlowerSpec = {
	entryId: string;
	name: string;
	icon?: string;
	/** The mount's name while this copy rides one; null otherwise. */
	mountedOn: string | null;
	stamina: BattleRingSpec | null;
	life: BattleRingSpec | null;
	/** The States the copy carries, in catalog order; empty for a copy carrying none. */
	statuses: UnitStatus[];
};

function battleRing(max: number | null, current: number | null): BattleRingSpec | null {
	if (max === null || current === null) return null;
	return { current, max, states: vitalityRingStates(current, max) };
}

/** Projects an army view into the flowers its panel draws: one per copy, in list order. */
export function battleFlowersFor(view: ArmyView): BattleFlowerSpec[] {
	return view.rows.map((row) => {
		const vitality = view.vitality[row.entryId];
		return {
			entryId: row.entryId,
			name: row.name,
			icon: row.icon,
			mountedOn: row.mounted ? (row.mount?.name ?? null) : null,
			stamina: battleRing(row.effectiveStats.STA, vitality?.sta ?? row.effectiveStats.STA),
			life: battleRing(row.effectiveStats.HP, vitality?.hp ?? row.effectiveStats.HP),
			statuses: unitStatuses(vitality)
		};
	});
}

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
