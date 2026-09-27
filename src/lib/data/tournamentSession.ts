const SESSION_KEY = 'oni-quest-advisor:tournament-session';

export type TournamentSession = {
	code: string;
	role: 'organizer' | 'player';
	token: string;
	/** The player's seat; null for an organizer who does not play. */
	seatIndex: number | null;
};

export function loadTournamentSession(): TournamentSession | null {
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const session = parsed as TournamentSession;
		if (typeof session.code !== 'string' || typeof session.token !== 'string') return null;
		if (session.role !== 'organizer' && session.role !== 'player') return null;
		if (session.seatIndex !== null && typeof session.seatIndex !== 'number') return null;
		return session;
	} catch {
		return null;
	}
}

export function saveTournamentSession(session: TournamentSession): void {
	window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearTournamentSession(): void {
	window.localStorage.removeItem(SESSION_KEY);
}
