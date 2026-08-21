import { json } from '@sveltejs/kit';
import { canStartGame, startGame } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Leader starts the game: mission selected and both schemes chosen. */
export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (!canStartGame(game)) throw new ApiError(409, 'The game cannot be started yet');
		return {
			next: startGame(game),
			events: { type: 'game-started', actor: 'player1' }
		};
	});
	notifyGameChanged(params.id, 'game-started');
	return json({ ok: true });
});
