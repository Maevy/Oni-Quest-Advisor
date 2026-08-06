import { loadFactions, loadMissions, loadSchemes } from '$lib/data';
import type { Faction, Mission, SchemeCard } from '$lib/domain';

class ContentStore {
	missions = $state<Mission[]>([]);
	factions = $state<Faction[]>([]);
	schemes = $state<SchemeCard[]>([]);
	loaded = $state(false);

	load(): void {
		if (this.loaded) return;
		this.missions = loadMissions();
		this.factions = loadFactions();
		this.schemes = loadSchemes();
		this.loaded = true;
	}
}

export const contentStore = new ContentStore();
