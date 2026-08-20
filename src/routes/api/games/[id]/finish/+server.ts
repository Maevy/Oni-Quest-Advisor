import { json } from '@sveltejs/kit';
import { finishGame, MAX_ROUND } from '$lib/domain';
import { ApiError, api, bearerToken, requireLeader } from '$lib/server/http';
import { updateGame, type GameEventInput } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';
import { computeRoundVp } from '$lib/server/vp';

/** Leader ends the game after round 5 scoring: final snapshot, auto-reveal, winner. */
export const POST = api(async ({ params, request }) => {
	const { game } = await requireLeader(params.id, bearerToken(request));
	if (game.status !== 'active' || game.phase !== 'scoring' || game.currentRound !== MAX_ROUND) {
		throw new ApiError(409, 'The game can only be finished during round 5 scoring');
	}
	const vp = computeRoundVp(game);
	if (!vp) throw new ApiError(500, 'Mission content missing');

	const next = finishGame(game, vp);
	const events: GameEventInput[] = [
		{
			type: 'round-snapshotted',
			actor: 'player1',
			payload: { round: game.currentRound, ...vp }
		},
		{
			type: 'game-finished',
			actor: 'player1',
			payload: { winner: next.winner, finalVp1: vp.player1, finalVp2: vp.player2 }
		}
	];
	await updateGame(next, events);
	notifyGameChanged(params.id, 'game-finished');
	return json({ ok: true });
});
