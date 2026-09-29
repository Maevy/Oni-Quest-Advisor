import { json } from '@sveltejs/kit';
import { canRequestJoin, normalizeNickname, requestJoin } from '$lib/domain';
import { ApiError, api } from '$lib/server/http';
import { mutateOpen } from '$lib/server/gameRepository';
import { hashToken } from '$lib/server/ids';
import { parsePickedArmy } from '$lib/server/payload';
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
	const army = parsePickedArmy(payload.army);
	if (!nickname) throw new ApiError(400, 'Invalid player name');
	if (!army) throw new ApiError(400, 'Invalid army');
	if (!token) throw new ApiError(400, 'Missing join token');

	await mutateOpen(params.id, (game) => {
		if (!canRequestJoin(game)) throw new ApiError(409, 'This game cannot be joined right now');
		return {
			next: requestJoin(game, nickname, hashToken(token), army),
			events: { type: 'join-requested', actor: 'player2', payload: { nickname } }
		};
	});
	notifyGameChanged(params.id, 'join-requested');
	return json({ status: 'pending' });
});
