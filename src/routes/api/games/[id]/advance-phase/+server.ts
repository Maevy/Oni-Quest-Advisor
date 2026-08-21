import { json } from '@sveltejs/kit';
import { advanceToScoring, MAX_ROUND, snapshotAndProceed } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';
import { computeRoundVp } from '$lib/server/vp';

/**
 * Leader advances the round engine:
 * Reveal → Scoring (commits reveal intents) or Scoring → next round
 * (VP snapshot; skips the next Reveal phase when both schemes are already revealed).
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (game.status !== 'active') throw new ApiError(409, 'The game is not running');

		if (game.phase === 'reveal') {
			const next = advanceToScoring(game);
			return {
				next,
				events: {
					type: 'phase-changed',
					actor: 'player1',
					payload: { round: next.currentRound, phase: next.phase }
				}
			};
		}

		// Scoring phase: snapshot VP, then advance.
		if (game.currentRound >= MAX_ROUND) {
			throw new ApiError(409, 'The final round is finished with Finish Game');
		}
		const vp = computeRoundVp(game);
		if (!vp) throw new ApiError(500, 'Mission content missing');

		const next = snapshotAndProceed(game, vp);
		return {
			next,
			events: [
				{
					type: 'round-snapshotted',
					actor: 'player1',
					payload: { round: game.currentRound, ...vp }
				},
				{
					type: 'phase-changed',
					actor: 'player1',
					payload: { round: next.currentRound, phase: next.phase }
				}
			]
		};
	});
	notifyGameChanged(params.id, 'phase-changed');
	return json({ ok: true });
});
