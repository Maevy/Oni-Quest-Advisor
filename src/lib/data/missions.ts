import type { Mission } from '$lib/domain';

const missionModules = import.meta.glob('./content/missions/*.json', { eager: true }) as Record<
	string,
	{ default: Mission }
>;

export function loadMissions(): Mission[] {
	return Object.values(missionModules).map((module) => module.default);
}
