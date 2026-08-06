import type { MissionProgress } from '$lib/domain';

const STORAGE_KEY_PREFIX = 'oni-quest-advisor:mission-progress:';

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
