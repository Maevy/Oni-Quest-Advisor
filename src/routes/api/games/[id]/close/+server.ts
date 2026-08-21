import { json } from '@sveltejs/kit';
import { closeGame } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Leader closes/abandons the game — allowed from lobby or active, never after finish. */
export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (game.status === 'finished' || game.status === 'closed') {
			throw new ApiError(409, 'This game has already ended');
		}
		return {
			next: closeGame(game),
			events: { type: 'game-closed', actor: 'player1' }
		};
	});
	notifyGameChanged(params.id, 'game-closed');
	return json({ ok: true });
});
