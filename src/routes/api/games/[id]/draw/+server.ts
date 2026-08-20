import { json } from '@sveltejs/kit';
import {
	canDrawSchemes,
	drawCountForIntelligence,
	drawUniqueSchemes,
	getSchemePool,
	setSeatDrawnSchemes
} from '$lib/domain';
import { getSchemes } from '$lib/server/content';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Server-side scheme draw; the hand is persisted for the seat (private — only ids travel in state). */
export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	if (!canDrawSchemes(game, seat)) throw new ApiError(409, 'Cannot draw schemes right now');

	const { factionId, intelligence } = game[seat]!.progress.schemeDraft;
	const pool = getSchemePool(getSchemes(), factionId!);
	const count = drawCountForIntelligence(intelligence!);
	const drawn = drawUniqueSchemes(pool, count, Math.random, factionId!);

	const next = setSeatDrawnSchemes(
		game,
		seat,
		drawn.map((card) => card.id)
	);
	await updateGame(next, {
		type: 'schemes-drawn',
		actor: seat,
		payload: { count: drawn.length }
	});
	notifyGameChanged(params.id, 'schemes-drawn');
	return json({ ok: true });
});
