import { loadFactions } from '$lib/data/factions';
import { loadMissions } from '$lib/data/missions';
import { loadSchemes } from '$lib/data/schemes';
import type { Faction, Mission, SchemeCard } from '$lib/domain';

/**
 * Server-side access to the bundled static content. Loaded through the same
 * `lib/data` loaders the client uses (bundled at build time, no I/O).
 */
let missions: Mission[] | null = null;
let factions: Faction[] | null = null;
let schemes: SchemeCard[] | null = null;

export function getMissions(): Mission[] {
	if (!missions) missions = loadMissions();
	return missions;
}

export function getFactions(): Faction[] {
	if (!factions) factions = loadFactions();
	return factions;
}

export function getSchemes(): SchemeCard[] {
	if (!schemes) schemes = loadSchemes();
	return schemes;
}

export function findMission(missionId: string): Mission | undefined {
	return getMissions().find((mission) => mission.id === missionId);
}
