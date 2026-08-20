import { json } from '@sveltejs/kit';
import { canChooseSeatScheme, chooseSeatScheme } from '$lib/domain';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Chooses a scheme from the seat's own drawn hand (hand membership is enforced). */
export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	const body: unknown = await request.json().catch(() => null);
	const schemeId =
		typeof body === 'object' && body !== null && 'schemeId' in body
			? (body as { schemeId: unknown }).schemeId
			: '';
	if (typeof schemeId !== 'string' || !canChooseSeatScheme(game, seat, schemeId)) {
		throw new ApiError(409, 'This scheme cannot be chosen');
	}

	const next = chooseSeatScheme(game, seat, schemeId);
	await updateGame(next, { type: 'scheme-chosen', actor: seat, payload: { schemeId } });
	notifyGameChanged(params.id, 'scheme-chosen');
	return json({ ok: true });
});
