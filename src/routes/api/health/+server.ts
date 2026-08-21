import { statSync } from 'node:fs';
import { json } from '@sveltejs/kit';
import { dbFilePath, getDb } from '$lib/server/db';
import { openStreamCount } from '$lib/server/sse';

/**
 * Operational probe (Fly HTTP check) — unauthenticated by design, reports
 * only aggregates: no game ids, nicknames or tokens leave this endpoint.
 */
export const GET = async () => {
	const db = await getDb();
	const result = await db.execute('SELECT status, COUNT(*) AS count FROM games GROUP BY status');
	const games: Record<string, number> = {};
	for (const row of result.rows) games[String(row[0])] = Number(row[1]);

	let dbBytes = 0;
	try {
		dbBytes = statSync(dbFilePath()).size;
	} catch {
		// Not created yet (no request touched the database so far).
	}

	return json({ ok: true, games, dbBytes, sseStreams: openStreamCount() });
};
