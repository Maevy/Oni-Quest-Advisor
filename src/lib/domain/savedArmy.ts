import type { ArmyFactionId, ArmyFormat } from './army';
import { unitStatuses, vitalityRingStates } from './army';
import { decodeArmy, encodeArmy, type ArmyCodeCatalog, type ArmyCodeDecodeError } from './armyCode';
import type {
	ArmyFactionConfig,
	ArmyItemSpec,
	ArmyRosterPick,
	ArmyRosterRow,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	ArmyUnitSpec,
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

/** Why a pasted army code could not be attached to a run. */
export type ArmyImportError = ArmyCodeDecodeError | 'wrong-format';

/**
 * Turns a pasted army code into the snapshot a run attaches, saving nothing. At the table,
 * building a list and naming a save before you can play is too slow when the code already
 * carries the whole list - and a friend's code, pasted once, should not clutter the saves.
 *
 * `format` is what the slot fields, so a mission run refuses a Roster code here rather than
 * attaching it and discovering the mismatch mid-game. The stored code is re-encoded from the
 * decoded list rather than kept as pasted: a legacy `t` format character folds to the modern
 * `r`, and whatever is stored is guaranteed to decode against the current catalogs.
 */
export function pickedArmyFromCode(
	code: string,
	catalog: ArmyCodeCatalog,
	options: { name: string; format: ArmyFormat }
): { ok: true; army: PickedArmy } | { ok: false; error: ArmyImportError } {
	const decoded = decodeArmy(code, catalog);
	if (!decoded.ok) return { ok: false, error: decoded.error };
	if (decoded.list.format !== options.format) return { ok: false, error: 'wrong-format' };
	return {
		ok: true,
		army: {
			name: options.name,
			factionId: decoded.list.factionId,
			code: encodeArmy(decoded.list, catalog),
			format: decoded.list.format
		}
	};
}

/** One summoned creature resolved for the board: its identity, its summoner, and its spec. */
export type SummonedRow = {
	id: string;
	summonerId: string;
	unit: ArmyUnitSpec;
};

/**
 * Everything the read-only army view needs, resolved once per render: the snapshot,
 * its copies joined with unit specs, and the catalogs the unit card resolves against.
 */
export type ArmyView = {
	army: PickedArmy;
	rows: ArmyRosterRow[];
	/** The roster's equipment pool; empty for Standard lists, which carry no pool. */
	picks: ArmyRosterPick[];
	/** Creatures called onto the field during the run, in the order they were summoned. */
	summons: SummonedRow[];
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
	/** Whether the model carries the Undead trait: it has no Incapacitated, and zero Life
	 * puts it straight into Dead. */
	undead: boolean;
	/**
	 * True on a creature called onto the field rather than recruited. It wears the flashy
	 * border, offers Dismiss in place of Summon Creature, and at zero Life it leaves the field
	 * instead of falling - so nothing may read it as an ordinary copy.
	 */
	summoned: boolean;
	/** The flower this one hangs below; null on an army copy. */
	summonerId: string | null;
};

function battleRing(max: number | null, current: number | null): BattleRingSpec | null {
	if (max === null || current === null) return null;
	return { current, max, states: vitalityRingStates(current, max) };
}

/** One summoned creature as a flower: its own identity, its spec's bases, and never a mount. */
function summonFlower(row: SummonedRow, vitality: UnitVitality | undefined): BattleFlowerSpec {
	const stats = row.unit.stats;
	return {
		entryId: row.id,
		name: row.unit.name,
		icon: row.unit.icon,
		mountedOn: null,
		stamina: battleRing(stats.STA, vitality?.sta ?? stats.STA),
		life: battleRing(stats.HP, vitality?.hp ?? stats.HP),
		statuses: unitStatuses(vitality),
		undead: (row.unit.traits ?? []).some((trait) => trait.id === 'undead'),
		summoned: true,
		summonerId: row.summonerId
	};
}

/**
 * Projects an army view into the flowers its panel draws: one per copy in list order, each
 * followed by the creatures it called. A summon hangs below its summoner and a summon's own
 * summons below it, so the board reads as the tree it is rather than as two unrelated lists.
 */
export function battleFlowersFor(view: ArmyView): BattleFlowerSpec[] {
	const bySummoner = new Map<string, SummonedRow[]>();
	for (const summon of view.summons) {
		const owned = bySummoner.get(summon.summonerId);
		if (owned) owned.push(summon);
		else bySummoner.set(summon.summonerId, [summon]);
	}
	const flowers: BattleFlowerSpec[] = [];
	const placed = new Set<string>();
	// Depth-first, with `placed` as the guard: a stored chain that ever looped would otherwise
	// recurse forever, and a creature whose summoner is not on the board is appended below
	// rather than dropped - an unreachable flower could never be dismissed.
	const appendOwnedBy = (ownerId: string): void => {
		for (const summon of bySummoner.get(ownerId) ?? []) {
			if (placed.has(summon.id)) continue;
			placed.add(summon.id);
			flowers.push(summonFlower(summon, view.vitality[summon.id]));
			appendOwnedBy(summon.id);
		}
	};
	for (const row of view.rows) {
		const vitality = view.vitality[row.entryId];
		flowers.push({
			entryId: row.entryId,
			name: row.name,
			icon: row.icon,
			mountedOn: row.mounted ? (row.mount?.name ?? null) : null,
			stamina: battleRing(row.effectiveStats.STA, vitality?.sta ?? row.effectiveStats.STA),
			life: battleRing(row.effectiveStats.HP, vitality?.hp ?? row.effectiveStats.HP),
			statuses: unitStatuses(vitality),
			undead: [row.upgradedUnit, row.mount].some((unit) =>
				(unit?.traits ?? []).some((trait) => trait.id === 'undead')
			),
			summoned: false,
			summonerId: null
		});
		appendOwnedBy(row.entryId);
	}
	for (const summon of view.summons) {
		if (placed.has(summon.id)) continue;
		placed.add(summon.id);
		flowers.push(summonFlower(summon, view.vitality[summon.id]));
	}
	return flowers;
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
