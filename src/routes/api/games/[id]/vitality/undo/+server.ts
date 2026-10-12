import { json } from '@sveltejs/kit';
import { isRoundRunning, undoableAction } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * Walks the latest interaction back, as an appended revert: the log keeps the mis-tap and the
 * fold skips the pair. Only the seat that acted may undo it, and only while its action is still
 * the last thing that happened - an undo is a correction of one's own mis-tap, not a veto.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const seq =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>).seq : null;
	if (typeof seq !== 'number' || !Number.isInteger(seq)) {
		throw new ApiError(400, 'Unknown interaction');
	}

	await mutateAsSeat(params.id, bearerToken(request), (game, seat, history) => {
		if (!isRoundRunning(game)) {
			throw new ApiError(409, 'The board is locked outside a running round');
		}
		const target = undoableAction(history, seat);
		if (target === null || target.seq !== seq) {
			throw new ApiError(409, 'Only your own latest interaction can be undone');
		}
		return {
			next: game,
			events: {
				type: 'vitality-reverted',
				actor: seat,
				payload: { revertOf: target.seq, round: game.currentRound }
			}
		};
	});
	notifyGameChanged(params.id, 'vitality-reverted');
	return json({ ok: true });
});
