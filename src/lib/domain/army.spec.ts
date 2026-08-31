import { describe, expect, it } from 'vitest';
import {
	addArmyUnit,
	armyCopyCounts,
	armyPoints,
	effectiveMountedStats,
	isOverArmyLimit,
	removeArmyCopy,
	removeArmyEntry,
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
	it('adds the first copy as a new entry', () => {
		expect(addArmyUnit([], 'warrior', UNITS, 'w1')).toEqual([{ id: 'w1', unitId: 'warrior' }]);
	});

	it('adds every further copy as its own entry', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(addArmyUnit(entries, 'warrior', UNITS, 'w2')).toEqual([
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		]);
	});

	it('leaves other entries untouched and does not mutate the input', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		const next = addArmyUnit(entries, 'mage', UNITS, 'm1');
		expect(next).toEqual([
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'm1', unitId: 'mage' }
		]);
		expect(entries).toEqual([{ id: 'w1', unitId: 'warrior' }]);
	});

	it('stops adding once the unit limit is reached across entries', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' },
			{ id: 'w3', unitId: 'warrior' }
		];
		expect(addArmyUnit(entries, 'warrior', UNITS, 'w4')).toBe(entries);
		expect(addArmyUnit([{ id: 'm1', unitId: 'mage' }], 'mage', UNITS, 'm2')).toEqual([
			{ id: 'm1', unitId: 'mage' }
		]);
	});

	it('adds units without roster info, since no limit applies', () => {
		expect(addArmyUnit([], 'ghost', UNITS, 'g1')).toEqual([{ id: 'g1', unitId: 'ghost' }]);
	});
});

describe('removeArmyEntry', () => {
	it('removes the entry with the given id', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(removeArmyEntry(entries, 'w1')).toEqual([{ id: 'w2', unitId: 'warrior' }]);
	});

	it('is a no-op for an unknown entry id', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(removeArmyEntry(entries, 'ghost')).toBe(entries);
	});
});

describe('removeArmyCopy', () => {
	it('removes the most recently added copy of the unit', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', mounted: true },
			{ id: 'm1', unitId: 'mage' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(removeArmyCopy(entries, 'warrior')).toEqual([
			{ id: 'w1', unitId: 'warrior', mounted: true },
			{ id: 'm1', unitId: 'mage' }
		]);
	});

	it('is a no-op for an unknown unit', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(removeArmyCopy(entries, 'warrior')).toBe(entries);
	});
});

describe('resolveArmyEntries', () => {
	it('returns one row per copy', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(resolveArmyEntries(entries, UNITS, MOUNTS)).toEqual([
			{
				entryId: 'w1',
				unitId: 'warrior',
				name: 'Warrior',
				points: 25,
				mounted: false,
				effectiveStats: STATS
			},
			{
				entryId: 'w2',
				unitId: 'warrior',
				name: 'Warrior',
				points: 25,
				mounted: false,
				effectiveStats: STATS
			}
		]);
	});

	it('skips entries whose unit no longer exists', () => {
		expect(resolveArmyEntries([{ id: 'g1', unitId: 'ghost' }], UNITS, MOUNTS)).toEqual([]);
	});

	it('carries the optional icon through for display', () => {
		const units: ArmyUnitSpec[] = [
			{ id: 'oni', name: 'Oni', points: 5, limit: 1, stats: STATS, icon: 'oni.jpg' }
		];
		expect(resolveArmyEntries([{ id: 'o1', unitId: 'oni' }], units, [])).toEqual([
			{
				entryId: 'o1',
				unitId: 'oni',
				name: 'Oni',
				points: 5,
				icon: 'oni.jpg',
				mounted: false,
				effectiveStats: STATS
			}
		]);
	});

	it('marks a copy as mounted and adds the mount cost and stats', () => {
		expect(
			resolveArmyEntries([{ id: 'd1', unitId: 'dragoon', mounted: true }], UNITS, MOUNTS)
		).toEqual([
			{
				entryId: 'd1',
				unitId: 'dragoon',
				name: 'Slayer Dragoon',
				points: 22,
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

describe('armyPoints', () => {
	it('is zero for an empty army', () => {
		expect(armyPoints([], UNITS)).toBe(0);
	});

	it('sums every copy of every selected unit', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' },
			{ id: 'w3', unitId: 'warrior' },
			{ id: 'a1', unitId: 'archer' },
			{ id: 'a2', unitId: 'archer' }
		];
		expect(armyPoints(entries, UNITS)).toBe(115);
	});

	it('adds the mount cost per mounted copy only', () => {
		const entries: ArmyEntry[] = [
			{ id: 'd1', unitId: 'dragoon', mounted: true },
			{ id: 'd2', unitId: 'dragoon' }
		];
		expect(armyPoints(entries, UNITS)).toBe(39);
	});
});

describe('armyCopyCounts', () => {
	it('counts copies per unit id', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'm1', unitId: 'mage' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(armyCopyCounts(entries)).toEqual({ warrior: 2, mage: 1 });
	});

	it('returns an empty record for an empty army', () => {
		expect(armyCopyCounts([])).toEqual({});
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
});

describe('toggleArmyMount', () => {
	it('flips the mount state of a single copy only', () => {
		const entries: ArmyEntry[] = [
			{ id: 'd1', unitId: 'dragoon' },
			{ id: 'd2', unitId: 'dragoon' }
		];
		const toggled = toggleArmyMount(entries, 'd1', UNITS);
		expect(toggled).toEqual([
			{ id: 'd1', unitId: 'dragoon', mounted: true },
			{ id: 'd2', unitId: 'dragoon' }
		]);
		expect(toggleArmyMount(toggled, 'd1', UNITS)).toEqual([
			{ id: 'd1', unitId: 'dragoon', mounted: false },
			{ id: 'd2', unitId: 'dragoon' }
		]);
	});

	it('ignores copies of units without a mount option', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(toggleArmyMount(entries, 'w1', UNITS)).toBe(entries);
	});

	it('ignores unknown entries', () => {
		const entries: ArmyEntry[] = [{ id: 'd1', unitId: 'dragoon' }];
		expect(toggleArmyMount(entries, 'ghost', UNITS)).toBe(entries);
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
