import type {
	PlayerKey,
	PickedArmy,
	TournamentEventView,
	TournamentOccupant,
	TournamentPeek,
	TournamentReportData
} from '$lib/domain';

const BASE = '/api/tournaments';

export type CreateTournamentResponse = { code: string; token: string };
export type JoinTournamentResponse = { seatIndex: number };
/**
 * The online seat a table's match handed back. Shaped exactly like `CreateGameResponse` in
 * `onlineApi`, because that is what it is: from here on the match is an ordinary online game.
 */
export type TableGameSession = { gameId: string; seat: PlayerKey; token: string };

export class TournamentApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

async function parse<T>(response: Response): Promise<T> {
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			typeof body === 'object' && body !== null && 'error' in body
				? String((body as { error: unknown }).error)
				: `Request failed (${response.status})`;
		throw new TournamentApiError(response.status, message);
	}
	return body as T;
}

/** The finished wizard configuration, exactly as the server re-validates it. */
export type TournamentConfiguration = {
	name: string;
	externalLink: string;
	organizerName: string;
	organizerPlays: boolean;
	organizerArmy: PickedArmy | null;
	participantCount: number;
	manualPairing: boolean;
	missionIds: string[];
	tableNames: string[];
};

/** Creates the tournament; the organizer token comes back exactly once. */
export async function createTournament(
	configuration: TournamentConfiguration
): Promise<CreateTournamentResponse> {
	const response = await fetch(BASE, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(configuration)
	});
	return parse<CreateTournamentResponse>(response);
}

/** The visibility-filtered lobby for the organizer or a seated player. */
export async function fetchTournamentView(
	code: string,
	token: string
): Promise<TournamentEventView> {
	const response = await fetch(`${BASE}/${code}/state`, {
		headers: { authorization: `Bearer ${token}` }
	});
	return parse<TournamentEventView>(response);
}

/** What the join page shows before anyone joins — no token needed. */
export async function fetchTournamentPeek(code: string): Promise<TournamentPeek> {
	const response = await fetch(`${BASE}/${code}/peek`);
	return parse<TournamentPeek>(response);
}

/** Takes the first free seat; the joining player's token is generated on their device. */
export async function joinTournament(
	code: string,
	name: string,
	army: PickedArmy,
	token: string
): Promise<JoinTournamentResponse> {
	const response = await fetch(`${BASE}/${code}/join`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name, army, token })
	});
	return parse<JoinTournamentResponse>(response);
}

export function tournamentEventsUrl(code: string, token: string): string {
	return `${BASE}/${code}/events?token=${encodeURIComponent(token)}`;
}

/** A seated player gives up their seat; the lobby shows it as empty again. */
export async function leaveTournament(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/leave`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/** The organizer cancels the event — it closes for every device in the lobby. */
export async function cancelTournament(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/cancel`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/** The organizer starts the event: the lobby closes and round 1 opens for assignment. */
export async function startTournament(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/start`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/** Moves one occupant (a seat or the BYE) to a table, or back to the pool when null. */
export async function assignTournamentOccupant(
	code: string,
	token: string,
	occupant: TournamentOccupant,
	tableIndex: number | null
): Promise<void> {
	const response = await fetch(`${BASE}/${code}/assign`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify({ occupant, tableIndex })
	});
	await parse<{ ok: boolean }>(response);
}

/** The organizer starts the round: setup becomes game and the tables lock. */
export async function startTournamentRound(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/start-round`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/**
 * A player sits down at their table's match. The response is an ordinary online game session — the
 * same three fields a game this device had created itself would return — because from here on the
 * match *is* an ordinary online game.
 */
export async function enterTournamentTableGame(
	code: string,
	token: string,
	tableIndex: number
): Promise<TableGameSession> {
	const response = await fetch(`${BASE}/${code}/enter-game`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify({ tableIndex })
	});
	return parse<TableGameSession>(response);
}

/** The organizer opens the next round on the next mission, carrying the standing forward. */
export async function nextTournamentRound(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/next-round`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/** The organizer ends the event; every device moves to the final standing. */
export async function concludeTournament(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/conclude`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/**
 * The organizer's megaphone: a shout at one table, or at every table when `tableIndex` is null.
 */
export async function sendTournamentMessage(
	code: string,
	token: string,
	tableIndex: number | null,
	text: string
): Promise<void> {
	const response = await fetch(`${BASE}/${code}/message`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify({ tableIndex, text })
	});
	await parse<{ ok: boolean }>(response);
}

/** The inbox closes, so the megaphone stops glowing. Only the caller's own view changes. */
export async function markTournamentMessagesRead(code: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${code}/read-messages`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<{ ok: boolean }>(response);
}

/**
 * The report's raw material, organizer-only: the archived rounds and every played match's
 * interaction log. The device folds it into a PDF; nothing is stored server-side.
 */
export async function fetchTournamentReport(
	code: string,
	token: string
): Promise<TournamentReportData> {
	const response = await fetch(`${BASE}/${code}/report`, {
		headers: { authorization: `Bearer ${token}` }
	});
	return parse<TournamentReportData>(response);
}

/** Seat tokens are generated client-side; only their hash reaches the server. */
export function generateTournamentToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
