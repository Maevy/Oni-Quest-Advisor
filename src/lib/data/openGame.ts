import type { OpenGame } from '$lib/domain';

const OPEN_GAME_KEY = 'oni-quest-advisor:open-game';

/**
 * The open game is read on app start, so unavailable or corrupt storage must degrade to "no open
 * game" rather than throw — a blocked-storage browser simply never offers to resume.
 */
export function loadOpenGame(): OpenGame | null {
	try {
		const raw = localStorage.getItem(OPEN_GAME_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<OpenGame> | null;
		return typeof parsed?.missionId === 'string' && parsed.missionId !== ''
			? { missionId: parsed.missionId }
			: null;
	} catch {
		return null;
	}
}

export function saveOpenGame(openGame: OpenGame): void {
	try {
		localStorage.setItem(OPEN_GAME_KEY, JSON.stringify(openGame));
	} catch {
		/* storage unavailable — the run stays playable, it just will not survive a reload */
	}
}

export function clearOpenGame(): void {
	try {
		localStorage.removeItem(OPEN_GAME_KEY);
	} catch {
		/* nothing to clear */
	}
}
