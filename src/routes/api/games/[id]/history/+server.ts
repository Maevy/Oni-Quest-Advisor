import { json } from '@sveltejs/kit';
import { api, bearerToken, requireSeat } from '$lib/server/http';
import { getGameCreatedAt, readGameHistory } from '$lib/server/gameRepository';

/**
 * The flower board's append log, in order, for both seats: every interaction of the match is
 * public to its players, and the report will later fold the same rows. `startedAt` rides along
 * as the match date the battle report prints - the state document itself carries no timestamp.
 */
export const GET = api(async ({ params, request }) => {
	await requireSeat(params.id, bearerToken(request));
	const [history, startedAt] = await Promise.all([
		readGameHistory(params.id),
		getGameCreatedAt(params.id)
	]);
	return json({ history, startedAt });
});
