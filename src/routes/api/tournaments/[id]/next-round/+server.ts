import { json } from '@sveltejs/kit';
import { advanceRound, canAdvanceRound, isRoundScored } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsTournamentOrganizer } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * The organizer opens the next round: the scored one is archived for the report, the next mission
 * becomes the round being prepared, and the cumulative standing travels with it. Every device
 * follows over the change notification, so the tables empty out for a new pairing everywhere at
 * once.
 */
export const POST = api(async ({ params, request }) => {
	let round = 0;
	await mutateAsTournamentOrganizer(params.id, bearerToken(request), (tournament) => {
		if (!canAdvanceRound(tournament)) {
			if (tournament.round?.phase !== 'scoring') {
				throw new ApiError(409, 'This round is still being played');
			}
			if (!isRoundScored(tournament)) {
				throw new ApiError(409, 'Not every table has reported its result');
			}
			throw new ApiError(409, 'This was the last round — conclude the tournament instead');
		}
		const next = advanceRound(tournament, new Date().toISOString());
		round = next.round?.number ?? 0;
		return {
			next,
			events: { type: 'round-advanced', actor: 'organizer', payload: { round } }
		};
	});
	notifyTournamentChanged(params.id, 'round-advanced');
	return json({ ok: true, round });
});
