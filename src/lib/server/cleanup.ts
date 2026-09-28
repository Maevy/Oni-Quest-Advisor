import type { Client } from '@libsql/client';
import { MAX_ROUND, advanceToScoring, finishGame, type OnlineGameState } from '$lib/domain';
import { ApiError } from './errors';
import { mutateOpen } from './gameRepository';
import { notifyGameChanged } from './sse';
import { computeRoundVp } from './vp';

const LOBBY_RETENTION_DAYS = 7;
const ACTIVE_RETENTION_DAYS = 30;
const FINISHED_RETENTION_DAYS = 90;
const TOURNAMENT_LOBBY_RETENTION_DAYS = 7;
const TOURNAMENT_ACTIVE_RETENTION_DAYS = 30;
/** The report window: a concluded tournament stays queryable for 48 hours, then goes. */
const TOURNAMENT_REPORT_RETENTION_HOURS = 48;
/**
 * A cancelled event has no report to keep, but its rows must outlive the moment of cancellation
 * so every open lobby can still be told what happened instead of meeting a 404.
 */
const TOURNAMENT_CANCELLED_RETENTION_HOURS = 24;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type CleanupSummary = { deleted: number; autoFinished: number };

function cutoffIso(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function cutoffHours(hours: number): string {
	return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
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

async function staleTournamentIds(
	db: Client,
	statuses: string[],
	cutoff: string
): Promise<string[]> {
	const placeholders = statuses.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `SELECT id FROM tournaments WHERE status IN (${placeholders}) AND updated_at < ?`,
		args: [...statuses, cutoff]
	});
	return result.rows.map((row) => String(row[0]));
}

/**
 * Tournament retention: an abandoned lobby is a dropped invite (7 days), a tournament abandoned
 * mid-play is deleted (30 days), a concluded one lives exactly as long as the report window the
 * creation notice promises — 48 hours — and a cancelled one only long enough for the open
 * lobbies to be told (24 hours) before it goes.
 */
export async function cleanupStaleTournaments(db: Client): Promise<number> {
	const ids = [
		...(await staleTournamentIds(db, ['lobby'], cutoffIso(TOURNAMENT_LOBBY_RETENTION_DAYS))),
		...(await staleTournamentIds(db, ['active'], cutoffIso(TOURNAMENT_ACTIVE_RETENTION_DAYS))),
		...(await staleTournamentIds(
			db,
			['concluded'],
			cutoffHours(TOURNAMENT_REPORT_RETENTION_HOURS)
		)),
		...(await staleTournamentIds(db, ['closed'], cutoffHours(TOURNAMENT_CANCELLED_RETENTION_HOURS)))
	];
	if (ids.length === 0) return 0;
	const placeholders = ids.map(() => '?').join(', ');
	await db.batch([
		{ sql: `DELETE FROM tournament_events WHERE tournament_id IN (${placeholders})`, args: ids },
		{ sql: `DELETE FROM tournaments WHERE id IN (${placeholders})`, args: ids }
	]);
	return ids.length;
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
		Promise.all([cleanupStaleGames(db), cleanupStaleTournaments(db)])
			.then(([games, tournaments]) => {
				if (games.deleted > 0 || games.autoFinished > 0 || tournaments > 0) {
					console.log(
						`Cleanup: deleted ${games.deleted} games, auto-finished ${games.autoFinished}, deleted ${tournaments} tournaments`
					);
				}
			})
			.catch((error) => console.error('Cleanup failed', error));
	run();
	const timer = setInterval(run, CLEANUP_INTERVAL_MS);
	timer.unref();
}
