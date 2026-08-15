import { describe, expect, it } from 'vitest';
import {
	CEASEFIRE_OBJECTIVE,
	CEASEFIRE_OBJECTIVE_ID,
	getScoreableResults,
	type Mission
} from './mission';

const mission: Mission = {
	id: 'quarter-war',
	season: 'Season 2',
	name: 'Quarter War',
	description: '...',
	brokenMorale: false,
	ceasefire: false,
	setup: [],
	map: { zone: { type: 'horizontal', rangeInches: 8 }, markers: [] },
	results: [{ id: 'hold-quarter', text: 'Hold a Quarter.', vp: 1, count: 1 }],
	questRules: [{ label: '', description: '...' }]
};

describe('getScoreableResults', () => {
	it('returns the mission results unchanged when there is no ceasefire', () => {
		expect(getScoreableResults(mission)).toEqual(mission.results);
	});

	it('appends the automatic ceasefire objective for ceasefire missions', () => {
		const ceasefireMission: Mission = { ...mission, ceasefire: true };

		expect(getScoreableResults(ceasefireMission)).toEqual([
			...mission.results,
			CEASEFIRE_OBJECTIVE
		]);
	});
});

describe('CEASEFIRE_OBJECTIVE', () => {
	it('is a single checkbox worth −4 VP, labeled "Ceasefire broken"', () => {
		expect(CEASEFIRE_OBJECTIVE).toEqual({
			id: CEASEFIRE_OBJECTIVE_ID,
			text: 'Ceasefire broken',
			vp: -4,
			count: 1
		});
	});
});
