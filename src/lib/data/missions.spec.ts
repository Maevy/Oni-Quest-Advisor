import { describe, expect, it } from 'vitest';
import { loadMissions } from './missions';

const missions = loadMissions();
const ceasefireMissions = missions.filter((mission) => mission.ceasefire);

describe('mission content', () => {
	it('loads the bundled missions, ceasefire ones included', () => {
		expect(missions.length).toBeGreaterThan(0);
		expect(ceasefireMissions.length).toBeGreaterThan(0);
	});

	it('gives ceasefire missions no Results objective that scores in Round 1', () => {
		// The 1st Round Ceasefire forbids VP during round 1, so a Round-1 objective would
		// contradict the rule the same mission displays.
		const offenders = ceasefireMissions.flatMap((mission) =>
			mission.results
				.filter((result) => /\bRound 1\b/i.test(result.text))
				.map((result) => `${mission.id}/${result.id}`)
		);

		expect(offenders).toEqual([]);
	});

	it('leaves Awaiting Reinforcements the four scoreable round-ends', () => {
		const awaiting = missions.find((mission) => mission.id === 'awaiting-reinforcements');

		expect(awaiting?.results.map((result) => result.count)).toEqual([4, 4, 4]);
	});
});
