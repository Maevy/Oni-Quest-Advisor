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

function databaseUrl(): string {
	const dataDir = process.env.DATA_DIR ?? '.data';
	const file = resolve(dataDir, 'oni-quest.db');
	mkdirSync(dirname(file), { recursive: true });
	return pathToFileURL(file).href;
}

/** Lazily opens the database and bootstraps the schema on first use. */
export function getDb(): Promise<Client> {
	if (!ready) {
		ready = (async () => {
			const client = createClient({ url: databaseUrl() });
			await client.batch(SCHEMA);
			startCleanupSchedule(client);
			return client;
		})();
	}
	return ready;
}
