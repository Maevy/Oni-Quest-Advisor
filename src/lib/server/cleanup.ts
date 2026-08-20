import type { Client } from '@libsql/client';

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Removes finished/closed games (and their event history) older than the
 * retention window. Abandoned lobby/active games are kept for now — lifecycle
 * policy for those is still an open question in MULTIPLAYER_PLAN.md §9.
 */
export async function cleanupStaleGames(db: Client): Promise<number> {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const stale = await db.execute({
		sql: "SELECT id FROM games WHERE status IN ('finished', 'closed') AND updated_at < ?",
		args: [cutoff]
	});
	const ids = stale.rows.map((row) => String(row[0]));
	if (ids.length === 0) return 0;
	const placeholders = ids.map(() => '?').join(', ');
	await db.batch([
		{ sql: `DELETE FROM game_events WHERE game_id IN (${placeholders})`, args: ids },
		{ sql: `DELETE FROM games WHERE id IN (${placeholders})`, args: ids }
	]);
	return ids.length;
}

/** Runs cleanup once on startup, then daily. Failures never take the server down. */
export function startCleanupSchedule(db: Client): void {
	void cleanupStaleGames(db).catch(() => {});
	const timer = setInterval(() => {
		void cleanupStaleGames(db).catch(() => {});
	}, CLEANUP_INTERVAL_MS);
	timer.unref();
}
