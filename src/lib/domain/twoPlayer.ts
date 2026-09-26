import type { UnitVitality } from './army';
import { getScoreableResults, type Mission } from './mission';
import { MAX_TOTAL_VP, MIN_ROUND, MAX_ROUND, type SchemeDraft } from './progress';
import type { PickedArmy } from './savedArmy';
import {
	chooseScheme,
	schemeVp,
	setSchemeChecked,
	type ChosenScheme,
	type SchemeCard
} from './scheme';

export type PlayerKey = 'player1' | 'player2';

/**
 * What one seat tracks during a mission: its objectives and its secret Scheme. Shared by hot-seat
 * and online, which differ only in where the record lives and who is allowed to write it.
 */
export type SeatProgress = {
	checkedObjectiveCounts: Record<string, number>;
	scheme: ChosenScheme | null;
	schemeDraft: SchemeDraft;
	schemeRevealed: boolean;
};

/**
 * A hot-seat seat: the shared scoring state plus the army it fields on this device. Both extra
 * fields are local-only — online play has no armies, so its seats stay on `SeatProgress`.
 */
export type PlayerProgress = SeatProgress & {
	/** The army this seat attached to the run; a snapshot, not a live save. */
	pickedArmy: PickedArmy | null;
	/** Live Life/stamina/States per army copy (entry id), for copies that are not untouched. */
	vitality: Record<string, UnitVitality>;
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
		schemeRevealed: false,
		pickedArmy: null,
		vitality: {}
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

/**
 * A record as it may sit in storage: every field optional, including the ones added after the
 * record was written. Hydration is what turns this back into a complete progress record.
 */
export type StoredTwoPlayerProgress = Partial<
	Omit<TwoPlayerMissionProgress, 'player1' | 'player2' | 'gameMode'>
> & {
	/** Storage can hold anything; hydration pins the mode back to `'two-player'`. */
	gameMode?: string;
	player1?: Partial<PlayerProgress>;
	player2?: Partial<PlayerProgress>;
};

/**
 * Fills a persisted record up to the current shape. Both seats merge onto their own empty
 * defaults, so a save written before a field existed (the army, its vitality) gets that field
 * rather than `undefined` — a shallow spread over the whole record would leave the nested
 * player objects untouched and break on the first read.
 */
export function hydrateTwoPlayerProgress(
	missionId: string,
	loaded: StoredTwoPlayerProgress
): TwoPlayerMissionProgress {
	const empty = createEmptyTwoPlayerProgress(missionId);
	return {
		...empty,
		...loaded,
		missionId,
		gameMode: 'two-player',
		player1: { ...empty.player1, ...loaded.player1 },
		player2: { ...empty.player2, ...loaded.player2 },
		currentRound: Math.max(MIN_ROUND, Math.min(loaded.currentRound ?? MIN_ROUND, MAX_ROUND))
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

/** Attaches a saved army to one seat as a snapshot; later edits to the save cannot leak in. */
export function setTwoPlayerPickedArmy(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	army: PickedArmy | null
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({ ...p, pickedArmy: army }));
}

/** Commits one copy's Life/stamina/States for one seat. */
export function setTwoPlayerVitality(
	progress: TwoPlayerMissionProgress,
	player: PlayerKey,
	entryId: string,
	vitality: UnitVitality
): TwoPlayerMissionProgress {
	return updatePlayer(progress, player, (p) => ({
		...p,
		vitality: { ...p.vitality, [entryId]: vitality }
	}));
}

export function setTwoPlayerRound(
	progress: TwoPlayerMissionProgress,
	round: number
): TwoPlayerMissionProgress {
	return { ...progress, currentRound: Math.max(MIN_ROUND, Math.min(round, MAX_ROUND)) };
}

export function calculateTwoPlayerVP(
	mission: Mission,
	seatProgress: SeatProgress,
	schemeCard: SchemeCard | null
): number {
	const resultsVP = getScoreableResults(mission).reduce((sum, objective) => {
		// Persisted counts can predate a content change that lowered an objective's count.
		const checked = Math.min(
			seatProgress.checkedObjectiveCounts[objective.id] ?? 0,
			objective.count
		);
		return sum + objective.vp * checked;
	}, 0);
	const schemeVP =
		seatProgress.scheme && schemeCard
			? schemeVp(schemeCard, seatProgress.scheme.checkedIncrements)
			: 0;
	return Math.min(resultsVP + schemeVP, MAX_TOTAL_VP);
}
