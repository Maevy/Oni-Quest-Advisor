import { json } from '@sveltejs/kit';
import { ApiError, api, requireGame } from '$lib/server/http';
import { hashToken } from '$lib/server/ids';

/**
 * Polled by the joining phone while awaiting the leader's decision. Identified
 * by nickname + own join token (no seat exists yet, so no seat auth is possible).
 */
export const GET = api(async ({ params, request }) => {
	const url = new URL(request.url);
	const nickname = url.searchParams.get('nickname') ?? '';
	const token = url.searchParams.get('token') ?? '';
	if (!token) throw new ApiError(400, 'Missing join token');

	const game = await requireGame(params.id);
	const tokenHash = hashToken(token);

	if (game.player2 && game.player2.tokenHash === tokenHash) {
		return json({ status: 'accepted', seat: 'player2' });
	}
	const pending = game.pendingJoin;
	if (pending && pending.nickname === nickname && pending.tokenHash === tokenHash) {
		return json({ status: 'pending' });
	}
	if (game.status === 'closed') return json({ status: 'closed' });
	if (game.status !== 'lobby') return json({ status: 'closed' });
	if (game.player2) return json({ status: 'full' });
	return json({ status: 'denied' });
});
