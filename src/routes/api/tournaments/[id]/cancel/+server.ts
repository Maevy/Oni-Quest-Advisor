import { json } from '@sveltejs/kit';
import { canCancelTournament, cancelTournament } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer abandons the event: it closes for everyone, and every open lobby learns it from
 * the change notification. Seats are kept so those devices still authenticate and can be told
 * what happened instead of meeting a bare 404; retention deletes the rows afterwards.
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canCancelTournament(tournament)) {
			throw new ApiError(409, 'This tournament has already ended');
		}
		return {
			next: cancelTournament(tournament, new Date().toISOString()),
			events: { type: 'tournament-cancelled', actor: 'organizer' }
		};
	});
	notifyTournamentChanged(params.id, 'tournament-cancelled');
	return json({ ok: true });
});
