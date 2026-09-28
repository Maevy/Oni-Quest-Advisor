import { json } from '@sveltejs/kit';
import { canStartRound, startRound } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer starts the round: setup becomes game, the roadmap moves a step on for every
 * device, and the tables lock — a pairing cannot change underneath a match being played.
 */
export const POST = api(async ({ params, request }) => {
	let round = 0;
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canStartRound(tournament)) {
			throw new ApiError(409, 'This round cannot be started');
		}
		const started = startRound(tournament, new Date().toISOString());
		round = started.round?.number ?? 0;
		return {
			next: started,
			events: { type: 'round-started', actor: 'organizer', payload: { round } }
		};
	});
	notifyTournamentChanged(params.id, 'round-started');
	return json({ ok: true, round });
});
