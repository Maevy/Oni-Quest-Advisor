import { json } from '@sveltejs/kit';
import { canEditSetup, setSeatDraft, type SchemeDraft } from '$lib/domain';
import { getFactions } from '$lib/server/content';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Sets the seat's faction and/or intelligence draft. */
export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	if (!canEditSetup(game)) throw new ApiError(409, 'Setup is locked');

	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const draft: Partial<SchemeDraft> = {};

	if ('factionId' in payload) {
		if (payload.factionId === null) {
			draft.factionId = null;
		} else if (
			typeof payload.factionId === 'string' &&
			getFactions().some((faction) => faction.id === payload.factionId)
		) {
			draft.factionId = payload.factionId;
		} else {
			throw new ApiError(400, 'Unknown faction');
		}
	}
	if ('intelligence' in payload) {
		if (payload.intelligence === null) {
			draft.intelligence = null;
		} else if (
			typeof payload.intelligence === 'number' &&
			Number.isFinite(payload.intelligence) &&
			payload.intelligence >= 0
		) {
			draft.intelligence = Math.floor(payload.intelligence);
		} else {
			throw new ApiError(400, 'Invalid intelligence');
		}
	}

	const next = setSeatDraft(game, seat, draft);
	await updateGame(next, { type: 'faction-drafted', actor: seat, payload: draft });
	notifyGameChanged(params.id, 'faction-drafted');
	return json({ ok: true });
});
