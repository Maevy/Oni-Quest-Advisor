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
import {
	decodeArmy,
	indexArmyRules,
	resolveArmyEntries,
	unitsForFaction,
	type ArmyFactionConfig,
	type ArmyItemSpec,
	type ArmyRulesSpec,
	type ArmySpellSpec,
	type ArmyStratagemSpec,
	type ArmyUnitContent,
	type ArmyUpgradeSpec,
	type ArmyView,
	type Faction,
	type Mission,
	type PickedArmy,
	type SchemeCard,
	type UnitVitality
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

	/**
	 * Resolves a run's attached-army snapshot into everything the read-only Army view renders.
	 * Null when nothing is picked, the catalogs are still loading, or the snapshot no longer
	 * decodes against the current roster — a code from before a content update must refuse to
	 * render rather than resolve the wrong units.
	 */
	armyView(picked: PickedArmy | null, vitality: Record<string, UnitVitality>): ArmyView | null {
		if (!picked || !this.armyLoaded) return null;
		const decoded = decodeArmy(picked.code, {
			factions: this.armyFactions,
			units: this.armyUnits,
			upgrades: this.armyUpgrades,
			spellcrafts: this.armySpellcrafts,
			items: this.armyItems
		});
		if (!decoded.ok) return null;
		const faction = this.armyFactions.find((candidate) => candidate.id === decoded.list.factionId);
		if (!faction) return null;
		const upgradeIndex = indexArmyRules(this.armyUpgrades);
		return {
			army: picked,
			rows: resolveArmyEntries(
				decoded.list.entries,
				unitsForFaction(decoded.list.factionId, this.armyUnits),
				this.armyUnits.mounts,
				upgradeIndex,
				indexArmyRules(this.armyItems)
			),
			picks: decoded.list.picks ?? [],
			faction,
			upgradeIndex,
			classIndex: indexArmyRules(this.armyClasses),
			skillIndex: indexArmyRules(this.armySkills),
			traitIndex: indexArmyRules(this.armyTraits),
			combatArtIndex: indexArmyRules(this.armyCombatArts),
			spellcraftIndex: indexArmyRules(this.armySpellcrafts),
			spells: this.armySpells,
			stratagemIndex: indexArmyRules(this.armyStratagems),
			itemIndex: indexArmyRules(this.armyItems),
			vitality
		};
	}
}

export const contentStore = new ContentStore();
