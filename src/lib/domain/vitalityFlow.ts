import type { BattleFlowerSpec } from './savedArmy';
import type { PlayerKey } from './twoPlayer';
import type { UnitStatus, UnitVitality } from './army';

/** The amount ring's fixed steps; the ring closes with X, which asks for a number. */
export const AMOUNT_STEPS = [1, 2, 3, 4, 5, 6] as const;

/** A tracked half overheals to double its base: Life paints the extra points blue, Stamina
 * violet - neither grows the ring. */
export const OVERHEAL_FACTOR = 2;

/** The most Life a copy of `max` base can hold, overheal included. */
export function lifeCap(max: number): number {
	return OVERHEAL_FACTOR * max;
}

/** The most Stamina a copy of `max` base can hold, over-Stamina included. */
export function staminaCap(max: number): number {
	return OVERHEAL_FACTOR * max;
}

/**
 * One tappable model in a vitality flow: the copies of both armies the flow can act on, the
 * focused flower among them - its twin in the row is the "clone" that lets a model act on
 * itself. `copy` numbers the copies of one unit inside one seat in list order, dead copies
 * included so a badge is a stable identity; it is null while the name is unique there.
 */
export type VitalityTarget = {
	player: PlayerKey;
	entryId: string;
	flower: BattleFlowerSpec;
	copy: number | null;
};

function targetsWhere(
	seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }>,
	keep: (flower: BattleFlowerSpec) => boolean
): VitalityTarget[] {
	const targets: VitalityTarget[] = [];
	for (const { player, flowers } of seats) {
		const total = new Map<string, number>();
		for (const flower of flowers) total.set(flower.name, (total.get(flower.name) ?? 0) + 1);
		const seen = new Map<string, number>();
		for (const flower of flowers) {
			const index = (seen.get(flower.name) ?? 0) + 1;
			seen.set(flower.name, index);
			if (!keep(flower)) continue;
			targets.push({
				player,
				entryId: flower.entryId,
				flower,
				copy: (total.get(flower.name) ?? 0) > 1 ? index : null
			});
		}
	}
	return targets;
}

/** The damage flow's row: every copy that still has Life to lose. */
export function aliveTargetsFor(
	seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }>
): VitalityTarget[] {
	return targetsWhere(seats, (flower) => flower.life !== null && flower.life.current > 0);
}

/** The heal flow's row: every copy below its overheal cap, from the fallen to the whole. */
export function healableTargetsFor(
	seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }>
): VitalityTarget[] {
	return targetsWhere(
		seats,
		(flower) => flower.life !== null && flower.life.current < lifeCap(flower.life.max)
	);
}

/**
 * The status flow's row: every copy of both armies. States are not a function of Life, so
 * nothing is filtered out - a fallen copy is exactly the one whose Incapacitated orb a player
 * goes looking for.
 */
export function allTargetsFor(
	seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }>
): VitalityTarget[] {
	return targetsWhere(seats, () => true);
}

/** What a hit of `amount` actually takes off a model with `currentHp` Life left: never more. */
export function damageApplied(amount: number, currentHp: number): number {
	return Math.max(0, Math.min(amount, currentHp));
}

/** What a heal of `amount` actually restores on a model with `currentHp` of `maxHp` base: never
 * more than the room left under the overheal cap. */
export function healApplied(amount: number, currentHp: number, maxHp: number): number {
	return Math.max(0, Math.min(amount, lifeCap(maxHp) - currentHp));
}

/**
 * The vitality record after a hit: Life drops and never below zero, stamina and States are
 * kept. `current` is absent for a copy nothing has touched yet, which reads as full.
 */
export function vitalityAfterDamage(
	current: UnitVitality | undefined,
	baseHp: number,
	baseSta: number | null,
	amount: number
): UnitVitality {
	const vitality: UnitVitality = {
		hp: Math.max(0, (current?.hp ?? baseHp) - amount),
		sta: current?.sta ?? baseSta ?? 0
	};
	if (current?.statuses) vitality.statuses = current.statuses;
	return vitality;
}

/** The vitality record after a heal: Life rises and never above the overheal cap, rest kept. */
export function vitalityAfterHeal(
	current: UnitVitality | undefined,
	baseHp: number,
	baseSta: number | null,
	amount: number
): UnitVitality {
	const vitality: UnitVitality = {
		hp: Math.min(lifeCap(baseHp), (current?.hp ?? baseHp) + amount),
		sta: current?.sta ?? baseSta ?? 0
	};
	if (current?.statuses) vitality.statuses = current.statuses;
	return vitality;
}

/**
 * The vitality record after a Stamina step: Stamina moves one point and never below zero or
 * above the over-Stamina cap, Life and States kept. A model with no Stamina (a null base) has
 * nothing to move, so the petal that leads here is not offered on it.
 */
export function vitalityAfterStamina(
	current: UnitVitality | undefined,
	baseHp: number,
	baseSta: number | null,
	delta: number
): UnitVitality {
	const base = baseSta ?? 0;
	const vitality: UnitVitality = {
		hp: current?.hp ?? baseHp,
		sta: Math.min(staminaCap(base), Math.max(0, (current?.sta ?? base) + delta))
	};
	if (current?.statuses) vitality.statuses = current.statuses;
	return vitality;
}

/**
 * The vitality record after a box tap: one half jumps straight to the tapped box, the other
 * half and the States kept. The ring only carries base boxes, so a tap can never ask for more
 * than the base - over-Stamina stays the disc's +1 alone - and Life clamps to the overheal cap
 * for the same reason a stray value can never land here.
 */
export function vitalityAfterBoxTap(
	current: UnitVitality | undefined,
	baseHp: number,
	baseSta: number | null,
	half: 'life' | 'stamina',
	value: number
): UnitVitality {
	const vitality: UnitVitality = {
		hp: half === 'life' ? Math.min(lifeCap(baseHp), Math.max(0, value)) : (current?.hp ?? baseHp),
		sta:
			half === 'stamina'
				? Math.min(baseSta ?? 0, Math.max(0, value))
				: (current?.sta ?? baseSta ?? 0)
	};
	if (current?.statuses) vitality.statuses = current.statuses;
	return vitality;
}

/**
 * The vitality record after a status edit: Life and stamina untouched, the States replaced
 * wholesale by the ring's confirmed draft. An empty draft drops the key again, so a copy
 * cleared of every State costs nothing in the run's map. The zero-Life States are not
 * re-applied here - the store's `setUnitVitality` runs every commit through
 * `applyZeroHpStates`, which is the one place that rule lives.
 */
export function vitalityAfterStatuses(
	current: UnitVitality | undefined,
	baseHp: number,
	baseSta: number | null,
	statuses: UnitStatus[]
): UnitVitality {
	const vitality: UnitVitality = {
		hp: current?.hp ?? baseHp,
		sta: current?.sta ?? baseSta ?? 0
	};
	if (statuses.length > 0) vitality.statuses = statuses;
	return vitality;
}
