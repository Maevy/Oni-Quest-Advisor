import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	canJoinTournament,
	cancelTournament,
	createTournamentEvent,
	joinTournament,
	leaveTournament,
	seatIndexForTokenHash,
	startTournament,
	type PickedArmy,
	type TournamentState
} from '$lib/domain';
import { getDb } from './db';
import { ApiError } from './errors';
import { generateGameCode, generateSeatToken, hashToken } from './ids';
import {
	getTournament,
	insertTournament,
	mutateAsTournamentOrganizer,
	mutateAsTournamentViewer,
	mutateOpenTournament,
	type TournamentViewer
} from './tournamentRepository';

// Point the file database at a throwaway directory before the lazy DB opens.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'oni-quest-advisor-tournament-test-'));

const army: PickedArmy = { name: 'List', factionId: 'helian-league', code: 'CODE' };

type Fixture = { code: string; organizerToken: string; playerToken: string };

/**
 * A lobby with a playing organizer in seat 0 and `players` joined players after it. Two players
 * is the default because it leaves exactly one seat empty — the most the start rule allows.
 */
async function createSeededTournament(field = 4, players = 2): Promise<Fixture> {
	const code = generateGameCode();
	const organizerToken = generateSeatToken();
	const playerToken = generateSeatToken();
	const secondPlayerToken = generateSeatToken();
	const now = new Date().toISOString();
	const state = createTournamentEvent({
		code,
		name: 'Eldfall Cup',
		externalLink: 'https://example.com/cup',
		organizerName: 'Marta',
		organizerTokenHash: hashToken(organizerToken),
		organizerPlays: true,
		organizerArmy: army,
		participantCount: field,
		manualPairing: false,
		missionIds: ['treasure-hunt'],
		tableNames: ['Table 1', 'Table 2'],
		now
	});
	await insertTournament(state, { type: 'tournament-created', actor: 'organizer' });
	await mutateOpenTournament(code, (tournament) => ({
		next: joinTournament(tournament, 'Ana', army, hashToken(playerToken), now),
		events: { type: 'player-joined', actor: 'player', payload: { name: 'Ana' } }
	}));
	// A second player, so at most one seat stays empty — the most the start rule allows.
	if (players >= 2) {
		await mutateOpenTournament(code, (tournament) => ({
			next: joinTournament(tournament, 'Ben', army, hashToken(secondPlayerToken), now),
			events: { type: 'player-joined', actor: 'player', payload: { name: 'Ben' } }
		}));
	}
	return { code, organizerToken, playerToken };
}

async function eventCount(code: string): Promise<number> {
	const db = await getDb();
	const result = await db.execute({
		sql: 'SELECT COUNT(*) FROM tournament_events WHERE tournament_id = ?',
		args: [code]
	});
	return Number(result.rows[0][0]);
}

async function expectApiError(promise: Promise<unknown>, status: number): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(status);
		return;
	}
	throw new Error(`Expected ApiError ${status}, but the promise resolved`);
}

describe('tournamentRepository', () => {
	beforeAll(async () => {
		await getDb();
	});

	it('stores and reads back a tournament', async () => {
		const { code } = await createSeededTournament();
		const stored = await getTournament(code);

		expect(stored?.name).toBe('Eldfall Cup');
		expect(stored?.status).toBe('lobby');
		expect(stored?.seats).toHaveLength(4);
		expect(await getTournament('NOPE12')).toBeNull();
	});

	it('records the history alongside the state', async () => {
		const { code } = await createSeededTournament();

		expect(await eventCount(code)).toBe(3); // created + two joins
	});

	it('lets an unauthenticated joiner take a free seat', async () => {
		const { code } = await createSeededTournament();
		const token = generateSeatToken();
		await mutateOpenTournament(code, (tournament) => ({
			next: joinTournament(tournament, 'Ben', army, hashToken(token), new Date().toISOString()),
			events: { type: 'player-joined', actor: 'player', payload: { name: 'Ben' } }
		}));

		expect((await getTournament(code))?.seats[2].participant?.name).toBe('Ben');
	});

	it('refuses an unknown tournament', async () => {
		await expectApiError(
			mutateOpenTournament('NOPE12', (tournament) => ({ next: tournament, events: [] })),
			404
		);
	});

	it('tells the organizer from a seated player', async () => {
		const { code, organizerToken, playerToken } = await createSeededTournament();
		const viewers: TournamentViewer[] = [];
		for (const token of [organizerToken, playerToken]) {
			await mutateAsTournamentViewer(code, token, (tournament, viewer) => {
				viewers.push(viewer);
				return { next: tournament, events: [] };
			});
		}

		expect(viewers[0]).toEqual({ kind: 'organizer' });
		expect(viewers[1]).toEqual({ kind: 'player', seatIndex: 1 });
	});

	it('refuses a stranger and a missing token', async () => {
		const { code } = await createSeededTournament();
		const noop = (tournament: Awaited<ReturnType<typeof getTournament>>) => ({
			next: tournament!,
			events: []
		});
		await expectApiError(mutateAsTournamentViewer(code, 'not-a-token', noop as never), 401);
		await expectApiError(mutateAsTournamentViewer(code, null, noop as never), 401);
	});

	it('keeps organizer-only actions away from players', async () => {
		const { code, playerToken } = await createSeededTournament();
		await expectApiError(
			mutateAsTournamentOrganizer(code, playerToken, (tournament) => ({
				next: tournament,
				events: []
			})),
			403
		);
	});

	it('frees a seat and records the leave in the history', async () => {
		const { code, playerToken } = await createSeededTournament();
		await mutateAsTournamentViewer(code, playerToken, (tournament, viewer) => {
			expect(viewer).toEqual({ kind: 'player', seatIndex: 1 });
			return {
				next: leaveTournament(tournament, hashToken(playerToken), new Date().toISOString()),
				events: { type: 'player-left', actor: 'player', payload: { name: 'Ana', seatIndex: 1 } }
			};
		});

		const stored = await getTournament(code);
		expect(stored?.seats[1].participant).toBeNull();
		expect(stored?.seats[0].participant?.name).toBe('Marta');
		expect(await eventCount(code)).toBe(4); // created + two joins + left
	});

	it('closes the tournament for everyone when the organizer cancels', async () => {
		const { code, organizerToken, playerToken } = await createSeededTournament();
		await mutateAsTournamentOrganizer(code, organizerToken, (tournament) => ({
			next: cancelTournament(tournament, new Date().toISOString()),
			events: { type: 'tournament-cancelled', actor: 'organizer' }
		}));

		const stored = await getTournament(code);
		expect(stored?.status).toBe('closed');
		expect(canJoinTournament(stored!)).toBe(false);
		// The seats survive the cancellation, so a player's token still authenticates and their
		// device can be told what happened instead of meeting a bare 404.
		expect(seatIndexForTokenHash(stored!, hashToken(playerToken))).toBe(1);
	});

	it('stores the round and hydrates a row written before the round existed', async () => {
		const { code, organizerToken } = await createSeededTournament();
		await mutateAsTournamentOrganizer(code, organizerToken, (tournament) => ({
			next: startTournament(tournament, new Date().toISOString()),
			events: { type: 'tournament-started', actor: 'organizer' }
		}));

		const stored = await getTournament(code);
		expect(stored?.status).toBe('active');
		expect(stored?.round?.number).toBe(1);
		expect(stored?.round?.missionId).toBe('treasure-hunt');
		expect(stored?.round?.tables).toEqual([[], []]);

		// A lobby created before the round model existed carries no key at all.
		const legacyCode = generateGameCode();
		const legacy = JSON.parse(
			JSON.stringify(
				createTournamentEvent({
					code: legacyCode,
					name: 'Old Cup',
					externalLink: null,
					organizerName: 'Marta',
					organizerTokenHash: hashToken(generateSeatToken()),
					organizerPlays: false,
					organizerArmy: null,
					participantCount: 4,
					manualPairing: true,
					missionIds: ['treasure-hunt'],
					tableNames: ['Table 1', 'Table 2'],
					now: new Date().toISOString()
				})
			)
		) as TournamentState;
		delete (legacy as Partial<TournamentState>).round;
		await insertTournament(legacy, { type: 'tournament-created', actor: 'organizer' });

		expect((await getTournament(legacyCode))?.round).toBeNull();
	});

	it('serializes concurrent joins so no seat is booked twice', async () => {
		const { code } = await createSeededTournament(4, 1); // seats 0 and 1 are taken, two free
		const results = await Promise.all(
			['Ben', 'Cem', 'Dee'].map((name) => {
				const token = generateSeatToken();
				return mutateOpenTournament(code, (tournament) => ({
					next: joinTournament(tournament, name, army, hashToken(token), new Date().toISOString()),
					events: { type: 'player-joined', actor: 'player', payload: { name } }
				})).then(
					() => 'joined',
					() => 'refused'
				);
			})
		);

		expect(results.sort()).toEqual(['joined', 'joined', 'refused']);
		const seats = (await getTournament(code))?.seats ?? [];
		expect(seats.filter((seat) => seat.participant !== null)).toHaveLength(4);
		// Four distinct token hashes prove every join was applied to the state the one before it
		// wrote — a lost update would have seated the same token twice.
		expect(new Set(seats.map((seat) => seat.participant?.tokenHash)).size).toBe(4);
	});
});
