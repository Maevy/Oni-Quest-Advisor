import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { acceptJoin, createOnlineGame, requestJoin } from '$lib/domain';
import { getDb } from './db';
import { ApiError } from './errors';
import { getGame, insertGame, mutateAsLeader, mutateAsSeat, mutateOpen } from './gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from './ids';

// Point the file database at a throwaway directory before the lazy DB opens.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'oni-quest-advisor-test-'));

type Fixture = {
	id: string;
	leaderToken: string;
	player2Token: string;
};

/** A lobby game with both seats filled (leader + accepted joiner). */
async function createSeededGame(): Promise<Fixture> {
	const id = generateGameCode();
	const leaderToken = generateSeatToken();
	const player2Token = generateSeatToken();
	const now = new Date().toISOString();
	let state = createOnlineGame(id, 'Leader', hashToken(leaderToken), now);
	state = requestJoin(state, 'Joiner', hashToken(player2Token));
	state = acceptJoin(state);
	await insertGame(state, {
		type: 'game-created',
		actor: 'player1',
		payload: { nickname: 'Leader' }
	});
	return { id, leaderToken, player2Token };
}

async function eventCount(gameId: string): Promise<number> {
	const db = await getDb();
	const result = await db.execute({
		sql: 'SELECT COUNT(*) FROM game_events WHERE game_id = ?',
		args: [gameId]
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

describe('gameRepository', () => {
	beforeAll(async () => {
		await getDb();
	});

	it('returns null for unknown games', async () => {
		expect(await getGame('MISSING')).toBeNull();
	});

	it('rejects mutations of unknown games with 404', async () => {
		await expectApiError(
			mutateOpen('MISSING', (game) => ({
				next: game,
				events: { type: 'game-closed', actor: 'server' }
			})),
			404
		);
	});

	it('applies a seat mutation and appends its events atomically', async () => {
		const { id, player2Token } = await createSeededGame();
		await mutateAsSeat(id, player2Token, (game, seat) => ({
			next: { ...game, [seat]: { ...game[seat]!, nickname: 'Renamed' } },
			events: [
				{ type: 'faction-drafted', actor: seat, payload: { step: 1 } },
				{ type: 'faction-drafted', actor: seat, payload: { step: 2 } }
			]
		}));

		const game = await getGame(id);
		expect(game?.player2?.nickname).toBe('Renamed');
		// game-created plus the two appended events.
		expect(await eventCount(id)).toBe(3);

		const db = await getDb();
		const seqs = await db.execute({
			sql: 'SELECT seq FROM game_events WHERE game_id = ? ORDER BY seq',
			args: [id]
		});
		expect(seqs.rows.map((row) => Number(row[0]))).toEqual([1, 2, 3]);
	});

	it('rejects invalid seat tokens without touching state or history', async () => {
		const { id } = await createSeededGame();
		const before = await getGame(id);
		await expectApiError(
			mutateAsSeat(id, 'not-a-real-token', (game) => ({
				next: game,
				events: { type: 'faction-drafted', actor: 'player1' }
			})),
			401
		);
		expect(await getGame(id)).toEqual(before);
		expect(await eventCount(id)).toBe(1);
	});

	it('rejects the non-leader seat for leader mutations with 403', async () => {
		const { id, player2Token } = await createSeededGame();
		await expectApiError(
			mutateAsLeader(id, player2Token, (game) => ({
				next: game,
				events: { type: 'game-closed', actor: 'player1' }
			})),
			403
		);
		expect(await eventCount(id)).toBe(1);
	});

	it('rolls back when a guard inside the callback throws', async () => {
		const { id, leaderToken } = await createSeededGame();
		await expectApiError(
			mutateAsLeader(id, leaderToken, () => {
				throw new ApiError(409, 'Locked');
			}),
			409
		);
		expect(await eventCount(id)).toBe(1);
	});

	it('serializes concurrent mutations without losing updates', async () => {
		const { id, leaderToken, player2Token } = await createSeededGame();
		const objectiveId = 'race-probe';
		const increment = (token: string) =>
			mutateAsSeat(id, token, (game, seat) => {
				const current = game.player1.progress.checkedObjectiveCounts[objectiveId] ?? 0;
				return {
					next: {
						...game,
						player1: {
							...game.player1,
							progress: {
								...game.player1.progress,
								checkedObjectiveCounts: {
									...game.player1.progress.checkedObjectiveCounts,
									[objectiveId]: current + 1
								}
							}
						}
					},
					events: { type: 'objective-toggled', actor: seat, payload: { objectiveId } }
				};
			});

		const writes = [];
		for (let i = 0; i < 10; i += 1) {
			writes.push(increment(i % 2 === 0 ? leaderToken : player2Token));
		}
		await Promise.all(writes);

		const game = await getGame(id);
		expect(game?.player1.progress.checkedObjectiveCounts[objectiveId]).toBe(10);
		expect(await eventCount(id)).toBe(11);
	});
});
