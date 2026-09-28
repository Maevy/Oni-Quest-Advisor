import { hydrateTournamentState, seatIndexForTokenHash, type TournamentState } from '$lib/domain';
import { ApiError } from './errors';
import { getDb } from './db';
import { hashToken } from './ids';

export type TournamentEventActor = 'organizer' | 'player' | 'server';

export type TournamentEventInput = {
	type: string;
	actor: TournamentEventActor;
	payload?: Record<string, unknown>;
};

/** Result of a mutation callback: the next state plus the event(s) recording it. */
export type TournamentMutation = {
	next: TournamentState;
	events: TournamentEventInput | TournamentEventInput[];
};

/** Who a mutation runs as: an unauthenticated joiner, a seated player, or the organizer. */
export type TournamentViewer =
	{ kind: 'open' } | { kind: 'player'; seatIndex: number } | { kind: 'organizer' };

export async function getTournament(id: string): Promise<TournamentState | null> {
	const db = await getDb();
	const result = await db.execute({
		sql: 'SELECT state FROM tournaments WHERE id = ?',
		args: [id]
	});
	if (result.rows.length === 0) return null;
	// Hydrated, because rows written before a field existed (the round) carry no value for it.
	return hydrateTournamentState(JSON.parse(String(result.rows[0][0])) as TournamentState);
}

export async function insertTournament(
	state: TournamentState,
	event: TournamentEventInput
): Promise<void> {
	const db = await getDb();
	await db.batch([
		{
			sql: 'INSERT INTO tournaments (id, status, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
			args: [state.code, state.status, JSON.stringify(state), state.createdAt, state.updatedAt]
		},
		{
			sql: 'INSERT INTO tournament_events (tournament_id, seq, type, actor, payload, created_at) VALUES (?, 1, ?, ?, ?, ?)',
			args: [
				state.code,
				event.type,
				event.actor,
				JSON.stringify(event.payload ?? {}),
				state.createdAt
			]
		}
	]);
}

/**
 * In-process FIFO queue serializing tournament mutations, separate from the games' queue but
 * with the same reason: libsql fails concurrent write transactions with SQLITE_BUSY instead of
 * queueing them, and this app runs as a single Node process on a single database file.
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

/**
 * The complete read-modify-write cycle for one tournament action: SELECT the freshest state,
 * authenticate, run the mutation callback, refresh the snapshot row and append the event(s) —
 * inside a single write transaction, serialized against all other mutations, so concurrent
 * joins can never double-book a seat or trip SQLITE_BUSY. Guard violations roll back cleanly.
 */
async function executeMutation(
	id: string,
	token: string | null,
	mutate: (tournament: TournamentState, viewer: TournamentViewer) => TournamentMutation
): Promise<TournamentState> {
	const db = await getDb();
	const tx = await db.transaction('write');
	try {
		const result = await tx.execute({
			sql: 'SELECT state FROM tournaments WHERE id = ?',
			args: [id]
		});
		if (result.rows.length === 0) throw new ApiError(404, 'Unknown tournament');
		const tournament = hydrateTournamentState(
			JSON.parse(String(result.rows[0][0])) as TournamentState
		);

		let viewer: TournamentViewer = { kind: 'open' };
		if (token !== null) {
			const tokenHash = hashToken(token);
			if (tokenHash === tournament.organizerTokenHash) {
				viewer = { kind: 'organizer' };
			} else {
				const seatIndex = seatIndexForTokenHash(tournament, tokenHash);
				if (seatIndex === null) throw new ApiError(401, 'Invalid tournament token');
				viewer = { kind: 'player', seatIndex };
			}
		}

		const { next, events } = mutate(tournament, viewer);
		const list = Array.isArray(events) ? events : [events];
		const updatedAt = new Date().toISOString();
		const persisted = { ...next, updatedAt };
		const seqResult = await tx.execute({
			sql: 'SELECT COALESCE(MAX(seq), 0) + 1 FROM tournament_events WHERE tournament_id = ?',
			args: [id]
		});
		let seq = Number(seqResult.rows[0][0]);
		await tx.execute({
			sql: 'UPDATE tournaments SET status = ?, state = ?, updated_at = ? WHERE id = ?',
			args: [persisted.status, JSON.stringify(persisted), updatedAt, id]
		});
		for (const event of list) {
			await tx.execute({
				sql: 'INSERT INTO tournament_events (tournament_id, seq, type, actor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
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

/**
 * Unauthenticated mutation — joins, where no seat exists yet. The domain guard decides whether
 * the lobby still takes players.
 */
export function mutateOpenTournament(
	id: string,
	mutate: (tournament: TournamentState) => TournamentMutation
): Promise<TournamentState> {
	return serializeMutation(() => executeMutation(id, null, (tournament) => mutate(tournament)));
}

/** Mutates as a seated player or the organizer, whichever the token proves. */
export function mutateAsTournamentViewer(
	id: string,
	token: string | null,
	mutate: (
		tournament: TournamentState,
		viewer: Exclude<TournamentViewer, { kind: 'open' }>
	) => TournamentMutation
): Promise<TournamentState> {
	return serializeMutation(() =>
		executeMutation(id, token, (tournament, viewer) => {
			if (viewer.kind === 'open') throw new ApiError(401, 'Missing tournament token');
			return mutate(tournament, viewer);
		})
	);
}

/** Mutates as the organizer; 403 for a seated player. */
export function mutateAsTournamentOrganizer(
	id: string,
	token: string | null,
	mutate: (tournament: TournamentState) => TournamentMutation
): Promise<TournamentState> {
	return mutateAsTournamentViewer(id, token, (tournament, viewer) => {
		if (viewer.kind !== 'organizer') throw new ApiError(403, 'Only the organizer may do this');
		return mutate(tournament);
	});
}
