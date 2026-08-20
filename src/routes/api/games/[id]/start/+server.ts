import { json } from '@sveltejs/kit';
import { canStartGame, startGame } from '$lib/domain';
import { ApiError, api, bearerToken, requireLeader } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Leader starts the game: mission selected and both schemes chosen. */
export const POST = api(async ({ params, request }) => {
	const { game } = await requireLeader(params.id, bearerToken(request));
	if (!canStartGame(game)) throw new ApiError(409, 'The game cannot be started yet');

	const next = startGame(game);
	await updateGame(next, { type: 'game-started', actor: 'player1' });
	notifyGameChanged(params.id, 'game-started');
	return json({ ok: true });
});
