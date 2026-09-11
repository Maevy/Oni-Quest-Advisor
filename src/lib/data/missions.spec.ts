import { describe, expect, it } from 'vitest';
import { MAX_ROUND, MIN_ROUND, type ResultObjectiveDef } from '$lib/domain';
import { loadMissions } from './missions';

const missions = loadMissions();
const ceasefireMissions = missions.filter((mission) => mission.ceasefire);

function groupMembers(results: ResultObjectiveDef[]): Map<string, ResultObjectiveDef[]> {
	const groups = new Map<string, ResultObjectiveDef[]>();
	for (const result of results) {
		if (!result.group) continue;
		const members = groups.get(result.group);
		if (members) {
			members.push(result);
		} else {
			groups.set(result.group, [result]);
		}
	}
	return groups;
}

describe('mission content', () => {
	it('loads the bundled missions, ceasefire ones included', () => {
		expect(missions.length).toBeGreaterThan(0);
		expect(ceasefireMissions.length).toBeGreaterThan(0);
	});

	it('gives every mission unique objective ids', () => {
		// Progress is keyed by objective id, so a duplicate would share one checked count.
		const duplicated = missions.flatMap((mission) => {
			const seen = new Set<string>();
			return mission.results
				.filter((result) => seen.has(result.id) || !seen.add(result.id))
				.map((result) => `${mission.id}/${result.id}`);
		});

		expect(duplicated).toEqual([]);
	});

	it('keeps round-scoped objectives inside the round range and inside a group', () => {
		const offenders = missions.flatMap((mission) =>
			mission.results
				.filter(
					(result) =>
						result.round !== undefined &&
						(result.round < MIN_ROUND || result.round > MAX_ROUND || !result.group)
				)
				.map((result) => `${mission.id}/${result.id}`)
		);

		expect(offenders).toEqual([]);
	});

	it('makes round group members interchangeable apart from their round', () => {
		// The grouped card takes its heading and VP from the first member and renders one row per
		// round, so a member that differs would silently mis-state or mis-score the other rounds.
		const offenders: string[] = [];
		for (const mission of missions) {
			for (const [group, members] of groupMembers(mission.results)) {
				const first = members[0];
				const rounds = members.map((member) => member.round);
				if (new Set(rounds).size !== rounds.length) {
					offenders.push(`${mission.id}/${group}: two members share a round`);
				}
				for (const member of members) {
					if (
						member.text !== first.text ||
						member.vp !== first.vp ||
						member.count !== first.count
					) {
						offenders.push(`${mission.id}/${group}/${member.id}: differs from ${first.id}`);
					}
				}
			}
		}

		expect(offenders).toEqual([]);
	});

	it('gives ceasefire missions no objective that scores in Round 1', () => {
		// The 1st Round Ceasefire forbids VP during round 1, so a Round-1 objective would
		// contradict the rule the same mission displays.
		const offenders = ceasefireMissions.flatMap((mission) =>
			mission.results
				.filter((result) => result.round === MIN_ROUND || /\bRound 1\b/i.test(result.text))
				.map((result) => `${mission.id}/${result.id}`)
		);

		expect(offenders).toEqual([]);
	});

	it('splits Awaiting Reinforcements into one objective per scoreable round-end', () => {
		const awaiting = missions.find((mission) => mission.id === 'awaiting-reinforcements');
		const groups = [...groupMembers(awaiting?.results ?? []).values()];

		expect(groups.map((members) => members[0].group)).toEqual([
			'near-obelisk',
			'stronger-presence-obelisk',
			'sole-presence-obelisk'
		]);
		for (const members of groups) {
			expect(members.map((member) => member.round)).toEqual([2, 3, 4, 5]);
			expect(members.every((member) => member.count === 1)).toBe(true);
		}
	});

	it('splits Supply Run into one scoreable row per round-end', () => {
		// Resources cannot be looted during Round 1 (models may not Interact with Intrigue Tokens
		// then), so the first scoreable round-end is Round 2 — a rules choice, not the ceasefire
		// guard, since Supply Run has no ceasefire. Resources are deposited repeatedly, so each
		// round carries four boxes rather than one.
		const supplyRun = missions.find((mission) => mission.id === 'supply-run');
		expect(supplyRun?.ceasefire).toBe(false);

		const groups = [...groupMembers(supplyRun?.results ?? []).values()];
		expect(groups.map((members) => members[0].group)).toEqual(['deposit-resources']);

		const members = groups[0];
		expect(members.map((member) => member.round)).toEqual([2, 3, 4, 5]);
		expect(members.every((member) => member.count === 4)).toBe(true);
	});
});
