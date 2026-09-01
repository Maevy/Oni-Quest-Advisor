import {
	ARMY_FORMAT_POINTS,
	addArmyUnit,
	addEntryUpgrade,
	armyPoints,
	indexArmyRules,
	isOverArmyLimit,
	removeArmyCopy,
	removeArmyEntry,
	removeEntryUpgrade,
	toggleArmyMount,
	unitsForFaction,
	upgradesForFaction,
	type ArmyEntry,
	type ArmyFactionId,
	type ArmyFormat,
	type ArmyItemSpec,
	type ArmyRulesIndexes,
	type ArmyUnitSpec,
	type ArmyUpgradeSelection,
	type ArmyUpgradeSpec
} from '$lib/domain';
import { contentStore } from './content.svelte';

/**
 * In-session army builder state. Selections are intentionally not persisted
 * yet - saving and loading lists arrives in a later phase.
 */
class ArmyBuilderStore {
	factionId = $state<ArmyFactionId | null>(null);
	format = $state<ArmyFormat>('standard');
	entries = $state<ArmyEntry[]>([]);

	points = $derived(armyPoints(this.entries, this.units, this.upgradeIndex));
	limit = $derived(ARMY_FORMAT_POINTS[this.format]);
	isOverLimit = $derived(isOverArmyLimit(this.points, this.format));

	/** Units available to the selected faction: its exclusives plus the neutral pool. */
	get units(): ArmyUnitSpec[] {
		return this.factionId ? unitsForFaction(this.factionId, contentStore.armyUnits) : [];
	}

	/** Mount options (never recruitable standalone). */
	get mounts(): ArmyUnitSpec[] {
		return contentStore.armyUnits.mounts;
	}

	/** Upgrades available to the selected faction: neutral pool plus own exclusives. */
	get upgrades(): ArmyUpgradeSpec[] {
		return this.factionId ? upgradesForFaction(this.factionId, contentStore.armyUpgrades) : [];
	}

	get upgradeIndex(): Record<string, ArmyUpgradeSpec> {
		return indexArmyRules(contentStore.armyUpgrades);
	}

	get itemIndex(): Record<string, ArmyItemSpec> {
		return indexArmyRules(contentStore.armyItems);
	}

	/** Rules catalogs keyed by id, feeding upgrade max-level checks. */
	get rulesIndexes(): ArmyRulesIndexes {
		return {
			classes: indexArmyRules(contentStore.armyClasses),
			skills: indexArmyRules(contentStore.armySkills),
			traits: indexArmyRules(contentStore.armyTraits),
			combatArts: indexArmyRules(contentStore.armyCombatArts),
			spellcrafts: indexArmyRules(contentStore.armySpellcrafts)
		};
	}

	selectFaction(factionId: ArmyFactionId): void {
		this.factionId = factionId;
		this.format = 'standard';
		this.entries = [];
	}

	setFormat(format: ArmyFormat): void {
		this.format = format;
	}

	addUnit(unitId: string): void {
		this.entries = addArmyUnit(this.entries, unitId, this.units, crypto.randomUUID());
	}

	/** Removes one copy via the available-units stepper (the most recently added). */
	removeUnit(unitId: string): void {
		this.entries = removeArmyCopy(this.entries, unitId);
	}

	removeEntry(entryId: string): void {
		this.entries = removeArmyEntry(this.entries, entryId);
	}

	toggleMount(entryId: string): void {
		this.entries = toggleArmyMount(this.entries, entryId, this.units);
	}

	/** Picks an upgrade for one copy unless the domain rules block it. */
	addUpgrade(entryId: string, upgradeId: string, selection?: ArmyUpgradeSelection): void {
		const upgrade = this.upgradeIndex[upgradeId];
		if (!upgrade) return;
		this.entries = addEntryUpgrade(
			this.entries,
			entryId,
			upgrade,
			this.units,
			this.upgradeIndex,
			this.rulesIndexes,
			contentStore.armySpells,
			this.itemIndex,
			selection
		);
	}

	removeUpgrade(entryId: string, upgradeId: string): void {
		this.entries = removeEntryUpgrade(this.entries, entryId, upgradeId);
	}

	/** Resets the builder when returning to the main menu. */
	leave(): void {
		this.factionId = null;
		this.format = 'standard';
		this.entries = [];
	}
}

export const armyBuilderStore = new ArmyBuilderStore();
