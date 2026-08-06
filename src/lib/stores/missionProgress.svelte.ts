import { loadMissionProgress, saveMissionProgress } from '$lib/data';
import * as domain from '$lib/domain';
import type { Mission, MissionProgress, SchemeCard } from '$lib/domain';

class MissionProgressStore {
	progress = $state<MissionProgress | null>(null);
	/** Candidate Schemes shown between "Draw Missions" and the forced pick — not persisted. */
	drawnSchemes = $state<SchemeCard[]>([]);

	loadForMission(missionId: string): void {
		this.progress = loadMissionProgress(missionId) ?? domain.createEmptyProgress(missionId);
		this.drawnSchemes = [];
	}

	private persist(): void {
		if (this.progress) saveMissionProgress(this.progress);
	}

	setObjectiveChecked(objectiveId: string, checkedCount: number, maxCount: number): void {
		if (!this.progress) return;
		this.progress = domain.setObjectiveChecked(this.progress, objectiveId, checkedCount, maxCount);
		this.persist();
	}

	/** Explicit reset for a fresh play of the mission: clears checked objectives and the chosen Scheme. */
	resetMission(): void {
		if (!this.progress) return;
		this.progress = domain.createEmptyProgress(this.progress.missionId);
		this.drawnSchemes = [];
		this.persist();
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
		this.drawnSchemes = domain.drawUniqueSchemes(pool, count, rng);
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

	totalVP(mission: Mission, schemeCard: SchemeCard | null): number {
		if (!this.progress) return 0;
		return domain.calculateTotalVP(mission, this.progress, schemeCard);
	}
}

export const missionProgressStore = new MissionProgressStore();
