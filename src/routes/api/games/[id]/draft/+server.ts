import { json } from '@sveltejs/kit';
import { canEditSetup, setSeatDraft } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * Sets the seat's intelligence. The Scheme faction is not a choice any more: `leavePrep` seeds it
 * from the combat army, and accepting one here would let a seat draw from a deck its army does not
 * belong to.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

	if (!('intelligence' in payload)) throw new ApiError(400, 'Nothing to draft');
	let intelligence: number | null;
	if (payload.intelligence === null) {
		intelligence = null;
	} else if (
		typeof payload.intelligence === 'number' &&
		Number.isFinite(payload.intelligence) &&
		payload.intelligence >= 0
	) {
		intelligence = Math.floor(payload.intelligence);
	} else {
		throw new ApiError(400, 'Invalid intelligence');
	}

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canEditSetup(game)) throw new ApiError(409, 'Setup is locked');
		return {
			next: setSeatDraft(game, seat, { intelligence }),
			events: { type: 'intelligence-drafted', actor: seat, payload: { intelligence } }
		};
	});
	notifyGameChanged(params.id, 'intelligence-drafted');
	return json({ ok: true });
});
