import { api, requireSeat } from '$lib/server/http';
import { subscribeToGame } from '$lib/server/sse';

/**
 * SSE change-notification stream. EventSource cannot send headers, so the seat
 * token travels as a query parameter here (and nowhere else).
 */
export const GET = api(async ({ params, request }) => {
	const token = new URL(request.url).searchParams.get('token');
	await requireSeat(params.id, token);
	return new Response(subscribeToGame(params.id), {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
});
