import type { ArmyFactionId } from './army';
import type { OnlineGamePhase, OnlineGameStatus, RoundSnapshot } from './online';
import type { PickedArmy } from './savedArmy';
import type { PlayerKey } from './twoPlayer';

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

/**
 * What the BYE is worth. The organizer hands it out like any other occupant, and whoever takes it
 * sits the round out — but a sit-out that scored nothing would punish a player for the field's
 * shape, so the round awards them these points instead of a played game's.
 */
export const BYE_VICTORY_POINTS = 5;

/** How a table's match ended: a played game's score, or the round it never had to play. */
export type TournamentMatchResult =
	{ kind: 'played'; winner: PlayerKey | 'draw'; vp: RoundSnapshot } | { kind: 'bye' };

/**
 * One table's match in the round being played. `attempt` counts replays: a game the leader closed
 * instead of finishing is dead, and the table's next game gets a new one — which is also what
 * keeps the derived game id unique, so a replay never collides with the match it replaces.
 */
export type TournamentTableMatch = {
	attempt: number;
	/** Null while the match is still being played (or nobody has entered it yet). */
	result: TournamentMatchResult | null;
};

export type TournamentRound = {
	/** 1-based; round n plays `missionIds[n - 1]`. */
	number: number;
	missionId: string;
	phase: TournamentRoundPhase;
	/** One occupant list per configured table, in table order; at most two occupants each. */
	tables: TournamentOccupant[][];
	/**
	 * One match slot per table, parallel to `tables` and created with it — the pairing is locked
	 * for the whole round, so nothing can shift one against the other. Null until the table has
	 * something to say: a replayed attempt or a result.
	 */
	matches: (TournamentTableMatch | null)[];
	/**
	 * Victory points per seat index, as the control panel lists them. **Cumulative**: a round
	 * starts on the total the previous one ended with and adds every result it scores.
	 */
	victoryPoints: number[];
};

/** A round that concluded, kept for the report the retention window exists for. */
export type CompletedTournamentRound = {
	number: number;
	missionId: string;
	tables: TournamentOccupant[][];
	matches: (TournamentTableMatch | null)[];
	/** The cumulative totals as of this round's end. */
	victoryPoints: number[];
};

/**
 * An announcement the organizer shouted at the tables — the megaphone. `tableIndex` null means
 * every table at once; a message belongs to the round it was sent in, so a new round starts with
 * a quiet megaphone rather than inheriting the last one's leftovers.
 */
export type TournamentMessage = {
	id: string;
	tableIndex: number | null;
	round: number;
	text: string;
	sentAt: string;
	/** The seat indexes that opened it — the badge counts the ones that have not. */
	readBy: number[];
};

/** Enough announcements to read back through one round; the oldest go when the cap is reached. */
export const MAX_TOURNAMENT_MESSAGES = 30;
export const MAX_TOURNAMENT_MESSAGE_LENGTH = 240;

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
	/** Every round that concluded, oldest first. */
	completedRounds: CompletedTournamentRound[];
	/** The organizer's announcements, newest first. */
	messages: TournamentMessage[];
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
		completedRounds: state.completedRounds ?? [],
		messages: state.messages ?? [],
		round:
			round === null
				? null
				: {
						...round,
						phase: round.phase ?? 'setup',
						// A round stored before tables could play: no table has a match yet.
						matches: round.matches ?? round.tables.map(() => null)
					}
	};
}

type LegacyRound = Omit<TournamentRound, 'phase' | 'matches'> & {
	phase?: TournamentRoundPhase;
	matches?: (TournamentTableMatch | null)[];
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
		round: null,
		completedRounds: [],
		messages: [],
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
 * organizer's list and every table starts empty. The standing is cumulative, so a round after the
 * first carries the totals the previous one ended with rather than starting over.
 */
export function createTournamentRound(
	state: TournamentState,
	number: number,
	previous: TournamentRound | null = null
): TournamentRound {
	const missionId = state.missionIds[number - 1];
	if (!missionId) throw new Error(`No mission is configured for round ${number}`);
	return {
		number,
		missionId,
		phase: 'setup',
		tables: state.tableNames.map(() => []),
		matches: state.tableNames.map(() => null),
		victoryPoints: state.seats.map((_seat, index) => previous?.victoryPoints[index] ?? 0)
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

/**
 * Starts the round: the tables lock and the phase moves to `game`, where the players enter their
 * matches. A table the BYE sits at never plays one, so its result is settled here and now — its
 * player sits the round out and takes the BYE's points — which also keeps it from holding the
 * round open while every other table reports.
 */
export function startRound(state: TournamentState, now: string): TournamentState {
	if (!canStartRound(state)) throw new Error('This round cannot be started');
	const round = state.round as TournamentRound;
	const matches = round.tables.map((table, index) =>
		tablePlaysAGame(table) ? (round.matches[index] ?? null) : { attempt: 0, result: byeResult }
	);
	const awarded = byeSeats(round.tables);
	const victoryPoints = round.victoryPoints.map((total, seatIndex) =>
		awarded.includes(seatIndex) ? total + BYE_VICTORY_POINTS : total
	);
	return {
		...state,
		round: { ...round, phase: 'game', matches, victoryPoints },
		updatedAt: now
	};
}

const byeResult: TournamentMatchResult = { kind: 'bye' };

/**
 * Whether a table plays a match at all. A table holding the BYE does not, and neither does an
 * empty one — the start gate makes the second unreachable, but a table that cannot play must
 * never be the one holding a round open.
 */
export function tablePlaysAGame(table: TournamentOccupant[]): boolean {
	return table.length > 0 && table.every((occupant) => occupant.kind === 'seat');
}

/** The seats sitting out this round because the BYE landed at their table. */
export function byeSeats(tables: TournamentOccupant[][]): number[] {
	const seats: number[] = [];
	for (const table of tables) {
		if (table.length === 0 || !table.some((occupant) => occupant.kind === 'bye')) continue;
		for (const occupant of table) {
			if (occupant.kind === 'seat') seats.push(occupant.seatIndex);
		}
	}
	return seats;
}

/**
 * The seat indexes a table's occupants hold, in occupant order — which is exactly the online
 * game's `player1`/`player2` order, and therefore the only mapping a result needs to be filed
 * against the right player.
 */
export function seatsAtTable(table: TournamentOccupant[]): number[] {
	return table
		.map((occupant) => (occupant.kind === 'seat' ? occupant.seatIndex : -1))
		.filter((seatIndex) => seatIndex !== -1);
}

/**
 * The id of the online game a table plays. **Derived, never allocated**: two devices pressing
 * Enter Game at the same moment compute the same id, so the second insert meets a primary-key
 * conflict and joins the game the first one created instead of opening a rival table. The attempt
 * is what makes a replay a different game rather than a resurrection of the closed one.
 */
export function tournamentGameId(
	code: string,
	round: number,
	tableIndex: number,
	attempt: number
): string {
	return `${code}-R${round}T${tableIndex + 1}A${attempt}`;
}

/** The table a seat plays at in the round being played; null while it waits in the pool. */
export function tableForSeat(state: TournamentState, seatIndex: number): number | null {
	const round = state.round;
	if (round === null) return null;
	const index = round.tables.findIndex((table) =>
		table.some((occupant) => occupant.kind === 'seat' && occupant.seatIndex === seatIndex)
	);
	return index === -1 ? null : index;
}

/** Whether a table's match is over — the round cannot be scored before every one of them is. */
export function isTableScored(round: TournamentRound, tableIndex: number): boolean {
	const table = round.tables[tableIndex];
	if (!table) return true;
	return !tablePlaysAGame(table) || round.matches[tableIndex]?.result != null;
}

/**
 * Folds a finished game's score into the round: the table's result, its players' cumulative
 * victory points, and — once every table has reported — the phase move to `scoring`, which is
 * what tells the organizer the round is theirs to advance.
 *
 * Idempotent: a game reports once, but an auto-finished stale game and a leader's last click can
 * both arrive, and the second must not score the match twice.
 */
export function recordTableResult(
	state: TournamentState,
	tableIndex: number,
	result: Extract<TournamentMatchResult, { kind: 'played' }>,
	now: string
): TournamentState {
	if (state.status !== 'active' || state.round === null) {
		throw new Error('This tournament is not playing a round');
	}
	const round = state.round;
	if (round.phase !== 'game') throw new Error('This round is not being played');
	const table = round.tables[tableIndex];
	if (!table) throw new Error('Unknown table');
	const match = round.matches[tableIndex] ?? null;
	if (match?.result) return state;

	const scored: TournamentRound = {
		...round,
		matches: round.matches.map((current, index) =>
			index === tableIndex
				? { attempt: current?.attempt ?? 0, result: result as TournamentMatchResult }
				: current
		),
		victoryPoints: (() => {
			const seats = seatsAtTable(table);
			return round.victoryPoints.map((total, seatIndex) => {
				if (seatIndex === seats[0]) return total + result.vp.player1;
				if (seatIndex === seats[1]) return total + result.vp.player2;
				return total;
			});
		})()
	};
	const complete = scored.tables.every((_occupants, index) => isTableScored(scored, index));
	return {
		...state,
		round: { ...scored, phase: complete ? 'scoring' : 'game' },
		updatedAt: now
	};
}

/**
 * Abandons a table's dead game and opens a replay: the attempt moves on, so the table's next game
 * gets a fresh id and a fresh pair of tokens. The players press Enter Game again for it — there
 * is no organizer override, because a result nobody played would be a result nobody can trust.
 */
export function replayTable(
	state: TournamentState,
	tableIndex: number,
	now: string
): TournamentState {
	if (state.status !== 'active' || state.round?.phase !== 'game') {
		throw new Error('This round is not being played');
	}
	const round = state.round;
	const table = round.tables[tableIndex];
	if (!table || !tablePlaysAGame(table)) throw new Error('That table plays no game');
	const match = round.matches[tableIndex] ?? null;
	if (match?.result) throw new Error('That table has already reported');
	return {
		...state,
		round: {
			...round,
			matches: round.matches.map((current, index) =>
				index === tableIndex ? { attempt: (current?.attempt ?? 0) + 1, result: null } : current
			)
		},
		updatedAt: now
	};
}

/** True when the round's tables have all reported and the organizer may move the event on. */
export function isRoundScored(state: TournamentState): boolean {
	const round = state.round;
	if (round === null) return false;
	return round.tables.every((_occupants, index) => isTableScored(round, index));
}

/** There is a next round to open exactly while a mission is left for it. */
export function canAdvanceRound(state: TournamentState): boolean {
	return (
		state.status === 'active' &&
		state.round !== null &&
		state.round.phase === 'scoring' &&
		isRoundScored(state) &&
		state.round.number < state.missionIds.length
	);
}

/** The last round's scoring is where the event ends: no mission is left to open. */
export function canConcludeTournament(state: TournamentState): boolean {
	return (
		state.status === 'active' &&
		state.round !== null &&
		state.round.phase === 'scoring' &&
		isRoundScored(state) &&
		state.round.number >= state.missionIds.length
	);
}

function completedRoundOf(round: TournamentRound): CompletedTournamentRound {
	return {
		number: round.number,
		missionId: round.missionId,
		tables: round.tables.map((table) => [...table]),
		matches: round.matches.map((match) => (match ? { ...match } : null)),
		victoryPoints: [...round.victoryPoints]
	};
}

/**
 * Opens the next round on the next mission, carrying the cumulative standing forward. The tables
 * empty out — every round is paired again, by hand or by a Swiss rule that does not exist yet.
 */
export function advanceRound(state: TournamentState, now: string): TournamentState {
	if (!canAdvanceRound(state)) throw new Error('This round cannot be advanced');
	const round = state.round as TournamentRound;
	return {
		...state,
		completedRounds: [...state.completedRounds, completedRoundOf(round)],
		round: createTournamentRound(state, round.number + 1, round),
		updatedAt: now
	};
}

/**
 * Ends the event: the last round joins the archive, the standings freeze and every device moves
 * to the conclusion screen. The rows live on for the 48-hour report window retention promises.
 */
export function concludeTournament(state: TournamentState, now: string): TournamentState {
	if (!canConcludeTournament(state)) throw new Error('This tournament cannot be concluded');
	const round = state.round as TournamentRound;
	return {
		...state,
		status: 'concluded',
		completedRounds: [...state.completedRounds, completedRoundOf(round)],
		round: null,
		concludedAt: now,
		updatedAt: now
	};
}

/**
 * The event's running totals: the live round's, or the last archived round's once the event
 * concluded and dropped it.
 */
export function cumulativeVictoryPoints(state: TournamentState): number[] {
	if (state.round !== null) return state.round.victoryPoints;
	const last = state.completedRounds[state.completedRounds.length - 1];
	return state.seats.map((_seat, index) => last?.victoryPoints[index] ?? 0);
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

// --- the organizer's megaphone ---

/** A message the organizer may send: which table it is for (null = all of them) and what it says. */
export type TournamentMessageDraft = { id: string; tableIndex: number | null; text: string };

/**
 * Announcements belong to a running event — a lobby has no tables to shout at and a concluded one
 * has nothing left to say.
 */
export function canSendTournamentMessage(state: TournamentState): boolean {
	return state.status === 'active' && state.round !== null;
}

export function sendTournamentMessage(
	state: TournamentState,
	draft: TournamentMessageDraft,
	now: string
): TournamentState {
	if (!canSendTournamentMessage(state)) throw new Error('This tournament is not running');
	const round = state.round as TournamentRound;
	const text = draft.text.trim();
	if (text === '' || text.length > MAX_TOURNAMENT_MESSAGE_LENGTH) {
		throw new Error('Invalid message');
	}
	if (draft.tableIndex !== null) {
		if (
			!Number.isInteger(draft.tableIndex) ||
			draft.tableIndex < 0 ||
			draft.tableIndex >= round.tables.length
		) {
			throw new Error('Unknown table');
		}
	}
	const message: TournamentMessage = {
		id: draft.id,
		tableIndex: draft.tableIndex,
		round: round.number,
		text,
		sentAt: now,
		readBy: []
	};
	return {
		...state,
		messages: [message, ...state.messages].slice(0, MAX_TOURNAMENT_MESSAGES),
		updatedAt: now
	};
}

/**
 * The announcements a seat can see: this round's, addressed to its own table or to every table.
 * Newest first, which is the order the inbox renders and the order a badge counts.
 */
export function messagesForSeat(state: TournamentState, seatIndex: number): TournamentMessage[] {
	const round = state.round?.number ?? null;
	const tableIndex = tableForSeat(state, seatIndex);
	return state.messages.filter(
		(message) =>
			message.round === round && (message.tableIndex === null || message.tableIndex === tableIndex)
	);
}

export function unreadMessageCount(state: TournamentState, seatIndex: number): number {
	return messagesForSeat(state, seatIndex).filter((message) => !message.readBy.includes(seatIndex))
		.length;
}

/**
 * Opens the inbox: every message this seat can see counts as read, so the megaphone stops glowing.
 * Reading is per seat, not per device — one token holds one seat, so the two are the same thing.
 */
export function markMessagesRead(
	state: TournamentState,
	seatIndex: number,
	now: string
): TournamentState {
	const unread = messagesForSeat(state, seatIndex).filter(
		(message) => !message.readBy.includes(seatIndex)
	);
	if (unread.length === 0) return state;
	const ids = new Set(unread.map((message) => message.id));
	return {
		...state,
		messages: state.messages.map((message) =>
			ids.has(message.id) ? { ...message, readBy: [...message.readBy, seatIndex] } : message
		),
		updatedAt: now
	};
}

// --- standings ---

/** One row of the event's standing: a registered player, their total and the place it earned. */
export type TournamentStandingView = {
	seatIndex: number;
	name: string;
	victoryPoints: number;
	/** Competition ranking: equal totals share the higher place, and the next one skips the tie. */
	place: number;
};

/**
 * The whole field ranked by cumulative victory points. The BYE is not a player and an empty seat
 * never registered, so neither appears — the conclusion screen lists exactly who played.
 */
export function tournamentStandings(state: TournamentState): TournamentStandingView[] {
	const totals = cumulativeVictoryPoints(state);
	const ranked = registeredSeatIndexes(state)
		.map((seatIndex) => ({
			seatIndex,
			name: state.seats[seatIndex].participant?.name ?? '',
			victoryPoints: totals[seatIndex] ?? 0,
			place: 0
		}))
		// Ties break on seat order, so the ranking is stable rather than following storage order.
		.sort((a, b) => b.victoryPoints - a.victoryPoints || a.seatIndex - b.seatIndex);
	let place = 0;
	let previous: number | null = null;
	for (const [index, row] of ranked.entries()) {
		if (previous === null || row.victoryPoints !== previous) place = index + 1;
		row.place = place;
		previous = row.victoryPoints;
	}
	return ranked;
}

/** What the lobby shows for one seat: never the army code, so nobody imports nobody's list. */
export type TournamentSeatView = {
	organizer: boolean;
	name: string | null;
	army: { name: string; factionId: ArmyFactionId } | null;
	/** True for the viewer's own seat, so the lobby can mark "you". */
	you: boolean;
};

/**
 * One table as the round screen renders it while the round runs: the game it plays, what state
 * that game is in, and what it scored. The game id is derived, so it is known before anybody has
 * entered — which is what lets the panel offer the same match to both of its players.
 */
export type TournamentTableMatchView = {
	gameId: string;
	/**
	 * The live status of that game, null while no such game exists. The domain cannot read the
	 * games table, so the server supplies it; without it a panel says "not entered yet".
	 */
	status: OnlineGameStatus | null;
	phase: OnlineGamePhase | null;
	result: TournamentMatchResult | null;
	/** Final victory points per seated player, in occupant order; empty until there is a result. */
	scores: { seatIndex: number; vp: number }[];
};

export type TournamentTableView = {
	occupants: TournamentOccupant[];
	/** Whether this table plays a match at all — the BYE's table does not. */
	plays: boolean;
	match: TournamentTableMatchView;
};

/** The round being prepared, as the match-prep screen renders it. */
export type TournamentRoundView = {
	number: number;
	missionId: string;
	phase: TournamentRoundPhase;
	/** One entry per configured table, in table order. */
	tables: TournamentTableView[];
	/** How many occupants one table takes — the pairing rule, so no client hardcodes it. */
	maxOccupants: number;
	/** Registered players (and the BYE when the field is odd) still waiting for a table. */
	pool: TournamentOccupant[];
	/** True when the pairing is complete — one half of the Start Round gate. */
	ready: boolean;
	/** True when the organizer may start this round: ready *and* still in setup. */
	canStartRound: boolean;
	/** True when every table has reported — the round is over and waits on the organizer. */
	scored: boolean;
	/** Whether a next mission exists to open; the organizer's button reads differently without one. */
	hasNextRound: boolean;
	/** The event's whole progression, and the step it is on. */
	roadmap: TournamentRoadmap;
	/** The control panel's rows: every registered player, in seat order. */
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
	/** The table this viewer plays at in the round being played; null when they are not paired. */
	tableIndex: number | null;
	/** The organizer's announcements this viewer may see, newest first. Empty for the organizer. */
	messages: TournamentMessageView[];
	/** How many of them are unread — the megaphone glows while this is above zero. */
	unreadMessages: number;
	round: TournamentRoundView | null;
	/** The event's ranked standing: the conclusion screen's table, and the place a seat holds. */
	standings: TournamentStandingView[];
	/** How many rounds have been played and archived — the conclusion screen's "after n rounds". */
	roundsPlayed: number;
};

/** One announcement as its recipient's inbox shows it. */
export type TournamentMessageView = {
	id: string;
	/** Null for a shout at every table. */
	tableIndex: number | null;
	round: number;
	text: string;
	sentAt: string;
	read: boolean;
};

/**
 * The live half of a table's match — what the domain cannot know, because the game lives in its
 * own table. The server reads it per fetch and hands it in, keyed by game id.
 */
export type TournamentGameSnapshot = {
	status: OnlineGameStatus;
	phase: OnlineGamePhase;
};

/** The victory points a table's result awards, per seated player, in occupant order. */
function tableScores(
	table: TournamentOccupant[],
	result: TournamentMatchResult | null
): { seatIndex: number; vp: number }[] {
	if (result === null) return [];
	const seats = seatsAtTable(table);
	if (result.kind === 'bye') {
		return seats.map((seatIndex) => ({ seatIndex, vp: BYE_VICTORY_POINTS }));
	}
	return [
		{ seatIndex: seats[0], vp: result.vp.player1 },
		{ seatIndex: seats[1], vp: result.vp.player2 }
	].filter((score) => score.seatIndex !== undefined);
}

function roundViewFor(
	state: TournamentState,
	games: Record<string, TournamentGameSnapshot>
): TournamentRoundView | null {
	const round = state.round;
	if (round === null) return null;
	const places = new Map(tournamentStandings(state).map((row) => [row.seatIndex, row.place]));
	return {
		number: round.number,
		missionId: round.missionId,
		phase: round.phase,
		tables: round.tables.map((occupants, index) => {
			const match = round.matches[index] ?? null;
			const attempt = match?.attempt ?? 0;
			const gameId = tournamentGameId(state.code, round.number, index, attempt);
			const snapshot = games[gameId] ?? null;
			return {
				occupants: [...occupants],
				plays: tablePlaysAGame(occupants),
				match: {
					gameId,
					status: snapshot?.status ?? null,
					phase: snapshot?.phase ?? null,
					result: match?.result ?? null,
					scores: tableScores(occupants, match?.result ?? null)
				}
			};
		}),
		maxOccupants: MAX_TABLE_OCCUPANTS,
		pool: unassignedOccupants(state),
		ready: isRoundReady(state),
		canStartRound: canStartRound(state),
		scored: isRoundScored(state),
		hasNextRound: round.number < state.missionIds.length,
		roadmap: tournamentRoadmap(state),
		standings: registeredSeatIndexes(state).map((seatIndex) => ({
			seatIndex,
			name: state.seats[seatIndex].participant?.name ?? '',
			victoryPoints: round.victoryPoints[seatIndex] ?? 0,
			place: places.get(seatIndex) ?? 0
		}))
	};
}

/**
 * The visibility-filtered view one authenticated viewer gets. The organizer authenticates with
 * their own token; a player with theirs. Everything in the lobby is shared by design — names,
 * missions, tables — the only secrets are the seat tokens and the army codes, and neither
 * leaves the server.
 *
 * `games` is the server's read of the round's live matches; the domain cannot reach the games
 * table, so a caller that omits it gets panels that simply have not been entered yet.
 */
export function viewForTournamentToken(
	state: TournamentState,
	tokenHash: string,
	games: Record<string, TournamentGameSnapshot> = {}
): TournamentEventView | null {
	const isOrganizer = tokenHash === state.organizerTokenHash;
	const seatIndex = seatIndexForTokenHash(state, tokenHash);
	if (!isOrganizer && seatIndex === null) return null;
	// The organizer is the sender, so their megaphone has no inbox — a playing organizer's own
	// seat gets nothing back either, since they cannot shout at themselves.
	const inbox = !isOrganizer && seatIndex !== null ? messagesForSeat(state, seatIndex) : [];
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
		tableIndex: seatIndex === null ? null : tableForSeat(state, seatIndex),
		messages: inbox.map((message) => ({
			id: message.id,
			tableIndex: message.tableIndex,
			round: message.round,
			text: message.text,
			sentAt: message.sentAt,
			read: seatIndex !== null && message.readBy.includes(seatIndex)
		})),
		unreadMessages: inbox.filter(
			(message) => seatIndex !== null && !message.readBy.includes(seatIndex)
		).length,
		round: roundViewFor(state, games),
		standings: tournamentStandings(state),
		roundsPlayed: state.completedRounds.length
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
