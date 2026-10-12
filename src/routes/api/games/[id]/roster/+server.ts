import { json } from '@sveltejs/kit';
import { canPublishRoster, parsePublishedRoster, publishRoster } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * A seat publishing its own combat list as board entries, once the round is running. The server
 * cannot derive entry ids from the stored code - it loads no army catalogs - so the owner's
 * device declares them, the same ruling the Leader's M and INT rest on. This is what opens the
 * composition at play: the opponent's half of the flower board renders from it. The importable
 * code never travels.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const entries = parsePublishedRoster(
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>).entries : null
	);
	if (!entries) throw new ApiError(400, 'Malformed roster');

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canPublishRoster(game, seat)) {
			throw new ApiError(409, 'The board opens once the round is running, and only once');
		}
		return {
			next: publishRoster(game, seat, entries),
			events: {
				type: 'roster-published',
				actor: seat,
				payload: { copies: entries.length }
			}
		};
	});
	notifyGameChanged(params.id, 'roster-published');
	return json({ ok: true });
});
