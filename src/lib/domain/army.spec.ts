import { describe, expect, it } from 'vitest';
import {
	addArmyUnit,
	armyPoints,
	isOverArmyLimit,
	removeArmyUnit,
	resolveArmyEntries,
	unitsForFaction,
	type ArmyEntry,
	type ArmyUnitContent,
	type ArmyUnitSpec
} from './army';

const UNITS: ArmyUnitSpec[] = [
	{ id: 'warrior', name: 'Warrior', points: 25, limit: 3 },
	{ id: 'mage', name: 'Mage', points: 25, limit: 1 },
	{ id: 'archer', name: 'Archer', points: 20, limit: 2 }
];

describe('addArmyUnit', () => {
	it('creates an entry with one copy on first use', () => {
		expect(addArmyUnit([], 'warrior', UNITS)).toEqual([{ unitId: 'warrior', count: 1 }]);
	});

	it('increments the count of an existing entry', () => {
		const entries: ArmyEntry[] = [{ unitId: 'warrior', count: 2 }];
		expect(addArmyUnit(entries, 'warrior', UNITS)).toEqual([{ unitId: 'warrior', count: 3 }]);
	});

	it('leaves other entries untouched and does not mutate the input', () => {
		const entries: ArmyEntry[] = [{ unitId: 'warrior', count: 1 }];
		const next = addArmyUnit(entries, 'mage', UNITS);
		expect(next).toEqual([
			{ unitId: 'warrior', count: 1 },
			{ unitId: 'mage', count: 1 }
		]);
		expect(entries).toEqual([{ unitId: 'warrior', count: 1 }]);
	});

	it('stops adding once the unit limit is reached', () => {
		const entries: ArmyEntry[] = [{ unitId: 'warrior', count: 3 }];
		expect(addArmyUnit(entries, 'warrior', UNITS)).toBe(entries);
		expect(addArmyUnit([{ unitId: 'mage', count: 1 }], 'mage', UNITS)).toEqual([
			{ unitId: 'mage', count: 1 }
		]);
	});

	it('adds units without roster info, since no limit applies', () => {
		expect(addArmyUnit([], 'ghost', UNITS)).toEqual([{ unitId: 'ghost', count: 1 }]);
	});
});

describe('removeArmyUnit', () => {
	it('decrements the count when copies remain', () => {
		expect(removeArmyUnit([{ unitId: 'warrior', count: 2 }], 'warrior')).toEqual([
			{ unitId: 'warrior', count: 1 }
		]);
	});

	it('drops the entry when the last copy is removed', () => {
		expect(removeArmyUnit([{ unitId: 'warrior', count: 1 }], 'warrior')).toEqual([]);
	});

	it('is a no-op for an unknown unit', () => {
		const entries: ArmyEntry[] = [{ unitId: 'mage', count: 1 }];
		expect(removeArmyUnit(entries, 'warrior')).toBe(entries);
	});
});

describe('resolveArmyEntries', () => {
	it('joins entries with their unit specs', () => {
		expect(resolveArmyEntries([{ unitId: 'warrior', count: 3 }], UNITS)).toEqual([
			{ unitId: 'warrior', name: 'Warrior', unitPoints: 25, count: 3, totalPoints: 75 }
		]);
	});

	it('skips entries whose unit no longer exists', () => {
		expect(resolveArmyEntries([{ unitId: 'ghost', count: 1 }], UNITS)).toEqual([]);
	});
});

describe('armyPoints', () => {
	it('is zero for an empty army', () => {
		expect(armyPoints([], UNITS)).toBe(0);
	});

	it('sums every copy of every selected unit', () => {
		const entries: ArmyEntry[] = [
			{ unitId: 'warrior', count: 3 },
			{ unitId: 'archer', count: 2 }
		];
		expect(armyPoints(entries, UNITS)).toBe(115);
	});
});

describe('isOverArmyLimit', () => {
	it('allows exactly the standard cap but not more', () => {
		expect(isOverArmyLimit(85, 'standard')).toBe(false);
		expect(isOverArmyLimit(86, 'standard')).toBe(true);
	});

	it('allows exactly the tournament cap but not more', () => {
		expect(isOverArmyLimit(125, 'tournament')).toBe(false);
		expect(isOverArmyLimit(126, 'tournament')).toBe(true);
	});
});

describe('unitsForFaction', () => {
	const CONTENT: ArmyUnitContent = {
		factionUnits: {
			'helian-league': [{ id: 'legionnaire', name: 'Legionnaire', points: 12, limit: 1 }],
			'oni-clans': [{ id: 'lesser-oni', name: 'Lesser Oni', points: 8, limit: 2 }]
		},
		neutralUnits: [{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3 }]
	};

	it('combines the faction exclusives with the neutral pool', () => {
		expect(unitsForFaction('helian-league', CONTENT)).toEqual([
			{ id: 'legionnaire', name: 'Legionnaire', points: 12, limit: 1 },
			{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3 }
		]);
	});

	it('falls back to the neutral pool for factions without exclusives', () => {
		expect(unitsForFaction('adventurers-guild', CONTENT)).toEqual([
			{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3 }
		]);
	});

	it('withholds the neutral pool from monster factions', () => {
		expect(unitsForFaction('oni-clans', CONTENT)).toEqual([
			{ id: 'lesser-oni', name: 'Lesser Oni', points: 8, limit: 2 }
		]);
		expect(unitsForFaction('goblin-wartribes', CONTENT)).toEqual([]);
	});
});
