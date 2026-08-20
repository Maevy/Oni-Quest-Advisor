import { json } from '@sveltejs/kit';
import { setSeatSchemeChecked } from '$lib/domain';
import { getSchemes } from '$lib/server/content';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Owner-only scheme-box toggle during the Scoring phase; max comes from the chosen card. */
export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	if (game.status !== 'active' || game.phase !== 'scoring') {
		throw new ApiError(409, 'Scheme boxes are locked outside the Scoring phase');
	}
	const chosen = game[seat]?.progress.scheme;
	if (!chosen) throw new ApiError(409, 'No scheme chosen');
	const card = getSchemes().find((c) => c.id === chosen.schemeId);
	if (!card) throw new ApiError(500, 'Scheme content missing');

	const body: unknown = await request.json().catch(() => null);
	const checkedIncrements =
		typeof body === 'object' && body !== null && 'checkedIncrements' in body
			? Number((body as { checkedIncrements: unknown }).checkedIncrements)
			: NaN;
	if (!Number.isFinite(checkedIncrements)) throw new ApiError(400, 'Invalid checkedIncrements');

	const next = setSeatSchemeChecked(game, seat, checkedIncrements, card.maxIncrements);
	await updateGame(next, {
		type: 'scheme-box-toggled',
		actor: seat,
		payload: { checkedIncrements: next[seat]!.progress.scheme?.checkedIncrements ?? 0 }
	});
	notifyGameChanged(params.id, 'scheme-box-toggled');
	return json({ ok: true });
});
