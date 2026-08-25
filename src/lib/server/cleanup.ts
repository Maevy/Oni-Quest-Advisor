import type { Client } from '@libsql/client';
import { MAX_ROUND, advanceToScoring, finishGame, type OnlineGameState } from '$lib/domain';
import { ApiError } from './errors';
import { mutateOpen } from './gameRepository';
import { notifyGameChanged } from './sse';
import { computeRoundVp } from './vp';

const LOBBY_RETENTION_DAYS = 7;
const ACTIVE_RETENTION_DAYS = 30;
const FINISHED_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type CleanupSummary = { deleted: number; autoFinished: number };

function cutoffIso(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function staleIds(db: Client, statuses: string[], cutoff: string): Promise<string[]> {
	const placeholders = statuses.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `SELECT id FROM games WHERE status IN (${placeholders}) AND updated_at < ?`,
		args: [...statuses, cutoff]
	});
	return result.rows.map((row) => String(row[0]));
}

async function deleteGames(db: Client, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const placeholders = ids.map(() => '?').join(', ');
	await db.batch([
		{ sql: `DELETE FROM game_events WHERE game_id IN (${placeholders})`, args: ids },
		{ sql: `DELETE FROM games WHERE id IN (${placeholders})`, args: ids }
	]);
}

/**
 * A game abandoned in the final round is a finished game missing the last
 * click - the server finishes it instead of deleting it, so auto-reveal,
 * winner and resultSummary survive for the statistics export. Eligibility is
 * re-checked inside the mutation so games players returned to in the meantime
 * are left untouched.
 */
async function autoFinishStaleGame(id: string, cutoff: string): Promise<boolean> {
	try {
		await mutateOpen(id, (game) => {
			if (game.status !== 'active' || game.currentRound !== MAX_ROUND || game.updatedAt >= cutoff) {
				throw new ApiError(409, 'Game is no longer eligible for auto-finish');
			}
			const ready = advanceToScoring(game);
			const vp = computeRoundVp(ready);
			if (!vp) throw new ApiError(500, 'Mission content missing');
			const next = finishGame(ready, vp);
			return {
				next,
				events: [
					{
						type: 'round-snapshotted',
						actor: 'server',
						payload: { round: ready.currentRound, ...vp }
					},
					{
						type: 'game-finished',
						actor: 'server',
						payload: {
							winner: next.winner,
							finalVp1: vp.player1,
							finalVp2: vp.player2,
							autoFinished: true
						}
					}
				]
			};
		});
		notifyGameChanged(id, 'game-finished');
		return true;
	} catch (error) {
		if (error instanceof ApiError) return false;
		throw error;
	}
}

/**
 * Retention windows: stale lobbies are dropped invites (7 days), games
 * abandoned mid-play are deleted (30 days), games abandoned in the final
 * round are auto-finished so their result is preserved, and finished/closed
 * games stay queryable for 90 days before deletion.
 */
export async function cleanupStaleGames(db: Client): Promise<CleanupSummary> {
	const activeCutoff = cutoffIso(ACTIVE_RETENTION_DAYS);
	const staleActive = await db.execute({
		sql: 'SELECT id, state FROM games WHERE status = ? AND updated_at < ?',
		args: ['active', activeCutoff]
	});
	let autoFinished = 0;
	const abandoned: string[] = [];
	for (const row of staleActive.rows) {
		const id = String(row[0]);
		const game = JSON.parse(String(row[1])) as OnlineGameState;
		if (game.currentRound === MAX_ROUND) {
			if (await autoFinishStaleGame(id, activeCutoff)) autoFinished += 1;
		} else {
			abandoned.push(id);
		}
	}

	const ids = [
		...abandoned,
		...(await staleIds(db, ['lobby'], cutoffIso(LOBBY_RETENTION_DAYS))),
		...(await staleIds(db, ['finished', 'closed'], cutoffIso(FINISHED_RETENTION_DAYS)))
	];
	await deleteGames(db, ids);
	return { deleted: ids.length, autoFinished };
}

/** Runs cleanup once on startup, then daily. Failures never take the server down. */
export function startCleanupSchedule(db: Client): void {
	const run = () =>
		cleanupStaleGames(db)
			.then(({ deleted, autoFinished }) => {
				if (deleted > 0 || autoFinished > 0) {
					console.log(`Game cleanup: deleted ${deleted}, auto-finished ${autoFinished}`);
				}
			})
			.catch((error) => console.error('Game cleanup failed', error));
	run();
	const timer = setInterval(run, CLEANUP_INTERVAL_MS);
	timer.unref();
}
