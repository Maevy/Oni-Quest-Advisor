import type { OnlineGameEventType, OnlineGameState, PlayerKey } from '$lib/domain';
import { getDb } from './db';

export type EventActor = PlayerKey | 'server';

export type GameEventInput = {
	type: OnlineGameEventType;
	actor: EventActor;
	payload?: Record<string, unknown>;
};

export async function getGame(id: string): Promise<OnlineGameState | null> {
	const db = await getDb();
	const result = await db.execute({ sql: 'SELECT state FROM games WHERE id = ?', args: [id] });
	if (result.rows.length === 0) return null;
	return JSON.parse(String(result.rows[0][0])) as OnlineGameState;
}

export async function insertGame(state: OnlineGameState, event: GameEventInput): Promise<void> {
	const db = await getDb();
	await db.batch([
		{
			sql: 'INSERT INTO games (id, status, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
			args: [state.id, state.status, JSON.stringify(state), state.createdAt, state.updatedAt]
		},
		{
			sql: 'INSERT INTO game_events (game_id, seq, type, actor, payload, created_at) VALUES (?, 1, ?, ?, ?, ?)',
			args: [
				state.id,
				event.type,
				event.actor,
				JSON.stringify(event.payload ?? {}),
				state.createdAt
			]
		}
	]);
}

/** One transaction: refresh the snapshot row and append the event to the history. */
export async function updateGame(state: OnlineGameState, event: GameEventInput): Promise<void> {
	const db = await getDb();
	const updatedAt = new Date().toISOString();
	const persisted = { ...state, updatedAt };
	const tx = await db.transaction('write');
	try {
		const seqResult = await tx.execute({
			sql: 'SELECT COALESCE(MAX(seq), 0) + 1 FROM game_events WHERE game_id = ?',
			args: [state.id]
		});
		const seq = Number(seqResult.rows[0][0]);
		await tx.execute({
			sql: 'UPDATE games SET status = ?, state = ?, updated_at = ? WHERE id = ?',
			args: [persisted.status, JSON.stringify(persisted), updatedAt, state.id]
		});
		await tx.execute({
			sql: 'INSERT INTO game_events (game_id, seq, type, actor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			args: [state.id, seq, event.type, event.actor, JSON.stringify(event.payload ?? {}), updatedAt]
		});
		await tx.commit();
	} catch (error) {
		await tx.rollback();
		throw error;
	}
}
