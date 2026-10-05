import { describe, expect, it } from 'vitest';
import {
	BYE_VICTORY_POINTS,
	MAX_TOURNAMENT_MESSAGES,
	TOURNAMENT_ROUND_PHASES,
	advanceRound,
	assignOccupant,
	canAdvanceRound,
	canAssignOccupants,
	canCancelTournament,
	canConcludeTournament,
	canJoinTournament,
	canLeaveTournament,
	canSendTournamentMessage,
	canStartRound,
	canStartTournament,
	cancelTournament,
	concludeTournament,
	createTournamentEvent,
	createTournamentRound,
	cumulativeVictoryPoints,
	fieldNeedsBye,
	hydrateTournamentState,
	isRoundReady,
	isRoundScored,
	isTournamentFull,
	joinTournament,
	joinedCount,
	leaveTournament,
	markMessagesRead,
	messagesForSeat,
	peekTournament,
	recordTableResult,
	registeredSeatIndexes,
	replayTable,
	seatIndexForTokenHash,
	seatsAtTable,
	sendTournamentMessage,
	startRound,
	startTournament,
	tableForSeat,
	tablePlaysAGame,
	tournamentGameId,
	tournamentRoadmap,
	tournamentStandings,
	unassignedOccupants,
	unreadMessageCount,
	viewForTournamentToken,
	type TournamentCreation,
	type TournamentMatchResult,
	type TournamentRoundPhase,
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

describe('leaveTournament', () => {
	it('frees the leaving player’s seat', () => {
		let event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);
		event = joinTournament(event, 'Ben', playerArmy, 'b', LATER);

		const left = leaveTournament(event, 'a', LATER);

		expect(left.seats.map((seat) => seat.participant?.name ?? null)).toEqual([
			null,
			'Ben',
			null,
			null
		]);
		expect(joinedCount(left)).toBe(1);
		expect(left.updatedAt).toBe(LATER);
	});

	it('opens the freed seat to the next joiner', () => {
		let event = state({ participantCount: 4 });
		for (const token of ['a', 'b', 'c', 'd']) {
			event = joinTournament(event, token, playerArmy, token, LATER);
		}
		expect(canJoinTournament(event)).toBe(false);

		const left = leaveTournament(event, 'b', LATER);
		const rejoined = joinTournament(left, 'Eve', playerArmy, 'e', LATER);

		expect(canJoinTournament(left)).toBe(true);
		expect(seatIndexForTokenHash(rejoined, 'e')).toBe(1);
		expect(seatIndexForTokenHash(rejoined, 'b')).toBeNull();
	});

	it('keeps the organizer’s own seat when a player leaves', () => {
		let event = state({ organizerPlays: true, organizerArmy });
		event = joinTournament(event, 'Ana', playerArmy, 'a', LATER);

		const left = leaveTournament(event, 'a', LATER);

		expect(left.seats[0].participant?.name).toBe('Marta');
		expect(left.seats[0].organizer).toBe(true);
	});

	it('refuses to leave once the event is running', () => {
		const event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);

		expect(canLeaveTournament({ ...event, status: 'active' })).toBe(false);
		expect(() => leaveTournament({ ...event, status: 'active' }, 'a', LATER)).toThrow(
			'cannot be left'
		);
	});

	it('refuses the organizer, who cancels instead of leaving', () => {
		const event = state({ organizerPlays: true, organizerArmy });

		expect(() => leaveTournament(event, 'org-hash', LATER)).toThrow('cancels the tournament');
	});

	it('refuses a token that holds no seat', () => {
		expect(() => leaveTournament(state(), 'stranger', LATER)).toThrow('holds no seat');
	});

	it('leaves the original untouched', () => {
		const event = joinTournament(state(), 'Ana', playerArmy, 'a', LATER);
		leaveTournament(event, 'a', LATER);

		expect(joinedCount(event)).toBe(1);
	});
});

describe('cancelTournament', () => {
	it('closes a lobby', () => {
		const cancelled = cancelTournament(state(), LATER);

		expect(cancelled.status).toBe('closed');
		expect(cancelled.updatedAt).toBe(LATER);
	});

	it('closes an event that is already running', () => {
		const event: TournamentState = { ...state(), status: 'active' };

		expect(canCancelTournament(event)).toBe(true);
		expect(cancelTournament(event, LATER).status).toBe('closed');
	});

	it('refuses an event that already ended', () => {
		expect(canCancelTournament({ ...state(), status: 'concluded' })).toBe(false);
		expect(() => cancelTournament({ ...state(), status: 'concluded' }, LATER)).toThrow(
			'already ended'
		);
		expect(() => cancelTournament({ ...state(), status: 'closed' }, LATER)).toThrow();
	});

	it('keeps the seats, so an open device is told it was cancelled rather than meeting a 404', () => {
		let event = state({ organizerPlays: true, organizerArmy });
		event = joinTournament(event, 'Ana', playerArmy, 'a', LATER);

		const cancelled = cancelTournament(event, LATER);
		const view = viewForTournamentToken(cancelled, 'a');

		expect(view?.status).toBe('closed');
		expect(view?.seats.map((seat) => seat.name)).toEqual(['Marta', 'Ana', null, null]);
	});

	it('closes the door on joining and on the invite link', () => {
		const cancelled = cancelTournament(state(), LATER);
		const peek = peekTournament(cancelled);

		expect(canJoinTournament(cancelled)).toBe(false);
		expect(peek.canJoin).toBe(false);
		expect(peek.status).toBe('closed');
		expect(() => joinTournament(cancelled, 'Ana', playerArmy, 'a', LATER)).toThrow();
	});

	it('leaves the original untouched', () => {
		const event = state();
		cancelTournament(event, LATER);

		expect(event.status).toBe('lobby');
	});
});

/**
 * A lobby with `players` seats taken (token `t0`, `t1`, …). The field defaults to the smallest
 * even size that leaves at most one seat empty — the size the wizard would offer for that many
 * players — so a started fixture is always a startable event.
 */
function lobbyWith(players: number, overrides: Partial<TournamentCreation> = {}): TournamentState {
	const field = Math.max(4, players % 2 === 0 ? players : players + 1);
	let event = state({ participantCount: field, ...overrides });
	for (let index = 0; index < players; index += 1) {
		event = joinTournament(event, `P${index + 1}`, playerArmy, `t${index}`, LATER);
	}
	return event;
}

/** A started event whose round is being prepared. */
function roundWith(players: number, overrides: Partial<TournamentCreation> = {}): TournamentState {
	return startTournament(lobbyWith(players, overrides), LATER);
}

describe('registeredSeatIndexes and fieldNeedsBye', () => {
	it('lists only the seats somebody took', () => {
		expect(registeredSeatIndexes(lobbyWith(3))).toEqual([0, 1, 2]);
		expect(registeredSeatIndexes(lobbyWith(0))).toEqual([]);
	});

	it('counts the playing organizer as a registered player', () => {
		const event = lobbyWith(2, { organizerPlays: true, organizerArmy });

		expect(registeredSeatIndexes(event)).toEqual([0, 1, 2]);
		expect(fieldNeedsBye(event)).toBe(true);
	});

	it('needs a BYE exactly when the registered field is odd', () => {
		expect(fieldNeedsBye(lobbyWith(2))).toBe(false);
		expect(fieldNeedsBye(lobbyWith(3))).toBe(true);
		expect(fieldNeedsBye(lobbyWith(4))).toBe(false);
	});
});

describe('startTournament', () => {
	it('needs at least two players and at most one empty seat', () => {
		expect(canStartTournament(lobbyWith(0))).toBe(false);
		expect(canStartTournament(lobbyWith(1))).toBe(false);
		expect(canStartTournament(lobbyWith(2))).toBe(false); // a four-field with two no-shows
		expect(canStartTournament(lobbyWith(3))).toBe(true); // the BYE takes the last seat
		expect(canStartTournament(lobbyWith(4))).toBe(true);
		expect(() => startTournament(lobbyWith(2), LATER)).toThrow('cannot be started');
	});

	it('opens round 1 on the first mission with empty tables and zero points', () => {
		const started = startTournament(lobbyWith(3), LATER);

		expect(started.status).toBe('active');
		expect(started.round).toEqual({
			number: 1,
			missionId: 'treasure-hunt',
			phase: 'setup',
			tables: [[], []],
			matches: [null, null],
			victoryPoints: [0, 0, 0, 0]
		});
		expect(started.updatedAt).toBe(LATER);
	});

	it('starts with one seat empty, the BYE filling it', () => {
		const started = startTournament(lobbyWith(3, { participantCount: 4 }), LATER);

		expect(started.round?.tables).toHaveLength(2); // the configured table list, not the field
		expect(unassignedOccupants(started)).toHaveLength(4); // three players plus the BYE
	});

	it('refuses to start while two or more seats are empty', () => {
		const twoEmpty = lobbyWith(2, { participantCount: 4 });

		expect(canStartTournament(twoEmpty)).toBe(false);
		expect(() => startTournament(twoEmpty, LATER)).toThrow('cannot be started');
	});

	it('refuses to start twice', () => {
		const started = startTournament(lobbyWith(4), LATER);

		expect(canStartTournament(started)).toBe(false);
		expect(() => startTournament(started, LATER)).toThrow();
	});

	it('refuses a round the mission list cannot cover', () => {
		expect(() => createTournamentRound(lobbyWith(2), 3)).toThrow('No mission is configured');
	});

	it('leaves the original untouched', () => {
		const event = lobbyWith(4);
		startTournament(event, LATER);

		expect(event.status).toBe('lobby');
		expect(event.round).toBeNull();
	});
});

describe('unassignedOccupants', () => {
	it('lists every registered player, then the BYE for an odd field', () => {
		expect(unassignedOccupants(roundWith(3))).toEqual([
			{ kind: 'seat', seatIndex: 0 },
			{ kind: 'seat', seatIndex: 1 },
			{ kind: 'seat', seatIndex: 2 },
			{ kind: 'bye' }
		]);
	});

	it('has no BYE for an even field', () => {
		expect(unassignedOccupants(roundWith(4)).some((occupant) => occupant.kind === 'bye')).toBe(
			false
		);
	});

	it('is empty while the event is still a lobby', () => {
		expect(unassignedOccupants(lobbyWith(3))).toEqual([]);
	});
});

describe('assignOccupant', () => {
	it('seats a player at a table and takes them out of the pool', () => {
		const assigned = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 1, LATER);

		expect(assigned.round?.tables[1]).toEqual([{ kind: 'seat', seatIndex: 0 }]);
		expect(unassignedOccupants(assigned)).toEqual([
			{ kind: 'seat', seatIndex: 1 },
			{ kind: 'seat', seatIndex: 2 },
			{ kind: 'seat', seatIndex: 3 }
		]);
	});

	it('moves a seated player instead of copying them', () => {
		let event = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 0 }, 1, LATER);

		expect(event.round?.tables).toEqual([[], [{ kind: 'seat', seatIndex: 0 }]]);
	});

	it('sends a player back to the pool when the table is null', () => {
		let event = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 0 }, null, LATER);

		expect(event.round?.tables).toEqual([[], []]);
		expect(unassignedOccupants(event)).toHaveLength(4);
	});

	it('assigns the BYE like any other occupant', () => {
		const assigned = assignOccupant(roundWith(3), { kind: 'bye' }, 0, LATER);

		expect(assigned.round?.tables[0]).toEqual([{ kind: 'bye' }]);
	});

	it('refuses a BYE the field does not need', () => {
		expect(() => assignOccupant(roundWith(4), { kind: 'bye' }, 0, LATER)).toThrow('needs no BYE');
	});

	it('refuses a third occupant at one table', () => {
		let event = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 1 }, 0, LATER);

		expect(() => assignOccupant(event, { kind: 'seat', seatIndex: 2 }, 0, LATER)).toThrow(
			'table is full'
		);
	});

	it('refuses a seat nobody holds and a table that does not exist', () => {
		const event = roundWith(3); // seat 3 of the four-field stays empty

		expect(() => assignOccupant(event, { kind: 'seat', seatIndex: 3 }, 0, LATER)).toThrow(
			'holds no player'
		);
		expect(() => assignOccupant(event, { kind: 'seat', seatIndex: 0 }, 7, LATER)).toThrow(
			'Unknown table'
		);
		expect(() => assignOccupant(event, { kind: 'seat', seatIndex: 0 }, -1, LATER)).toThrow();
	});

	it('refuses while the event is still a lobby or already over', () => {
		const occupant = { kind: 'seat', seatIndex: 0 } as const;

		expect(() => assignOccupant(lobbyWith(2), occupant, 0, LATER)).toThrow('not preparing a round');
		expect(() =>
			assignOccupant(cancelTournament(roundWith(4), LATER), occupant, 0, LATER)
		).toThrow();
	});

	it('leaves the original untouched', () => {
		const event = roundWith(4);
		assignOccupant(event, { kind: 'seat', seatIndex: 0 }, 0, LATER);

		expect(event.round?.tables).toEqual([[], []]);
	});
});

describe('isRoundReady', () => {
	it('is false while anybody is still in the pool', () => {
		const event = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 0, LATER);

		expect(isRoundReady(event)).toBe(false);
	});

	it('is false for an untouched round', () => {
		expect(isRoundReady(roundWith(4))).toBe(false);
		expect(isRoundReady(lobbyWith(2))).toBe(false);
	});

	it('is true once every player is paired, with the tables it does not need left empty', () => {
		let event = assignOccupant(roundWith(4), { kind: 'seat', seatIndex: 0 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 1 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 2 }, 1, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 3 }, 1, LATER);

		expect(isRoundReady(event)).toBe(true);
	});

	it('is true when the odd player sits with the BYE', () => {
		let event = assignOccupant(roundWith(3), { kind: 'seat', seatIndex: 0 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 1 }, 0, LATER);
		event = assignOccupant(event, { kind: 'seat', seatIndex: 2 }, 1, LATER);
		expect(isRoundReady(event)).toBe(false);

		event = assignOccupant(event, { kind: 'bye' }, 1, LATER);

		expect(isRoundReady(event)).toBe(true);
	});

	it('rejects an arrangement that assigns everybody but strands two of them alone', () => {
		const fourTables = {
			participantCount: 7, // six players and one seat left open — the most the rule allows
			tableNames: ['Table 1', 'Table 2', 'Table 3', 'Table 4']
		};
		let event = roundWith(6, fourTables);
		const seat = (index: number) => ({ kind: 'seat', seatIndex: index }) as const;
		for (const [index, table] of [0, 0, 1, 1, 2, 3].entries()) {
			event = assignOccupant(event, seat(index), table, LATER);
		}

		expect(unassignedOccupants(event)).toEqual([]);
		expect(event.round?.tables.map((table) => table.length)).toEqual([2, 2, 1, 1]);
		expect(isRoundReady(event)).toBe(false);
	});
});

describe('hydrateTournamentState', () => {
	it('gives a state written before the round existed its null', () => {
		const legacy = JSON.parse(
			JSON.stringify({ ...lobbyWith(2), round: undefined })
		) as TournamentState;

		expect(legacy.round).toBeUndefined();
		expect(hydrateTournamentState(legacy).round).toBeNull();
	});

	it('keeps a round that is there', () => {
		const event = roundWith(4);

		expect(hydrateTournamentState(event).round).toEqual(event.round);
	});
});

describe('the round in the view', () => {
	it('carries the round, the pool, the standing and the gate', () => {
		const event = roundWith(3);
		const view = viewForTournamentToken(event, 'org-hash');

		expect(view?.round?.number).toBe(1);
		expect(view?.round?.missionId).toBe('treasure-hunt');
		expect(view?.round?.pool).toHaveLength(4); // three players plus the BYE
		expect(view?.round?.ready).toBe(false);
		expect(view?.round?.standings).toEqual([
			{ seatIndex: 0, name: 'P1', victoryPoints: 0, place: 1 },
			{ seatIndex: 1, name: 'P2', victoryPoints: 0, place: 1 },
			{ seatIndex: 2, name: 'P3', victoryPoints: 0, place: 1 }
		]);
		expect(view?.needsBye).toBe(true);
	});

	it('tells the organizer whether the event may start, and never a player', () => {
		const lobby = lobbyWith(1);

		expect(viewForTournamentToken(lobby, 'org-hash')?.canStart).toBe(false);
		expect(viewForTournamentToken(lobbyWith(3), 'org-hash')?.canStart).toBe(true);
		expect(viewForTournamentToken(startTournament(lobbyWith(3), LATER), 'org-hash')?.canStart).toBe(
			false
		);
	});

	it('has no round while the event is a lobby', () => {
		expect(viewForTournamentToken(lobbyWith(2), 'org-hash')?.round).toBeNull();
	});
});

/** A started event whose pairing is complete, so the round itself may start. */
function pairedRound(
	players: number,
	overrides: Partial<TournamentCreation> = {}
): TournamentState {
	let event = roundWith(players, overrides);
	const tableCount = event.round?.tables.length ?? 1;
	unassignedOccupants(event).forEach((occupant, index) => {
		event = assignOccupant(event, occupant, Math.floor(index / 2) % tableCount, LATER);
	});
	return event;
}

function inPhase(event: TournamentState, phase: TournamentRoundPhase): TournamentState {
	const round = event.round;
	if (round === null) throw new Error('That event has no round');
	return { ...event, round: { ...round, phase } };
}

describe('startRound', () => {
	it('needs a complete pairing first', () => {
		const unpaired = roundWith(4);

		expect(canStartRound(unpaired)).toBe(false);
		expect(() => startRound(unpaired, LATER)).toThrow('cannot be started');
	});

	it('moves the round from setup to game', () => {
		const started = startRound(pairedRound(4), LATER);

		expect(started.round?.phase).toBe('game');
		expect(started.round?.tables).toEqual(pairedRound(4).round?.tables);
		expect(started.updatedAt).toBe(LATER);
	});

	it('locks the tables once the round is under way', () => {
		const started = startRound(pairedRound(4), LATER);

		expect(canAssignOccupants(started)).toBe(false);
		expect(() => assignOccupant(started, { kind: 'seat', seatIndex: 0 }, 1, LATER)).toThrow(
			'not preparing a round'
		);
	});

	it('cannot be started twice, and not from a later phase either', () => {
		const started = startRound(pairedRound(4), LATER);

		expect(canStartRound(started)).toBe(false);
		expect(() => startRound(started, LATER)).toThrow();
		expect(canStartRound(inPhase(pairedRound(4), 'scoring'))).toBe(false);
	});

	it('is unavailable in the lobby and for a cancelled event', () => {
		expect(canStartRound(lobbyWith(2))).toBe(false);
		expect(canStartRound(cancelTournament(pairedRound(4), LATER))).toBe(false);
	});

	it('leaves the original untouched', () => {
		const event = pairedRound(4);
		startRound(event, LATER);

		expect(event.round?.phase).toBe('setup');
	});
});

describe('tournamentRoadmap', () => {
	it('lays out three steps per mission, then the conclusion', () => {
		const roadmap = tournamentRoadmap(roundWith(4, { missionIds: ['a', 'b'] }));

		expect(roadmap.steps.map((step) => step.id)).toEqual([
			'round-1-setup',
			'round-1-game',
			'round-1-scoring',
			'round-2-setup',
			'round-2-game',
			'round-2-scoring',
			'conclusion'
		]);
		expect(roadmap.steps[0]).toEqual({ id: 'round-1-setup', round: 1, phase: 'setup' });
		expect(roadmap.steps[6]).toEqual({ id: 'conclusion', round: null, phase: 'conclusion' });
	});

	it('walks setup, game and scoring within a round', () => {
		const paired = pairedRound(4);

		expect(tournamentRoadmap(paired).currentIndex).toBe(0);
		expect(tournamentRoadmap(startRound(paired, LATER)).currentIndex).toBe(1);
		expect(tournamentRoadmap(inPhase(paired, 'scoring')).currentIndex).toBe(2);
	});

	it('moves to the next round with the round number', () => {
		const twoRounds = roundWith(4, { missionIds: ['a', 'b'] });
		const second = { ...twoRounds, round: createTournamentRound(twoRounds, 2) };

		expect(tournamentRoadmap(second).currentIndex).toBe(3);
		expect(tournamentRoadmap(inPhase(second, 'game')).currentIndex).toBe(4);
	});

	it('has no current step while the event is still a lobby', () => {
		expect(tournamentRoadmap(lobbyWith(2)).currentIndex).toBe(-1);
	});

	it('ends on the conclusion', () => {
		const concluded = {
			...pairedRound(4, { missionIds: ['a', 'b'] }),
			status: 'concluded' as const
		};
		const roadmap = tournamentRoadmap(concluded);

		expect(roadmap.currentIndex).toBe(roadmap.steps.length - 1);
	});

	it('grows with the configured mission list, one round per mission', () => {
		// The fixture configures two missions: three steps each, plus the conclusion.
		expect(tournamentRoadmap(roundWith(4)).steps).toHaveLength(7);
		expect(tournamentRoadmap(roundWith(4, { missionIds: ['a', 'b', 'c'] })).steps).toHaveLength(10);
	});

	it('names the phases a round walks through', () => {
		expect(TOURNAMENT_ROUND_PHASES).toEqual(['setup', 'game', 'scoring']);
	});
});

describe('the phase in the view', () => {
	it('reports the phase, the gate and the roadmap', () => {
		const paired = pairedRound(4);
		const view = viewForTournamentToken(paired, 'org-hash');

		expect(view?.round?.phase).toBe('setup');
		expect(view?.round?.ready).toBe(true);
		expect(view?.round?.canStartRound).toBe(true);
		expect(view?.round?.roadmap.currentIndex).toBe(0);
		expect(
			viewForTournamentToken(startRound(paired, LATER), 'org-hash')?.round?.canStartRound
		).toBe(false);
		expect(viewForTournamentToken(roundWith(4), 'org-hash')?.round?.canStartRound).toBe(false);
	});

	it('reaches the players too, so their roadmap follows the same step', () => {
		const started = startRound(pairedRound(4), LATER);
		const playerView = viewForTournamentToken(started, 't0');

		expect(playerView?.role).toBe('player');
		expect(playerView?.round?.phase).toBe('game');
		expect(playerView?.round?.roadmap.currentIndex).toBe(1);
	});
});

describe('hydrating a legacy round', () => {
	it('gives a round written before the phase existed its setup', () => {
		const legacy = JSON.parse(
			JSON.stringify({
				...roundWith(4),
				round: {
					number: 1,
					missionId: 'treasure-hunt',
					tables: [[], []],
					victoryPoints: [0, 0, 0, 0]
				}
			})
		) as TournamentState;

		expect((legacy.round as { phase?: string }).phase).toBeUndefined();
		expect(hydrateTournamentState(legacy).round?.phase).toBe('setup');
	});

	it('gives a round written before tables could play an empty match list', () => {
		const legacy = JSON.parse(
			JSON.stringify({ ...roundWith(4), completedRounds: undefined, messages: undefined })
		) as TournamentState;

		const hydrated = hydrateTournamentState(legacy);
		expect(hydrated.round?.matches).toEqual([null, null]);
		expect(hydrated.completedRounds).toEqual([]);
		expect(hydrated.messages).toEqual([]);
	});
});

/** A round whose tables are paired and playing — the state Enter Game meets. */
function playingRound(players = 4, overrides: Partial<TournamentCreation> = {}): TournamentState {
	return startRound(pairedRound(players, overrides), LATER);
}

/** A finished match's score, shaped the way a game's result summary hands it over. */
function played(
	player1: number,
	player2: number,
	winner: 'player1' | 'player2' | 'draw' = 'player1'
): Extract<TournamentMatchResult, { kind: 'played' }> {
	return { kind: 'played', winner, vp: { player1, player2 } };
}

/** Both tables of a round reported, so the round waits on the organizer. */
function scoredRound(players = 4, overrides: Partial<TournamentCreation> = {}): TournamentState {
	let event = playingRound(players, overrides);
	event = recordTableResult(event, 0, played(7, 4), LATER);
	const tables = event.round?.tables.length ?? 2;
	if (tables < 2) return event;
	return recordTableResult(event, 1, played(2, 9, 'player2'), LATER);
}

describe('the tables a round starts', () => {
	it('settles the BYE table at once, and pays its player for the sit-out', () => {
		const event = playingRound(3); // P1 v P2 at table 0, P3 with the BYE at table 1

		expect(tablePlaysAGame(event.round?.tables[1] ?? [])).toBe(false);
		expect(event.round?.matches[1]).toEqual({ attempt: 0, result: { kind: 'bye' } });
		expect(event.round?.victoryPoints).toEqual([0, 0, BYE_VICTORY_POINTS, 0]);
		// The BYE never holds a round open, but the real match still has to report.
		expect(isRoundScored(event)).toBe(false);
	});

	it('leaves a fully paired field with nothing settled', () => {
		expect(playingRound(4).round?.matches).toEqual([null, null]);
	});

	it('lists a table’s seats in occupant order, which is the game’s seat order', () => {
		const event = playingRound(4);

		expect(seatsAtTable(event.round?.tables[0] ?? [])).toEqual([0, 1]);
		expect(seatsAtTable(event.round?.tables[1] ?? [])).toEqual([2, 3]);
		expect(seatsAtTable(playingRound(3).round?.tables[1] ?? [])).toEqual([2]);
	});

	it('finds the table a seat plays at', () => {
		const event = playingRound(4);

		expect(tableForSeat(event, 0)).toBe(0);
		expect(tableForSeat(event, 3)).toBe(1);
		expect(tableForSeat(roundWith(4), 0)).toBeNull(); // still in the pool
	});
});

describe('recordTableResult', () => {
	it('adds the score to the two players at that table and nobody else', () => {
		const event = recordTableResult(playingRound(4), 0, played(7, 4), LATER);

		expect(event.round?.victoryPoints).toEqual([7, 4, 0, 0]);
		expect(event.round?.matches[0]?.result).toEqual(played(7, 4));
		expect(event.round?.phase).toBe('game'); // the other table is still playing
	});

	it('moves the round to scoring once every table has reported', () => {
		const event = scoredRound();

		expect(event.round?.victoryPoints).toEqual([7, 4, 2, 9]);
		expect(isRoundScored(event)).toBe(true);
		expect(event.round?.phase).toBe('scoring');
	});

	it('scores a report once, however often it arrives', () => {
		const once = recordTableResult(playingRound(4), 0, played(7, 4), LATER);

		// An auto-finished stale game and a leader's last click can both report the same match.
		expect(recordTableResult(once, 0, played(7, 4), LATER)).toEqual(once);
		expect(recordTableResult(once, 0, played(10, 10), LATER)).toEqual(once);
	});

	it('refuses a round that is not being played', () => {
		expect(() => recordTableResult(pairedRound(4), 0, played(1, 1), LATER)).toThrow(
			'not being played'
		);
		expect(() => recordTableResult(playingRound(4), 5, played(1, 1), LATER)).toThrow(
			'Unknown table'
		);
	});

	it('needs a round that scores the BYE to be complete without it', () => {
		const event = recordTableResult(playingRound(3), 0, played(6, 3), LATER);

		expect(event.round?.victoryPoints).toEqual([6, 3, BYE_VICTORY_POINTS, 0]);
		expect(event.round?.phase).toBe('scoring');
	});
});

describe('a dead table replays', () => {
	it('moves the attempt on, which is what gives the replay a game of its own', () => {
		const event = replayTable(playingRound(4), 0, LATER);

		expect(event.round?.matches[0]).toEqual({ attempt: 1, result: null });
		expect(tournamentGameId('ABC234', 1, 0, 1)).not.toBe(tournamentGameId('ABC234', 1, 0, 0));
	});

	it('refuses a table that plays no game or already reported', () => {
		const partial = recordTableResult(playingRound(4), 0, played(7, 4), LATER);

		expect(() => replayTable(playingRound(3), 1, LATER)).toThrow('plays no game');
		expect(() => replayTable(partial, 0, LATER)).toThrow('already reported');
	});
});

describe('the game id a table plays', () => {
	it('is derived, so two devices pressing Enter Game aim at the same row', () => {
		expect(tournamentGameId('ABC234', 2, 1, 0)).toBe('ABC234-R2T2A0');
	});
});

describe('advancing and concluding', () => {
	it('carries the standing into the next round and archives the one it closes', () => {
		const scored = scoredRound();
		const next = advanceRound(scored, LATER);

		expect(next.round?.number).toBe(2);
		expect(next.round?.missionId).toBe('quarter-war');
		expect(next.round?.phase).toBe('setup');
		expect(next.round?.tables).toEqual([[], []]);
		expect(next.round?.matches).toEqual([null, null]);
		// Cumulative: round 2 starts on round 1's totals, not on zero.
		expect(next.round?.victoryPoints).toEqual(scored.round?.victoryPoints);
		expect(next.completedRounds).toHaveLength(1);
		expect(next.completedRounds[0]).toEqual({
			number: 1,
			missionId: 'treasure-hunt',
			tables: scored.round?.tables,
			matches: scored.round?.matches,
			victoryPoints: scored.round?.victoryPoints
		});
	});

	it('refuses to advance while a table has not reported', () => {
		const open = recordTableResult(playingRound(4), 0, played(7, 4), LATER);

		expect(canAdvanceRound(open)).toBe(false);
		expect(() => advanceRound(open, LATER)).toThrow('cannot be advanced');
	});

	it('ends at the mission list: the last round concludes instead of advancing', () => {
		const scored = scoredRound(4, { missionIds: ['treasure-hunt'] });

		expect(canAdvanceRound(scored)).toBe(false);
		expect(canConcludeTournament(scored)).toBe(true);
	});

	it('concludes the event and keeps the standing the archive holds', () => {
		const scored = scoredRound(4, { missionIds: ['treasure-hunt'] });
		const concluded = concludeTournament(scored, LATER);

		expect(concluded.status).toBe('concluded');
		expect(concluded.round).toBeNull();
		expect(concluded.concludedAt).toBe(LATER);
		expect(concluded.completedRounds).toHaveLength(1);
		expect(cumulativeVictoryPoints(concluded)).toEqual([7, 4, 2, 9]);
		expect(canConcludeTournament(concluded)).toBe(false);
		expect(canCancelTournament(concluded)).toBe(false);
	});

	it('ranks the field by points, and lets a tie share the higher place', () => {
		let event = playingRound(4);
		event = recordTableResult(event, 0, played(9, 5), LATER);
		event = recordTableResult(event, 1, played(9, 3), LATER);

		expect(tournamentStandings(event).map((row) => [row.name, row.place])).toEqual([
			['P1', 1],
			['P3', 1],
			['P2', 3], // the tie skips 2nd, as competition ranking does
			['P4', 4]
		]);
	});
});

describe('the organizer’s megaphone', () => {
	it('shouts at one table, or at all of them', () => {
		const event = playingRound(4);
		const table0 = sendTournamentMessage(
			event,
			{ id: 'm1', tableIndex: 0, text: 'Time is up' },
			LATER
		);

		expect(table0.messages[0]).toEqual({
			id: 'm1',
			tableIndex: 0,
			round: 1,
			text: 'Time is up',
			sentAt: LATER,
			readBy: []
		});
		expect(messagesForSeat(table0, 0)).toHaveLength(1);
		expect(messagesForSeat(table0, 2)).toHaveLength(0);

		const all = sendTournamentMessage(
			event,
			{ id: 'm2', tableIndex: null, text: 'Last round' },
			LATER
		);
		expect(messagesForSeat(all, 0)).toHaveLength(1);
		expect(messagesForSeat(all, 2)).toHaveLength(1);
	});

	it('counts what a seat has not opened, and stops counting once it has', () => {
		let event = sendTournamentMessage(
			playingRound(4),
			{ id: 'm1', tableIndex: null, text: 'Time is up' },
			LATER
		);

		expect(unreadMessageCount(event, 0)).toBe(1);
		event = markMessagesRead(event, 0, LATER);
		expect(unreadMessageCount(event, 0)).toBe(0);
		expect(unreadMessageCount(event, 1)).toBe(1); // reading is per seat, not per event
		expect(event.messages[0].readBy).toEqual([0]);
		// Nothing left to read: the state comes back as it was, so no pointless write follows.
		expect(markMessagesRead(event, 0, LATER)).toBe(event);
	});

	it('belongs to the round it was sent in', () => {
		const shouted = sendTournamentMessage(
			playingRound(4),
			{ id: 'm1', tableIndex: null, text: 'Time is up' },
			LATER
		);
		const advanced = advanceRound(scoredRound(4), LATER);

		expect(messagesForSeat(shouted, 0)).toHaveLength(1);
		expect(messagesForSeat({ ...advanced, messages: shouted.messages }, 0)).toHaveLength(0);
	});

	it('keeps the newest and drops the oldest past the cap', () => {
		let event = playingRound(4);
		for (let index = 0; index < MAX_TOURNAMENT_MESSAGES + 5; index += 1) {
			event = sendTournamentMessage(
				event,
				{ id: `m${index}`, tableIndex: null, text: `Message ${index}` },
				LATER
			);
		}

		expect(event.messages).toHaveLength(MAX_TOURNAMENT_MESSAGES);
		expect(event.messages[0].id).toBe(`m${MAX_TOURNAMENT_MESSAGES + 4}`);
	});

	it('runs while the event is active, and not before or after', () => {
		expect(canSendTournamentMessage(lobbyWith(4))).toBe(false);
		expect(canSendTournamentMessage(playingRound(4))).toBe(true);
		expect(
			canSendTournamentMessage(
				concludeTournament(scoredRound(4, { missionIds: ['treasure-hunt'] }), LATER)
			)
		).toBe(false);
	});

	it('refuses an empty shout, an overlong one and a table that does not exist', () => {
		const event = playingRound(4);

		expect(() =>
			sendTournamentMessage(event, { id: 'm1', tableIndex: null, text: '   ' }, LATER)
		).toThrow('Invalid message');
		expect(() =>
			sendTournamentMessage(event, { id: 'm1', tableIndex: null, text: 'x'.repeat(241) }, LATER)
		).toThrow('Invalid message');
		expect(() =>
			sendTournamentMessage(event, { id: 'm1', tableIndex: 7, text: 'Hello' }, LATER)
		).toThrow('Unknown table');
	});

	it('reaches a player’s view, and never the organizer’s', () => {
		const event = sendTournamentMessage(
			playingRound(4),
			{ id: 'm1', tableIndex: 0, text: 'Time is up' },
			LATER
		);

		const player = viewForTournamentToken(event, 't0');
		expect(player?.messages).toEqual([
			{
				id: 'm1',
				tableIndex: 0,
				round: 1,
				text: 'Time is up',
				sentAt: LATER,
				read: false
			}
		]);
		expect(player?.unreadMessages).toBe(1);
		expect(player?.tableIndex).toBe(0);
		// The other table's player sees nothing, and the organizer — who sent it — has no inbox.
		expect(viewForTournamentToken(event, 't2')?.messages).toEqual([]);
		expect(viewForTournamentToken(event, 'org-hash')?.messages).toEqual([]);
		expect(viewForTournamentToken(event, 'org-hash')?.unreadMessages).toBe(0);
	});
});

describe('the tables in the view', () => {
	it('carries the derived game id and nothing about a game nobody entered', () => {
		const view = viewForTournamentToken(playingRound(4), 'org-hash');

		expect(view?.round?.tables[0].match).toEqual({
			gameId: tournamentGameId('ABC234', 1, 0, 0),
			status: null,
			phase: null,
			result: null,
			scores: []
		});
		expect(view?.round?.tables[0].plays).toBe(true);
	});

	it('takes a match’s live status from the server, which is the only place it exists', () => {
		const event = playingRound(4);
		const gameId = tournamentGameId('ABC234', 1, 0, 0);
		const view = viewForTournamentToken(event, 'org-hash', {
			[gameId]: { status: 'active', phase: 'playing' }
		});

		expect(view?.round?.tables[0].match.status).toBe('active');
		expect(view?.round?.tables[0].match.phase).toBe('playing');
		expect(view?.round?.tables[1].match.status).toBeNull();
	});

	it('hands a finished table’s score back per seat, in occupant order', () => {
		const event = recordTableResult(playingRound(4), 0, played(7, 4), LATER);
		const view = viewForTournamentToken(event, 't0');

		expect(view?.round?.tables[0].match.scores).toEqual([
			{ seatIndex: 0, vp: 7 },
			{ seatIndex: 1, vp: 4 }
		]);
		expect(view?.round?.scored).toBe(false);
	});

	it('says what the BYE table paid, without a game behind it', () => {
		const view = viewForTournamentToken(playingRound(3), 't2');

		expect(view?.round?.tables[1].plays).toBe(false);
		expect(view?.round?.tables[1].match.result).toEqual({ kind: 'bye' });
		expect(view?.round?.tables[1].match.scores).toEqual([{ seatIndex: 2, vp: BYE_VICTORY_POINTS }]);
	});

	it('follows the attempt a replay moved, so the panel points at the new game', () => {
		const event = replayTable(playingRound(4), 0, LATER);
		const view = viewForTournamentToken(event, 'org-hash');

		expect(view?.round?.tables[0].match.gameId).toBe(tournamentGameId('ABC234', 1, 0, 1));
	});

	it('counts the rounds played for the conclusion screen', () => {
		expect(viewForTournamentToken(playingRound(4), 'org-hash')?.roundsPlayed).toBe(0);
		expect(viewForTournamentToken(scoredRound(4), 'org-hash')?.roundsPlayed).toBe(0);
		expect(
			viewForTournamentToken(advanceRound(scoredRound(4), LATER), 'org-hash')?.roundsPlayed
		).toBe(1);
	});
});
