import { json } from '@sveltejs/kit';
import {
	canDrawSchemes,
	drawCountForIntelligence,
	drawUniqueSchemes,
	getSchemePool,
	setSeatDrawnSchemes
} from '$lib/domain';
import { getSchemes } from '$lib/server/content';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Server-side scheme draw; the hand is persisted for the seat (private — only ids travel in state). */
export const POST = api(async ({ params, request }) => {
	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canDrawSchemes(game, seat)) throw new ApiError(409, 'Cannot draw schemes right now');

		const { factionId, intelligence } = game[seat]!.progress.schemeDraft;
		const pool = getSchemePool(getSchemes(), factionId!);
		const count = drawCountForIntelligence(intelligence!);
		const drawn = drawUniqueSchemes(pool, count, Math.random, factionId!);

		return {
			next: setSeatDrawnSchemes(
				game,
				seat,
				drawn.map((card) => card.id)
			),
			events: { type: 'schemes-drawn', actor: seat, payload: { count: drawn.length } }
		};
	});
	notifyGameChanged(params.id, 'schemes-drawn');
	return json({ ok: true });
});
