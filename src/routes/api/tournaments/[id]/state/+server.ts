import { json } from '@sveltejs/kit';
import { viewForTournamentToken } from '$lib/domain';
import { ApiError, api, bearerToken, requireTournamentViewer } from '$lib/server/http';

/** Returns the visibility-filtered lobby view for the organizer or a seated player. */
export const GET = api(async ({ params, request }) => {
	const { tournament, tokenHash } = await requireTournamentViewer(params.id, bearerToken(request));
	const view = viewForTournamentToken(tournament, tokenHash);
	if (!view) throw new ApiError(401, 'Not part of this tournament');
	return json(view);
});
