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
	finishGame,
	requestJoin,
	selectMission,
	setSeatDraft,
	setSeatDrawnSchemes,
	setSeatObjectiveChecked,
	snapshotAndProceed,
	startGame,
	toggleRevealIntent
} from '$lib/domain';
import { cleanupStaleGames } from './cleanup';
import { getDb } from './db';
import { getGame, insertGame } from './gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from './ids';

// Point the file database at a throwaway directory before the lazy DB opens.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'oni-quest-advisor-cleanup-test-'));

const MISSION_ID = 'treasure-hunt';
const SEASON = 'Season 2';
const SCHEME_ID = 'opportunistic-manipulation';

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** A lobby game with only the leader seat filled. */
async function insertLobbyGame(ageInDays: number): Promise<string> {
	const id = generateGameCode();
	const state = createOnlineGame(id, 'Leader', hashToken(generateSeatToken()), daysAgo(ageInDays));
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
		daysAgo(journey.ageInDays)
	);
	state = requestJoin(state, 'Joiner', hashToken(generateSeatToken()));
	state = acceptJoin(state);
	state = selectMission(state, SEASON, MISSION_ID);
	for (const seat of ['player1', 'player2'] as const) {
		state = setSeatDraft(state, seat, { factionId: 'helian-league', intelligence: 14 });
		state = setSeatDrawnSchemes(state, seat, [SCHEME_ID]);
		state = chooseSeatScheme(state, seat, SCHEME_ID);
	}
	state = startGame(state);
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
