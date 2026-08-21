import { json } from '@sveltejs/kit';
import { acceptJoin } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (!game.pendingJoin) throw new ApiError(409, 'No pending join request');
		const nickname = game.pendingJoin.nickname;
		return {
			next: acceptJoin(game),
			events: { type: 'join-accepted', actor: 'player1', payload: { nickname } }
		};
	});
	notifyGameChanged(params.id, 'join-accepted');
	return json({ ok: true });
});
