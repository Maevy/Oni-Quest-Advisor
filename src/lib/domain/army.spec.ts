import { describe, expect, it } from 'vitest';
import {
	addArmyUnit,
	armyPoints,
	effectiveMountedStats,
	isOverArmyLimit,
	removeArmyUnit,
	resolveArmyEntries,
	toggleArmyMount,
	unitsForFaction,
	type ArmyEntry,
	type ArmyStats,
	type ArmyUnitContent,
	type ArmyUnitSpec
} from './army';

const STATS: ArmyStats = {
	STA: 1,
	SPD: 2,
	OFF: 3,
	DEF: 4,
	ACC: 5,
	INT: 6,
	AG: 7,
	T: 8,
	ARM: 9,
	HP: 10,
	M: 11
};

const UNITS: ArmyUnitSpec[] = [
	{ id: 'warrior', name: 'Warrior', points: 25, limit: 3, stats: STATS },
	{ id: 'mage', name: 'Mage', points: 25, limit: 1, stats: STATS },
	{ id: 'archer', name: 'Archer', points: 20, limit: 2, stats: STATS },
	{
		id: 'dragoon',
		name: 'Slayer Dragoon',
		points: 17,
		limit: 2,
		stats: STATS,
		mount: { unitId: 'lupus-rex', points: 5 }
	}
];

const MOUNTS: ArmyUnitSpec[] = [
	{
		id: 'lupus-rex',
		name: 'Lupus Rex',
		points: 5,
		limit: 2,
		stats: {
			STA: null,
			SPD: 9,
			OFF: null,
			DEF: null,
			ACC: null,
			INT: null,
			AG: null,
			T: null,
			ARM: null,
			HP: null,
			M: null
		},
		statChanges: { DEF: 3, T: 2, ARM: -2, HP: 1 }
	}
];

const DRAGOON = UNITS.find((unit) => unit.id === 'dragoon') ?? UNITS[0];

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
		expect(resolveArmyEntries([{ unitId: 'warrior', count: 3 }], UNITS, MOUNTS)).toEqual([
			{
				unitId: 'warrior',
				name: 'Warrior',
				unitPoints: 25,
				count: 3,
				totalPoints: 75,
				mounted: false,
				effectiveStats: STATS
			}
		]);
	});

	it('skips entries whose unit no longer exists', () => {
		expect(resolveArmyEntries([{ unitId: 'ghost', count: 1 }], UNITS, MOUNTS)).toEqual([]);
	});

	it('carries the optional icon through for display', () => {
		const units: ArmyUnitSpec[] = [
			{ id: 'oni', name: 'Oni', points: 5, limit: 1, stats: STATS, icon: 'oni.jpg' }
		];
		expect(resolveArmyEntries([{ unitId: 'oni', count: 1 }], units, [])).toEqual([
			{
				unitId: 'oni',
				name: 'Oni',
				unitPoints: 5,
				count: 1,
				totalPoints: 5,
				icon: 'oni.jpg',
				mounted: false,
				effectiveStats: STATS
			}
		]);
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
			'helian-league': [
				{ id: 'legionnaire', name: 'Legionnaire', points: 12, limit: 1, stats: STATS }
			],
			'oni-clans': [{ id: 'lesser-oni', name: 'Lesser Oni', points: 8, limit: 2, stats: STATS }]
		},
		neutralUnits: [{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3, stats: STATS }],
		mounts: MOUNTS
	};

	it('combines the faction exclusives with the neutral pool', () => {
		expect(unitsForFaction('helian-league', CONTENT)).toEqual([
			{ id: 'legionnaire', name: 'Legionnaire', points: 12, limit: 1, stats: STATS },
			{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3, stats: STATS }
		]);
	});

	it('falls back to the neutral pool for factions without exclusives', () => {
		expect(unitsForFaction('adventurers-guild', CONTENT)).toEqual([
			{ id: 'hired-blade', name: 'Hired Blade', points: 17, limit: 3, stats: STATS }
		]);
	});

	it('withholds the neutral pool from monster factions', () => {
		expect(unitsForFaction('oni-clans', CONTENT)).toEqual([
			{ id: 'lesser-oni', name: 'Lesser Oni', points: 8, limit: 2, stats: STATS }
		]);
		expect(unitsForFaction('goblin-wartribes', CONTENT)).toEqual([]);
	});

	it('marks a rider as mounted and adds the mount to the row', () => {
		expect(
			resolveArmyEntries([{ unitId: 'dragoon', count: 1, mounted: true }], UNITS, MOUNTS)
		).toEqual([
			{
				unitId: 'dragoon',
				name: 'Slayer Dragoon',
				unitPoints: 17,
				count: 1,
				totalPoints: 22,
				mounted: true,
				mount: MOUNTS[0],
				effectiveStats: {
					STA: 1,
					SPD: 9,
					OFF: 3,
					DEF: 7,
					ACC: 5,
					INT: 6,
					AG: 7,
					T: 10,
					ARM: 7,
					HP: 11,
					M: 11
				}
			}
		]);
	});
});

describe('toggleArmyMount', () => {
	it('flips the mount state of a rider entry', () => {
		const entries: ArmyEntry[] = [{ unitId: 'dragoon', count: 1 }];
		const toggled = toggleArmyMount(entries, 'dragoon', UNITS);
		expect(toggled).toEqual([{ unitId: 'dragoon', count: 1, mounted: true }]);
		expect(toggleArmyMount(toggled, 'dragoon', UNITS)).toEqual([
			{ unitId: 'dragoon', count: 1, mounted: false }
		]);
	});

	it('ignores units without a mount option', () => {
		const entries: ArmyEntry[] = [{ unitId: 'warrior', count: 1 }];
		expect(toggleArmyMount(entries, 'warrior', UNITS)).toBe(entries);
	});
});

describe('mounted army points', () => {
	it('adds the mount cost per copy while mounted', () => {
		expect(armyPoints([{ unitId: 'dragoon', count: 2, mounted: true }], UNITS)).toBe(44);
		expect(armyPoints([{ unitId: 'dragoon', count: 2 }], UNITS)).toBe(34);
	});
});

describe('effectiveMountedStats', () => {
	it('overrides rider stats with non-null mount stats', () => {
		expect(effectiveMountedStats(DRAGOON, MOUNTS[0]).SPD).toBe(9);
		expect(effectiveMountedStats(DRAGOON, MOUNTS[0]).STA).toBe(1);
	});

	it('adds statChanges on top of the rider stats', () => {
		const stats = effectiveMountedStats(DRAGOON, MOUNTS[0]);
		expect(stats.DEF).toBe(7);
		expect(stats.T).toBe(10);
		expect(stats.ARM).toBe(7);
		expect(stats.HP).toBe(11);
	});
});
