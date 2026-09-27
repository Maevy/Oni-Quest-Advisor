import { describe, expect, it } from 'vitest';
import {
	canJoinTournament,
	createTournamentEvent,
	isTournamentFull,
	joinTournament,
	joinedCount,
	peekTournament,
	seatIndexForTokenHash,
	viewForTournamentToken,
	type TournamentCreation,
	type TournamentState
} from './tournamentEvent';
import type { PickedArmy } from './savedArmy';

const NOW = '2026-09-27T20:00:00.000Z';
const LATER = '2026-09-27T21:30:00.000Z';

const organizerArmy: PickedArmy = { name: 'Marta List', factionId: 'helian-league', code: 'ORG1' };
const playerArmy: PickedArmy = { name: 'Soga List', factionId: 'empire-of-soga', code: 'PLY1' };

function creation(overrides: Partial<TournamentCreation> = {}): TournamentCreation {
	return {
		code: 'ABC234',
		name: 'Eldfall Cup',
		externalLink: 'https://tabletop.events/eldfall-cup',
		organizerName: 'Marta',
		organizerTokenHash: 'org-hash',
		organizerPlays: false,
		organizerArmy: null,
		participantCount: 4,
		manualPairing: false,
		missionIds: ['treasure-hunt', 'quarter-war'],
		tableNames: ['Table 1', 'Table 2'],
		now: NOW,
		...overrides
	};
}

function state(overrides: Partial<TournamentCreation> = {}): TournamentState {
	return createTournamentEvent(creation(overrides));
}

describe('createTournamentEvent', () => {
	it('opens a lobby with one empty seat per pairing slot', () => {
		const event = state();

		expect(event.status).toBe('lobby');
		expect(event.seats).toHaveLength(4);
		expect(event.seats.every((seat) => !seat.organizer && seat.participant === null)).toBe(true);
		expect(event.concludedAt).toBeNull();
	});

	it('carries the whole configuration through', () => {
		const event = state();

		expect(event.code).toBe('ABC234');
		expect(event.name).toBe('Eldfall Cup');
		expect(event.externalLink).toBe('https://tabletop.events/eldfall-cup');
		expect(event.organizerName).toBe('Marta');
		expect(event.manualPairing).toBe(false);
		expect(event.missionIds).toEqual(['treasure-hunt', 'quarter-war']);
		expect(event.tableNames).toEqual(['Table 1', 'Table 2']);
		expect(event.createdAt).toBe(NOW);
		expect(event.updatedAt).toBe(NOW);
	});

	it('copies the mission and table lists rather than aliasing the draft', () => {
		const input = creation();
		const event = createTournamentEvent(input);
		input.missionIds.push('clue-trail');
		input.tableNames[0] = 'Renamed';

		expect(event.missionIds).toEqual(['treasure-hunt', 'quarter-war']);
		expect(event.tableNames).toEqual(['Table 1', 'Table 2']);
	});

	it('fills the first seat with the organizer when they play', () => {
		const event = state({ organizerPlays: true, organizerArmy });

		expect(event.seats[0]).toEqual({
			organizer: true,
			participant: { name: 'Marta', army: organizerArmy, tokenHash: 'org-hash' }
		});
		expect(event.seats.slice(1).every((seat) => seat.participant === null)).toBe(true);
		expect(joinedCount(event)).toBe(1);
	});

	it('leaves every seat empty when the organizer only organizes', () => {
		expect(joinedCount(state())).toBe(0);
	});

	it('refuses to seat a playing organizer without an army', () => {
		expect(() => state({ organizerPlays: true, organizerArmy: null })).toThrow();
	});
});

describe('the join gate', () => {
	it('allows joins while the lobby has a free seat', () => {
		expect(canJoinTournament(state())).toBe(true);
	});

	it('closes once every seat is taken', () => {
		let event = state();
		event = joinTournament(event, 'Ana', playerArmy, 'a', LATER);
		event = joinTournament(event, 'Ben', playerArmy, 'b', LATER);
		event = joinTournament(event, 'Cem', playerArmy, 'c', LATER);
		expect(isTournamentFull(event)).toBe(false);

		event = joinTournament(event, 'Dee', playerArmy, 'd', LATER);
		expect(isTournamentFull(event)).toBe(true);
		expect(canJoinTournament(event)).toBe(false);
	});

	it('counts the organizer as joined from the start', () => {
		const event = state({ organizerPlays: true, organizerArmy });

		expect(joinedCount(event)).toBe(1);
		expect(isTournamentFull(event)).toBe(false);
	});

	it('stops accepting joins once the event is under way', () => {
		expect(canJoinTournament({ ...state(), status: 'active' })).toBe(false);
	});
});

describe('joinTournament', () => {
	it('seats a player in the first free seat', () => {
		const event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);

		expect(event.seats[0].participant).toEqual({ name: 'Ana', army: playerArmy, tokenHash: 'a' });
		expect(event.seats[0].organizer).toBe(false);
		expect(event.updatedAt).toBe(LATER);
	});

	it('skips the organizer seat when filling', () => {
		const event = joinTournament(
			state({ organizerPlays: true, organizerArmy }),
			'Ana',
			playerArmy,
			'a',
			LATER
		);

		expect(event.seats[0].participant?.name).toBe('Marta');
		expect(event.seats[1].participant?.name).toBe('Ana');
	});

	it('fills seats in order', () => {
		let event = state();
		event = joinTournament(event, 'Ana', playerArmy, 'a', LATER);
		event = joinTournament(event, 'Ben', playerArmy, 'b', LATER);

		expect(event.seats.map((seat) => seat.participant?.name ?? null)).toEqual([
			'Ana',
			'Ben',
			null,
			null
		]);
	});

	it('refuses a join into a full lobby', () => {
		let event = state({ participantCount: 4 });
		for (const token of ['a', 'b', 'c', 'd']) {
			event = joinTournament(event, token, playerArmy, token, LATER);
		}

		expect(() => joinTournament(event, 'Eve', playerArmy, 'e', LATER)).toThrow('cannot be joined');
	});

	it('refuses a second seat for the same token', () => {
		const event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);

		expect(() => joinTournament(event, 'Ana again', playerArmy, 'a', LATER)).toThrow(
			'already holds a seat'
		);
	});

	it('refuses a join once the event is under way', () => {
		expect(() =>
			joinTournament({ ...state(), status: 'active' }, 'Ana', playerArmy, 'a', LATER)
		).toThrow();
	});

	it('leaves the original untouched', () => {
		const before = state();
		joinTournament(before, 'Ana', playerArmy, 'a', LATER);

		expect(before.seats.every((seat) => seat.participant === null)).toBe(true);
	});
});

describe('seatIndexForTokenHash', () => {
	it('finds the organizer on their seat when they play', () => {
		expect(seatIndexForTokenHash(state({ organizerPlays: true, organizerArmy }), 'org-hash')).toBe(
			0
		);
	});

	it('finds nobody for the organizer token when they only organize', () => {
		expect(seatIndexForTokenHash(state(), 'org-hash')).toBeNull();
	});

	it('finds a joined player', () => {
		const event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);

		expect(seatIndexForTokenHash(event, 'a')).toBe(0);
		expect(seatIndexForTokenHash(event, 'unknown')).toBeNull();
	});
});

describe('viewForTournamentToken', () => {
	it('shows the organizer their own seat and role', () => {
		const view = viewForTournamentToken(state({ organizerPlays: true, organizerArmy }), 'org-hash');

		expect(view?.role).toBe('organizer');
		expect(view?.seatIndex).toBe(0);
		expect(view?.seats[0]).toEqual({
			organizer: true,
			name: 'Marta',
			army: { name: 'Marta List', factionId: 'helian-league' },
			you: true
		});
	});

	it('gives a non-playing organizer the whole lobby without a seat', () => {
		const view = viewForTournamentToken(state(), 'org-hash');

		expect(view?.role).toBe('organizer');
		expect(view?.seatIndex).toBeNull();
		expect(view?.seats.every((seat) => !seat.you)).toBe(true);
	});

	it('marks only the viewer’s own seat for a player', () => {
		let event = state();
		event = joinTournament(event, 'Ana', playerArmy, 'a', LATER);
		event = joinTournament(event, 'Ben', playerArmy, 'b', LATER);
		const view = viewForTournamentToken(event, 'b');

		expect(view?.role).toBe('player');
		expect(view?.seatIndex).toBe(1);
		expect(view?.seats.map((seat) => seat.you)).toEqual([false, true, false, false]);
	});

	it('never leaks an army code or a seat token', () => {
		let event = state({ organizerPlays: true, organizerArmy });
		event = joinTournament(event, 'Ana', playerArmy, 'a-secret-hash', LATER);
		const view = viewForTournamentToken(event, 'org-hash');

		const serialized = JSON.stringify(view);
		expect(serialized).not.toContain('PLY1');
		expect(serialized).not.toContain('ORG1');
		expect(serialized).not.toContain('a-secret-hash');
		expect(serialized).not.toContain('org-hash');
	});

	it('refuses a token that holds no seat', () => {
		expect(viewForTournamentToken(state(), 'stranger')).toBeNull();
	});

	it('reports the fill state', () => {
		const view = viewForTournamentToken(state(), 'org-hash');

		expect(view?.joinedCount).toBe(0);
		expect(view?.full).toBe(false);
	});
});

describe('peekTournament', () => {
	it('tells an unauthenticated visitor only what the join page needs', () => {
		const peek = peekTournament(state({ organizerPlays: true, organizerArmy }));

		expect(peek).toEqual({
			code: 'ABC234',
			status: 'lobby',
			name: 'Eldfall Cup',
			organizerName: 'Marta',
			participantCount: 4,
			joinedCount: 1,
			full: false,
			canJoin: true
		});
	});

	it('says so when the field is full', () => {
		let event = state({ participantCount: 4 });
		for (const token of ['a', 'b', 'c', 'd']) {
			event = joinTournament(event, token, playerArmy, token, LATER);
		}

		expect(peekTournament(event).full).toBe(true);
		expect(peekTournament(event).canJoin).toBe(false);
	});
});
