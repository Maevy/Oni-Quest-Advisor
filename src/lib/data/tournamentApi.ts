import type { PickedArmy, TournamentEventView, TournamentPeek } from '$lib/domain';

const BASE = '/api/tournaments';

export type CreateTournamentResponse = { code: string; token: string };
export type JoinTournamentResponse = { seatIndex: number };

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

/** Seat tokens are generated client-side; only their hash reaches the server. */
export function generateTournamentToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
