import { ApiError, api, requireTournamentViewer } from '$lib/server/http';
import { subscribeToTournament, tournamentSubscriberCount } from '$lib/server/sse';

/** A full field of 32 plus their reconnects is the ceiling one tournament can need. */
const MAX_SUBSCRIBERS_PER_TOURNAMENT = 40;

/**
 * SSE change-notification stream for a tournament lobby. EventSource cannot send headers, so
 * the seat token travels as a query parameter here (and nowhere else).
 */
export const GET = api(async ({ params, request }) => {
	const token = new URL(request.url).searchParams.get('token');
	await requireTournamentViewer(params.id, token);
	if (tournamentSubscriberCount(params.id) >= MAX_SUBSCRIBERS_PER_TOURNAMENT) {
		throw new ApiError(429, 'Too many live connections for this tournament');
	}
	return new Response(subscribeToTournament(params.id), {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
});
