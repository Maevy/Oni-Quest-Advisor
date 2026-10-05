import { json } from '@sveltejs/kit';
import { canConcludeTournament, concludeTournament, isRoundScored } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer ends the event: the last round is archived, the standings freeze and every device
 * moves to the conclusion screen. The rows live on for the 48-hour report window the creation
 * notice promised, and nothing about them may change from here on — which is why a seat cannot be
 * freed after this point either.
 */
export const POST = api(async ({ params, request }) => {
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canConcludeTournament(tournament)) {
			if (tournament.round?.phase !== 'scoring') {
				throw new ApiError(409, 'This round is still being played');
			}
			if (!isRoundScored(tournament)) {
				throw new ApiError(409, 'Not every table has reported its result');
			}
			throw new ApiError(409, 'A round is still left to play');
		}
		return {
			next: concludeTournament(tournament, new Date().toISOString()),
			events: { type: 'tournament-concluded', actor: 'organizer' }
		};
	});
	notifyTournamentChanged(params.id, 'tournament-concluded');
	return json({ ok: true });
});
