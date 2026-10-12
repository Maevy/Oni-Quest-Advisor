import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	acceptJoin,
	createOnlineGame,
	requestJoin,
	undoableAction,
	type HistoryAction,
	type HistoryEntry,
	type PickedArmy
} from '$lib/domain';
import { getDb } from './db';
import { ApiError } from './errors';
import {
	getGame,
	insertGame,
	mutateAsLeader,
	mutateAsSeat,
	mutateOpen,
	readGameHistory
} from './gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from './ids';

// Point the file database at a throwaway directory before the lazy DB opens.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'oni-quest-advisor-test-'));

const FIXTURE_ARMY: PickedArmy = {
	name: 'Fixture',
	factionId: 'helian-league',
	code: 'aaaaa:0s:0',
	format: 'standard'
};

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
	let state = createOnlineGame(id, 'Leader', hashToken(leaderToken), now, {
		season: 'Season 2',
		missionId: 'obelisk-strike',
		army: FIXTURE_ARMY
	});
	state = requestJoin(state, 'Joiner', hashToken(player2Token), FIXTURE_ARMY);
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
				{ type: 'seat-ready-toggled', actor: seat, payload: { step: 1 } },
				{ type: 'seat-ready-toggled', actor: seat, payload: { step: 2 } }
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
				events: { type: 'seat-ready-toggled', actor: 'player1' }
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

describe('the flower board log', () => {
	const COMMIT = {
		targetSeat: 'player2',
		targetEntryId: 'e1',
		targetName: 'Clan Champion',
		targetCopy: null,
		originEntryId: 'e0',
		originName: 'Chiyohime',
		action: { kind: 'damage', amount: 4 }
	} as const;

	/** A seeded game moved into a running round, where the board is open. */
	async function playingGame(): Promise<Fixture> {
		const fixture = await createSeededGame();
		await mutateAsSeat(fixture.id, fixture.leaderToken, (game) => ({
			next: { ...game, status: 'active' },
			events: { type: 'game-started', actor: 'player1' }
		}));
		return fixture;
	}

	it('appends a commit and reads it back with the round the server stamped', async () => {
		const { id, leaderToken } = await playingGame();
		await mutateAsSeat(id, leaderToken, (game, seat) => ({
			next: game,
			events: {
				type: 'vitality-committed',
				actor: seat,
				payload: { ...COMMIT, round: game.currentRound }
			}
		}));

		const history = await readGameHistory(id);
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			kind: 'action',
			actor: 'player1',
			round: 1,
			undoneBy: null
		});
		expect((history[0] as HistoryAction).action).toEqual({ kind: 'damage', amount: 4 });
		expect((history[0] as HistoryAction).targetName).toBe('Clan Champion');
	});

	it('hands a mutation the same log the history endpoint reads, and joins the undo onto it', async () => {
		const { id, leaderToken } = await playingGame();
		await mutateAsSeat(id, leaderToken, (game, seat) => ({
			next: game,
			events: {
				type: 'vitality-committed',
				actor: seat,
				payload: { ...COMMIT, round: game.currentRound }
			}
		}));

		let seen: HistoryEntry[] = [];
		await mutateAsSeat(id, leaderToken, (game, seat, history) => {
			seen = history;
			const target = undoableAction(history, seat);
			if (!target) throw new ApiError(409, 'Nothing to undo');
			return {
				next: game,
				events: {
					type: 'vitality-reverted',
					actor: seat,
					payload: { revertOf: target.seq, round: game.currentRound }
				}
			};
		});
		expect(seen).toHaveLength(1);

		const history = await readGameHistory(id);
		expect(history).toHaveLength(2);
		expect(history[1]).toMatchObject({ kind: 'revert', revertOf: history[0]?.seq });
		expect(history[0]).toMatchObject({ kind: 'action', undoneBy: history[1]?.seq });
		expect(undoableAction(history, 'player1')).toBeNull();
	});

	it('refuses to undo an opponent’s action', async () => {
		const { id, leaderToken, player2Token } = await playingGame();
		await mutateAsSeat(id, leaderToken, (game, seat) => ({
			next: game,
			events: {
				type: 'vitality-committed',
				actor: seat,
				payload: { ...COMMIT, round: game.currentRound }
			}
		}));

		await expectApiError(
			mutateAsSeat(id, player2Token, (game, seat, history) => {
				const target = undoableAction(history, seat);
				if (!target) throw new ApiError(409, 'Only your own latest interaction can be undone');
				return {
					next: game,
					events: {
						type: 'vitality-reverted',
						actor: seat,
						payload: { revertOf: target.seq, round: game.currentRound }
					}
				};
			}),
			409
		);
		expect(await readGameHistory(id)).toHaveLength(1);
	});

	it('skips a row whose payload no longer parses', async () => {
		const { id } = await playingGame();
		const db = await getDb();
		const next = await db.execute({
			sql: 'SELECT COALESCE(MAX(seq), 0) + 1 FROM game_events WHERE game_id = ?',
			args: [id]
		});
		await db.execute({
			sql: 'INSERT INTO game_events (game_id, seq, type, actor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			args: [
				id,
				Number(next.rows[0][0]),
				'vitality-committed',
				'player1',
				JSON.stringify({ round: 1, action: { kind: 'damage', amount: 0 } }),
				new Date().toISOString()
			]
		});
		expect(await readGameHistory(id)).toEqual([]);
	});
});
