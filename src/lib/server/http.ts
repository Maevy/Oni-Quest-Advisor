import { json, type RequestHandler } from '@sveltejs/kit';
import { seatForTokenHash, type OnlineGameState, type PlayerKey } from '$lib/domain';
import { getGame } from './gameRepository';
import { hashToken } from './ids';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

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

/** The creator (seat player1) is the leader for the whole game. */
export async function requireLeader(
	id: string,
	token: string | null
): Promise<{ game: OnlineGameState }> {
	const { game, seat } = await requireSeat(id, token);
	if (seat !== 'player1') throw new ApiError(403, 'Only the game leader may do this');
	return { game };
}

type ApiContext = { params: { id: string }; request: Request };

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
