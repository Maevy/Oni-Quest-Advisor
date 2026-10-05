import { json } from '@sveltejs/kit';
import {
	MAX_TOURNAMENT_MESSAGE_LENGTH,
	canSendTournamentMessage,
	sendTournamentMessage
} from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { generateMessageId } from '$lib/server/ids';
import { parseTableIndex } from '$lib/server/payload';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer's megaphone: a shout at one table, or at every table when `tableIndex` is null.
 * It reaches the players wherever they are — on the round board or inside the match it interrupts
 * — because every device refetches on the change notification and the header's megaphone lights
 * up with the unread count.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	// Null is a real value here — it addresses every table at once — so it must not be collapsed
	// into "missing" the way `?? undefined` would.
	const tableIndex = parseTableIndex(payload.tableIndex);
	if (tableIndex === undefined) throw new ApiError(400, 'Invalid table');
	const text = typeof payload.text === 'string' ? payload.text.trim() : '';
	if (text === '') throw new ApiError(400, 'A message needs some text');
	if (text.length > MAX_TOURNAMENT_MESSAGE_LENGTH) {
		throw new ApiError(400, `A message is at most ${MAX_TOURNAMENT_MESSAGE_LENGTH} characters`);
	}

	let id = '';
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canSendTournamentMessage(tournament)) {
			throw new ApiError(409, 'This tournament is not running');
		}
		id = generateMessageId();
		return {
			next: sendTournamentMessage(tournament, { id, tableIndex, text }, new Date().toISOString()),
			events: { type: 'message-sent', actor: 'organizer', payload: { tableIndex } }
		};
	});
	notifyTournamentChanged(params.id, 'message-sent');
	return json({ ok: true, id });
});
