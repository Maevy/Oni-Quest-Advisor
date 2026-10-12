import { json } from '@sveltejs/kit';
import { api, bearerToken, requireSeat } from '$lib/server/http';
import { readGameHistory } from '$lib/server/gameRepository';

/**
 * The flower board's append log, in order, for both seats: every interaction of the match is
 * public to its players, and the report will later fold the same rows.
 */
export const GET = api(async ({ params, request }) => {
	await requireSeat(params.id, bearerToken(request));
	return json({ history: await readGameHistory(params.id) });
});
