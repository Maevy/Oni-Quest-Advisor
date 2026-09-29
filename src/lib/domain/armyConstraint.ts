import type { ArmyEntry, ArmyRosterPick } from './army';

/**
 * The budget a roster cut-down build works inside.
 *
 * A Roster army is a 125-point "everything I bring" list whose equipment sits in one shared pool;
 * a match is only 85 points, so the player cuts a Standard list out of it. The cut may use nothing
 * the roster did not contain: its copies per unit, its **mounted** copies per unit (a mount picked
 * in the roster may be left off, one never picked may not be added) and its pool quantities, which
 * become a per-upgrade budget of assignable copies.
 *
 * The pool records no target and no selection — `{ id, qty }` is a shopping list, not an equipped
 * state — so which copy gets which upgrade, and which item a Glyphscribe inscribes, is always the
 * player's choice. Nothing here can be inferred.
 *
 * The result is an ordinary Standard list: the constraint shapes how it was built, not what it is,
 * so it encodes to a normal `s` code and replays through `importArmy` unchanged.
 */
export type ArmyConstraint = {
	/** Copies allowed per unit id. */
	unitCopies: Record<string, number>;
	/** Mounted copies allowed per unit id — a ceiling that only ever comes down. */
	unitMounted: Record<string, number>;
	/** Assignable copies per upgrade id, from the roster's equipment pool. */
	upgradeQty: Record<string, number>;
};

/**
 * Budgets from a decoded roster list. Entry-level upgrades are ignored: a Roster list carries its
 * equipment in the pool, so anything on an entry is not part of what the player brought.
 */
export function constraintFromRoster(
	entries: ArmyEntry[],
	picks: ArmyRosterPick[] | undefined
): ArmyConstraint {
	const unitCopies: Record<string, number> = {};
	const unitMounted: Record<string, number> = {};
	for (const entry of entries) {
		unitCopies[entry.unitId] = (unitCopies[entry.unitId] ?? 0) + 1;
		if (entry.mounted) unitMounted[entry.unitId] = (unitMounted[entry.unitId] ?? 0) + 1;
	}
	const upgradeQty: Record<string, number> = {};
	for (const pick of picks ?? []) {
		if (pick.qty < 1) continue;
		upgradeQty[pick.id] = (upgradeQty[pick.id] ?? 0) + pick.qty;
	}
	return { unitCopies, unitMounted, upgradeQty };
}

/** Whether the roster contains this unit at all — units outside it are not recruitable. */
export function constraintAllowsUnit(constraint: ArmyConstraint, unitId: string): boolean {
	return (constraint.unitCopies[unitId] ?? 0) > 0;
}

/** How many more copies of this unit the roster has, given the entries built so far. */
export function constraintUnitRoom(
	constraint: ArmyConstraint,
	entries: ArmyEntry[],
	unitId: string
): number {
	const used = entries.filter((entry) => entry.unitId === unitId).length;
	return Math.max(0, (constraint.unitCopies[unitId] ?? 0) - used);
}

/**
 * How many more copies of this unit may still be mounted. Unmounting is always allowed, so this
 * only ever gates turning a mount on.
 */
export function constraintMountRoom(
	constraint: ArmyConstraint,
	entries: ArmyEntry[],
	unitId: string
): number {
	const used = entries.filter((entry) => entry.unitId === unitId && entry.mounted === true).length;
	return Math.max(0, (constraint.unitMounted[unitId] ?? 0) - used);
}

/** How many more copies of this upgrade the pool has, given what is already assigned. */
export function constraintUpgradeRoom(
	constraint: ArmyConstraint,
	entries: ArmyEntry[],
	upgradeId: string
): number {
	const used = entries.reduce(
		(sum, entry) => sum + (entry.upgrades ?? []).filter((id) => id === upgradeId).length,
		0
	);
	return Math.max(0, (constraint.upgradeQty[upgradeId] ?? 0) - used);
}

/** Whether the pool has any copies of this upgrade left to assign. */
export function constraintUpgradeAvailable(
	constraint: ArmyConstraint,
	entries: ArmyEntry[],
	upgradeId: string
): boolean {
	return constraintUpgradeRoom(constraint, entries, upgradeId) > 0;
}

/** What is left of each pool entry, for the constrained builder's equipment summary. */
export function constraintRemaining(
	constraint: ArmyConstraint,
	entries: ArmyEntry[]
): ArmyRosterPick[] {
	return Object.keys(constraint.upgradeQty)
		.sort()
		.map((id) => ({ id, qty: constraintUpgradeRoom(constraint, entries, id) }))
		.filter((pick) => pick.qty > 0);
}
