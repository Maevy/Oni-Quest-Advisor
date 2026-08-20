import type { PlayerKey } from '$lib/domain';

const SESSION_KEY = 'oni-quest-advisor:online-session';

export type OnlineSession = {
	gameId: string;
	seat: PlayerKey;
	token: string;
};

export function loadOnlineSession(): OnlineSession | null {
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			typeof (parsed as OnlineSession).gameId !== 'string' ||
			typeof (parsed as OnlineSession).token !== 'string'
		) {
			return null;
		}
		const seat = (parsed as OnlineSession).seat;
		if (seat !== 'player1' && seat !== 'player2') return null;
		return parsed as OnlineSession;
	} catch {
		return null;
	}
}

export function saveOnlineSession(session: OnlineSession): void {
	window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearOnlineSession(): void {
	window.localStorage.removeItem(SESSION_KEY);
}
