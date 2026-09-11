import { describe, expect, it } from 'vitest';
import { MAX_ROUND, MIN_ROUND } from './progress';
import { groupResults, type ResultsEntry } from './results';
import type { ResultObjectiveDef } from './mission';

function objective(overrides: Partial<ResultObjectiveDef> & { id: string }): ResultObjectiveDef {
	return { text: `Score ${overrides.id}.`, vp: 1, count: 1, ...overrides };
}

function roundGroup(entries: ResultsEntry[], group: string) {
	const entry = entries.find(
		(candidate) => candidate.kind === 'roundGroup' && candidate.group === group
	);
	if (entry?.kind !== 'roundGroup') throw new Error(`no round group "${group}"`);
	return entry;
}

describe('groupResults', () => {
	it('passes ungrouped objectives through in order', () => {
		const entries = groupResults([objective({ id: 'a' }), objective({ id: 'b' })]);

		expect(entries).toEqual([
			{ kind: 'objective', objective: objective({ id: 'a' }) },
			{ kind: 'objective', objective: objective({ id: 'b' }) }
		]);
	});

	it('collapses per-round objectives into one card at the first member position', () => {
		const entries = groupResults([
			objective({ id: 'flat' }),
			objective({ id: 'control-2', group: 'control', round: 2, text: 'Control each Marker.' }),
			objective({ id: 'control-3', group: 'control', round: 3, text: 'Control each Marker.' })
		]);

		expect(entries.map((entry) => entry.kind)).toEqual(['objective', 'roundGroup']);
		expect(roundGroup(entries, 'control').text).toBe('Control each Marker.');
	});

	it('carries a row for every round, locking the ones that score nothing', () => {
		const entries = groupResults([
			objective({ id: 'control-2', group: 'control', round: 2 }),
			objective({ id: 'control-4', group: 'control', round: 4 })
		]);
		const rows = roundGroup(entries, 'control').rows;

		expect(rows.map((row) => row.round)).toEqual([MIN_ROUND, 2, 3, 4, MAX_ROUND]);
		expect(rows.map((row) => row.objective?.id ?? null)).toEqual([
			null,
			'control-2',
			null,
			'control-4',
			null
		]);
	});

	it('keeps each round objective as its own row so per-round instances stay independent', () => {
		const entries = groupResults([
			objective({ id: 'quarters-2', group: 'quarters', round: 2, count: 4 }),
			objective({ id: 'quarters-3', group: 'quarters', round: 3, count: 4 })
		]);
		const rows = roundGroup(entries, 'quarters').rows;

		expect(rows[1].objective?.count).toBe(4);
		expect(rows[2].objective?.count).toBe(4);
	});

	it('takes the card VP from the group members', () => {
		const entries = groupResults([
			objective({ id: 'control-2', group: 'control', round: 2, vp: 2 })
		]);

		expect(roundGroup(entries, 'control').vp).toBe(2);
	});
});
