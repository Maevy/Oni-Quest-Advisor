import { describe, expect, it } from 'vitest';
import {
	addSummon,
	commitVitality,
	dismissSummon,
	nextSummonId,
	summonedBy,
	type SummonBoard,
	type SummonedModel
} from './summoning';
import { battleFlowersFor } from './savedArmy';
import type { ArmyView } from './savedArmy';
import type { ArmyRosterRow, ArmyStats, ArmyUnitSpec } from './army';

const STATS: ArmyStats = {
	STA: 2,
	SPD: 4,
	OFF: 10,
	DEF: 10,
	ACC: 8,
	INT: 8,
	AG: 6,
	T: 15,
	ARM: 5,
	HP: 3,
	M: 20
};

function unit(id: string, name: string): ArmyUnitSpec {
	return { id, name, points: 0, limit: 0, stats: STATS, size: 'medium', classes: ['creature'] };
}

function summon(id: string, summonerId: string, unitId = id): SummonedModel {
	return { id, unitId, summonerId };
}

/** A board with one creature on it, called by `summonerId`. */
function boardWith(summonerId: string, unitId = 'gargoyle-tier-i'): SummonBoard {
	return addSummon({ summons: [], vitality: {} }, summonerId, unitId);
}

describe('summon ids', () => {
	it('counts up from one', () => {
		expect(nextSummonId([])).toBe('summon-1');
		expect(nextSummonId([summon('summon-1', 'e1')])).toBe('summon-2');
	});

	it('prefixed so a summon can never read as an army entry id', () => {
		// Army entry ids are crypto.randomUUID(); the vitality map keys both kinds by id.
		expect(nextSummonId([])).toMatch(/^summon-/);
	});

	it('reuses a freed id, which is safe because leaving drops the vitality record', () => {
		const board = boardWith('vizier');
		const dismissed = dismissSummon(board, 'summon-1');
		expect(dismissed.summons).toEqual([]);
		expect(dismissed.vitality).toEqual({});
		expect(nextSummonId(dismissed.summons)).toBe('summon-1');
	});
});

describe('summonedBy', () => {
	it('follows the chain, so a creature that called one takes it along', () => {
		const summons = [
			summon('summon-1', 'vizier'),
			summon('summon-2', 'summon-1'),
			summon('summon-3', 'nara')
		];
		expect(summonedBy(summons, 'vizier')).toEqual(['summon-1', 'summon-2']);
		expect(summonedBy(summons, 'nara')).toEqual(['summon-3']);
	});

	it('excludes the root itself', () => {
		expect(summonedBy([summon('summon-1', 'vizier')], 'summon-1')).toEqual([]);
	});
});

describe('commitVitality - a summon at zero Life', () => {
	it('leaves the field rather than falling: no Incapacitated, no Crouched', () => {
		const board = commitVitality(boardWith('vizier'), 'summon-1', { hp: 0, sta: 1 }, false);
		expect(board.summons).toEqual([]);
		expect(board.vitality['summon-1']).toBeUndefined();
	});

	it('leaves no Dead either, even when the creature is Undead', () => {
		const board = commitVitality(
			boardWith('nara', 'blighted-riftspawn'),
			'summon-1',
			{ hp: 0, sta: 3 },
			true
		);
		expect(board.summons).toEqual([]);
		expect(board.vitality).toEqual({});
	});

	it('keeps a summon that is still standing, settled like any other copy', () => {
		const board = commitVitality(boardWith('vizier'), 'summon-1', { hp: 2, sta: 1 }, false);
		expect(board.summons).toHaveLength(1);
		expect(board.vitality['summon-1']).toEqual({ hp: 2, sta: 1 });
	});
});

describe('commitVitality - a summoner that falls', () => {
	it('takes every creature it called off the field', () => {
		const board = commitVitality(boardWith('vizier'), 'vizier', { hp: 0, sta: 2 }, false);
		expect(board.summons).toEqual([]);
		expect(board.vitality['summon-1']).toBeUndefined();
		// The summoner itself stays: it fell, it was not summoned.
		expect(board.vitality['vizier']?.statuses).toContain('incapacitated');
	});

	it('takes them too when an Undead summoner goes straight to Dead', () => {
		const board = commitVitality(boardWith('nara'), 'nara', { hp: 0, sta: 2 }, true);
		expect(board.summons).toEqual([]);
		expect(board.vitality['nara']?.statuses).toEqual(['dead']);
	});

	it('takes a chain with it, not just the first creature', () => {
		const board: SummonBoard = {
			summons: [summon('summon-1', 'vizier'), summon('summon-2', 'summon-1')],
			vitality: {}
		};
		expect(commitVitality(board, 'vizier', { hp: 0, sta: 1 }, false).summons).toEqual([]);
	});

	it('is permanent: healing the summoner back does not return them', () => {
		let board = commitVitality(boardWith('vizier'), 'vizier', { hp: 0, sta: 2 }, false);
		board = commitVitality(board, 'vizier', { hp: 2, sta: 2 }, false);
		expect(board.summons).toEqual([]);
		expect(board.vitality['vizier']?.statuses).toBeUndefined();
	});

	it("leaves another model's creatures alone", () => {
		const board: SummonBoard = {
			summons: [summon('summon-1', 'vizier'), summon('summon-2', 'nara')],
			vitality: {}
		};
		const next = commitVitality(board, 'vizier', { hp: 0, sta: 1 }, false);
		expect(next.summons.map((model) => model.id)).toEqual(['summon-2']);
	});

	it('does nothing to the field when the summoner stays standing', () => {
		const board = commitVitality(boardWith('vizier'), 'vizier', { hp: 1, sta: 2 }, false);
		expect(board.summons).toHaveLength(1);
	});
});

// --- The board projection: a summon hangs below the flower that called it. ---

function row(entryId: string, name: string): ArmyRosterRow {
	return {
		entryId,
		unitId: entryId,
		name,
		points: 10,
		mounted: false,
		effectiveStats: STATS,
		effectiveSize: 'medium',
		upgradedUnit: unit(entryId, name),
		upgrades: [],
		itemOverrides: {}
	};
}

const gargoyle = unit('gargoyle-tier-i', 'Gargoyle, Tier I');
const golem = unit('golem-tier-ii', 'Golem, Tier II');
const bonewalker = unit('bonewalker', 'Bonewalker, Tier I');

const VIEW: ArmyView = {
	army: { name: 'Test List', factionId: 'sand-kingdoms', code: 'a000:0' },
	rows: [row('vizier', 'Vizier of Conjurations'), row('guard', 'Guard')],
	picks: [],
	summons: [],
	faction: { id: 'sand-kingdoms', name: 'Sand Kingdoms', color: '#1', logo: 's' },
	upgradeIndex: {},
	classIndex: {},
	skillIndex: {},
	traitIndex: {},
	combatArtIndex: {},
	spellcraftIndex: {},
	spells: [],
	stratagemIndex: {},
	itemIndex: {},
	vitality: {}
};

function viewWith(summons: ArmyView['summons'], vitality: ArmyView['vitality'] = {}): ArmyView {
	return { ...VIEW, summons, vitality };
}

describe('battleFlowersFor', () => {
	it('hangs each summon below the flower that called it', () => {
		const view = viewWith([
			{ id: 'summon-1', summonerId: 'vizier', unit: gargoyle },
			{ id: 'summon-2', summonerId: 'guard', unit: bonewalker }
		]);
		expect(battleFlowersFor(view).map((flower) => flower.entryId)).toEqual([
			'vizier',
			'summon-1',
			'guard',
			'summon-2'
		]);
	});

	it('nests a creature below the creature that called it', () => {
		const view = viewWith([
			{ id: 'summon-2', summonerId: 'summon-1', unit: golem },
			{ id: 'summon-1', summonerId: 'vizier', unit: gargoyle }
		]);
		expect(battleFlowersFor(view).map((flower) => flower.entryId)).toEqual([
			'vizier',
			'summon-1',
			'summon-2',
			'guard'
		]);
	});

	it('marks only the summoned flowers, and names who called them', () => {
		const view = viewWith([{ id: 'summon-1', summonerId: 'vizier', unit: gargoyle }]);
		const flowers = battleFlowersFor(view);
		// Board order is vizier, its summon, then guard - so the middle flower is the called one.
		expect(flowers.map((flower) => flower.entryId)).toEqual(['vizier', 'summon-1', 'guard']);
		expect(flowers.map((flower) => flower.summoned)).toEqual([false, true, false]);
		expect(flowers.find((flower) => flower.entryId === 'summon-1')?.summonerId).toBe('vizier');
		expect(flowers.find((flower) => flower.entryId === 'vizier')?.summonerId).toBeNull();
	});

	it("reads a summon's rings from its own spec and its own vitality", () => {
		const view = viewWith([{ id: 'summon-1', summonerId: 'vizier', unit: gargoyle }], {
			'summon-1': { hp: 1, sta: 2 }
		});
		const flower = battleFlowersFor(view).find((candidate) => candidate.entryId === 'summon-1');
		expect(flower?.name).toBe('Gargoyle, Tier I');
		expect(flower?.life).toMatchObject({ current: 1, max: 3 });
		expect(flower?.stamina).toMatchObject({ current: 2, max: 2 });
		expect(flower?.mountedOn).toBeNull();
	});

	it('still shows a summon whose caller is not on the board, so it can be dismissed', () => {
		const view = viewWith([{ id: 'summon-9', summonerId: 'gone', unit: gargoyle }]);
		expect(battleFlowersFor(view).map((flower) => flower.entryId)).toContain('summon-9');
	});

	it('terminates on a stored cycle instead of recursing forever', () => {
		const view = viewWith([
			{ id: 'summon-1', summonerId: 'summon-2', unit: gargoyle },
			{ id: 'summon-2', summonerId: 'summon-1', unit: golem }
		]);
		expect(battleFlowersFor(view).map((flower) => flower.entryId)).toEqual([
			'vizier',
			'guard',
			'summon-1',
			'summon-2'
		]);
	});
});
