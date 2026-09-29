import { json } from '@sveltejs/kit';
import { canRevealSeatScheme, revealSeatScheme } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * Reveals this seat's scheme, immediately and irreversibly. The confirm lives on the client —
 * the server's job is only to refuse outside a running round or for an already-revealed scheme.
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canRevealSeatScheme(game, seat)) {
			throw new ApiError(409, 'A scheme can only be revealed once, during a running round');
		}
		return {
			next: revealSeatScheme(game, seat),
			events: { type: 'scheme-revealed', actor: seat }
		};
	});
	notifyGameChanged(params.id, 'scheme-revealed');
	return json({ ok: true });
});
