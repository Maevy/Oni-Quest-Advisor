import {
	clearMissionProgress,
	clearOpenGame,
	loadMissionProgress,
	loadOpenGame,
	saveMissionProgress,
	saveOpenGame
} from '$lib/data';
import * as domain from '$lib/domain';
import type {
	ArmyView,
	Mission,
	MissionProgress,
	PickedArmy,
	SchemeCard,
	UnitVitality
} from '$lib/domain';
import { contentStore } from './content.svelte';

class MissionProgressStore {
	progress = $state<MissionProgress | null>(null);
	/** Candidate Schemes shown between "Draw Missions" and the forced pick — not persisted. */
	drawnSchemes = $state<SchemeCard[]>([]);

	loadForMission(missionId: string): void {
		const loaded = loadMissionProgress(missionId);
		this.progress = loaded
			? { ...domain.createEmptyProgress(missionId), ...loaded }
			: domain.createEmptyProgress(missionId);
		this.drawnSchemes = [];
	}

	private persist(): void {
		if (this.progress) saveMissionProgress(this.progress);
	}

	/** Marks the loaded mission as the one open solo game — called when Start Game is pressed. */
	beginGame(): void {
		if (!this.progress) return;
		saveOpenGame({ missionId: this.progress.missionId, mode: 'solo' });
	}

	/**
	 * Abandons the open game. The record and that mission's saved progress both go, so the run
	 * cannot be resumed later and its boxes cannot score again.
	 */
	abandonGame(): void {
		const open = loadOpenGame();
		clearOpenGame();
		if (open) clearMissionProgress(open.missionId);
		this.progress = null;
		this.drawnSchemes = [];
	}

	setObjectiveChecked(objectiveId: string, checkedCount: number, maxCount: number): void {
		if (!this.progress) return;
		this.progress = domain.setObjectiveChecked(this.progress, objectiveId, checkedCount, maxCount);
		this.persist();
	}

	/** Explicit reset for a fresh play of the mission: clears checked objectives and the chosen Scheme. */
	resetMission(): void {
		if (!this.progress) return;
		// The attached army is the list being fielded, not scoring state - a fresh play keeps it.
		const pickedArmy = this.progress.pickedArmy;
		this.progress = { ...domain.createEmptyProgress(this.progress.missionId), pickedArmy };
		this.drawnSchemes = [];
		this.persist();
	}

	/** Attaches a saved army to this run as a snapshot; later edits to the save cannot leak in. */
	pickArmy(army: PickedArmy): void {
		if (!this.progress) return;
		this.progress = { ...this.progress, pickedArmy: army };
		this.persist();
	}

	clearPickedArmy(): void {
		if (!this.progress) return;
		this.progress = { ...this.progress, pickedArmy: null };
		this.persist();
	}

	/** Commits a copy's Life/stamina once the vitality menu is accepted. */
	setUnitVitality(entryId: string, vitality: UnitVitality): void {
		if (!this.progress) return;
		this.progress = {
			...this.progress,
			vitality: { ...this.progress.vitality, [entryId]: domain.applyZeroHpStates(vitality) }
		};
		this.persist();
	}

	/**
	 * The attached army resolved for display; null when nothing is picked, the catalogs are
	 * still loading, or the snapshot no longer decodes against the current roster.
	 */
	armyView(): ArmyView | null {
		return contentStore.armyView(this.progress?.pickedArmy ?? null, this.progress?.vitality ?? {});
	}

	setDraftFaction(factionId: string | null): void {
		if (!this.progress) return;
		this.progress = domain.setSchemeDraft(this.progress, { factionId });
		this.persist();
	}

	setDraftIntelligence(intelligence: number | null): void {
		if (!this.progress) return;
		this.progress = domain.setSchemeDraft(this.progress, { intelligence });
		this.persist();
	}

	drawSchemes(allSchemes: SchemeCard[], rng: domain.Rng = Math.random): void {
		const draft = this.progress?.schemeDraft;
		if (!draft?.factionId || draft.intelligence == null) return;
		const pool = domain.getSchemePool(allSchemes, draft.factionId);
		const count = domain.drawCountForIntelligence(draft.intelligence);
		this.drawnSchemes = domain.drawUniqueSchemes(pool, count, rng, draft.factionId);
	}

	chooseScheme(schemeId: string): void {
		const draft = this.progress?.schemeDraft;
		if (!this.progress || !draft?.factionId || draft.intelligence == null) return;
		this.progress = {
			...this.progress,
			scheme: domain.chooseScheme(schemeId, draft.factionId, draft.intelligence)
		};
		this.drawnSchemes = [];
		this.persist();
	}

	setSchemeChecked(checkedIncrements: number, maxIncrements: number): void {
		if (!this.progress?.scheme) return;
		this.progress = {
			...this.progress,
			scheme: domain.setSchemeChecked(this.progress.scheme, checkedIncrements, maxIncrements)
		};
		this.persist();
	}

	/** The red-X control: drops the chosen Scheme, keeps faction/intelligence prefilled. */
	deleteScheme(): void {
		if (!this.progress) return;
		this.progress = domain.clearScheme(this.progress);
		this.drawnSchemes = [];
		this.persist();
	}

	setRound(round: number): void {
		if (!this.progress) return;
		this.progress = domain.setRound(this.progress, round);
		this.persist();
	}

	totalVP(mission: Mission, schemeCard: SchemeCard | null): number {
		if (!this.progress) return 0;
		return domain.calculateTotalVP(mission, this.progress, schemeCard);
	}
}

export const missionProgressStore = new MissionProgressStore();
