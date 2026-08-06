import { describe, expect, it } from 'vitest';
import { getMissionsForSeason, getSeasons } from './season';
import type { Mission } from './mission';

function mission(id: string, season: string): Mission {
	return {
		id,
		season,
		name: id,
		description: '',
		brokenMorale: false,
		ceasefire: false,
		setup: [],
		map: { zone: { type: 'horizontal', rangeInches: 8 }, markers: [] },
		results: [],
		questRules: []
	};
}

const missions = [mission('m1', 'Season 1'), mission('m2', 'Season 2'), mission('m3', 'Season 2')];

describe('getSeasons', () => {
	it('returns each distinct season exactly once', () => {
		expect(getSeasons(missions)).toEqual(['Season 1', 'Season 2']);
	});
});

describe('getMissionsForSeason', () => {
	it('returns only the missions belonging to that season', () => {
		expect(getMissionsForSeason(missions, 'Season 2').map((m) => m.id)).toEqual(['m2', 'm3']);
	});
});
