import {
	calculateTwoPlayerVP,
	type OnlineGameState,
	type PlayerProgress,
	type RoundSnapshot,
	type SchemeCard
} from '$lib/domain';
import { findMission, getSchemes } from './content';

/**
 * Both players' current VP, computed from the bundled content (server-side, so
 * snapshots stay correct regardless of what the clients saw). Null when mission
 * content is missing — that should never happen with bundled data.
 */
export function computeRoundVp(game: OnlineGameState): RoundSnapshot | null {
	const mission = game.missionId ? findMission(game.missionId) : undefined;
	if (!mission) return null;
	const cardFor = (progress: PlayerProgress): SchemeCard | null =>
		progress.scheme
			? (getSchemes().find((card) => card.id === progress.scheme?.schemeId) ?? null)
			: null;
	return {
		player1: calculateTwoPlayerVP(mission, game.player1.progress, cardFor(game.player1.progress)),
		player2: game.player2
			? calculateTwoPlayerVP(mission, game.player2.progress, cardFor(game.player2.progress))
			: 0
	};
}
