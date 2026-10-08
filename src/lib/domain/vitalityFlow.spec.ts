import { describe, expect, it } from 'vitest';
import {
	allTargetsFor,
	aliveTargetsFor,
	damageApplied,
	healApplied,
	healableTargetsFor,
	staminaCap,
	vitalityAfterBoxTap,
	vitalityAfterDamage,
	vitalityAfterHeal,
	vitalityAfterStamina,
	vitalityAfterStatuses,
	type VitalityTarget
} from './vitalityFlow';
import type { BattleFlowerSpec } from './savedArmy';
import type { UnitStatus } from './army';

function flower(
	entryId: string,
	name: string,
	hp: number | null,
	max = 3,
	statuses: UnitStatus[] = [],
	undead = false
): BattleFlowerSpec {
	return {
		entryId,
		name,
		mountedOn: null,
		stamina: null,
		life: hp === null ? null : { current: hp, max, states: [] },
		statuses,
		undead
	};
}

const ids = (targets: VitalityTarget[]): string[] => targets.map((target) => target.entryId);

const SEATS = [
	{
		player: 'player1' as const,
		flowers: [flower('p1-a', 'Shieldbearer', 3), flower('p1-b', 'Shieldbearer', 1)]
	},
	{ player: 'player2' as const, flowers: [flower('p2-a', 'Oni Raider', 2)] }
];

describe('aliveTargetsFor', () => {
	it('lists every living copy of both seats, in seat order', () => {
		expect(ids(aliveTargetsFor(SEATS))).toEqual(['p1-a', 'p1-b', 'p2-a']);
	});

	it('keeps the fallen - another hit on them is how Dead arrives - and skips the Dead', () => {
		const targets = aliveTargetsFor([
			{
				player: 'player1',
				flowers: [
					flower('fallen', 'Shieldbearer', 0),
					flower('dead', 'Shieldbearer', 0, 3, ['dead']),
					flower('nohp', 'Summon', null),
					flower('ok', 'Shieldbearer', 2)
				]
			}
		]);
		expect(ids(targets)).toEqual(['fallen', 'ok']);
	});

	it('numbers duplicate copies per seat, leaving unique names unnumbered', () => {
		const targets = aliveTargetsFor([
			{
				player: 'player1',
				flowers: [
					flower('a', 'Shieldbearer', 3),
					flower('b', 'Shieldbearer', 3),
					flower('c', 'Shieldbearer', 0),
					flower('d', 'Captain', 3)
				]
			},
			{ player: 'player2', flowers: [flower('e', 'Shieldbearer', 3)] }
		]);
		expect(targets.map((target) => target.copy)).toEqual([1, 2, 3, null, null]);
	});
});

describe('healableTargetsFor', () => {
	it('lists every copy below its overheal cap, from the fallen to the whole', () => {
		const targets = healableTargetsFor([
			{
				player: 'player1',
				flowers: [
					flower('full', 'Shieldbearer', 3),
					flower('hurt', 'Shieldbearer', 1),
					flower('fallen', 'Captain', 0),
					flower('capped', 'Captain', 4, 2)
				]
			},
			{ player: 'player2', flowers: [flower('p2', 'Oni Raider', 2, 2)] }
		]);
		expect(ids(targets)).toEqual(['full', 'hurt', 'fallen', 'p2']);
	});

	it('skips the Dead, except an Undead copy on the floor - Dead is its fall', () => {
		const targets = healableTargetsFor([
			{
				player: 'player1',
				flowers: [
					flower('corpse', 'Shieldbearer', 0, 3, ['dead']),
					flower('undead-down', 'Ghoul', 0, 3, ['dead'], true),
					flower('undead-killed', 'Ghoul', 2, 3, ['dead'], true)
				]
			}
		]);
		expect(ids(targets)).toEqual(['undead-down']);
	});

	it('skips copies without Life', () => {
		const targets = healableTargetsFor([
			{ player: 'player1', flowers: [flower('nohp', 'Summon', null)] }
		]);
		expect(ids(targets)).toEqual([]);
	});
});

describe('allTargetsFor', () => {
	it('lists every copy of both seats, fallen and untracked alike', () => {
		const targets = allTargetsFor([
			{
				player: 'player1',
				flowers: [
					flower('dead', 'Shieldbearer', 0),
					flower('nohp', 'Summon', null),
					flower('hurt', 'Captain', 1, 3, ['bleeding'])
				]
			},
			{ player: 'player2', flowers: [flower('p2', 'Oni Raider', 2)] }
		]);
		expect(ids(targets)).toEqual(['dead', 'nohp', 'hurt', 'p2']);
	});

	it('numbers duplicate copies per seat exactly as the other rows do', () => {
		const targets = allTargetsFor([
			{
				player: 'player1',
				flowers: [flower('a', 'Shieldbearer', 0), flower('b', 'Shieldbearer', 3)]
			},
			{ player: 'player2', flowers: [flower('c', 'Shieldbearer', 3)] }
		]);
		expect(targets.map((target) => target.copy)).toEqual([1, 2, null]);
	});
});

describe('damageApplied', () => {
	it('takes the whole amount while Life lasts', () => {
		expect(damageApplied(2, 5)).toBe(2);
	});

	it('clamps to what is left, and to zero', () => {
		expect(damageApplied(6, 2)).toBe(2);
		expect(damageApplied(3, 0)).toBe(0);
	});
});

describe('healApplied', () => {
	it('restores the whole amount while boxes are dark', () => {
		expect(healApplied(2, 1, 3)).toBe(2);
	});

	it('heals a whole model into its overheal', () => {
		expect(healApplied(2, 3, 3)).toBe(2);
	});

	it('clamps at the overheal cap, and a capped model not at all', () => {
		expect(healApplied(6, 2, 3)).toBe(4);
		expect(healApplied(3, 6, 3)).toBe(0);
	});
});

describe('vitalityAfterDamage', () => {
	it('reads an untouched copy as full', () => {
		expect(vitalityAfterDamage(undefined, 4, 2, 3)).toEqual({ hp: 1, sta: 2 });
	});

	it('keeps stamina and States, and never drops below zero', () => {
		const after = vitalityAfterDamage({ hp: 2, sta: 1, statuses: ['bleeding'] }, 4, 2, 6);
		expect(after).toEqual({ hp: 0, sta: 1, statuses: ['bleeding'] });
	});

	it('kills a copy already on the floor instead of taking Life it has not got', () => {
		expect(
			vitalityAfterDamage({ hp: 0, sta: 1, statuses: ['crouched', 'incapacitated'] }, 2, 2, 3)
		).toEqual({ hp: 0, sta: 1, statuses: ['crouched', 'dead', 'incapacitated'] });
	});

	it('does not kill on a hit that merely floors the copy, nor on a hit of nothing', () => {
		expect(vitalityAfterDamage({ hp: 1, sta: 1 }, 2, 2, 5)).toEqual({ hp: 0, sta: 1 });
		expect(vitalityAfterDamage({ hp: 0, sta: 1, statuses: ['incapacitated'] }, 2, 2, 0)).toEqual({
			hp: 0,
			sta: 1,
			statuses: ['incapacitated']
		});
	});
});

describe('vitalityAfterHeal', () => {
	it('fills the dark boxes and keeps stamina and States', () => {
		const after = vitalityAfterHeal({ hp: 1, sta: 1, statuses: ['bleeding'] }, 4, 2, 2);
		expect(after).toEqual({ hp: 3, sta: 1, statuses: ['bleeding'] });
	});

	it('reads an untouched copy as full', () => {
		expect(vitalityAfterHeal(undefined, 4, 2, 3)).toEqual({ hp: 7, sta: 2 });
	});

	it('heals into the overheal and stops at double the base', () => {
		expect(vitalityAfterHeal({ hp: 2, sta: 2 }, 2, 2, 3)).toEqual({ hp: 4, sta: 2 });
		expect(vitalityAfterHeal({ hp: 3, sta: 2 }, 4, 2, 6)).toEqual({ hp: 8, sta: 2 });
	});
});

describe('vitalityAfterStatuses', () => {
	it('replaces the States wholesale and keeps Life and stamina', () => {
		const after = vitalityAfterStatuses({ hp: 1, sta: 2, statuses: ['bleeding'] }, 4, 2, [
			'slowed'
		]);
		expect(after).toEqual({ hp: 1, sta: 2, statuses: ['slowed'] });
	});

	it('reads an untouched copy as full', () => {
		expect(vitalityAfterStatuses(undefined, 4, 2, ['panicked'])).toEqual({
			hp: 4,
			sta: 2,
			statuses: ['panicked']
		});
	});

	it('drops the key again once the draft clears every State', () => {
		expect(vitalityAfterStatuses({ hp: 2, sta: 1, statuses: ['bleeding'] }, 4, 2, [])).toEqual({
			hp: 2,
			sta: 1
		});
	});
});

describe('vitalityAfterStamina', () => {
	it('caps over-Stamina at double the base, like Life', () => {
		expect(staminaCap(3)).toBe(6);
		expect(vitalityAfterStamina({ hp: 4, sta: 6 }, 4, 3, 1)).toEqual({ hp: 4, sta: 6 });
		expect(vitalityAfterStamina({ hp: 4, sta: 5 }, 4, 3, 4)).toEqual({ hp: 4, sta: 6 });
	});

	it('never spends below zero', () => {
		expect(vitalityAfterStamina({ hp: 4, sta: 0 }, 4, 3, -1)).toEqual({ hp: 4, sta: 0 });
		expect(vitalityAfterStamina({ hp: 4, sta: 1 }, 4, 3, -5)).toEqual({ hp: 4, sta: 0 });
	});

	it('moves one point and keeps Life and States', () => {
		expect(vitalityAfterStamina({ hp: 1, sta: 2, statuses: ['bleeding'] }, 4, 3, -1)).toEqual({
			hp: 1,
			sta: 1,
			statuses: ['bleeding']
		});
		expect(vitalityAfterStamina({ hp: 1, sta: 2 }, 4, 3, 1)).toEqual({ hp: 1, sta: 3 });
	});

	it('reads an untouched copy as full, and a null base as nothing to move', () => {
		expect(vitalityAfterStamina(undefined, 4, 3, -1)).toEqual({ hp: 4, sta: 2 });
		expect(vitalityAfterStamina(undefined, 4, 3, 1)).toEqual({ hp: 4, sta: 4 });
		expect(vitalityAfterStamina({ hp: 2, sta: 0 }, 2, null, 1)).toEqual({ hp: 2, sta: 0 });
	});
});

describe('vitalityAfterBoxTap', () => {
	it('sets the tapped half straight to the box and keeps the other', () => {
		expect(vitalityAfterBoxTap({ hp: 4, sta: 2 }, 4, 3, 'life', 1)).toEqual({ hp: 1, sta: 2 });
		expect(vitalityAfterBoxTap({ hp: 4, sta: 2 }, 4, 3, 'stamina', 1)).toEqual({ hp: 4, sta: 1 });
	});

	it('clamps at zero and at the caps, and keeps States', () => {
		expect(
			vitalityAfterBoxTap({ hp: 1, sta: 1, statuses: ['bleeding'] }, 4, 3, 'life', 99)
		).toEqual({
			hp: 8,
			sta: 1,
			statuses: ['bleeding']
		});
		expect(vitalityAfterBoxTap({ hp: 1, sta: 1 }, 4, 3, 'stamina', 99)).toEqual({ hp: 1, sta: 3 });
		expect(vitalityAfterBoxTap({ hp: 2, sta: 2 }, 2, 2, 'life', 0)).toEqual({ hp: 0, sta: 2 });
	});

	it('reads an untouched copy as full, and a null base as nothing to set', () => {
		expect(vitalityAfterBoxTap(undefined, 4, 3, 'stamina', 2)).toEqual({ hp: 4, sta: 2 });
		expect(vitalityAfterBoxTap({ hp: 2, sta: 0 }, 2, null, 'stamina', 3)).toEqual({
			hp: 2,
			sta: 0
		});
	});
});
