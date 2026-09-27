import { LibsqlError } from '@libsql/client';
import { json } from '@sveltejs/kit';
import {
	MAX_EXTERNAL_LINK_LENGTH,
	MAX_ORGANIZER_NAME_LENGTH,
	MAX_TOURNAMENT_NAME_LENGTH,
	checkExternalLink,
	clampTournamentPlayers,
	createTournamentEvent,
	tableCountFor
} from '$lib/domain';
import { ApiError, api } from '$lib/server/http';
import { generateGameCode, generateSeatToken, hashToken } from '$lib/server/ids';
import { parsePickedArmy, parseStringArray } from '$lib/server/payload';
import { insertTournament } from '$lib/server/tournamentRepository';

const MAX_MISSION_ID_LENGTH = 60;

/**
 * Creates a tournament from the organizer's finished configuration and hands back the join code
 * plus the plain organizer token, exactly once. Everything the wizard collected is re-validated
 * here — the client's gates are a courtesy, not a boundary.
 */
export const POST = api(async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

	const name = typeof payload.name === 'string' ? payload.name.trim() : '';
	const organizerName =
		typeof payload.organizerName === 'string' ? payload.organizerName.trim() : '';
	const externalLinkRaw = typeof payload.externalLink === 'string' ? payload.externalLink : '';
	const organizerPlays = payload.organizerPlays === true;
	const manualPairing = payload.manualPairing === true;
	const participantCount =
		typeof payload.participantCount === 'number' ? payload.participantCount : NaN;
	const missionIds = parseStringArray(payload.missionIds, MAX_MISSION_ID_LENGTH);
	const tableNames = parseStringArray(payload.tableNames, MAX_ORGANIZER_NAME_LENGTH);
	const organizerArmy = organizerPlays ? parsePickedArmy(payload.organizerArmy) : null;

	const link = checkExternalLink(externalLinkRaw);
	if (name === '' || name.length > MAX_TOURNAMENT_NAME_LENGTH) {
		throw new ApiError(400, 'Invalid tournament name');
	}
	if (organizerName === '' || organizerName.length > MAX_ORGANIZER_NAME_LENGTH) {
		throw new ApiError(400, 'Invalid organizer name');
	}
	if (externalLinkRaw.length > MAX_EXTERNAL_LINK_LENGTH || !link.ok) {
		throw new ApiError(400, 'Invalid external link');
	}
	if (clampTournamentPlayers(participantCount) !== participantCount) {
		throw new ApiError(400, 'Invalid participant count');
	}
	if (missionIds === null || missionIds.length === 0) {
		throw new ApiError(400, 'A tournament needs at least one mission');
	}
	if (tableNames === null || tableNames.length !== tableCountFor(participantCount)) {
		throw new ApiError(400, 'Invalid table list');
	}
	if (organizerPlays && organizerArmy === null) {
		throw new ApiError(400, 'A playing organizer needs an army');
	}

	const token = generateSeatToken();
	const now = new Date().toISOString();
	for (let attempt = 0; attempt < 3; attempt++) {
		const code = generateGameCode();
		const state = createTournamentEvent({
			code,
			name,
			externalLink: link.ok ? link.url : null,
			organizerName,
			organizerTokenHash: hashToken(token),
			organizerPlays,
			organizerArmy,
			participantCount,
			manualPairing,
			missionIds,
			tableNames,
			now
		});
		try {
			await insertTournament(state, {
				type: 'tournament-created',
				actor: 'organizer',
				payload: { name, organizerName }
			});
			return json({ code, token }, { status: 201 });
		} catch (error) {
			const isCollision =
				error instanceof LibsqlError && error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
			if (!isCollision) throw error;
		}
	}
	throw new ApiError(500, 'Could not allocate a tournament code');
});
