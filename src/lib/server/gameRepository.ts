import {
	seatForTokenHash,
	type OnlineGameEventType,
	type OnlineGameState,
	type PlayerKey
} from '$lib/domain';
import { ApiError } from './errors';
import { getDb } from './db';
import { hashToken } from './ids';

export type EventActor = PlayerKey | 'server';

export type GameEventInput = {
	type: OnlineGameEventType;
	actor: EventActor;
	payload?: Record<string, unknown>;
};

/** Result of a mutation callback: the next state plus the event(s) recording it. */
export type Mutation = {
	next: OnlineGameState;
	events: GameEventInput | GameEventInput[];
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

/**
 * In-process FIFO queue serializing mutations. libsql fails concurrent write
 * transactions with SQLITE_BUSY instead of queueing them, and this app runs as
 * a single Node process on a single database file, so ordering here is safe
 * and complete. (A multi-process deployment would need database-level locking.)
 */
let mutationTail: Promise<void> = Promise.resolve();

function serializeMutation<T>(task: () => Promise<T>): Promise<T> {
	const result = mutationTail.then(task);
	mutationTail = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

type MutationRole = 'anyone' | 'seat' | 'leader';

/**
 * The complete authenticated read-modify-write cycle for one game action:
 * SELECT the freshest state, authenticate, run the mutation callback, refresh
 * the snapshot row and append the event(s) — inside a single write
 * transaction, serialized against all other mutations, so concurrent actions
 * can never lose an update or trip SQLITE_BUSY. Guard violations (ApiError)
 * roll back cleanly.
 */
function runMutation(
	id: string,
	role: MutationRole,
	token: string | null,
	mutate: (game: OnlineGameState, seat: PlayerKey | null) => Mutation
): Promise<OnlineGameState> {
	return serializeMutation(() => executeMutation(id, role, token, mutate));
}

async function executeMutation(
	id: string,
	role: MutationRole,
	token: string | null,
	mutate: (game: OnlineGameState, seat: PlayerKey | null) => Mutation
): Promise<OnlineGameState> {
	const db = await getDb();
	const tx = await db.transaction('write');
	try {
		const result = await tx.execute({
			sql: 'SELECT state FROM games WHERE id = ?',
			args: [id]
		});
		if (result.rows.length === 0) throw new ApiError(404, 'Unknown game');
		const game = JSON.parse(String(result.rows[0][0])) as OnlineGameState;

		let seat: PlayerKey | null = null;
		if (role !== 'anyone') {
			if (!token) throw new ApiError(401, 'Missing seat token');
			seat = seatForTokenHash(game, hashToken(token));
			if (!seat) throw new ApiError(401, 'Invalid seat token');
			// The creator (seat player1) is the leader for the whole game.
			if (role === 'leader' && seat !== 'player1') {
				throw new ApiError(403, 'Only the game leader may do this');
			}
		}

		const { next, events } = mutate(game, seat);
		const list = Array.isArray(events) ? events : [events];
		const updatedAt = new Date().toISOString();
		const persisted = { ...next, updatedAt };
		const seqResult = await tx.execute({
			sql: 'SELECT COALESCE(MAX(seq), 0) + 1 FROM game_events WHERE game_id = ?',
			args: [id]
		});
		let seq = Number(seqResult.rows[0][0]);
		await tx.execute({
			sql: 'UPDATE games SET status = ?, state = ?, updated_at = ? WHERE id = ?',
			args: [persisted.status, JSON.stringify(persisted), updatedAt, id]
		});
		for (const event of list) {
			await tx.execute({
				sql: 'INSERT INTO game_events (game_id, seq, type, actor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
				args: [id, seq, event.type, event.actor, JSON.stringify(event.payload ?? {}), updatedAt]
			});
			seq += 1;
		}
		await tx.commit();
		return persisted;
	} catch (error) {
		await tx.rollback();
		throw error;
	}
}

/** Unauthenticated mutation (join requests — no seat exists yet). */
export function mutateOpen(
	id: string,
	mutate: (game: OnlineGameState) => Mutation
): Promise<OnlineGameState> {
	return runMutation(id, 'anyone', null, (game) => mutate(game));
}

/** Mutates as one of the two seats; the callback receives the caller's seat. */
export function mutateAsSeat(
	id: string,
	token: string | null,
	mutate: (game: OnlineGameState, seat: PlayerKey) => Mutation
): Promise<OnlineGameState> {
	return runMutation(id, 'seat', token, (game, seat) => mutate(game, seat!));
}

/** Mutates as the leader (seat player1); 403 for the other seat. */
export function mutateAsLeader(
	id: string,
	token: string | null,
	mutate: (game: OnlineGameState) => Mutation
): Promise<OnlineGameState> {
	return runMutation(id, 'leader', token, (game) => mutate(game));
}
