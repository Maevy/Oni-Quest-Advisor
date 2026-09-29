import { json } from '@sveltejs/kit';
import { canToggleReady, toggleReady } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Flips this seat's lobby readiness; the leader's Start Game needs both seats ready. */
export const POST = api(async ({ params, request }) => {
	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canToggleReady(game, seat)) {
			throw new ApiError(409, 'Readiness can only be changed in the lobby');
		}
		const next = toggleReady(game, seat);
		return {
			next,
			events: {
				type: 'seat-ready-toggled',
				actor: seat,
				payload: { ready: next[seat]!.ready }
			}
		};
	});
	notifyGameChanged(params.id, 'seat-ready-toggled');
	return json({ ok: true });
});
