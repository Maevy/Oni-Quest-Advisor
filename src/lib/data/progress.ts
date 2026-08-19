import type { MissionProgress, TwoPlayerMissionProgress } from '$lib/domain';

const STORAGE_KEY_PREFIX = 'oni-quest-advisor:mission-progress:';
const TWO_PLAYER_KEY_PREFIX = 'oni-quest-advisor:2p-progress:';

export function loadMissionProgress(missionId: string): MissionProgress | null {
	const raw = localStorage.getItem(STORAGE_KEY_PREFIX + missionId);
	return raw ? (JSON.parse(raw) as MissionProgress) : null;
}

export function saveMissionProgress(progress: MissionProgress): void {
	localStorage.setItem(STORAGE_KEY_PREFIX + progress.missionId, JSON.stringify(progress));
}

export function clearMissionProgress(missionId: string): void {
	localStorage.removeItem(STORAGE_KEY_PREFIX + missionId);
}

export function loadTwoPlayerProgress(missionId: string): TwoPlayerMissionProgress | null {
	const raw = localStorage.getItem(TWO_PLAYER_KEY_PREFIX + missionId);
	return raw ? (JSON.parse(raw) as TwoPlayerMissionProgress) : null;
}

export function saveTwoPlayerProgress(progress: TwoPlayerMissionProgress): void {
	localStorage.setItem(TWO_PLAYER_KEY_PREFIX + progress.missionId, JSON.stringify(progress));
}

export function clearTwoPlayerProgress(missionId: string): void {
	localStorage.removeItem(TWO_PLAYER_KEY_PREFIX + missionId);
}
