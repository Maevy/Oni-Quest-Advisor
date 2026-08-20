import { json } from '@sveltejs/kit';
import { closeGame } from '$lib/domain';
import { ApiError, api, bearerToken, requireLeader } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Leader closes/abandons the game — allowed from lobby or active, never after finish. */
export const POST = api(async ({ params, request }) => {
	const { game } = await requireLeader(params.id, bearerToken(request));
	if (game.status === 'finished' || game.status === 'closed') {
		throw new ApiError(409, 'This game has already ended');
	}

	const next = closeGame(game);
	await updateGame(next, { type: 'game-closed', actor: 'player1' });
	notifyGameChanged(params.id, 'game-closed');
	return json({ ok: true });
});
