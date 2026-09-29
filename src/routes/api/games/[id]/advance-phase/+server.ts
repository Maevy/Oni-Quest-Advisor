import { json } from '@sveltejs/kit';
import {
	canLeaveArmies,
	canLeavePrep,
	canStartRounds,
	finishGame,
	leaveArmies,
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
 * Armies → Preparation (the reveal is over), Preparation → Scheme setup (both seats combat-ready
 * and led), Scheme setup → Round 1 (both Schemes chosen), Round 1–4 → the next round (VP
 * snapshot), Round 5 → concluded (final snapshot, winner, result summary, status finished).
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (game.status !== 'active') throw new ApiError(409, 'The game is not running');

		if (game.phase === 'armies') {
			if (!canLeaveArmies(game)) {
				throw new ApiError(409, 'The armies are not revealed yet');
			}
			const next = leaveArmies(game);
			return { next, events: phaseEvent(next) };
		}

		if (game.phase === 'prep') {
			if (!canLeavePrep(game)) {
				throw new ApiError(409, 'Both players need a combat-ready army and a Leader');
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

		// A running round: snapshot its VP, then advance — or conclude on round 5.
		const vp = computeRoundVp(game);
		if (!vp) throw new ApiError(500, 'Mission content missing');
		const snapshotted = {
			type: 'round-snapshotted',
			actor: 'player1',
			payload: { round: game.currentRound, ...vp }
		} as const;

		if (game.currentRound >= MAX_ROUND) {
			const next = finishGame(game, vp);
			return {
				next,
				events: [snapshotted, { type: 'game-finished', actor: 'player1' } as const]
			};
		}

		const next = snapshotAndProceed(game, vp);
		return { next, events: [snapshotted, phaseEvent(next)] };
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
