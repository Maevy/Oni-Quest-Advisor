import { json } from '@sveltejs/kit';
import {
	MAX_TABLE_OCCUPANTS,
	assignOccupant,
	canAssignOccupants,
	fieldNeedsBye,
	sameOccupant
} from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { parseTableIndex, parseTournamentOccupant } from '$lib/server/payload';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer moves one occupant — a player's seat or the BYE — to a table, or back to the pool
 * when `tableIndex` is null. One call covers a drop on another table too, since the occupant is
 * lifted out of wherever it sat first. Every drop reaches every device in the round over SSE.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const occupant = parseTournamentOccupant(payload.occupant);
	// Null is a real value here — it sends the occupant back to the pool — so it must not be
	// collapsed into "missing" the way `?? undefined` would.
	const tableIndex = parseTableIndex(payload.tableIndex);
	if (!occupant) throw new ApiError(400, 'Invalid occupant');
	if (tableIndex === undefined) throw new ApiError(400, 'Invalid table');

	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canAssignOccupants(tournament)) {
			// A round under way is the case the organizer will actually hit: its tables are locked.
			throw new ApiError(
				409,
				tournament.round !== null && tournament.status === 'active'
					? 'The tables are locked — this round is under way'
					: 'This tournament is not preparing a round'
			);
		}
		const round = tournament.round;
		if (!round) throw new ApiError(409, 'This tournament is not preparing a round');
		if (occupant.kind === 'bye' && !fieldNeedsBye(tournament)) {
			throw new ApiError(409, 'This field needs no BYE');
		}
		if (occupant.kind === 'seat' && tournament.seats[occupant.seatIndex]?.participant == null) {
			throw new ApiError(409, 'That seat holds no player');
		}
		if (tableIndex !== null) {
			if (tableIndex >= round.tables.length) throw new ApiError(400, 'Unknown table');
			const target = round.tables[tableIndex];
			const alreadySeated = target.some((other) => sameOccupant(other, occupant));
			if (!alreadySeated && target.length >= MAX_TABLE_OCCUPANTS) {
				throw new ApiError(409, 'That table is full');
			}
		}
		return {
			next: assignOccupant(tournament, occupant, tableIndex, new Date().toISOString()),
			events: { type: 'table-assigned', actor: 'organizer', payload: { occupant, tableIndex } }
		};
	});
	notifyTournamentChanged(params.id, 'table-assigned');
	return json({ ok: true });
});
