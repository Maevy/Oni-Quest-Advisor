import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	MAX_ROUND,
	acceptJoin,
	advanceToScoring,
	chooseSeatScheme,
	closeGame,
	createOnlineGame,
	createTournamentEvent,
	finishGame,
	leavePrep,
	requestJoin,
	setSeatDraft,
	setSeatDrawnSchemes,
	setSeatObjectiveChecked,
	snapshotAndProceed,
	startGame,
	startRounds,
	toggleReady,
	toggleRevealIntent,
	type PickedArmy
} from '$lib/domain';
import { cleanupStaleGames, cleanupStaleTournaments } from './cleanup';
import { getDb } from './db';
import { getGame, insertGame } from './gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from './ids';
import { getTournament, insertTournament } from './tournamentRepository';

// Point the file database at a throwaway directory before the lazy DB opens.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'oni-quest-advisor-cleanup-test-'));

const MISSION_ID = 'treasure-hunt';
const SEASON = 'Season 2';
const SCHEME_ID = 'opportunistic-manipulation';

const FIXTURE_ARMY: PickedArmy = {
	name: 'Fixture',
	factionId: 'helian-league',
	code: 'aaaaa:0s:0',
	format: 'standard'
};

/** Creation carries the mission now, so every fixture game is born set up. */
function fixtureSetup() {
	return { season: SEASON, missionId: MISSION_ID, army: FIXTURE_ARMY };
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** A lobby game with only the leader seat filled. */
async function insertLobbyGame(ageInDays: number): Promise<string> {
	const id = generateGameCode();
	const state = createOnlineGame(
		id,
		'Leader',
		hashToken(generateSeatToken()),
		daysAgo(ageInDays),
		fixtureSetup()
	);
	await insertGame(state, {
		type: 'game-created',
		actor: 'player1',
		payload: { nickname: 'Leader' }
	});
	return id;
}

type Journey = {
	ageInDays: number;
	roundsAdvanced: number;
	reachScoring?: boolean;
	revealIntent?: boolean;
	objectiveChecks?: number;
	finished?: boolean;
	closed?: boolean;
};

/** Plays a synthetic game through setup and the given number of rounds. */
async function insertJourneyGame(journey: Journey): Promise<string> {
	const id = generateGameCode();
	let state = createOnlineGame(
		id,
		'Leader',
		hashToken(generateSeatToken()),
		daysAgo(journey.ageInDays),
		fixtureSetup()
	);
	state = requestJoin(state, 'Joiner', hashToken(generateSeatToken()), FIXTURE_ARMY);
	state = acceptJoin(state);
	for (const seat of ['player1', 'player2'] as const) state = toggleReady(state, seat);
	state = startGame(state);
	// Both fixture seats registered Standard lists, so preparation is already satisfied.
	state = leavePrep(state);
	for (const seat of ['player1', 'player2'] as const) {
		state = setSeatDraft(state, seat, { intelligence: 14 });
		state = setSeatDrawnSchemes(state, seat, [SCHEME_ID]);
		state = chooseSeatScheme(state, seat, SCHEME_ID);
	}
	state = startRounds(state);
	for (let round = 0; round < journey.roundsAdvanced; round++) {
		state = advanceToScoring(state);
		state = snapshotAndProceed(state, { player1: 0, player2: 0 });
	}
	if (journey.revealIntent) state = toggleRevealIntent(state, 'player1');
	if (journey.reachScoring) state = advanceToScoring(state);
	if (journey.objectiveChecks) {
		state = setSeatObjectiveChecked(state, 'player1', 'unlock-cache', journey.objectiveChecks, 2);
	}
	if (journey.finished) state = finishGame(state, { player1: 0, player2: 0 });
	if (journey.closed) state = closeGame(state);
	await insertGame(state, {
		type: 'game-created',
		actor: 'player1',
		payload: { nickname: 'Leader' }
	});
	return id;
}

type StoredEvent = { type: string; actor: string; payload: Record<string, unknown> };

async function eventsOf(gameId: string): Promise<StoredEvent[]> {
	const db = await getDb();
	const result = await db.execute({
		sql: 'SELECT type, actor, payload FROM game_events WHERE game_id = ? ORDER BY seq',
		args: [gameId]
	});
	return result.rows.map((row) => ({
		type: String(row[0]),
		actor: String(row[1]),
		payload: JSON.parse(String(row[2]))
	}));
}

describe('cleanupStaleGames', () => {
	beforeAll(async () => {
		await getDb();
	});

	it('deletes stale lobby games and keeps fresh ones', async () => {
		const stale = await insertLobbyGame(8);
		const fresh = await insertLobbyGame(6);
		await cleanupStaleGames(await getDb());
		expect(await getGame(stale)).toBeNull();
		expect(await getGame(fresh)).not.toBeNull();
	});

	it('deletes finished and closed games after 90 days', async () => {
		const staleFinished = await insertJourneyGame({
			ageInDays: 91,
			roundsAdvanced: 4,
			reachScoring: true,
			finished: true
		});
		const staleClosed = await insertJourneyGame({ ageInDays: 91, roundsAdvanced: 2, closed: true });
		const freshFinished = await insertJourneyGame({
			ageInDays: 89,
			roundsAdvanced: 4,
			reachScoring: true,
			finished: true
		});
		await cleanupStaleGames(await getDb());
		expect(await getGame(staleFinished)).toBeNull();
		expect(await getGame(staleClosed)).toBeNull();
		expect(await getGame(freshFinished)).not.toBeNull();
	});

	it('deletes active games abandoned before the final round', async () => {
		const stale = await insertJourneyGame({ ageInDays: 31, roundsAdvanced: 2 });
		const fresh = await insertJourneyGame({ ageInDays: 29, roundsAdvanced: 2 });
		await cleanupStaleGames(await getDb());
		expect(await getGame(stale)).toBeNull();
		expect(await getGame(fresh)).not.toBeNull();
	});

	it('auto-finishes stale final-round games and records the result', async () => {
		const id = await insertJourneyGame({
			ageInDays: 31,
			roundsAdvanced: 4,
			reachScoring: true,
			objectiveChecks: 2
		});
		const summary = await cleanupStaleGames(await getDb());
		expect(summary.autoFinished).toBe(1);

		const game = await getGame(id);
		expect(game?.status).toBe('finished');
		expect(game?.winner).toBe('player1');
		expect(game?.resultSummary?.finalVp).toEqual({ player1: 2, player2: 0 });
		expect(game?.roundSnapshots[MAX_ROUND]).toEqual({ player1: 2, player2: 0 });

		const finished = (await eventsOf(id)).find((event) => event.type === 'game-finished');
		expect(finished?.actor).toBe('server');
		expect(finished?.payload.autoFinished).toBe(true);
		expect(finished?.payload.finalVp1).toBe(2);
	});

	it('auto-finishes stale final-round games stuck in the reveal phase', async () => {
		const id = await insertJourneyGame({ ageInDays: 31, roundsAdvanced: 4, revealIntent: true });
		await cleanupStaleGames(await getDb());
		const game = await getGame(id);
		expect(game?.status).toBe('finished');
		expect(game?.winner).toBe('draw');
		expect(game?.roundSnapshots[MAX_ROUND]).toEqual({ player1: 0, player2: 0 });
	});

	it('leaves fresh final-round games untouched', async () => {
		const id = await insertJourneyGame({ ageInDays: 2, roundsAdvanced: 4, reachScoring: true });
		await cleanupStaleGames(await getDb());
		const game = await getGame(id);
		expect(game?.status).toBe('active');
		expect(game?.currentRound).toBe(MAX_ROUND);
	});
});

describe('cleanupStaleTournaments', () => {
	/** A tournament of the given status whose snapshot row is `ageInHours` old. */
	async function seedTournament(
		status: 'lobby' | 'active' | 'concluded' | 'closed',
		ageInHours: number
	) {
		const code = generateGameCode();
		const state = createTournamentEvent({
			code,
			name: 'Cup',
			externalLink: null,
			organizerName: 'Marta',
			organizerTokenHash: hashToken(generateSeatToken()),
			organizerPlays: false,
			organizerArmy: null,
			participantCount: 4,
			manualPairing: false,
			missionIds: [MISSION_ID],
			tableNames: ['Table 1', 'Table 2'],
			now: new Date(Date.now() - ageInHours * 60 * 60 * 1000).toISOString()
		});
		await insertTournament(
			{ ...state, status },
			{ type: 'tournament-created', actor: 'organizer' }
		);
		return code;
	}

	it('keeps a concluded tournament for exactly the 48-hour report window', async () => {
		const fresh = await seedTournament('concluded', 47);
		const stale = await seedTournament('concluded', 49);
		expect(await cleanupStaleTournaments(await getDb())).toBe(1);
		expect((await getTournament(fresh))?.code).toBe(fresh);
		expect(await getTournament(stale)).toBeNull();
	});

	it('drops abandoned lobbies after a week', async () => {
		const fresh = await seedTournament('lobby', 24);
		const stale = await seedTournament('lobby', 24 * 8);
		expect(await cleanupStaleTournaments(await getDb())).toBe(1);
		expect((await getTournament(fresh))?.code).toBe(fresh);
		expect(await getTournament(stale)).toBeNull();
	});

	it('keeps a cancelled tournament only long enough for the open lobbies to be told', async () => {
		const fresh = await seedTournament('closed', 23);
		const stale = await seedTournament('closed', 25);
		expect(await cleanupStaleTournaments(await getDb())).toBe(1);
		expect((await getTournament(fresh))?.status).toBe('closed');
		expect(await getTournament(stale)).toBeNull();
	});

	it('leaves a tournament that is still running alone', async () => {
		const active = await seedTournament('active', 24 * 20);
		expect(await cleanupStaleTournaments(await getDb())).toBe(0);
		expect((await getTournament(active))?.status).toBe('active');
	});
});
