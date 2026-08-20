import { LibsqlError } from '@libsql/client';
import { json } from '@sveltejs/kit';
import { createOnlineGame, normalizeNickname } from '$lib/domain';
import { ApiError, api } from '$lib/server/http';
import { insertGame } from '$lib/server/gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from '$lib/server/ids';

/** Creates a new game; returns the plain leader seat token exactly once. */
export const POST = api(async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	const rawNickname =
		typeof body === 'object' && body !== null && 'nickname' in body
			? String((body as { nickname: unknown }).nickname)
			: '';
	const nickname = normalizeNickname(rawNickname);
	if (!nickname) throw new ApiError(400, 'Invalid nickname');

	const token = generateSeatToken();
	const now = new Date().toISOString();
	for (let attempt = 0; attempt < 3; attempt++) {
		const id = generateGameCode();
		const state = createOnlineGame(id, nickname, hashToken(token), now);
		try {
			await insertGame(state, { type: 'game-created', actor: 'player1', payload: { nickname } });
			return json({ gameId: id, seat: 'player1', token }, { status: 201 });
		} catch (error) {
			const isCollision =
				error instanceof LibsqlError && error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
			if (!isCollision) throw error;
		}
	}
	throw new ApiError(500, 'Could not allocate a game code');
});
