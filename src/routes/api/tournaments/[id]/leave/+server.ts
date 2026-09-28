import { json } from '@sveltejs/kit';
import { canLeaveTournament, leaveTournament } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { hashToken } from '$lib/server/ids';
import { mutateAsTournamentViewer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * A seated player gives up their seat — the lobby shows it as empty again and the next joiner
 * takes it. The organizer has no leave: abandoning as the TO cancels the whole event.
 */
export const POST = api(async ({ params, request }) => {
	const token = bearerToken(request);
	let seatIndex = -1;
	await mutateAsTournamentViewer(params.id, token, (tournament, viewer) => {
		if (viewer.kind !== 'player') {
			throw new ApiError(403, 'The organizer cancels the tournament instead of leaving it');
		}
		if (!canLeaveTournament(tournament)) {
			throw new ApiError(409, 'A running tournament cannot be left');
		}
		seatIndex = viewer.seatIndex;
		const name = tournament.seats[viewer.seatIndex].participant?.name ?? '';
		return {
			next: leaveTournament(tournament, hashToken(token ?? ''), new Date().toISOString()),
			events: { type: 'player-left', actor: 'player', payload: { name, seatIndex } }
		};
	});
	notifyTournamentChanged(params.id, 'player-left');
	return json({ ok: true });
});
