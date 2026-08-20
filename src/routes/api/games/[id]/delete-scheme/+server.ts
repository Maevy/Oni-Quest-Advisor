import { json } from '@sveltejs/kit';
import { canEditSetup, clearSeatScheme } from '$lib/domain';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	if (!canEditSetup(game)) throw new ApiError(409, 'Setup is locked');

	const next = clearSeatScheme(game, seat);
	await updateGame(next, { type: 'scheme-deleted', actor: seat });
	notifyGameChanged(params.id, 'scheme-deleted');
	return json({ ok: true });
});
