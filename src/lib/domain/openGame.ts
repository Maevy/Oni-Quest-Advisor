/**
 * A solo game that has been started and not yet abandoned.
 *
 * Its existence is what makes the app offer to resume on the next launch: per-mission progress
 * alone cannot say whether a run is still live, since progress is keyed by mission and would
 * otherwise linger after a player walks away. Abandoning deletes both this record and the
 * mission's progress, so an abandoned run never resumes and never scores again.
 *
 * Solo only — hot-seat and online games have their own lifecycles.
 */
export interface OpenGame {
	missionId: string;
}
