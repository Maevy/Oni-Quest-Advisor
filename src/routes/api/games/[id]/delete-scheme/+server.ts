import { json } from '@sveltejs/kit';
import { canEditSetup, clearSeatScheme } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

export const POST = api(async ({ params, request }) => {
	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canEditSetup(game)) throw new ApiError(409, 'Setup is locked');
		return {
			next: clearSeatScheme(game, seat),
			events: { type: 'scheme-deleted', actor: seat }
		};
	});
	notifyGameChanged(params.id, 'scheme-deleted');
	return json({ ok: true });
});
