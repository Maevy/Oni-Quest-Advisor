import { ApiError, api, requireSeat } from '$lib/server/http';
import { subscribeToGame, subscriberCount } from '$lib/server/sse';

/** Two phones with reconnects never need more than a handful of streams per game. */
const MAX_SUBSCRIBERS_PER_GAME = 8;

/**
 * SSE change-notification stream. EventSource cannot send headers, so the seat
 * token travels as a query parameter here (and nowhere else).
 */
export const GET = api(async ({ params, request }) => {
	const token = new URL(request.url).searchParams.get('token');
	await requireSeat(params.id, token);
	if (subscriberCount(params.id) >= MAX_SUBSCRIBERS_PER_GAME) {
		throw new ApiError(429, 'Too many live connections for this game');
	}
	return new Response(subscribeToGame(params.id), {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
});
