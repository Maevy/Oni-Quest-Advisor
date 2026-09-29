import { LibsqlError } from '@libsql/client';
import { json } from '@sveltejs/kit';
import { createOnlineGame, normalizeNickname } from '$lib/domain';
import { ApiError, api } from '$lib/server/http';
import { findMission } from '$lib/server/content';
import { insertGame } from '$lib/server/gameRepository';
import { generateGameCode, generateSeatToken, hashToken } from '$lib/server/ids';
import { parsePickedArmy } from '$lib/server/payload';

/**
 * Creates a new game. The mission and the leader's army are part of the creation, so a game
 * exists already set up — the lobby has nothing left to choose. Returns the plain leader seat
 * token exactly once.
 */
export const POST = api(async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const nickname = normalizeNickname(typeof payload.nickname === 'string' ? payload.nickname : '');
	const season = typeof payload.season === 'string' ? payload.season : '';
	const missionId = typeof payload.missionId === 'string' ? payload.missionId : '';
	const army = parsePickedArmy(payload.army);
	if (!nickname) throw new ApiError(400, 'Invalid player name');
	if (!army) throw new ApiError(400, 'Invalid army');
	const mission = findMission(missionId);
	if (!mission || mission.season !== season) throw new ApiError(400, 'Unknown mission');

	const token = generateSeatToken();
	const now = new Date().toISOString();
	for (let attempt = 0; attempt < 3; attempt++) {
		const id = generateGameCode();
		const state = createOnlineGame(id, nickname, hashToken(token), now, {
			season,
			missionId,
			army
		});
		try {
			await insertGame(state, {
				type: 'game-created',
				actor: 'player1',
				payload: { nickname, season, missionId }
			});
			return json({ gameId: id, seat: 'player1', token }, { status: 201 });
		} catch (error) {
			const isCollision =
				error instanceof LibsqlError && error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
			if (!isCollision) throw error;
		}
	}
	throw new ApiError(500, 'Could not allocate a game code');
});
