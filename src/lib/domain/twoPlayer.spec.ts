import { describe, expect, it } from 'vitest';
import {
	calculateTwoPlayerVP,
	chooseTwoPlayerScheme,
	clearTwoPlayerScheme,
	createEmptyTwoPlayerProgress,
	revealTwoPlayerScheme,
	setTwoPlayerObjectiveChecked,
	setTwoPlayerRound,
	setTwoPlayerSchemeChecked,
	setTwoPlayerSchemeDraft
} from './twoPlayer';
import { CEASEFIRE_OBJECTIVE_ID, type Mission } from './mission';
import { MAX_TOTAL_VP, MIN_ROUND, MAX_ROUND } from './progress';
import { type SchemeCard } from './scheme';

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

const headHunt: SchemeCard = {
	id: 'head-hunt',
	title: 'Head Hunt',
	ruleText: '...',
	factionIds: ['empire-of-soga'],
	copies: 2,
	maxIncrements: 3,
	vpPerIncrement: 1
};

describe('createEmptyTwoPlayerProgress', () => {
	it('initialises both players with empty state and round at MIN_ROUND', () => {
		const progress = createEmptyTwoPlayerProgress('test-mission');
		expect(progress.missionId).toBe('test-mission');
		expect(progress.gameMode).toBe('two-player');
		expect(progress.currentRound).toBe(MIN_ROUND);
		expect(progress.player1.checkedObjectiveCounts).toEqual({});
		expect(progress.player1.scheme).toBeNull();
		expect(progress.player1.schemeDraft).toEqual({ factionId: null, intelligence: null });
		expect(progress.player1.schemeRevealed).toBe(false);
		expect(progress.player2.checkedObjectiveCounts).toEqual({});
		expect(progress.player2.scheme).toBeNull();
		expect(progress.player2.schemeRevealed).toBe(false);
	});
});

describe('setTwoPlayerObjectiveChecked', () => {
	it('checks an objective for one player without affecting the other', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 1, 1);

		expect(progress.player1.checkedObjectiveCounts).toEqual({ 'unlock-cache': 1 });
		expect(progress.player2.checkedObjectiveCounts).toEqual({});
	});

	it('clamps to the valid range', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 5, 2);
		expect(progress.player1.checkedObjectiveCounts).toEqual({ 'unlock-cache': 2 });

		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', -1, 2);
		expect(progress.player1.checkedObjectiveCounts).toEqual({ 'unlock-cache': 0 });
	});

	it('allows both players to independently check the same objective', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 1, 1);
		progress = setTwoPlayerObjectiveChecked(progress, 'player2', 'unlock-cache', 1, 1);

		expect(progress.player1.checkedObjectiveCounts).toEqual({ 'unlock-cache': 1 });
		expect(progress.player2.checkedObjectiveCounts).toEqual({ 'unlock-cache': 1 });
	});
});

describe('setTwoPlayerSchemeDraft', () => {
	it('sets draft for one player only', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerSchemeDraft(progress, 'player1', { factionId: 'helian-league' });
		progress = setTwoPlayerSchemeDraft(progress, 'player1', { intelligence: 14 });

		expect(progress.player1.schemeDraft).toEqual({ factionId: 'helian-league', intelligence: 14 });
		expect(progress.player2.schemeDraft).toEqual({ factionId: null, intelligence: null });
	});
});

describe('chooseTwoPlayerScheme', () => {
	it('assigns a scheme to the specified player', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = chooseTwoPlayerScheme(progress, 'player1', 'head-hunt', 'empire-of-soga', 14);

		expect(progress.player1.scheme).toEqual({
			schemeId: 'head-hunt',
			factionId: 'empire-of-soga',
			intelligence: 14,
			checkedIncrements: 0
		});
		expect(progress.player2.scheme).toBeNull();
	});
});

describe('clearTwoPlayerScheme', () => {
	it('clears the scheme for one player only', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = chooseTwoPlayerScheme(progress, 'player1', 'head-hunt', 'empire-of-soga', 14);
		progress = chooseTwoPlayerScheme(progress, 'player2', 'head-hunt', 'empire-of-soga', 12);
		progress = clearTwoPlayerScheme(progress, 'player1');

		expect(progress.player1.scheme).toBeNull();
		expect(progress.player2.scheme).not.toBeNull();
	});
});

describe('setTwoPlayerSchemeChecked', () => {
	it('updates checked increments for a player scheme', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = chooseTwoPlayerScheme(progress, 'player1', 'head-hunt', 'empire-of-soga', 14);
		progress = setTwoPlayerSchemeChecked(progress, 'player1', 2, headHunt.maxIncrements);

		expect(progress.player1.scheme?.checkedIncrements).toBe(2);
	});

	it('is a no-op when the player has no scheme', () => {
		const progress = createEmptyTwoPlayerProgress(mission.id);
		const result = setTwoPlayerSchemeChecked(progress, 'player1', 2, 3);
		expect(result).toBe(progress);
	});
});

describe('revealTwoPlayerScheme', () => {
	it('marks a scheme as revealed permanently', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = chooseTwoPlayerScheme(progress, 'player1', 'head-hunt', 'empire-of-soga', 14);
		progress = revealTwoPlayerScheme(progress, 'player1');

		expect(progress.player1.schemeRevealed).toBe(true);
		expect(progress.player2.schemeRevealed).toBe(false);
	});

	it('stays revealed after further mutations', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = chooseTwoPlayerScheme(progress, 'player2', 'head-hunt', 'empire-of-soga', 14);
		progress = revealTwoPlayerScheme(progress, 'player2');
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 1, 1);

		expect(progress.player2.schemeRevealed).toBe(true);
	});
});

describe('setTwoPlayerRound', () => {
	it('sets the shared round counter', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerRound(progress, 3);
		expect(progress.currentRound).toBe(3);
	});

	it('clamps to MIN_ROUND..MAX_ROUND', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerRound(progress, 0);
		expect(progress.currentRound).toBe(MIN_ROUND);

		progress = setTwoPlayerRound(progress, 99);
		expect(progress.currentRound).toBe(MAX_ROUND);
	});
});

describe('calculateTwoPlayerVP', () => {
	it('returns 0 for a fresh player', () => {
		const progress = createEmptyTwoPlayerProgress(mission.id);
		expect(calculateTwoPlayerVP(mission, progress.player1, null)).toBe(0);
	});

	it('sums VP from checked objectives for the given player', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'treasure-in-inventory', 1, 1);

		expect(calculateTwoPlayerVP(mission, progress.player1, null)).toBe(2);
		expect(calculateTwoPlayerVP(mission, progress.player2, null)).toBe(0);
	});

	it('adds scheme VP', () => {
		let progress = createEmptyTwoPlayerProgress(mission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 1, 1);
		progress = chooseTwoPlayerScheme(progress, 'player1', 'head-hunt', 'empire-of-soga', 14);
		progress = setTwoPlayerSchemeChecked(progress, 'player1', 2, headHunt.maxIncrements);

		expect(calculateTwoPlayerVP(mission, progress.player1, headHunt)).toBe(1 + 2);
	});

	it('subtracts ceasefire penalty', () => {
		const ceasefireMission: Mission = { ...mission, ceasefire: true };
		let progress = createEmptyTwoPlayerProgress(ceasefireMission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'unlock-cache', 1, 1);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', CEASEFIRE_OBJECTIVE_ID, 1, 1);

		expect(calculateTwoPlayerVP(ceasefireMission, progress.player1, null)).toBe(1 - 4);
	});

	it('caps at MAX_TOTAL_VP', () => {
		const richMission: Mission = {
			...mission,
			results: [{ id: 'jackpot', text: 'Big score.', vp: 6, count: 2 }]
		};
		let progress = createEmptyTwoPlayerProgress(richMission.id);
		progress = setTwoPlayerObjectiveChecked(progress, 'player1', 'jackpot', 2, 2);

		expect(calculateTwoPlayerVP(richMission, progress.player1, null)).toBe(MAX_TOTAL_VP);
	});
});
