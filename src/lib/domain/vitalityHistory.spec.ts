import { describe, expect, it } from 'vitest';
import {
	foldHistory,
	parseVitalityCommit,
	undoableAction,
	type HistoryAction,
	type HistoryEntry,
	type HistoryRevert,
	type VitalityAction,
	type VitalityBases
} from './vitalityHistory';
import type { PlayerKey } from './twoPlayer';
import type { UnitStatus } from './army';

const BASES: VitalityBases = {
	player1: {
		chiyohime: { hp: 4, sta: 2, undead: false },
		nostamina: { hp: 3, sta: null, undead: false }
	},
	player2: {
		champion: { hp: 5, sta: 3, undead: false },
		ghoul: { hp: 2, sta: 1, undead: true }
	}
};

let seq = 0;
function action(
	actor: PlayerKey,
	targetSeat: PlayerKey,
	targetEntryId: string,
	targetName: string,
	vitalityAction: VitalityAction,
	originName: string | null = null,
	originEntryId: string | null = null,
	targetCopy: number | null = null
): HistoryAction {
	seq += 1;
	return {
		kind: 'action',
		seq,
		round: 1,
		actor,
		at: '2026-10-12T10:00:00.000Z',
		targetSeat,
		targetEntryId,
		targetName,
		targetCopy,
		originEntryId,
		originName,
		action: vitalityAction,
		undoneBy: null
	};
}

function revert(actor: PlayerKey, revertOf: number): HistoryRevert {
	seq += 1;
	return { kind: 'revert', seq, round: 1, actor, at: '2026-10-12T10:01:00.000Z', revertOf };
}

function damage(amount: number): VitalityAction {
	return { kind: 'damage', amount };
}
function heal(amount: number): VitalityAction {
	return { kind: 'heal', amount };
}
function statuses(
	statuses: UnitStatus[],
	added: UnitStatus[] = [],
	removed: UnitStatus[] = []
): VitalityAction {
	return { kind: 'statuses', statuses, added, removed };
}

describe('foldHistory', () => {
	it('replays a cross-model hit into the target seat’s map', () => {
		seq = 0;
		const hit = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			damage(4),
			'Chiyohime',
			'chiyohime'
		);
		const fold = foldHistory([hit], BASES);
		expect(fold.vitality.player2.champion).toEqual({ hp: 1, sta: 3 });
		expect(fold.vitality.player1).toEqual({});
	});

	it('never drops Life below zero, however large the declared hit', () => {
		seq = 0;
		const fold = foldHistory(
			[action('player1', 'player2', 'champion', 'Clan Champion', damage(99))],
			BASES
		);
		expect(fold.vitality.player2.champion?.hp).toBe(0);
	});

	it('heals to the overheal cap and no further', () => {
		seq = 0;
		const fold = foldHistory(
			[action('player2', 'player1', 'chiyohime', 'Chiyohime', heal(99))],
			BASES
		);
		expect(fold.vitality.player1.chiyohime?.hp).toBe(8);
	});

	it('forces the fall at zero Life and the death on a second hit', () => {
		seq = 0;
		const fall = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			damage(5),
			'Chiyohime',
			'chiyohime'
		);
		const kill = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			damage(1),
			'Chiyohime',
			'chiyohime'
		);
		const fold = foldHistory([fall, kill], BASES);
		// Dead and Incapacitated never share a copy: the kill trades the fall's Incapacitated
		// for Dead, and Crouched stays on the corpse.
		expect(fold.vitality.player2.champion?.statuses).not.toContain('incapacitated');
		expect(fold.vitality.player2.champion?.statuses).toContain('crouched');
		expect(fold.vitality.player2.champion?.statuses).toContain('dead');
		expect(fold.sentences[fall.seq]).toEqual([
			'Chiyohime has dealt 5 damage to Clan Champion',
			'Clan Champion receives Incapacitated',
			'Clan Champion receives Crouched'
		]);
		expect(fold.sentences[kill.seq]).toEqual([
			'Chiyohime has dealt 1 damage to Clan Champion',
			'Clan Champion is Dead'
		]);
	});

	it('stands a fallen model back up on a heal of at least one', () => {
		seq = 0;
		const fall = action('player1', 'player2', 'champion', 'Clan Champion', damage(5));
		const lift = action('player2', 'player2', 'champion', 'Clan Champion', heal(2));
		const fold = foldHistory([fall, lift], BASES);
		expect(fold.vitality.player2.champion?.hp).toBe(2);
		expect(fold.vitality.player2.champion?.statuses).not.toContain('incapacitated');
		// Crouched is forced on at zero Life but is not lifted by the rise - only Incapacitated
		// and Dead are - so the standing model still carries it until a player clears it.
		expect(fold.vitality.player2.champion?.statuses).toContain('crouched');
		expect(fold.sentences[lift.seq]).toEqual([
			'Clan Champion recovers 2 Life',
			'Clan Champion stands back up'
		]);
	});

	it('brings a corpse back to play on a heal of at least one', () => {
		seq = 0;
		const fall = action('player1', 'player2', 'champion', 'Clan Champion', damage(5));
		const kill = action('player1', 'player2', 'champion', 'Clan Champion', damage(1));
		const revive = action('player2', 'player2', 'champion', 'Clan Champion', heal(1));
		const fold = foldHistory([fall, kill, revive], BASES);
		expect(fold.vitality.player2.champion?.hp).toBe(1);
		expect(fold.vitality.player2.champion?.statuses).not.toContain('dead');
		expect(fold.sentences[revive.seq]).toEqual([
			'Clan Champion recovers 1 Life',
			'Clan Champion returns to play'
		]);
	});

	it('spends activations on Stagger and every one on Stun', () => {
		seq = 0;
		const stagger = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			{ kind: 'stagger' },
			'Chiyohime',
			'chiyohime'
		);
		const stun = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			{ kind: 'stun' },
			'Chiyohime',
			'chiyohime'
		);
		const fold = foldHistory([stagger, stun], BASES);
		expect(fold.vitality.player2.champion?.sta).toBe(0);
		expect(fold.sentences[stagger.seq]?.[0]).toBe(
			'Chiyohime staggers Clan Champion - one activation spent'
		);
		expect(fold.sentences[stun.seq]?.[0]).toBe(
			'Chiyohime stuns Clan Champion - every activation spent'
		);
	});

	it('walks Stamina both ways and caps over-Stamina at double the base', () => {
		seq = 0;
		const up = action('player1', 'player1', 'chiyohime', 'Chiyohime', {
			kind: 'stamina',
			delta: 99
		});
		const down = action('player1', 'player1', 'chiyohime', 'Chiyohime', {
			kind: 'stamina',
			delta: -2
		});
		const fold = foldHistory([up, down], BASES);
		expect(fold.vitality.player1.chiyohime?.sta).toBe(2);
		expect(fold.sentences[up.seq]).toEqual(['Chiyohime regains 99 activations']);
		expect(fold.sentences[down.seq]).toEqual(['Chiyohime spends 2 activations']);
	});

	it('applies a status draft wholesale and names every added and removed State', () => {
		seq = 0;
		const assign = action(
			'player1',
			'player2',
			'champion',
			'Clan Champion',
			statuses(['poison-2'], ['poison-2'], []),
			'Chiyohime',
			'chiyohime'
		);
		const clear = action(
			'player2',
			'player2',
			'champion',
			'Clan Champion',
			statuses([], [], ['poison-2'])
		);
		const fold = foldHistory([assign, clear], BASES);
		expect(fold.vitality.player2.champion?.statuses).toBeUndefined();
		expect(fold.sentences[assign.seq]).toEqual([
			'Chiyohime assigns Strong Poison to Clan Champion'
		]);
		expect(fold.sentences[clear.seq]).toEqual(['Clan Champion sheds Strong Poison']);
	});

	it('still narrates an action against an entry the bases do not know', () => {
		seq = 0;
		const stray = action('player1', 'player2', 'nobody', 'Nobody', damage(3));
		const fold = foldHistory([stray], BASES);
		// No base stats, so no vitality and no forced-State lines - but the commit line reads,
		// which is what a battle report needs when one half of the board never published.
		expect(fold.vitality.player2).toEqual({});
		expect(fold.sentences[stray.seq]).toEqual(['Nobody takes 3 damage']);
	});

	it('lets a revert walk its action back out of the fold', () => {
		seq = 0;
		const hit = action('player1', 'player2', 'champion', 'Clan Champion', damage(4));
		const other = action('player2', 'player2', 'champion', 'Clan Champion', heal(1));
		const undo = revert('player1', hit.seq);
		const folded = foldHistory([hit, other, undo], BASES);
		expect(folded.vitality.player2.champion).toEqual({ hp: 6, sta: 3 });
		// The undone hit keeps its commit line for the list, but no forced-State lines and no
		// effect on the board.
		expect(folded.sentences[hit.seq]).toEqual(['Clan Champion takes 4 damage']);
		expect(folded.sentences[other.seq]?.[0]).toBe('Clan Champion recovers 1 Life');
	});
});

describe('undoableAction', () => {
	it('offers the caller’s own last action while it stands', () => {
		seq = 0;
		const mine = action('player1', 'player2', 'champion', 'Clan Champion', damage(2));
		expect(undoableAction([mine], 'player1')).toBe(mine);
		expect(undoableAction([mine], 'player2')).toBeNull();
	});

	it('offers nothing when the last action is the opponent’s', () => {
		seq = 0;
		const mine = action('player1', 'player2', 'champion', 'Clan Champion', damage(2));
		const theirs = action('player2', 'player1', 'chiyohime', 'Chiyohime', damage(1));
		expect(undoableAction([mine, theirs], 'player1')).toBeNull();
		expect(undoableAction([mine, theirs], 'player2')).toBe(theirs);
	});

	it('offers nothing once the last action is undone, nor on a bare revert', () => {
		seq = 0;
		const mine = action('player1', 'player2', 'champion', 'Clan Champion', damage(2));
		const undone: HistoryAction = { ...mine, undoneBy: 99 };
		expect(undoableAction([undone], 'player1')).toBeNull();
		const entries: HistoryEntry[] = [mine, revert('player1', mine.seq)];
		expect(undoableAction(entries, 'player1')).toBeNull();
	});

	it('offers nothing on an empty log', () => {
		expect(undoableAction([], 'player1')).toBeNull();
	});
});

describe('parseVitalityCommit', () => {
	const identity = {
		targetSeat: 'player2',
		targetEntryId: 'champion',
		targetName: 'Clan Champion',
		targetCopy: null,
		originEntryId: 'chiyohime',
		originName: 'Chiyohime'
	};

	it('accepts a well-formed damage commit', () => {
		expect(parseVitalityCommit({ ...identity, action: { kind: 'damage', amount: 4 } })).toEqual({
			...identity,
			action: { kind: 'damage', amount: 4 }
		});
	});

	it('rejects amounts outside the integer bounds', () => {
		for (const amount of [0, -1, 1.5, 100])
			expect(parseVitalityCommit({ ...identity, action: { kind: 'damage', amount } })).toBeNull();
	});

	it('rejects a zero or oversized Stamina step', () => {
		expect(parseVitalityCommit({ ...identity, action: { kind: 'stamina', delta: 0 } })).toBeNull();
		expect(
			parseVitalityCommit({ ...identity, action: { kind: 'stamina', delta: 100 } })
		).toBeNull();
	});

	it('rejects unknown States and a malformed draft', () => {
		expect(
			parseVitalityCommit({
				...identity,
				action: { kind: 'statuses', statuses: ['nope'], added: [], removed: [] }
			})
		).toBeNull();
		expect(
			parseVitalityCommit({ ...identity, action: { kind: 'statuses', statuses: ['bleeding'] } })
		).toBeNull();
	});

	it('rejects an unknown action kind, a bad seat and an over-long name', () => {
		expect(parseVitalityCommit({ ...identity, action: { kind: 'buff' } })).toBeNull();
		expect(
			parseVitalityCommit({ ...identity, targetSeat: 'player3', action: damage(1) })
		).toBeNull();
		expect(
			parseVitalityCommit({ ...identity, targetName: 'x'.repeat(49), action: damage(1) })
		).toBeNull();
		expect(parseVitalityCommit({ ...identity, targetEntryId: '', action: damage(1) })).toBeNull();
		expect(parseVitalityCommit(null)).toBeNull();
	});
});
