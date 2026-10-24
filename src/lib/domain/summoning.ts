import {
	affinityElements,
	settleVitalityStates,
	type ArmySummonSource,
	type ArmyUnitContent,
	type ArmyUnitSpec,
	type UnitStatus,
	type UnitVitality
} from './army';

/**
 * Which model may put which creature on the field.
 *
 * Two spellcrafts summon, and they gate differently. **Conjuration** is bound to an
 * Affinity: a creature carries the element it is called through, and the caster needs that
 * element among its Affinity elements plus a spellcraft level reaching the creature's tier.
 * **Necromancy** is element-blind - it raises Undead by tier alone, and is deliberately
 * faction-agnostic, so a Sand Kingdoms necromancer raises an Oni Clans Bonewalker.
 *
 * Pass the *effective* unit (upgrades applied), never the catalog original: an Affinity
 * granted or replaced by an upgrade is exactly what unlocks a creature the base model could
 * not call, and the Deathweaving Fan is an inventory item.
 */

/** The spellcraft that calls a creature bound to one of the caster's Affinity elements. */
export const CONJURATION_SPELLCRAFT_ID = 'art-of-conjuration';

/** The spellcraft that raises Undead creatures. */
export const NECROMANCY_SPELLCRAFT_ID = 'necromancy';

/**
 * The item whose Ritual carries Necromancy past {@link NECROMANCY_BASE_TIER_CAP}: "To summon
 * a Tier III or higher Undead via Ritual, spend Mana equal to the model's Tier +1 and remove
 * 2 Dead models within Awareness." Chiyohime is the only model that ships with it.
 */
export const DEATHWEAVING_FAN_ITEM_ID = 'deathweaving-fan';

/**
 * The highest creature tier Necromancy reaches unaided - "Raise the Undead" summons "up to 2
 * Tier I Undead or 1 Tier II Undead". The Deathweaving Fan lifts the cap entirely.
 */
export const NECROMANCY_BASE_TIER_CAP = 2;

/** One creature a model may summon, with the rule that admits it. */
export type AvailableSummon = {
	unit: ArmyUnitSpec;
	tier: number;
	source: ArmySummonSource;
};

/** By tier, then name: the order a summon picker reads in, and a stable one for tests. */
function byTierThenName(a: ArmyUnitSpec, b: ArmyUnitSpec): number {
	const tier = (a.summon?.tier ?? 0) - (b.summon?.tier ?? 0);
	return tier !== 0 ? tier : a.name.localeCompare(b.name);
}

/**
 * Every creature in the content a spell can put on the field, whatever file its unit spec
 * lives in: the faction-less tokens sit in `summons`, while the Undead that can also be
 * recruited sit in their faction's file. Scanning all three pools is what makes Necromancy
 * faction-agnostic.
 */
export function summonableUnits(content: ArmyUnitContent): ArmyUnitSpec[] {
	const all = [
		...Object.values(content.factionUnits).flatMap((units) => units ?? []),
		...content.neutralUnits,
		...content.summons
	];
	return all.filter((unit) => unit.summon !== undefined).sort(byTierThenName);
}

function spellcraftLevel(unit: ArmyUnitSpec, id: string): number {
	return unit.spellcrafts?.find((ref) => ref.id === id)?.level ?? 0;
}

function carriesItem(unit: ArmyUnitSpec, itemId: string): boolean {
	return (unit.inventory ?? []).some((slot) => slot.id === itemId);
}

/**
 * Whether `unit` may call `summon`. False for anything that is not a summonable creature, so
 * a caller can hand it an arbitrary unit without checking first.
 */
export function canSummon(unit: ArmyUnitSpec, summon: ArmyUnitSpec): boolean {
	const spec = summon.summon;
	if (!spec) return false;
	if (spec.source.kind === 'conjuration') {
		if (spellcraftLevel(unit, CONJURATION_SPELLCRAFT_ID) < spec.tier) return false;
		return affinityElements(unit).includes(spec.source.element);
	}
	if (spellcraftLevel(unit, NECROMANCY_SPELLCRAFT_ID) < 1) return false;
	return carriesItem(unit, DEATHWEAVING_FAN_ITEM_ID) || spec.tier <= NECROMANCY_BASE_TIER_CAP;
}

/** Every creature `unit` may summon, in `pool` order. */
export function availableSummons(unit: ArmyUnitSpec, pool: ArmyUnitSpec[]): AvailableSummon[] {
	const available: AvailableSummon[] = [];
	for (const candidate of pool) {
		const spec = candidate.summon;
		if (!spec || !canSummon(unit, candidate)) continue;
		available.push({ unit: candidate, tier: spec.tier, source: spec.source });
	}
	return available;
}

/**
 * One creature a model called onto the field. A summon is not an army entry: it is not in the
 * army code, it is created during play, and it leaves again during play.
 */
export type SummonedModel = {
	/**
	 * Its own identity. The vitality map keys army entries and summons by the same field, so
	 * this must never read as an entry id - hence the prefix, and hence {@link nextSummonId}.
	 */
	id: string;
	unitId: string;
	/** The army entry - or another summon - that called it, and whose fall takes it off. */
	summonerId: string;
};

/** The id prefix that keeps a summon's identity out of the army code's entry-id space. */
const SUMMON_ID_PREFIX = 'summon-';

/**
 * The next summon id: one past the highest in use. An id is only reused once every higher one
 * has left the field, and leaving drops the vitality record with it, so a reused id is clean.
 */
export function nextSummonId(summons: SummonedModel[]): string {
	let highest = 0;
	for (const summon of summons) {
		const parsed = Number.parseInt(summon.id.slice(SUMMON_ID_PREFIX.length), 10);
		if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
	}
	return SUMMON_ID_PREFIX + (highest + 1);
}

/** Every summon `rootId` owns, directly or through another summon; `rootId` itself excluded. */
export function summonedBy(summons: SummonedModel[], rootId: string): string[] {
	const owned: string[] = [];
	const queue = [rootId];
	while (queue.length > 0) {
		const current = queue.shift() as string;
		for (const summon of summons) {
			if (summon.summonerId !== current || owned.includes(summon.id)) continue;
			owned.push(summon.id);
			queue.push(summon.id);
		}
	}
	return owned;
}

/**
 * The slice of a run's state the summon rules touch: the creatures on the field, and the
 * vitality map that keys army entries and summons alike.
 */
export type SummonBoard = {
	summons: SummonedModel[];
	vitality: Record<string, UnitVitality>;
};

/** Takes creatures off the field and drops their vitality records with them. */
export function removeSummons(board: SummonBoard, ids: readonly string[]): SummonBoard {
	if (ids.length === 0) return board;
	const gone = new Set(ids);
	const vitality = { ...board.vitality };
	for (const id of gone) delete vitality[id];
	return { summons: board.summons.filter((summon) => !gone.has(summon.id)), vitality };
}

/** Puts a creature on the field, below the model that called it. */
export function addSummon(board: SummonBoard, summonerId: string, unitId: string): SummonBoard {
	const summon: SummonedModel = { id: nextSummonId(board.summons), unitId, summonerId };
	return { summons: [...board.summons, summon], vitality: board.vitality };
}

/** One creature leaves the field, and anything it called leaves with it. */
export function dismissSummon(board: SummonBoard, id: string): SummonBoard {
	return removeSummons(board, [id, ...summonedBy(board.summons, id)]);
}

/** The States that mean a model is no longer in control of anything it called. */
const LOSES_SUMMONS: UnitStatus[] = ['incapacitated', 'dead'];

/**
 * Commits one model's vitality and applies the two ways a summon leaves the field:
 *
 * - a **summon at zero Life is removed**, not fallen - it never carries Incapacitated or Dead,
 *   so it never reaches {@link settleVitalityStates}' zero-Life rule at all;
 * - a model that goes **Incapacitated or Dead loses every creature it called**, transitively.
 *   Both States count, because an Undead summoner goes straight to Dead with no Incapacitated
 *   step and would otherwise keep controlling a field it is not on.
 *
 * Removal is **permanent**, by ruling: healing the summoner back above zero Life does not
 * return them, they have to be summoned again. Storing the removal rather than deriving it from
 * the summoner's State is what makes that stick.
 */
export function commitVitality(
	board: SummonBoard,
	entryId: string,
	vitality: UnitVitality,
	undead: boolean
): SummonBoard {
	const summoned = board.summons.some((summon) => summon.id === entryId);
	if (summoned && vitality.hp <= 0) return dismissSummon(board, entryId);
	const settled = settleVitalityStates(vitality, board.vitality[entryId]?.hp, undead);
	const next: SummonBoard = {
		summons: board.summons,
		vitality: { ...board.vitality, [entryId]: settled }
	};
	const statuses = settled.statuses ?? [];
	if (!LOSES_SUMMONS.some((status) => statuses.includes(status))) return next;
	return removeSummons(next, summonedBy(next.summons, entryId));
}
