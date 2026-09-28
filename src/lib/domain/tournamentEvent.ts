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
	/** Cancelled by the organizer — deleted-to-be, and unreachable for joining. */
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

/**
 * One occupant of a table in the round being prepared: a registered player's seat, or the BYE —
 * the imaginary player an odd field needs so every pairing round stays uniform. The BYE is a
 * first-class occupant rather than a rule bolted onto pairing, because the organizer assigns it
 * to a table by hand exactly like a player, and whoever it lands with sits the round out.
 */
export type TournamentOccupant = { kind: 'seat'; seatIndex: number } | { kind: 'bye' };

/** Where a round is in its life: tables being assigned, matches being played, results coming in. */
export type TournamentRoundPhase = 'setup' | 'game' | 'scoring';

/** The phases one round walks through, in order — three roadmap steps per round. */
export const TOURNAMENT_ROUND_PHASES: readonly TournamentRoundPhase[] = [
	'setup',
	'game',
	'scoring'
];

export type TournamentRound = {
	/** 1-based; round n plays `missionIds[n - 1]`. */
	number: number;
	missionId: string;
	phase: TournamentRoundPhase;
	/** One occupant list per configured table, in table order; at most two occupants each. */
	tables: TournamentOccupant[][];
	/** Victory points per seat index, as the control panel lists them; zeros until scored. */
	victoryPoints: number[];
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
	/** The round being prepared or played; null while the event is still a lobby. */
	round: TournamentRound | null;
	createdAt: string;
	updatedAt: string;
	concludedAt: string | null;
};

/**
 * Fills the defaults a state written before a field existed is missing — the same merge-onto-
 * defaults rule the persisted progress types follow, so an old lobby row read back from SQLite
 * never hands a component `undefined` where it expects `null`.
 */
export function hydrateTournamentState(state: TournamentState): TournamentState {
	// A round stored before the phase model existed was in setup — that was all a round could be.
	const round = (state.round ?? null) as LegacyRound | null;
	return {
		...state,
		round: round === null ? null : { ...round, phase: round.phase ?? 'setup' }
	};
}

type LegacyRound = Omit<TournamentRound, 'phase'> & { phase?: TournamentRoundPhase };

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
		round: null,
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

/**
 * A seated player may give up their seat while the event is still a lobby. Once it runs, a seat
 * is part of the pairing — releasing it needs a forfeit rule that does not exist yet.
 */
export function canLeaveTournament(state: TournamentState): boolean {
	return state.status === 'lobby';
}

/**
 * Frees the caller's seat, so the lobby shows it as empty again and the next joiner takes it.
 * The organizer never leaves: abandoning as the TO cancels the whole event instead, and there is
 * no handover of an event mid-flight.
 */
export function leaveTournament(
	state: TournamentState,
	tokenHash: string,
	now: string
): TournamentState {
	if (!canLeaveTournament(state)) {
		throw new Error('A running tournament cannot be left');
	}
	if (tokenHash === state.organizerTokenHash) {
		throw new Error('The organizer cancels the tournament instead of leaving it');
	}
	const seatIndex = seatIndexForTokenHash(state, tokenHash);
	if (seatIndex === null) throw new Error('This token holds no seat');
	const seats = state.seats.map((seat, index) =>
		index === seatIndex ? { ...seat, participant: null } : seat
	);
	return { ...state, seats, updatedAt: now };
}

/** The organizer may kill the event while it is a lobby or mid-play, never once it concluded. */
export function canCancelTournament(state: TournamentState): boolean {
	return state.status === 'lobby' || state.status === 'active';
}

/**
 * Cancels the event: status `closed`, seats left as they were so every open device still
 * authenticates and can be told what happened rather than meeting a bare 404.
 */
export function cancelTournament(state: TournamentState, now: string): TournamentState {
	if (!canCancelTournament(state)) throw new Error('This tournament has already ended');
	return { ...state, status: 'closed', updatedAt: now };
}

/** A single player cannot be paired, so an event needs at least two of them to start. */
export const MIN_PLAYERS_TO_START = 2;
/**
 * At most one seat may stay empty. The configured tables are the tables that will play — one per
 * pair of seats — so two empty seats would leave a table with nobody at it, while exactly one is
 * what the BYE exists to fill.
 */
export const MAX_EMPTY_SEATS = 1;
/** A table seats one match: two players, or one player and the BYE. */
export const MAX_TABLE_OCCUPANTS = 2;

/** The seats somebody actually registered for, in seat order — empty seats are not players. */
export function registeredSeatIndexes(state: TournamentState): number[] {
	return state.seats
		.map((seat, index) => (seat.participant === null ? -1 : index))
		.filter((index) => index !== -1);
}

/**
 * True when an odd number of players registered: the field then needs the BYE as one more
 * occupant so that every table can still be paired. The configured field is always even (it
 * steps in pairs), so this is purely about how many seats were taken.
 */
export function fieldNeedsBye(state: TournamentState): boolean {
	return registeredSeatIndexes(state).length % 2 === 1;
}

/** True when the same occupant is meant — the BYE has no index to compare. */
export function sameOccupant(a: TournamentOccupant, b: TournamentOccupant): boolean {
	return a.kind === 'bye' ? b.kind === 'bye' : b.kind === 'seat' && a.seatIndex === b.seatIndex;
}

/**
 * The organizer may start the event once at least two players are in **and at most one seat is
 * still empty**: the round pairs whoever came, but a table with nobody at it must not exist in the
 * first place — the configured table count is a promise about the event, not a suggestion. With
 * exactly one empty seat the BYE fills it; with none, every table is a real pairing. Starting
 * closes the lobby, so nobody joins or leaves mid-round.
 */
export function canStartTournament(state: TournamentState): boolean {
	const registered = registeredSeatIndexes(state).length;
	return (
		state.status === 'lobby' &&
		registered >= MIN_PLAYERS_TO_START &&
		state.seats.length - registered <= MAX_EMPTY_SEATS
	);
}

/**
 * The round a started event prepares: round `number` plays the `number`th mission in the
 * organizer's list, every table starts empty, and every seat's victory points start at zero.
 */
export function createTournamentRound(state: TournamentState, number: number): TournamentRound {
	const missionId = state.missionIds[number - 1];
	if (!missionId) throw new Error(`No mission is configured for round ${number}`);
	return {
		number,
		missionId,
		phase: 'setup',
		tables: state.tableNames.map(() => []),
		victoryPoints: state.seats.map(() => 0)
	};
}

export function startTournament(state: TournamentState, now: string): TournamentState {
	if (!canStartTournament(state)) throw new Error('This tournament cannot be started');
	return {
		...state,
		status: 'active',
		round: createTournamentRound(state, 1),
		updatedAt: now
	};
}

/**
 * Occupants are assigned while a round is being prepared — an `active` event whose round is still
 * in setup. Once the round is under way the tables are locked: a pairing cannot change underneath
 * a match that is already being played.
 */
export function canAssignOccupants(state: TournamentState): boolean {
	return state.status === 'active' && state.round?.phase === 'setup';
}

/**
 * Everything still waiting for a table: the registered players in seat order, then the BYE when
 * the field is odd. This is the assignment panel's pool.
 */
export function unassignedOccupants(state: TournamentState): TournamentOccupant[] {
	if (state.round === null) return [];
	const assigned = state.round.tables.flat();
	const occupants: TournamentOccupant[] = registeredSeatIndexes(state).map((seatIndex) => ({
		kind: 'seat',
		seatIndex
	}));
	if (fieldNeedsBye(state)) occupants.push({ kind: 'bye' });
	return occupants.filter((occupant) => !assigned.some((other) => sameOccupant(other, occupant)));
}

/**
 * Moves an occupant to a table, or back to the pool when `tableIndex` is null. The occupant is
 * lifted out of wherever it sat first, so this one call covers a drop on another table, a drop
 * back into the pool and a drop on its own table alike.
 */
export function assignOccupant(
	state: TournamentState,
	occupant: TournamentOccupant,
	tableIndex: number | null,
	now: string
): TournamentState {
	if (!canAssignOccupants(state)) throw new Error('This tournament is not preparing a round');
	const round = state.round as TournamentRound;
	if (occupant.kind === 'bye' && !fieldNeedsBye(state)) {
		throw new Error('This field needs no BYE');
	}
	if (occupant.kind === 'seat' && state.seats[occupant.seatIndex]?.participant == null) {
		throw new Error('That seat holds no player');
	}
	if (
		tableIndex !== null &&
		(!Number.isInteger(tableIndex) || tableIndex < 0 || tableIndex >= round.tables.length)
	) {
		throw new Error('Unknown table');
	}
	const tables = round.tables.map((table) =>
		table.filter((other) => !sameOccupant(other, occupant))
	);
	if (tableIndex !== null) {
		if (tables[tableIndex].length >= MAX_TABLE_OCCUPANTS) throw new Error('That table is full');
		tables[tableIndex] = [...tables[tableIndex], occupant];
	}
	return { ...state, round: { ...round, tables }, updatedAt: now };
}

/**
 * True when the round can begin: nobody is left in the pool — the BYE included — and no table
 * holds a single occupant, which would leave that player without an opponent. Checking the pool
 * alone is not enough: with four tables and six players, 2/2/1/1 assigns everybody and still
 * strands two of them.
 */
export function isRoundReady(state: TournamentState): boolean {
	if (state.round === null) return false;
	if (unassignedOccupants(state).length > 0) return false;
	return state.round.tables.every(
		(table) => table.length === 0 || table.length === MAX_TABLE_OCCUPANTS
	);
}

/**
 * True when the organizer may start the round: it is still in setup and its pairing is complete.
 * Starting it is what moves the roadmap on — and what locks the tables.
 */
export function canStartRound(state: TournamentState): boolean {
	return canAssignOccupants(state) && isRoundReady(state);
}

export function startRound(state: TournamentState, now: string): TournamentState {
	if (!canStartRound(state)) throw new Error('This round cannot be started');
	const round = state.round as TournamentRound;
	return { ...state, round: { ...round, phase: 'game' }, updatedAt: now };
}

/**
 * One step of the event's roadmap: a round's phase, or the tournament's conclusion. Labels are
 * the client's business — the domain only says which steps exist and which one the event is on.
 */
export type TournamentRoadmapStep = {
	/** Stable across renders: `round-2-game`, or `conclusion`. */
	id: string;
	/** The round this step belongs to; null for the conclusion. */
	round: number | null;
	phase: TournamentRoundPhase | 'conclusion';
};

export type TournamentRoadmap = {
	steps: TournamentRoadmapStep[];
	/** The step the event is on; -1 while it has not started. */
	currentIndex: number;
};

/**
 * The whole event as a sequence of steps: three phases per configured mission — one mission per
 * round, so the mission list is the round list — and the conclusion at the end. The roadmap is
 * derived, never stored, so it cannot drift from the rounds the tournament was configured with.
 */
export function tournamentRoadmap(state: TournamentState): TournamentRoadmap {
	const steps: TournamentRoadmapStep[] = [];
	state.missionIds.forEach((_, index) => {
		const round = index + 1;
		for (const phase of TOURNAMENT_ROUND_PHASES) {
			steps.push({ id: `round-${round}-${phase}`, round, phase });
		}
	});
	steps.push({ id: 'conclusion', round: null, phase: 'conclusion' });
	return { steps, currentIndex: roadmapIndexFor(state, steps.length) };
}

function roadmapIndexFor(state: TournamentState, stepCount: number): number {
	if (state.status === 'concluded') return stepCount - 1;
	const round = state.round;
	if (round === null) return -1;
	const phaseIndex = TOURNAMENT_ROUND_PHASES.indexOf(round.phase);
	const index = (round.number - 1) * TOURNAMENT_ROUND_PHASES.length + phaseIndex;
	return Math.min(Math.max(index, 0), stepCount - 1);
}

/** What the lobby shows for one seat: never the army code, so nobody imports nobody's list. */
export type TournamentSeatView = {
	organizer: boolean;
	name: string | null;
	army: { name: string; factionId: ArmyFactionId } | null;
	/** True for the viewer's own seat, so the lobby can mark "you". */
	you: boolean;
};

/** One row of the control panel's standing: a registered player and their victory points. */
export type TournamentStandingView = {
	seatIndex: number;
	name: string;
	victoryPoints: number;
};

/** The round being prepared, as the match-prep screen renders it. */
export type TournamentRoundView = {
	number: number;
	missionId: string;
	phase: TournamentRoundPhase;
	/** Occupants per table, in table order. */
	tables: TournamentOccupant[][];
	/** How many occupants one table takes — the pairing rule, so no client hardcodes it. */
	maxOccupants: number;
	/** Registered players (and the BYE when the field is odd) still waiting for a table. */
	pool: TournamentOccupant[];
	/** True when the pairing is complete — one half of the Start Round gate. */
	ready: boolean;
	/** True when the organizer may start this round: ready *and* still in setup. */
	canStartRound: boolean;
	/** The event's whole progression, and the step it is on. */
	roadmap: TournamentRoadmap;
	standings: TournamentStandingView[];
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
	/** Whether the organizer may start the event — computed here so no client re-derives a rule. */
	canStart: boolean;
	/** Whether the registered field is odd and the round therefore needs the BYE. */
	needsBye: boolean;
	round: TournamentRoundView | null;
};

function roundViewFor(state: TournamentState): TournamentRoundView | null {
	const round = state.round;
	if (round === null) return null;
	return {
		number: round.number,
		missionId: round.missionId,
		phase: round.phase,
		tables: round.tables.map((table) => [...table]),
		maxOccupants: MAX_TABLE_OCCUPANTS,
		pool: unassignedOccupants(state),
		ready: isRoundReady(state),
		canStartRound: canStartRound(state),
		roadmap: tournamentRoadmap(state),
		standings: registeredSeatIndexes(state).map((seatIndex) => ({
			seatIndex,
			name: state.seats[seatIndex].participant?.name ?? '',
			victoryPoints: round.victoryPoints[seatIndex] ?? 0
		}))
	};
}

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
		full: isTournamentFull(state),
		canStart: canStartTournament(state),
		needsBye: fieldNeedsBye(state),
		round: roundViewFor(state)
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
