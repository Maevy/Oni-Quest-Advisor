import { json } from '@sveltejs/kit';
import { viewForSeat } from '$lib/domain';
import { ApiError, api, bearerToken, requireSeat } from '$lib/server/http';

/** Returns the visibility-filtered view for the authenticated seat. */
export const GET = api(async ({ params, request }) => {
	const { game, seat } = await requireSeat(params.id, bearerToken(request));
	const view = viewForSeat(game, seat);
	if (!view) throw new ApiError(401, 'Seat not part of this game');
	return json(view);
});
