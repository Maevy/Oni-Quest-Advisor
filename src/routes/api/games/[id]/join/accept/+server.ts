import { json } from '@sveltejs/kit';
import { acceptJoin } from '$lib/domain';
import { ApiError, api, bearerToken, requireLeader } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

export const POST = api(async ({ params, request }) => {
	const { game } = await requireLeader(params.id, bearerToken(request));
	if (!game.pendingJoin) throw new ApiError(409, 'No pending join request');

	const nickname = game.pendingJoin.nickname;
	const next = acceptJoin(game);
	await updateGame(next, { type: 'join-accepted', actor: 'player1', payload: { nickname } });
	notifyGameChanged(params.id, 'join-accepted');
	return json({ ok: true });
});
