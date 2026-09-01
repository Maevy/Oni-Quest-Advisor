import {
	ARMY_FORMAT_POINTS,
	addArmyUnit,
	addEntryUpgrade,
	armyPoints,
	decodeArmy,
	encodeArmy,
	indexArmyRules,
	isOverArmyLimit,
	removeArmyCopy,
	removeArmyEntry,
	removeEntryUpgrade,
	toggleArmyMount,
	unitsForFaction,
	upgradesForFaction,
	type ArmyCodeCatalog,
	type ArmyCodeDecodeError,
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
	/** Opens the builder on the Your-Army panel; set by a code import. */
	startOnArmyPanel = $state(false);

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
		this.startOnArmyPanel = false;
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

	/** The catalogs an army code indexes into (and fingerprints against). */
	private get codeCatalog(): ArmyCodeCatalog {
		return {
			factions: contentStore.armyFactions,
			units: contentStore.armyUnits,
			upgrades: contentStore.armyUpgrades,
			spellcrafts: contentStore.armySpellcrafts,
			items: contentStore.armyItems
		};
	}

	/** The compact share code for the current army; null while it is empty. */
	exportArmyCode(): string | null {
		if (!this.factionId || this.entries.length === 0) return null;
		return encodeArmy(
			{ factionId: this.factionId, format: this.format, entries: this.entries },
			this.codeCatalog
		);
	}

	/**
	 * Loads an army from a share code, replaying every pick through the
	 * domain guards so an import can never yield an invalid army. Null on
	 * success, the decode error otherwise.
	 */
	importArmy(code: string): ArmyCodeDecodeError | null {
		const decoded = decodeArmy(code, this.codeCatalog);
		if (!decoded.ok) return decoded.error;
		const { factionId, format, entries } = decoded.list;
		const units = unitsForFaction(factionId, contentStore.armyUnits);
		const unitIds = new Set(units.map((unit) => unit.id));
		const upgradeIds = new Set(
			upgradesForFaction(factionId, contentStore.armyUpgrades).map((upgrade) => upgrade.id)
		);
		for (const entry of entries) {
			if (!unitIds.has(entry.unitId)) return 'invalid';
			for (const upgradeId of entry.upgrades ?? []) {
				if (!upgradeIds.has(upgradeId)) return 'invalid';
			}
		}
		let next: ArmyEntry[] = [];
		for (const entry of entries) {
			const before = next.length;
			next = addArmyUnit(next, entry.unitId, units, entry.id);
			if (next.length === before) return 'invalid';
			if (entry.mounted) next = toggleArmyMount(next, entry.id, units);
		}
		const upgradeIndex = indexArmyRules(contentStore.armyUpgrades);
		for (const entry of entries) {
			for (const upgradeId of entry.upgrades ?? []) {
				const upgrade = upgradeIndex[upgradeId];
				if (!upgrade) return 'invalid';
				const choice = entry.upgradeChoices?.[upgradeId];
				const before = next;
				next = addEntryUpgrade(
					next,
					entry.id,
					upgrade,
					units,
					upgradeIndex,
					this.rulesIndexes,
					contentStore.armySpells,
					this.itemIndex,
					{
						spellcraftId: entry.spellcraftChoices?.[upgradeId],
						optionId: choice?.option,
						itemId: choice?.itemId,
						removedElement: choice?.removedElement
					}
				);
				if (next === before) return 'invalid';
			}
		}
		this.factionId = factionId;
		this.format = format;
		this.entries = next;
		this.startOnArmyPanel = true;
		return null;
	}

	/** Resets the builder when returning to the main menu. */
	leave(): void {
		this.factionId = null;
		this.format = 'standard';
		this.entries = [];
		this.startOnArmyPanel = false;
	}
}

export const armyBuilderStore = new ArmyBuilderStore();
