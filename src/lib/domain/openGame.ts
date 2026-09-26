import type { GameMode } from './gameMode';

/**
 * A local game that has been started and not yet abandoned.
 *
 * Its existence is what makes the app offer to resume on the next launch: per-mission progress
 * alone cannot say whether a run is still live, since progress is keyed by mission and would
 * otherwise linger after a player walks away. Abandoning deletes both this record and the
 * mission's progress, so an abandoned run never resumes and never scores again.
 *
 * `mode` says which progress store and which tracker the run belongs to — solo and hot-seat keep
 * separate records per mission, so resuming has to restore the right one. Online games have their
 * own lifecycle on the server and are never open games.
 */
export interface OpenGame {
	missionId: string;
	mode: GameMode;
}
