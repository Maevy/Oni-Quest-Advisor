import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startCleanupSchedule } from './cleanup';

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS games (
		id TEXT PRIMARY KEY,
		status TEXT NOT NULL,
		state TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS game_events (
		game_id TEXT NOT NULL REFERENCES games(id),
		seq INTEGER NOT NULL,
		type TEXT NOT NULL,
		actor TEXT,
		payload TEXT NOT NULL,
		created_at TEXT NOT NULL,
		PRIMARY KEY (game_id, seq)
	)`
];

let ready: Promise<Client> | null = null;

/** Absolute path of the SQLite file (without creating the directory). */
export function dbFilePath(): string {
	const dataDir = process.env.DATA_DIR ?? '.data';
	return resolve(dataDir, 'oni-quest.db');
}

function databaseUrl(): string {
	const file = dbFilePath();
	mkdirSync(dirname(file), { recursive: true });
	return pathToFileURL(file).href;
}

/** Lazily opens the database and bootstraps the schema on first use. */
export function getDb(): Promise<Client> {
	if (!ready) {
		ready = (async () => {
			const client = createClient({ url: databaseUrl() });
			// WAL keeps state reads (every SSE-triggered refetch) from blocking
			// behind write transactions; busy_timeout waits instead of failing
			// when a write transaction is briefly held.
			await client.execute('PRAGMA journal_mode = WAL');
			await client.execute('PRAGMA busy_timeout = 5000');
			await client.batch(SCHEMA);
			startCleanupSchedule(client);
			return client;
		})();
	}
	return ready;
}
