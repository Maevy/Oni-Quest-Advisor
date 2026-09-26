import type { GameMode, OpenGame } from '$lib/domain';

const OPEN_GAME_KEY = 'oni-quest-advisor:open-game';

/** Records written before hot-seat joined the lifecycle carry no mode and are solo runs. */
function parseMode(value: unknown): GameMode {
	return value === 'two-player' ? 'two-player' : 'solo';
}

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
			? { missionId: parsed.missionId, mode: parseMode(parsed.mode) }
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
