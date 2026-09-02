import {
	loadArmyClasses,
	loadArmyCombatArts,
	loadArmyFactions,
	loadArmyItems,
	loadArmySkills,
	loadArmySpellcrafts,
	loadArmySpells,
	loadArmyStratagems,
	loadArmyTraits,
	loadArmyUnits,
	loadArmyUpgrades,
	loadFactions,
	loadMissions,
	loadSchemes
} from '$lib/data';
import type {
	ArmyFactionConfig,
	ArmyItemSpec,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	ArmyUnitContent,
	ArmyUpgradeSpec,
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
	armyStratagems = $state<ArmyStratagemSpec[]>([]);
	armyItems = $state<ArmyItemSpec[]>([]);
	armyUpgrades = $state<ArmyUpgradeSpec[]>([]);
	schemes = $state<SchemeCard[]>([]);
	loaded = $state(false);
	armyLoaded = $state(false);
	private armyLoading: Promise<void> | null = null;

	/** Core content needed immediately: missions, scheme decks, factions. */
	load(): void {
		if (this.loaded) return;
		this.missions = loadMissions();
		this.factions = loadFactions();
		this.schemes = loadSchemes();
		this.loaded = true;
	}

	/**
	 * Army builder catalogs, fetched on demand when the army flow is first
	 * entered — they live in separate chunks and stay out of the initial JS.
	 */
	loadArmy(): Promise<void> {
		if (this.armyLoaded) return Promise.resolve();
		this.armyLoading ??= (async () => {
			const [
				armyUnits,
				armyClasses,
				armySkills,
				armyTraits,
				armyCombatArts,
				armySpellcrafts,
				armySpells,
				armyStratagems,
				armyItems,
				armyUpgrades
			] = await Promise.all([
				loadArmyUnits(),
				loadArmyClasses(),
				loadArmySkills(),
				loadArmyTraits(),
				loadArmyCombatArts(),
				loadArmySpellcrafts(),
				loadArmySpells(),
				loadArmyStratagems(),
				loadArmyItems(),
				loadArmyUpgrades()
			]);
			this.armyFactions = loadArmyFactions();
			this.armyUnits = armyUnits;
			this.armyClasses = armyClasses;
			this.armySkills = armySkills;
			this.armyTraits = armyTraits;
			this.armyCombatArts = armyCombatArts;
			this.armySpellcrafts = armySpellcrafts;
			this.armySpells = armySpells;
			this.armyStratagems = armyStratagems;
			this.armyItems = armyItems;
			this.armyUpgrades = armyUpgrades;
			this.armyLoaded = true;
		})();
		return this.armyLoading;
	}
}

export const contentStore = new ContentStore();
