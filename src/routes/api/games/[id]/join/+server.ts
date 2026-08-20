import { json } from '@sveltejs/kit';
import { canRequestJoin, normalizeNickname, requestJoin } from '$lib/domain';
import { ApiError, api, requireGame } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { hashToken } from '$lib/server/ids';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * Player 2 requests to join. The joining player generates their own seat token
 * and sends it along — the server only ever stores its hash.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const nickname = normalizeNickname(typeof payload.nickname === 'string' ? payload.nickname : '');
	const token = typeof payload.token === 'string' ? payload.token : '';
	if (!nickname) throw new ApiError(400, 'Invalid nickname');
	if (!token) throw new ApiError(400, 'Missing join token');

	const game = await requireGame(params.id);
	if (!canRequestJoin(game)) throw new ApiError(409, 'This game cannot be joined right now');

	const next = requestJoin(game, nickname, hashToken(token));
	await updateGame(next, { type: 'join-requested', actor: 'player2', payload: { nickname } });
	notifyGameChanged(params.id, 'join-requested');
	return json({ status: 'pending' });
});
