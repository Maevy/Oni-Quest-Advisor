import type { Mission } from './mission';

export function getSeasons(missions: Mission[]): string[] {
	return [...new Set(missions.map((mission) => mission.season))];
}

export function getMissionsForSeason(missions: Mission[], season: string): Mission[] {
	return missions.filter((mission) => mission.season === season);
}
