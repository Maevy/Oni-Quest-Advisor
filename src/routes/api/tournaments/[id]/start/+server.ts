import { json } from '@sveltejs/kit';
import {
	canStartTournament,
	fieldNeedsBye,
	registeredSeatIndexes,
	startTournament
} from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer starts the event: the lobby closes (nobody joins or leaves any more) and round 1
 * opens on the first configured mission with every table empty, ready to be assigned. Seats
 * nobody took are simply ignored — the round pairs whoever came.
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canStartTournament(tournament)) {
			throw new ApiError(409, 'This tournament cannot be started');
		}
		const started = startTournament(tournament, new Date().toISOString());
		return {
			next: started,
			events: {
				type: 'tournament-started',
				actor: 'organizer',
				payload: {
					players: registeredSeatIndexes(tournament).length,
					bye: fieldNeedsBye(tournament),
					missionId: started.round?.missionId ?? null
				}
			}
		};
	});
	notifyTournamentChanged(params.id, 'tournament-started');
	return json({ ok: true });
});
