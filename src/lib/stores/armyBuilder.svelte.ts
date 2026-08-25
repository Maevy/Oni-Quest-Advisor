import {
	ARMY_FORMAT_POINTS,
	addArmyUnit,
	armyPoints,
	isOverArmyLimit,
	removeArmyUnit,
	unitsForFaction,
	type ArmyEntry,
	type ArmyFactionId,
	type ArmyFormat,
	type ArmyUnitSpec
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

	points = $derived(armyPoints(this.entries, this.units));
	limit = $derived(ARMY_FORMAT_POINTS[this.format]);
	isOverLimit = $derived(isOverArmyLimit(this.points, this.format));

	/** Units available to the selected faction: its exclusives plus the neutral pool. */
	get units(): ArmyUnitSpec[] {
		return this.factionId ? unitsForFaction(this.factionId, contentStore.armyUnits) : [];
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
		this.entries = addArmyUnit(this.entries, unitId, this.units);
	}

	removeUnit(unitId: string): void {
		this.entries = removeArmyUnit(this.entries, unitId);
	}

	/** Resets the builder when returning to the main menu. */
	leave(): void {
		this.factionId = null;
		this.format = 'standard';
		this.entries = [];
	}
}

export const armyBuilderStore = new ArmyBuilderStore();
