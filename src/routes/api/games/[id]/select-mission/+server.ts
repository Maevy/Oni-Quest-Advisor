import { json } from '@sveltejs/kit';
import { canSelectMission, selectMission } from '$lib/domain';
import { findMission } from '$lib/server/content';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsLeader } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** Leader picks season + mission; validated against the bundled content. */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const season = typeof payload.season === 'string' ? payload.season : '';
	const missionId = typeof payload.missionId === 'string' ? payload.missionId : '';
	const mission = findMission(missionId);
	if (!mission || mission.season !== season) {
		throw new ApiError(400, 'Unknown mission');
	}

	await mutateAsLeader(params.id, bearerToken(request), (game) => {
		if (!canSelectMission(game)) throw new ApiError(409, 'Mission selection is locked');
		return {
			next: selectMission(game, season, missionId),
			events: { type: 'mission-selected', actor: 'player1', payload: { season, missionId } }
		};
	});
	notifyGameChanged(params.id, 'mission-selected');
	return json({ ok: true });
});
