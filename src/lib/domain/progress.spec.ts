import { describe, expect, it } from 'vitest';
import {
	calculateTotalVP,
	createEmptyProgress,
	setObjectiveChecked,
	setSchemeDraft
} from './progress';
import { CEASEFIRE_OBJECTIVE_ID, type Mission } from './mission';
import { chooseScheme, setSchemeChecked, type SchemeCard } from './scheme';

const mission: Mission = {
	id: 'obelisk-strike',
	season: 'Season 2',
	name: 'Obelisk Strike',
	description: '...',
	brokenMorale: false,
	ceasefire: false,
	setup: [],
	map: { zone: { type: 'horizontal', rangeInches: 8 }, markers: [] },
	results: [
		{ id: 'unlock-cache', text: 'Unlock the Cache.', vp: 1, count: 1 },
		{ id: 'treasure-in-inventory', text: 'Keep the Treasure.', vp: 2, count: 1 }
	],
	questRules: [{ label: '', description: '...' }]
};

describe('setObjectiveChecked', () => {
	it('checks and unchecks a single-count objective like a plain toggle', () => {
		const empty = createEmptyProgress(mission.id);

		const checked = setObjectiveChecked(empty, 'unlock-cache', 1, 1);
		expect(checked.checkedObjectiveCounts).toEqual({ 'unlock-cache': 1 });

		const unchecked = setObjectiveChecked(checked, 'unlock-cache', 0, 1);
		expect(unchecked.checkedObjectiveCounts).toEqual({ 'unlock-cache': 0 });
	});

	it('clamps to the given max count', () => {
		const empty = createEmptyProgress(mission.id);

		expect(setObjectiveChecked(empty, 'unlock-cache', 5, 2).checkedObjectiveCounts).toEqual({
			'unlock-cache': 2
		});
		expect(setObjectiveChecked(empty, 'unlock-cache', -1, 2).checkedObjectiveCounts).toEqual({
			'unlock-cache': 0
		});
	});
});

describe('setSchemeDraft', () => {
	it('starts with no faction/intelligence set', () => {
		expect(createEmptyProgress(mission.id).schemeDraft).toEqual({
			factionId: null,
			intelligence: null
		});
	});

	it('merges a partial update, leaving the other field untouched', () => {
		let progress = createEmptyProgress(mission.id);
		progress = setSchemeDraft(progress, { factionId: 'helian-league' });
		progress = setSchemeDraft(progress, { intelligence: 5 });

		expect(progress.schemeDraft).toEqual({ factionId: 'helian-league', intelligence: 5 });
	});
});

describe('calculateTotalVP', () => {
	it('sums VP from checked Results objectives only', () => {
		const progress = setObjectiveChecked(
			createEmptyProgress(mission.id),
			'treasure-in-inventory',
			1,
			1
		);

		expect(calculateTotalVP(mission, progress, null)).toBe(2);
	});

	it('multiplies VP by the checked count for a multi-token objective (e.g. 2 Cache tokens)', () => {
		const missionWithTwoTokens: Mission = {
			...mission,
			results: [{ id: 'unlock-cache', text: 'Unlock the Cache.', vp: 1, count: 2 }]
		};
		const progress = setObjectiveChecked(
			createEmptyProgress(missionWithTwoTokens.id),
			'unlock-cache',
			2,
			2
		);

		expect(calculateTotalVP(missionWithTwoTokens, progress, null)).toBe(2);
	});

	it("adds the chosen Scheme's VP (checked increments × VP per increment)", () => {
		const schemeCard: SchemeCard = {
			id: 'head-hunt',
			title: 'Head Hunt',
			ruleText: '...',
			factionIds: ['empire-of-soga'],
			copies: 2,
			maxIncrements: 3,
			vpPerIncrement: 1
		};
		let progress = setObjectiveChecked(createEmptyProgress(mission.id), 'unlock-cache', 1, 1);
		progress = {
			...progress,
			scheme: setSchemeChecked(
				chooseScheme(schemeCard.id, 'empire-of-soga', 5),
				2,
				schemeCard.maxIncrements
			)
		};

		expect(calculateTotalVP(mission, progress, schemeCard)).toBe(1 + 2);
	});

	it("subtracts the ceasefire penalty when 'Ceasefire broken' is checked", () => {
		const ceasefireMission: Mission = { ...mission, ceasefire: true };
		let progress = setObjectiveChecked(
			createEmptyProgress(ceasefireMission.id),
			'unlock-cache',
			1,
			1
		);
		progress = setObjectiveChecked(progress, CEASEFIRE_OBJECTIVE_ID, 1, 1);

		expect(calculateTotalVP(ceasefireMission, progress, null)).toBe(1 - 4);
	});

	it('does not count the ceasefire penalty while it is unchecked', () => {
		const ceasefireMission: Mission = { ...mission, ceasefire: true };
		const progress = setObjectiveChecked(
			createEmptyProgress(ceasefireMission.id),
			'unlock-cache',
			1,
			1
		);

		expect(calculateTotalVP(ceasefireMission, progress, null)).toBe(1);
	});

	it('sums per-box Scheme VP for cards with uneven increment values (e.g. Martial Valor)', () => {
		const martialValor: SchemeCard = {
			id: 'martial-valor',
			title: 'Martial Valor',
			ruleText: '...',
			factionIds: ['helian-league', 'empire-of-soga'],
			copies: 2,
			maxIncrements: 2,
			incrementVp: [2, 1]
		};
		let progress = createEmptyProgress(mission.id);
		progress = {
			...progress,
			scheme: setSchemeChecked(
				chooseScheme(martialValor.id, 'helian-league', 5),
				1,
				martialValor.maxIncrements
			)
		};

		expect(calculateTotalVP(mission, progress, martialValor)).toBe(2);
	});
});
