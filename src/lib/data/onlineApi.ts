import type {
	OnlineGameSetup,
	OnlineGameView,
	PickedArmy,
	PlayerKey,
	SeatLeader
} from '$lib/domain';

const BASE = '/api/games';

export type CreateGameResponse = { gameId: string; seat: PlayerKey; token: string };

export type JoinStatus = 'pending' | 'accepted' | 'denied' | 'closed' | 'full';
export type JoinStatusResponse = { status: JoinStatus };

export class OnlineApiError extends Error {
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
		throw new OnlineApiError(response.status, message);
	}
	return body as T;
}

export async function createGame(
	nickname: string,
	setup: OnlineGameSetup
): Promise<CreateGameResponse> {
	const response = await fetch(BASE, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ nickname, ...setup })
	});
	return parse<CreateGameResponse>(response);
}

export async function fetchGameState(gameId: string, token: string): Promise<OnlineGameView> {
	const response = await fetch(`${BASE}/${gameId}/state`, {
		headers: { authorization: `Bearer ${token}` }
	});
	return parse<OnlineGameView>(response);
}

export function gameEventsUrl(gameId: string, token: string): string {
	return `${BASE}/${gameId}/events?token=${encodeURIComponent(token)}`;
}

export async function requestJoin(
	gameId: string,
	nickname: string,
	token: string,
	army: PickedArmy
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/join`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ nickname, token, army })
	});
	await parse<Record<string, never>>(response);
}

export async function fetchJoinStatus(
	gameId: string,
	nickname: string,
	token: string
): Promise<JoinStatusResponse> {
	const params = new URLSearchParams({ nickname, token });
	const response = await fetch(`${BASE}/${gameId}/join/status?${params.toString()}`);
	return parse<JoinStatusResponse>(response);
}

export async function acceptJoin(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/join/accept`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function denyJoin(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/join/deny`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function closeGame(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/close`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

/** Sets the seat's intelligence; the Scheme faction comes from the combat army, not from here. */
export async function draftIntelligence(
	gameId: string,
	token: string,
	intelligence: number | null
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/draft`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ intelligence })
	});
	await parse<Record<string, never>>(response);
}

export async function drawSchemes(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/draw`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function chooseScheme(gameId: string, token: string, schemeId: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/choose-scheme`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ schemeId })
	});
	await parse<Record<string, never>>(response);
}

export async function deleteScheme(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/delete-scheme`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function toggleReady(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/ready`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

/** Registers the Standard list this seat fields, cut down from the Roster army it brought. */
export async function setCombatArmy(
	gameId: string,
	token: string,
	army: PickedArmy
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/combat-army`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ army })
	});
	await parse<Record<string, never>>(response);
}

/** Assigns (or clears) this seat's Leader, declaring the statistics the initiative roll needs. */
export async function setLeader(
	gameId: string,
	token: string,
	leader: SeatLeader | null
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/leader`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ leader })
	});
	await parse<Record<string, never>>(response);
}

export async function startGame(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/start`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function toggleRevealIntent(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/reveal-intent`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function setObjectiveChecked(
	gameId: string,
	token: string,
	objectiveId: string,
	checkedCount: number
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/objective`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ objectiveId, checkedCount })
	});
	await parse<Record<string, never>>(response);
}

export async function setSchemeBoxChecked(
	gameId: string,
	token: string,
	checkedIncrements: number
): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/scheme-box`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ checkedIncrements })
	});
	await parse<Record<string, never>>(response);
}

export async function advancePhase(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/advance-phase`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

export async function finishGame(gameId: string, token: string): Promise<void> {
	const response = await fetch(`${BASE}/${gameId}/finish`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
	await parse<Record<string, never>>(response);
}

/** Seat tokens for joining players are generated client-side; only their hash reaches the server. */
export function generateJoinToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
