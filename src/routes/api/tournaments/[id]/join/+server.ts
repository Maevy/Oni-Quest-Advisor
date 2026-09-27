import { json } from '@sveltejs/kit';
import {
	canJoinTournament,
	joinTournament,
	normalizeNickname,
	seatIndexForTokenHash
} from '$lib/domain';
import { ApiError, api } from '$lib/server/http';
import { hashToken } from '$lib/server/ids';
import { parsePickedArmy } from '$lib/server/payload';
import { mutateOpenTournament } from '$lib/server/tournamentRepository';
import { notifyTournamentChanged } from '$lib/server/sse';

/**
 * A player takes the first free seat. They generate their own seat token and send it along —
 * the server only ever stores its hash, exactly like an online-game join.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const name = normalizeNickname(typeof payload.name === 'string' ? payload.name : '');
	const army = parsePickedArmy(payload.army);
	const token = typeof payload.token === 'string' ? payload.token : '';
	if (!name) throw new ApiError(400, 'Invalid name');
	if (!army) throw new ApiError(400, 'A roster army is required to join');
	if (!token) throw new ApiError(400, 'Missing join token');

	const tokenHash = hashToken(token);
	let seatIndex = -1;
	await mutateOpenTournament(params.id, (tournament) => {
		if (!canJoinTournament(tournament)) {
			throw new ApiError(409, 'This tournament cannot be joined right now');
		}
		if (seatIndexForTokenHash(tournament, tokenHash) !== null) {
			throw new ApiError(409, 'You already hold a seat in this tournament');
		}
		seatIndex = tournament.seats.findIndex((seat) => !seat.organizer && seat.participant === null);
		return {
			next: joinTournament(tournament, name, army, tokenHash, new Date().toISOString()),
			events: { type: 'player-joined', actor: 'player', payload: { name, seatIndex } }
		};
	});
	notifyTournamentChanged(params.id, 'player-joined');
	return json({ seatIndex }, { status: 201 });
});
