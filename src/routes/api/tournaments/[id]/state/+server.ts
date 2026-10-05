import { json } from '@sveltejs/kit';
import { viewForTournamentToken } from '$lib/domain';
import { ApiError, api, bearerToken, requireTournamentViewer } from '$lib/server/http';
import { tableGameSnapshots } from '$lib/server/tournamentGames';

/**
 * Returns the visibility-filtered lobby view for the organizer or a seated player. The round's
 * tables carry the live status of the matches they play, which lives in the games table — so the
 * read is joined here, on every fetch, rather than stored where it could go stale.
 */
export const GET = api(async ({ params, request }) => {
	const { tournament, tokenHash } = await requireTournamentViewer(params.id, bearerToken(request));
	const view = viewForTournamentToken(tournament, tokenHash, await tableGameSnapshots(tournament));
	if (!view) throw new ApiError(401, 'Not part of this tournament');
	return json(view);
});
