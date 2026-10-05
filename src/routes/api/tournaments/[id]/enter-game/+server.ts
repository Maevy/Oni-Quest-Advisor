import { json } from '@sveltejs/kit';
import { seatIndexForTokenHash } from '$lib/domain';
import { ApiError, api, bearerToken, requireTournamentViewer } from '$lib/server/http';
import { parseTableIndex } from '$lib/server/payload';
import { notifyTournamentChanged } from '$lib/server/sse';
import { enterTableGame } from '$lib/server/tournamentGames';

/**
 * A player sits down at their table's match. The first of the two to press creates the game — with
 * both seats filled from the tournament's registrations and the round's mission already set — and
 * the second joins the same one, so the pair lands in an ordinary online lobby and follows the
 * ordinary online flow from there. Returns that game's seat session, which the client adopts
 * exactly like one it had created itself.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const tableIndex = parseTableIndex(payload.tableIndex);
	// Only a table this caller plays at is a valid target, so "back to the pool" is meaningless
	// here and null is rejected along with anything that is not a table index.
	if (tableIndex === null || tableIndex === undefined) throw new ApiError(400, 'Invalid table');

	const { tournament, tokenHash } = await requireTournamentViewer(params.id, bearerToken(request));
	// A playing organizer holds a seat like anybody else, and the role their token proves is not
	// what decides whether they may sit down — the pairing is.
	const seatIndex = seatIndexForTokenHash(tournament, tokenHash);
	if (seatIndex === null) throw new ApiError(403, 'Only a seated player may enter a game');

	const session = await enterTableGame(tournament, seatIndex, tableIndex);
	notifyTournamentChanged(params.id, 'table-entered');
	return json(session, { status: 201 });
});
