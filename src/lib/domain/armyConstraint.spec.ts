import { describe, expect, it } from 'vitest';
import type { ArmyEntry, ArmyRosterPick } from './army';
import {
	constraintAllowsUnit,
	constraintFromRoster,
	constraintMountRoom,
	constraintRemaining,
	constraintUnitRoom,
	constraintUpgradeAvailable,
	constraintUpgradeRoom,
	type ArmyConstraint
} from './armyConstraint';

/** The roster being cut: two Samurai (one mounted), one Alpha, and a pool of three picks. */
const ROSTER_ENTRIES: ArmyEntry[] = [
	{ id: 'r1', unitId: 'samurai', mounted: true },
	{ id: 'r2', unitId: 'samurai' },
	{ id: 'r3', unitId: 'alpha' }
];

const ROSTER_POOL: ArmyRosterPick[] = [
	{ id: 'pouch', qty: 2 },
	{ id: 'gift-of-longevity', qty: 1 }
];

const ROSTER = constraintFromRoster(ROSTER_ENTRIES, ROSTER_POOL);

describe('constraintFromRoster', () => {
	it('counts one copy per roster entry', () => {
		expect(ROSTER.unitCopies).toEqual({ samurai: 2, alpha: 1 });
	});

	it('counts mounted copies separately from copies', () => {
		expect(ROSTER.unitMounted).toEqual({ samurai: 1 });
	});

	it('turns the pool quantities into per-upgrade budgets', () => {
		expect(ROSTER.upgradeQty).toEqual({ pouch: 2, 'gift-of-longevity': 1 });
	});

	it('sums duplicate pool rows and skips empty ones', () => {
		const constraint = constraintFromRoster(
			[],
			[
				{ id: 'pouch', qty: 1 },
				{ id: 'pouch', qty: 2 },
				{ id: 'empty', qty: 0 }
			]
		);
		expect(constraint.upgradeQty).toEqual({ pouch: 3 });
	});

	it('ignores upgrades sitting on a roster entry, which are not part of the pool', () => {
		const constraint = constraintFromRoster(
			[{ id: 'r1', unitId: 'samurai', upgrades: ['pouch', 'pouch'] }],
			undefined
		);
		expect(constraint.upgradeQty).toEqual({});
		expect(constraint.unitCopies).toEqual({ samurai: 1 });
	});

	it('treats a pool-less roster as having no equipment to assign', () => {
		expect(constraintFromRoster(ROSTER_ENTRIES, undefined).upgradeQty).toEqual({});
	});
});

describe('constraintAllowsUnit', () => {
	it('allows a unit the roster contains and refuses one it does not', () => {
		expect(constraintAllowsUnit(ROSTER, 'samurai')).toBe(true);
		expect(constraintAllowsUnit(ROSTER, 'nomad'), 'never brought to the match').toBe(false);
	});
});

describe('constraintUnitRoom', () => {
	it('is the whole budget while nothing is built', () => {
		expect(constraintUnitRoom(ROSTER, [], 'samurai')).toBe(2);
	});

	it('falls by one per copy taken', () => {
		const one: ArmyEntry[] = [{ id: 'c1', unitId: 'samurai' }];
		expect(constraintUnitRoom(ROSTER, one, 'samurai')).toBe(1);
		expect(constraintUnitRoom(ROSTER, [...one, { id: 'c2', unitId: 'samurai' }], 'samurai')).toBe(
			0
		);
	});

	it('counts each unit on its own', () => {
		expect(constraintUnitRoom(ROSTER, [{ id: 'c1', unitId: 'samurai' }], 'alpha')).toBe(1);
	});

	it('never goes negative and is zero for a unit outside the roster', () => {
		const over: ArmyEntry[] = [
			{ id: 'c1', unitId: 'alpha' },
			{ id: 'c2', unitId: 'alpha' }
		];
		expect(constraintUnitRoom(ROSTER, over, 'alpha')).toBe(0);
		expect(constraintUnitRoom(ROSTER, [], 'nomad')).toBe(0);
	});
});

describe('constraintMountRoom', () => {
	it('is the roster’s mounted count, not its copy count', () => {
		expect(constraintMountRoom(ROSTER, [], 'samurai')).toBe(1);
		expect(constraintMountRoom(ROSTER, [], 'alpha'), 'no alpha was mounted').toBe(0);
	});

	it('counts only the copies that are actually mounted', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', mounted: true },
			{ id: 'c2', unitId: 'samurai' }
		];
		expect(constraintMountRoom(ROSTER, entries, 'samurai')).toBe(0);
	});

	it('gives the budget back when a copy is unmounted', () => {
		const entries: ArmyEntry[] = [{ id: 'c1', unitId: 'samurai', mounted: true }];
		expect(constraintMountRoom(ROSTER, entries, 'samurai')).toBe(0);
		const unmounted: ArmyEntry[] = [{ id: 'c1', unitId: 'samurai' }];
		expect(constraintMountRoom(ROSTER, unmounted, 'samurai')).toBe(1);
	});

	it('never goes negative', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', mounted: true },
			{ id: 'c2', unitId: 'samurai', mounted: true }
		];
		expect(constraintMountRoom(ROSTER, entries, 'samurai')).toBe(0);
	});
});

describe('constraintUpgradeRoom', () => {
	it('is the pool quantity while nothing is assigned', () => {
		expect(constraintUpgradeRoom(ROSTER, [], 'pouch')).toBe(2);
		expect(constraintUpgradeRoom(ROSTER, [], 'gift-of-longevity')).toBe(1);
	});

	it('counts assignments across every copy', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', upgrades: ['pouch'] },
			{ id: 'c2', unitId: 'samurai', upgrades: ['pouch'] }
		];
		expect(constraintUpgradeRoom(ROSTER, entries, 'pouch')).toBe(0);
		expect(constraintUpgradeAvailable(ROSTER, entries, 'pouch')).toBe(false);
	});

	it('counts one assignment even when a copy holds several upgrades', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', upgrades: ['pouch', 'gift-of-longevity'] }
		];
		expect(constraintUpgradeRoom(ROSTER, entries, 'pouch')).toBe(1);
		expect(constraintUpgradeRoom(ROSTER, entries, 'gift-of-longevity')).toBe(0);
	});

	it('has no room for an upgrade the pool never held', () => {
		expect(constraintUpgradeAvailable(ROSTER, [], 'imported-crossbow')).toBe(false);
		expect(constraintUpgradeRoom(ROSTER, [], 'imported-crossbow')).toBe(0);
	});

	it('never goes negative', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', upgrades: ['gift-of-longevity'] },
			{ id: 'c2', unitId: 'alpha', upgrades: ['gift-of-longevity'] }
		];
		expect(constraintUpgradeRoom(ROSTER, entries, 'gift-of-longevity')).toBe(0);
	});
});

describe('constraintRemaining', () => {
	it('is the whole pool while nothing is assigned, sorted by id', () => {
		expect(constraintRemaining(ROSTER, [])).toEqual([
			{ id: 'gift-of-longevity', qty: 1 },
			{ id: 'pouch', qty: 2 }
		]);
	});

	it('drops an exhausted entry and lowers a partly used one', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', upgrades: ['gift-of-longevity', 'pouch'] }
		];
		expect(constraintRemaining(ROSTER, entries)).toEqual([{ id: 'pouch', qty: 1 }]);
	});

	it('is empty once everything is assigned', () => {
		const entries: ArmyEntry[] = [
			{ id: 'c1', unitId: 'samurai', upgrades: ['gift-of-longevity', 'pouch'] },
			{ id: 'c2', unitId: 'alpha', upgrades: ['pouch'] }
		];
		expect(constraintRemaining(ROSTER, entries)).toEqual([]);
	});
});

describe('an empty constraint', () => {
	const EMPTY: ArmyConstraint = { unitCopies: {}, unitMounted: {}, upgradeQty: {} };

	it('allows nothing at all', () => {
		expect(constraintAllowsUnit(EMPTY, 'samurai')).toBe(false);
		expect(constraintUnitRoom(EMPTY, [], 'samurai')).toBe(0);
		expect(constraintMountRoom(EMPTY, [], 'samurai')).toBe(0);
		expect(constraintUpgradeAvailable(EMPTY, [], 'pouch')).toBe(false);
		expect(constraintRemaining(EMPTY, [])).toEqual([]);
	});
});
