import type { Faction } from '$lib/domain';

const factionModules = import.meta.glob('./content/factions/*.json', { eager: true }) as Record<
	string,
	{ default: Faction }
>;

export function loadFactions(): Faction[] {
	return Object.values(factionModules).map((module) => module.default);
}
