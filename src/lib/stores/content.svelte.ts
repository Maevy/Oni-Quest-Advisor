import {
	loadArmyClasses,
	loadArmyCombatArts,
	loadArmyFactions,
	loadArmySkills,
	loadArmySpellcrafts,
	loadArmySpells,
	loadArmyTraits,
	loadArmyUnits,
	loadFactions,
	loadMissions,
	loadSchemes
} from '$lib/data';
import type {
	ArmyFactionConfig,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyUnitContent,
	Faction,
	Mission,
	SchemeCard
} from '$lib/domain';

class ContentStore {
	missions = $state<Mission[]>([]);
	factions = $state<Faction[]>([]);
	armyFactions = $state<ArmyFactionConfig[]>([]);
	armyUnits = $state<ArmyUnitContent>({ factionUnits: {}, neutralUnits: [], mounts: [] });
	armyClasses = $state<ArmyRulesSpec[]>([]);
	armySkills = $state<ArmyRulesSpec[]>([]);
	armyTraits = $state<ArmyRulesSpec[]>([]);
	armyCombatArts = $state<ArmyRulesSpec[]>([]);
	armySpellcrafts = $state<ArmyRulesSpec[]>([]);
	armySpells = $state<ArmySpellSpec[]>([]);
	schemes = $state<SchemeCard[]>([]);
	loaded = $state(false);

	load(): void {
		if (this.loaded) return;
		this.missions = loadMissions();
		this.factions = loadFactions();
		this.armyFactions = loadArmyFactions();
		this.armyUnits = loadArmyUnits();
		this.armyClasses = loadArmyClasses();
		this.armySkills = loadArmySkills();
		this.armyTraits = loadArmyTraits();
		this.armyCombatArts = loadArmyCombatArts();
		this.armySpellcrafts = loadArmySpellcrafts();
		this.armySpells = loadArmySpells();
		this.schemes = loadSchemes();
		this.loaded = true;
	}
}

export const contentStore = new ContentStore();
