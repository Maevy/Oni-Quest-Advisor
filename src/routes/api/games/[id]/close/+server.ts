import { json } from '@sveltejs/kit';
import { closeGame } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';
import { reportClosedGame } from '$lib/server/tournamentGames';

/** Leader closes/abandons the game — allowed from lobby or active, never after finish. */
export const POST = api(async ({ params, request }) => {
	const closed = await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (game.status === 'finished' || game.status === 'closed') {
			throw new ApiError(409, 'This game has already ended');
		}
		return {
			next: closeGame(game),
			events: { type: 'game-closed', actor: 'player1' }
		};
	});
	notifyGameChanged(params.id, 'game-closed');
	// A tournament table whose match died has to say so: its players get a replay, and the
	// organizer's board would otherwise keep showing a game nobody can finish.
	await reportClosedGame(closed);
	return json({ ok: true });
});
