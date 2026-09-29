import { json } from '@sveltejs/kit';
import {
	advanceToScoring,
	canLeavePrep,
	canStartRounds,
	leavePrep,
	MAX_ROUND,
	snapshotAndProceed,
	startRounds,
	type OnlineGameState
} from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';
import { computeRoundVp } from '$lib/server/vp';

/**
 * Leader advances the game one step:
 * Prep → Scheme setup (both seats combat-ready), Scheme setup → Round 1 Reveal (both Schemes
 * chosen), Reveal → Scoring (commits reveal intents), or Scoring → next round (VP snapshot;
 * skips the next Reveal phase when both schemes are already revealed).
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (game.status !== 'active') throw new ApiError(409, 'The game is not running');

		if (game.phase === 'prep') {
			if (!canLeavePrep(game)) {
				throw new ApiError(409, 'Both players need a combat-ready army');
			}
			const next = leavePrep(game);
			return { next, events: phaseEvent(next) };
		}

		if (game.phase === 'setup') {
			if (!canStartRounds(game)) {
				throw new ApiError(409, 'Both players need to choose a Scheme');
			}
			const next = startRounds(game);
			return { next, events: phaseEvent(next) };
		}

		if (game.phase === 'reveal') {
			const next = advanceToScoring(game);
			return { next, events: phaseEvent(next) };
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
				phaseEvent(next)
			]
		};
	});
	notifyGameChanged(params.id, 'phase-changed');
	return json({ ok: true });
});

function phaseEvent(game: OnlineGameState) {
	return {
		type: 'phase-changed',
		actor: 'player1',
		payload: { round: game.currentRound, phase: game.phase }
	} as const;
}
