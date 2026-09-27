import { json, type RequestHandler } from '@sveltejs/kit';
import {
	seatForTokenHash,
	seatIndexForTokenHash,
	type OnlineGameState,
	type PlayerKey,
	type TournamentState
} from '$lib/domain';
import { ApiError } from './errors';
import { getGame } from './gameRepository';
import { getTournament } from './tournamentRepository';
import { hashToken } from './ids';

export { ApiError } from './errors';

export function bearerToken(request: Request): string | null {
	const header = request.headers.get('authorization');
	return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

export async function requireGame(id: string): Promise<OnlineGameState> {
	const game = await getGame(id);
	if (!game) throw new ApiError(404, 'Unknown game');
	return game;
}

export async function requireSeat(
	id: string,
	token: string | null
): Promise<{ game: OnlineGameState; seat: PlayerKey }> {
	if (!token) throw new ApiError(401, 'Missing seat token');
	const game = await requireGame(id);
	const seat = seatForTokenHash(game, hashToken(token));
	if (!seat) throw new ApiError(401, 'Invalid seat token');
	return { game, seat };
}

type ApiContext = { params: { id: string }; request: Request };

export async function requireTournament(id: string): Promise<TournamentState> {
	const tournament = await getTournament(id);
	if (!tournament) throw new ApiError(404, 'Unknown tournament');
	return tournament;
}

/**
 * Proves the caller is the organizer or holds a seat, and hands back the hash their view is
 * filtered by. Joiners without a token use the peek endpoint instead.
 */
export async function requireTournamentViewer(
	id: string,
	token: string | null
): Promise<{ tournament: TournamentState; tokenHash: string }> {
	if (!token) throw new ApiError(401, 'Missing tournament token');
	const tournament = await requireTournament(id);
	const tokenHash = hashToken(token);
	const isOrganizer = tokenHash === tournament.organizerTokenHash;
	if (!isOrganizer && seatIndexForTokenHash(tournament, tokenHash) === null) {
		throw new ApiError(401, 'Invalid tournament token');
	}
	return { tournament, tokenHash };
}

/** Wraps a handler so ApiErrors become JSON responses instead of 500s. */
export function api(handler: (ctx: ApiContext) => Promise<Response>): RequestHandler {
	return async ({ params, request }) => {
		try {
			return await handler({ params: { id: params.id ?? '' }, request });
		} catch (error) {
			if (error instanceof ApiError) {
				return json({ error: error.message }, { status: error.status });
			}
			throw error;
		}
	};
}
