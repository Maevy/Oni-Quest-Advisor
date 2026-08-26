import {
	loadArmyFactions,
	loadArmyUnits,
	loadFactions,
	loadMissions,
	loadSchemes
} from '$lib/data';
import type { ArmyFactionConfig, ArmyUnitContent, Faction, Mission, SchemeCard } from '$lib/domain';

class ContentStore {
	missions = $state<Mission[]>([]);
	factions = $state<Faction[]>([]);
	armyFactions = $state<ArmyFactionConfig[]>([]);
	armyUnits = $state<ArmyUnitContent>({ factionUnits: {}, neutralUnits: [], mounts: [] });
	schemes = $state<SchemeCard[]>([]);
	loaded = $state(false);

	load(): void {
		if (this.loaded) return;
		this.missions = loadMissions();
		this.factions = loadFactions();
		this.armyFactions = loadArmyFactions();
		this.armyUnits = loadArmyUnits();
		this.schemes = loadSchemes();
		this.loaded = true;
	}
}

export const contentStore = new ContentStore();
