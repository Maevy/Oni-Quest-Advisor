import { json } from '@sveltejs/kit';
import { isRoundRunning, parseVitalityCommit } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * One flower-dialog commit, appended to the game's log. The state document does not change: the
 * vitality maps both boards render are the log folded, so the append IS the commit. Names and
 * base identities are the committing device's word - the server loads no army catalogs - but
 * only within the bounds `parseVitalityCommit` enforces.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const commit = parseVitalityCommit(body);
	if (!commit) throw new ApiError(400, 'Malformed vitality commit');

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!isRoundRunning(game)) {
			throw new ApiError(409, 'The board is locked outside a running round');
		}
		return {
			next: game,
			events: {
				type: 'vitality-committed',
				actor: seat,
				payload: { ...commit, round: game.currentRound }
			}
		};
	});
	notifyGameChanged(params.id, 'vitality-committed');
	return json({ ok: true });
});
