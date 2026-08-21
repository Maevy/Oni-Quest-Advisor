import { json } from '@sveltejs/kit';
import { canChooseSeatScheme, chooseSeatScheme } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Chooses a scheme from the seat's own drawn hand (hand membership is enforced). */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const schemeId =
		typeof body === 'object' && body !== null && 'schemeId' in body
			? (body as { schemeId: unknown }).schemeId
			: '';
	if (typeof schemeId !== 'string') throw new ApiError(409, 'This scheme cannot be chosen');

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canChooseSeatScheme(game, seat, schemeId)) {
			throw new ApiError(409, 'This scheme cannot be chosen');
		}
		return {
			next: chooseSeatScheme(game, seat, schemeId),
			events: { type: 'scheme-chosen', actor: seat, payload: { schemeId } }
		};
	});
	notifyGameChanged(params.id, 'scheme-chosen');
	return json({ ok: true });
});
