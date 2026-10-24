import {
	affinityElements,
	type ArmySummonSource,
	type ArmyUnitContent,
	type ArmyUnitSpec
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
