import type { ArmyFactionId } from './army';
import type { PickedArmy } from './savedArmy';

/**
 * The server-authoritative state of one tournament: what the lobby shows, who holds which seat
 * and how far the event has gotten. Mirrors `online.ts` in shape — pure transitions with `can*`
 * guards here, persistence and transport in `lib/server`.
 */
export type TournamentEventStatus =
	/** Players are still joining; nothing is paired yet. */
	| 'lobby'
	/** The TO started it; tables are playing. */
	| 'active'
	/** The event concluded; its data lives on for the report window. */
	| 'concluded'
	/** Deleted-to-be: the TO cancelled it before it started. */
	| 'closed';

export type TournamentParticipant = {
	name: string;
	/** The list the player registered with, as a snapshot taken at join time. */
	army: PickedArmy;
	/** SHA-256 of the seat token; the plain token lives only on the player's device. */
	tokenHash: string;
};

export type TournamentSeat = {
	/** The organizer's own seat: reserved at creation and filled from the start. */
	organizer: boolean;
	participant: TournamentParticipant | null;
};

export type TournamentState = {
	/** The join code — appears in invite links and the QR code. */
	code: string;
	status: TournamentEventStatus;
	name: string;
	externalLink: string | null;
	organizerName: string;
	organizerTokenHash: string;
	manualPairing: boolean;
	/** The missions in the order the organizer added them; each plays once. */
	missionIds: string[];
	/** One name per table, half the field of them. */
	tableNames: string[];
	/** One entry per pairing slot; its length is the configured field. */
	seats: TournamentSeat[];
	createdAt: string;
	updatedAt: string;
	concludedAt: string | null;
};

/**
 * Everything `createTournamentEvent` needs. Codes, token hashes and the clock are injected —
 * the domain stays pure, so creation is unit-testable and the server owns randomness and time.
 */
export type TournamentCreation = {
	code: string;
	name: string;
	externalLink: string | null;
	organizerName: string;
	organizerTokenHash: string;
	organizerPlays: boolean;
	/** Required when the organizer plays — the wizard will not advance without one. */
	organizerArmy: PickedArmy | null;
	participantCount: number;
	manualPairing: boolean;
	missionIds: string[];
	tableNames: string[];
	now: string;
};

/**
 * Builds the initial state: every seat empty except the organizer's, which sits first and is
 * filled from the draft when they play.
 */
export function createTournamentEvent(creation: TournamentCreation): TournamentState {
	if (creation.organizerPlays && creation.organizerArmy === null) {
		throw new Error('A playing organizer must register an army');
	}
	const seats: TournamentSeat[] = [];
	for (let index = 0; index < creation.participantCount; index += 1) {
		const organizer = creation.organizerPlays && index === 0;
		seats.push({
			organizer,
			participant: organizer
				? {
						name: creation.organizerName,
						army: creation.organizerArmy as PickedArmy,
						tokenHash: creation.organizerTokenHash
					}
				: null
		});
	}
	return {
		code: creation.code,
		status: 'lobby',
		name: creation.name,
		externalLink: creation.externalLink,
		organizerName: creation.organizerName,
		organizerTokenHash: creation.organizerTokenHash,
		manualPairing: creation.manualPairing,
		missionIds: [...creation.missionIds],
		tableNames: [...creation.tableNames],
		seats,
		createdAt: creation.now,
		updatedAt: creation.now,
		concludedAt: null
	};
}

export function joinedCount(state: TournamentState): number {
	return state.seats.filter((seat) => seat.participant !== null).length;
}

/** True when every pairing slot is taken — no further join fits. */
export function isTournamentFull(state: TournamentState): boolean {
	return state.seats.every((seat) => seat.participant !== null);
}

/** A player may join while the event is still a lobby with a free seat. */
export function canJoinTournament(state: TournamentState): boolean {
	return state.status === 'lobby' && !isTournamentFull(state);
}

/** Whether this token already holds a seat — a device joins once, not twice. */
export function seatIndexForTokenHash(state: TournamentState, tokenHash: string): number | null {
	const index = state.seats.findIndex(
		(seat) => seat.participant !== null && seat.participant.tokenHash === tokenHash
	);
	return index === -1 ? null : index;
}

/**
 * Seats a joining player in the first free seat that is not the organizer's. The caller checks
 * `canJoinTournament` and the duplicate-token case first; both are re-checked here so a replayed
 * or racing join can never double-book a seat.
 */
export function joinTournament(
	state: TournamentState,
	name: string,
	army: PickedArmy,
	tokenHash: string,
	now: string
): TournamentState {
	if (!canJoinTournament(state)) throw new Error('This tournament cannot be joined right now');
	if (seatIndexForTokenHash(state, tokenHash) !== null) {
		throw new Error('This token already holds a seat');
	}
	const target = state.seats.findIndex((seat) => !seat.organizer && seat.participant === null);
	if (target === -1) throw new Error('This tournament is full');
	const seats = state.seats.map((seat, index) =>
		index === target ? { ...seat, participant: { name, army, tokenHash } } : seat
	);
	return { ...state, seats, updatedAt: now };
}

/** What the lobby shows for one seat: never the army code, so nobody imports nobody's list. */
export type TournamentSeatView = {
	organizer: boolean;
	name: string | null;
	army: { name: string; factionId: ArmyFactionId } | null;
	/** True for the viewer's own seat, so the lobby can mark "you". */
	you: boolean;
};

export type TournamentEventView = {
	code: string;
	status: TournamentEventStatus;
	name: string;
	externalLink: string | null;
	organizerName: string;
	manualPairing: boolean;
	missionIds: string[];
	tableNames: string[];
	seats: TournamentSeatView[];
	role: 'organizer' | 'player';
	/** The viewer's seat, null for the organizer when they do not play. */
	seatIndex: number | null;
	joinedCount: number;
	full: boolean;
};

/**
 * The visibility-filtered view one authenticated viewer gets. The organizer authenticates with
 * their own token; a player with theirs. Everything in the lobby is shared by design — names,
 * missions, tables — the only secrets are the seat tokens and the army codes, and neither
 * leaves the server.
 */
export function viewForTournamentToken(
	state: TournamentState,
	tokenHash: string
): TournamentEventView | null {
	const isOrganizer = tokenHash === state.organizerTokenHash;
	const seatIndex = seatIndexForTokenHash(state, tokenHash);
	if (!isOrganizer && seatIndex === null) return null;
	return {
		code: state.code,
		status: state.status,
		name: state.name,
		externalLink: state.externalLink,
		organizerName: state.organizerName,
		manualPairing: state.manualPairing,
		missionIds: [...state.missionIds],
		tableNames: [...state.tableNames],
		seats: state.seats.map((seat, index) => ({
			organizer: seat.organizer,
			name: seat.participant?.name ?? null,
			army: seat.participant
				? { name: seat.participant.army.name, factionId: seat.participant.army.factionId }
				: null,
			you: index === seatIndex
		})),
		role: isOrganizer ? 'organizer' : 'player',
		seatIndex,
		joinedCount: joinedCount(state),
		full: isTournamentFull(state)
	};
}

/** What an unauthenticated visitor (the join page) may see before they join. */
export type TournamentPeek = {
	code: string;
	status: TournamentEventStatus;
	name: string;
	organizerName: string;
	participantCount: number;
	joinedCount: number;
	full: boolean;
	canJoin: boolean;
};

export function peekTournament(state: TournamentState): TournamentPeek {
	return {
		code: state.code,
		status: state.status,
		name: state.name,
		organizerName: state.organizerName,
		participantCount: state.seats.length,
		joinedCount: joinedCount(state),
		full: isTournamentFull(state),
		canJoin: canJoinTournament(state)
	};
}
