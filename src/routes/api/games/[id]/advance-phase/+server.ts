import { json } from '@sveltejs/kit';
import { advanceToScoring, MAX_ROUND, snapshotAndProceed } from '$lib/domain';
import { ApiError, api, bearerToken, requireLeader } from '$lib/server/http';
import { updateGame, type GameEventInput } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';
import { computeRoundVp } from '$lib/server/vp';

/**
 * Leader advances the round engine:
 * Reveal → Scoring (commits reveal intents) or Scoring → next round
 * (VP snapshot; skips the next Reveal phase when both schemes are already revealed).
 */
export const POST = api(async ({ params, request }) => {
	const { game } = await requireLeader(params.id, bearerToken(request));
	if (game.status !== 'active') throw new ApiError(409, 'The game is not running');

	if (game.phase === 'reveal') {
		const next = advanceToScoring(game);
		await updateGame(next, {
			type: 'phase-changed',
			actor: 'player1',
			payload: { round: next.currentRound, phase: next.phase }
		});
		notifyGameChanged(params.id, 'phase-changed');
		return json({ ok: true });
	}

	// Scoring phase: snapshot VP, then advance.
	if (game.currentRound >= MAX_ROUND) {
		throw new ApiError(409, 'The final round is finished with Finish Game');
	}
	const vp = computeRoundVp(game);
	if (!vp) throw new ApiError(500, 'Mission content missing');

	const next = snapshotAndProceed(game, vp);
	const events: GameEventInput[] = [
		{ type: 'round-snapshotted', actor: 'player1', payload: { round: game.currentRound, ...vp } },
		{
			type: 'phase-changed',
			actor: 'player1',
			payload: { round: next.currentRound, phase: next.phase }
		}
	];
	await updateGame(next, events);
	notifyGameChanged(params.id, 'phase-changed');
	return json({ ok: true });
});
