import { json } from '@sveltejs/kit';
import { markMessagesRead, seatIndexForTokenHash, unreadMessageCount } from '$lib/domain';
import { ApiError, api, bearerToken, requireTournamentViewer } from '$lib/server/http';
import { mutateAsTournamentViewer } from '$lib/server/tournamentRepository';

/**
 * The inbox closes: every message this seat can see counts as read, and its megaphone stops
 * glowing. Deliberately not announced over the change stream — opening a popup is nobody else's
 * business, and a notification would refetch every device in the event for nothing. The caller's
 * own store refetches, which is the only view that changed.
 */
export const POST = api(async ({ params, request }) => {
	const token = bearerToken(request);
	const { tournament, tokenHash } = await requireTournamentViewer(params.id, token);
	// A playing organizer has a seat but no inbox — they are the one shouting.
	const seatIndex =
		tokenHash === tournament.organizerTokenHash
			? null
			: seatIndexForTokenHash(tournament, tokenHash);
	if (seatIndex === null) throw new ApiError(403, 'The organizer has no inbox');
	if (unreadMessageCount(tournament, seatIndex) === 0) return json({ ok: true });

	await mutateAsTournamentViewer(params.id, token, (event, viewer) => {
		if (viewer.kind !== 'player') throw new ApiError(403, 'The organizer has no inbox');
		return {
			next: markMessagesRead(event, viewer.seatIndex, new Date().toISOString()),
			events: { type: 'messages-read', actor: 'player', payload: { seatIndex } }
		};
	});
	return json({ ok: true });
});
