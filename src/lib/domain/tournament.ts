import type { PickedArmy } from './savedArmy';

/** Which pane of the configuration wizard the organizer is on. */
export type TournamentSetupStep = 'basics' | 'missions';

/**
 * The Tournament Organizer's configuration draft.
 *
 * The whole wizard is local: nothing here is persisted or sent anywhere until the tournament is
 * actually created at the end of configuration, at which point the server takes over (pairings,
 * invites, live overwatch). Abandoning the wizard therefore leaves no trace behind.
 */
export type TournamentDraft = {
	/** The tournament's name, shown to everyone invited. */
	name: string;
	/** Where the event is listed outside the app, if anywhere. Optional. */
	externalLink: string;
	/** The organizer's name — also their player name when they take a seat. */
	organizerName: string;
	/** Whether the organizer occupies one of the participant seats. */
	organizerPlays: boolean;
	/** The organizer's own roster-format army, when they take a seat. */
	organizerArmy: PickedArmy | null;
	/**
	 * Total seats in the tournament, the organizer's included when they play. Always even and
	 * always within range; {@link clampTournamentPlayers} is the only way in.
	 */
	participantCount: number;
	/** True when the TO pairs each round by hand instead of the app running a Swiss system. */
	manualPairing: boolean;
	/** Missions added to the tournament, in the order the organizer added them. Each plays once. */
	missionIds: string[];
	/**
	 * One name per table, defaults materialized as "Table n". The length always follows the
	 * field — half the participants — via {@link syncTournamentTables}.
	 */
	tableNames: string[];
};

export const MIN_TOURNAMENT_PLAYERS = 4;
export const MAX_TOURNAMENT_PLAYERS = 32;

/**
 * Every round pairs players off, so the field steps in pairs and both ends are even. An even
 * field means no byes and no rule for who sits a round out; odd fields are deliberately
 * unreachable rather than handled.
 */
export const TOURNAMENT_PLAYER_STEP = 2;

export const MAX_TOURNAMENT_NAME_LENGTH = 40;
/** The organizer's name doubles as a player name, so it shares the online nickname limit. */
export const MAX_ORGANIZER_NAME_LENGTH = 24;
export const MAX_EXTERNAL_LINK_LENGTH = 200;

/**
 * An external link is optional; when given, it has to be an http(s) URL. The result carries the
 * normalized address (scheme added when the organizer left it off), which is what a later
 * "open the event page" affordance would use.
 */
export type ExternalLinkCheck = { ok: true; url: string | null } | { ok: false };

export function createEmptyTournamentDraft(): TournamentDraft {
	return syncTournamentTables({
		name: '',
		externalLink: '',
		organizerName: '',
		organizerPlays: false,
		organizerArmy: null,
		participantCount: MIN_TOURNAMENT_PLAYERS,
		manualPairing: false,
		missionIds: [],
		tableNames: []
	});
}

export function checkExternalLink(raw: string): ExternalLinkCheck {
	const trimmed = raw.trim();
	if (trimmed === '') return { ok: true, url: null };
	// Engines disagree about spaces inside a host — Chromium percent-encodes them into a
	// "valid" URL where Node throws — so whitespace anywhere disqualifies the input before any
	// parsing happens. A real pasted address carries %20, not spaces.
	if (/\s/.test(trimmed)) return { ok: false };
	// A link that brings its own "://" keeps its scheme and is only accepted as http(s); a bare
	// address additionally gets https:// tried, so pasting "tabletop.events/x" works.
	const candidates = trimmed.includes('://') ? [trimmed] : [trimmed, `https://${trimmed}`];
	for (const candidate of candidates) {
		let parsed: URL;
		try {
			parsed = new URL(candidate);
		} catch {
			continue;
		}
		if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname !== '') {
			return { ok: true, url: parsed.href };
		}
	}
	return { ok: false };
}

/**
 * Forces a seat count into a legal field. Odd input snaps up to the next even count, which is
 * safe because the maximum is itself even.
 */
export function clampTournamentPlayers(count: number): number {
	if (!Number.isFinite(count)) return MIN_TOURNAMENT_PLAYERS;
	const bounded = Math.min(
		Math.max(Math.round(count), MIN_TOURNAMENT_PLAYERS),
		MAX_TOURNAMENT_PLAYERS
	);
	return bounded % 2 === 0 ? bounded : Math.min(bounded + 1, MAX_TOURNAMENT_PLAYERS);
}

/** Moves the field by whole pairs, clamped at both ends — the −/+ stepper's only entry point. */
export function stepTournamentPlayers(count: number, pairs: number): number {
	return clampTournamentPlayers(count + pairs * TOURNAMENT_PLAYER_STEP);
}

/**
 * Gives up or takes the organizer's seat. A seat they no longer hold has no army to bring, so
 * un-ticking drops the picked list rather than keeping a ghost of it around.
 */
export function setTournamentOrganizerPlays(
	draft: TournamentDraft,
	plays: boolean
): TournamentDraft {
	return {
		...draft,
		organizerPlays: plays,
		organizerArmy: plays ? draft.organizerArmy : null
	};
}

export function setTournamentOrganizerArmy(
	draft: TournamentDraft,
	army: PickedArmy | null
): TournamentDraft {
	return { ...draft, organizerArmy: army };
}

/** The wizard advances only once the names are given and the optional link is usable. */
export function canContinueTournamentSetup(draft: TournamentDraft): boolean {
	return (
		draft.name.trim().length > 0 &&
		draft.organizerName.trim().length > 0 &&
		checkExternalLink(draft.externalLink).ok
	);
}

/** One table per pair of players — every round seats the whole field at once. */
export function tableCountFor(participantCount: number): number {
	return Math.max(1, Math.floor(participantCount / 2));
}

export function defaultTableName(index: number): string {
	return 'Table ' + (index + 1);
}

/**
 * Keeps exactly one name per table. Growing the field appends default-named tables; shrinking
 * drops the surplus names — so a custom name always stays with its table number.
 */
export function syncTournamentTables(draft: TournamentDraft): TournamentDraft {
	const count = tableCountFor(draft.participantCount);
	if (draft.tableNames.length === count) return draft;
	const tableNames = draft.tableNames.slice(0, count);
	while (tableNames.length < count) tableNames.push(defaultTableName(tableNames.length));
	return { ...draft, tableNames };
}

/** Appends a mission unless it is already on the list — a mission plays once per tournament. */
export function addTournamentMission(draft: TournamentDraft, missionId: string): TournamentDraft {
	if (draft.missionIds.includes(missionId)) return draft;
	return { ...draft, missionIds: [...draft.missionIds, missionId] };
}

export function removeTournamentMission(
	draft: TournamentDraft,
	missionId: string
): TournamentDraft {
	return { ...draft, missionIds: draft.missionIds.filter((id) => id !== missionId) };
}

export function setTournamentTableName(
	draft: TournamentDraft,
	index: number,
	name: string
): TournamentDraft {
	if (index < 0 || index >= draft.tableNames.length) return draft;
	const tableNames = [...draft.tableNames];
	tableNames[index] = name;
	return { ...draft, tableNames };
}

/** The tournament can be created once at least one mission is on the list. */
export function canCreateTournament(draft: TournamentDraft): boolean {
	return draft.missionIds.length > 0;
}
