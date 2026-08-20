import { json } from '@sveltejs/kit';
import { toggleRevealIntent } from '$lib/domain';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';
import { updateGame } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Toggles the seat's reveal intent during a Reveal phase; committed at the phase transition. */
export const POST = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	if (game.status !== 'active' || game.phase !== 'reveal') {
		throw new ApiError(409, 'Revealing is only possible during the Reveal phase');
	}
	if (!game[seat]?.progress.scheme) throw new ApiError(409, 'No scheme to reveal');

	const next = toggleRevealIntent(game, seat);
	await updateGame(next, {
		type: 'reveal-intent-toggled',
		actor: seat,
		payload: { intent: next[seat]!.revealIntent }
	});
	notifyGameChanged(params.id, 'reveal-intent-toggled');
	return json({ ok: true });
});
