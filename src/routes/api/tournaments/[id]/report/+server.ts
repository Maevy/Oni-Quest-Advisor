import { json } from '@sveltejs/kit';
import {
	tournamentReportGameIds,
	tournamentReportRounds,
	type TournamentReportMatchLog
} from '$lib/domain';
import { ApiError, api, bearerToken, requireTournamentViewer } from '$lib/server/http';
import { readGameHistory } from '$lib/server/gameRepository';

/**
 * The report's raw material, organizer-only: the archived rounds with their pairings and
 * results, plus every played match's interaction log under its derived game id. A match nobody
 * entered has no game row and reports an empty log rather than failing - the retention window
 * keeps what exists, and the report says what was recorded. Nothing here is stored: the
 * organizer's device folds this into a PDF and downloads it.
 */
export const GET = api(async ({ params, request }) => {
	const { tournament, tokenHash } = await requireTournamentViewer(params.id, bearerToken(request));
	if (tokenHash !== tournament.organizerTokenHash) {
		throw new ApiError(403, 'Only the organizer can generate the report');
	}

	const matchLogs: TournamentReportMatchLog[] = [];
	for (const match of tournamentReportGameIds(tournament)) {
		matchLogs.push({
			round: match.round,
			tableIndex: match.tableIndex,
			gameId: match.gameId,
			history: await readGameHistory(match.gameId)
		});
	}
	return json({
		createdAt: tournament.createdAt,
		concludedAt: tournament.concludedAt,
		rounds: tournamentReportRounds(tournament),
		matchLogs
	});
});
