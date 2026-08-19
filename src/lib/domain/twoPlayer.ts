import { getScoreableResults, type Mission } from './mission';
import { MAX_TOTAL_VP, MIN_ROUND, MAX_ROUND, type SchemeDraft } from './progress';
import {
	chooseScheme,
	schemeVp,
	setSchemeChecked,
	type ChosenScheme,
	type SchemeCard
} from './scheme';

export type PlayerKey = 'player1' | 'player2';

export type PlayerProgress = {
	checkedObjectiveCounts: Record<string, number>;
	scheme: ChosenScheme | null;
	schemeDraft: SchemeDraft;
	schemeRevealed: boolean;
};

export type TwoPlayerMissionProgress = {
	missionId: string;
	gameMode: 'two-player';
	player1: PlayerProgress;
	player2: PlayerProgress;
	currentRound: number;
};

function createEmptyPlayerProgress(): PlayerProgress {
	return {
		checkedObjectiveCounts: {},
		scheme: null,
		schemeDraft: { factionId: null, intelligence: null },
		schemeRevealed: false
	};
}

export function createEmptyTwoPlayerProgress(missionId: string): TwoPlayerMissionProgress {
	return {
		missionId,
		gameMode: 'two-player',
		player1: createEmptyPlayerProgress(),
		player2: createEmptyPlayerProgress(),
		currentRound: MIN_ROUND
	};
}

function updatePlayer(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	updater: (p: PlayerProgress) => PlayerProgress
): TwoPlayerMissionProgress {
	return { ...progress, [player]: updater(progress[player]) };
}

export function setTwoPlayerObjectiveChecked(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	objectiveId: string,
	checkedCount: number,
	maxCount: number
): TwoPlayerMissionProgress {
	const clamped = Math.max(0, Math.min(checkedCount, maxCount));
	return updatePlayer(progress, player, (p) => ({
		...p,
		checkedObjectiveCounts: { ...p.checkedObjectiveCounts, [objectiveId]: clamped }
	}));
}

export function setTwoPlayerSchemeDraft(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	draft: Partial<SchemeDraft>
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({
		...p,
		schemeDraft: { ...p.schemeDraft, ...draft }
	}));
}

export function chooseTwoPlayerScheme(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	schemeId: string,
	factionId: string,
	intelligence: number
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({
		...p,
		scheme: chooseScheme(schemeId, factionId, intelligence)
	}));
}

export function clearTwoPlayerScheme(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({ ...p, scheme: null }));
}

export function setTwoPlayerSchemeChecked(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	checkedIncrements: number,
	maxIncrements: number
): TwoPlayerMissionProgress {
	const current = progress[player].scheme;
	if (!current) return progress;
	return updatePlayer(progress, player, (p) => ({
		...p,
		scheme: setSchemeChecked(current, checkedIncrements, maxIncrements)
	}));
}

export function revealTwoPlayerScheme(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({ ...p, schemeRevealed: true }));
}

export function setTwoPlayerRound(
	progress: TwoPlayerMissionProgress,
	round: number
): TwoPlayerMissionProgress {
	return { ...progress, currentRound: Math.max(MIN_ROUND, Math.min(round, MAX_ROUND)) };
}

export function calculateTwoPlayerVP(
	mission: Mission,
	playerProgress: PlayerProgress,
	schemeCard: SchemeCard | null
): number {
	const resultsVP = getScoreableResults(mission).reduce(
		(sum, objective) =>
			sum + objective.vp * (playerProgress.checkedObjectiveCounts[objective.id] ?? 0),
		0
	);
	const schemeVP =
		playerProgress.scheme && schemeCard
			? schemeVp(schemeCard, playerProgress.scheme.checkedIncrements)
			: 0;
	return Math.min(resultsVP + schemeVP, MAX_TOTAL_VP);
}
