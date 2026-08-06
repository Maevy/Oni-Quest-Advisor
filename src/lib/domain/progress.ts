import type { Mission } from './mission';
import type { ChosenScheme, SchemeCard } from './scheme';

export type SchemeDraft = {
	factionId: string | null;
	intelligence: number | null;
};

export type MissionProgress = {
	missionId: string;
	/** Objective id → how many of its independent instances are checked (0..objective.count). */
	checkedObjectiveCounts: Record<string, number>;
	scheme: ChosenScheme | null;
	/** Faction/intelligence inputs for the Scheme draw step — kept prefilled across a reset. */
	schemeDraft: SchemeDraft;
};

export function createEmptyProgress(missionId: string): MissionProgress {
	return {
		missionId,
		checkedObjectiveCounts: {},
		scheme: null,
		schemeDraft: { factionId: null, intelligence: null }
	};
}

export function setSchemeDraft(
	progress: MissionProgress,
	draft: Partial<SchemeDraft>
): MissionProgress {
	return { ...progress, schemeDraft: { ...progress.schemeDraft, ...draft } };
}

export function setObjectiveChecked(
	progress: MissionProgress,
	objectiveId: string,
	checkedCount: number,
	maxCount: number
): MissionProgress {
	const clamped = Math.max(0, Math.min(checkedCount, maxCount));
	return {
		...progress,
		checkedObjectiveCounts: { ...progress.checkedObjectiveCounts, [objectiveId]: clamped }
	};
}

export function clearScheme(progress: MissionProgress): MissionProgress {
	return { ...progress, scheme: null };
}

export function calculateTotalVP(
	mission: Mission,
	progress: MissionProgress,
	schemeCard: SchemeCard | null
): number {
	const resultsVP = mission.results.reduce(
		(sum, objective) => sum + objective.vp * (progress.checkedObjectiveCounts[objective.id] ?? 0),
		0
	);

	const schemeVP =
		progress.scheme && schemeCard
			? progress.scheme.checkedIncrements * schemeCard.vpPerIncrement
			: 0;

	return resultsVP + schemeVP;
}
