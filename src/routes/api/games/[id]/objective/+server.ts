import { json } from '@sveltejs/kit';
import { getScoreableResults, setSeatObjectiveChecked } from '$lib/domain';
import { findMission } from '$lib/server/content';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Owner-only objective toggle during the Scoring phase; bounds come from the mission content. */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const objectiveId = typeof payload.objectiveId === 'string' ? payload.objectiveId : '';
	const checkedCount = typeof payload.checkedCount === 'number' ? payload.checkedCount : NaN;
	if (!objectiveId || !Number.isFinite(checkedCount)) throw new ApiError(400, 'Unknown objective');

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (game.status !== 'active' || game.phase !== 'scoring') {
			throw new ApiError(409, 'Objectives are locked outside the Scoring phase');
		}
		const mission = game.missionId ? findMission(game.missionId) : undefined;
		if (!mission) throw new ApiError(500, 'Mission content missing');
		const objective = getScoreableResults(mission).find((o) => o.id === objectiveId);
		if (!objective) throw new ApiError(400, 'Unknown objective');

		const next = setSeatObjectiveChecked(game, seat, objectiveId, checkedCount, objective.count);
		const clamped = next[seat]!.progress.checkedObjectiveCounts[objectiveId] ?? 0;
		return {
			next,
			events: {
				type: 'objective-toggled',
				actor: seat,
				payload: { objectiveId, checkedCount: clamped }
			}
		};
	});
	notifyGameChanged(params.id, 'objective-toggled');
	return json({ ok: true });
});
