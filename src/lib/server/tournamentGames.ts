import { LibsqlError } from '@libsql/client';
import {
	createTournamentGame,
	onlineGameTournament,
	recordTableResult,
	replayTable,
	reseatToken,
	seatsAtTable,
	tableForSeat,
	tablePlaysAGame,
	tournamentGameId,
	type OnlineGameState,
	type PlayerKey,
	type TournamentGameSeat,
	type TournamentGameSnapshot,
	type TournamentState
} from '$lib/domain';
import { findMission } from './content';
import { ApiError } from './errors';
import { getGame, getGameStatuses, insertGame, mutateOpen } from './gameRepository';
import { generateSeatToken, hashToken } from './ids';
import { notifyGameChanged, notifyTournamentChanged } from './sse';
import { mutateOpenTournament } from './tournamentRepository';

/** What a player's device needs to sit down at their table's game. */
export type TableGameSession = { gameId: string; seat: PlayerKey; token: string };

/** Thrown inside a mutation to roll it back because there was nothing to record. */
class NothingToRecord extends Error {}

/**
 * Seats a tournament player at the match their table plays, creating that match the first time
 * anybody asks for it and handing the caller a fresh seat token every time.
 *
 * Two things make this safe to press twice, from two devices, at the same moment:
 *
 * - **The game id is derived** (`tournamentGameId`), so both callers aim at the same row; the
 *   loser of the insert meets a primary-key conflict and simply joins the winner's game instead
 *   of opening a rival one.
 * - **The caller's own seat token is always re-minted**, so a device that lost its session gets
 *   back in with its tournament token alone. The old token dies — one token holds one seat.
 *
 * The pairing is already decided, which is why the game is born with both seats filled: there is
 * no join request to approve and no invite code to share.
 */
export async function enterTableGame(
	tournament: TournamentState,
	seatIndex: number,
	tableIndex: number
): Promise<TableGameSession> {
	const round = tournament.round;
	if (tournament.status !== 'active' || round === null || round.phase !== 'game') {
		throw new ApiError(409, 'This round is not being played');
	}
	if (tableForSeat(tournament, seatIndex) !== tableIndex) {
		throw new ApiError(403, 'You do not play at that table');
	}
	const table = round.tables[tableIndex];
	if (!table || !tablePlaysAGame(table)) throw new ApiError(409, 'That table plays no game');
	if (round.matches[tableIndex]?.result) {
		throw new ApiError(409, 'That table has already reported its result');
	}
	const mission = findMission(round.missionId);
	if (!mission) throw new ApiError(500, 'This round plays a mission that does not exist');

	const attempt = round.matches[tableIndex]?.attempt ?? 0;
	const gameId = tournamentGameId(tournament.code, round.number, tableIndex, attempt);

	// A closed game is a dead table: its players abandoned it, so the match is replayed from the
	// top with a fresh id rather than resumed. Bumped through the tournament's own queue, so two
	// devices pressing at once cannot skip an attempt between them.
	const dead = await getGame(gameId);
	if (dead !== null && dead.status === 'closed') {
		const replayed = await replay(tournament.code, tableIndex);
		return enterTableGame(replayed, seatIndex, tableIndex);
	}

	const seats = seatsAtTable(table);
	const seat: PlayerKey = seats[0] === seatIndex ? 'player1' : 'player2';
	const token = generateSeatToken();
	const now = new Date().toISOString();
	let created = false;

	if (dead === null) {
		const occupant = (index: number, mine: boolean): TournamentGameSeat => {
			const participant = tournament.seats[seats[index]].participant;
			if (!participant) throw new ApiError(409, 'That table holds an empty seat');
			return {
				nickname: participant.name,
				// The hash for the other seat is a placeholder until that player enters and
				// takes it over — nothing authenticates with it in the meantime.
				tokenHash: mine ? hashToken(token) : hashToken(generateSeatToken()),
				army: participant.army
			};
		};
		const state = createTournamentGame(
			gameId,
			now,
			{ season: mission.season, missionId: mission.id },
			{ code: tournament.code, round: round.number, tableIndex },
			[occupant(0, seat === 'player1'), occupant(1, seat === 'player2')]
		);
		try {
			await insertGame(state, {
				type: 'game-created',
				actor: 'server',
				payload: {
					tournament: tournament.code,
					round: round.number,
					tableIndex,
					missionId: mission.id
				}
			});
			created = true;
			notifyGameChanged(gameId, 'game-created');
		} catch (error) {
			const isCollision =
				error instanceof LibsqlError && error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
			// The other player at this table got here first: their game is the table's game, and
			// the seat hash in it is a placeholder this caller has to take over below.
			if (!isCollision) throw error;
		}
	}

	if (!created) {
		// Authorized by the tournament token the route already checked, not by a game seat token
		// this device may no longer hold — which is the whole point of the recovery.
		await mutateOpen(gameId, (game) => ({
			next: reseatToken(game, seat, hashToken(token)),
			events: { type: 'seat-reseated', actor: 'server', payload: { seat } }
		}));
	}
	return { gameId, seat, token };
}

/** Bumps a dead table's attempt and hands back the tournament as the replay sees it. */
async function replay(code: string, tableIndex: number): Promise<TournamentState> {
	let replayed: TournamentState | null = null;
	await mutateOpenTournament(code, (tournament) => {
		const next = replayTable(tournament, tableIndex, new Date().toISOString());
		replayed = next;
		return {
			next,
			events: { type: 'table-replayed', actor: 'server', payload: { tableIndex } }
		};
	});
	if (replayed === null) throw new ApiError(500, 'Could not replay this table');
	notifyTournamentChanged(code, 'table-replayed');
	return replayed;
}

/**
 * The live status of every game the round's tables play, keyed by the derived game id — the half
 * of a table panel the domain cannot know. Read per view fetch, so a board always says what the
 * matches are doing now rather than what they were doing when the last notification arrived.
 */
export async function tableGameSnapshots(
	tournament: TournamentState
): Promise<Record<string, TournamentGameSnapshot>> {
	const round = tournament.round;
	if (round === null) return {};
	return getGameStatuses(
		round.tables.map((_occupants, index) =>
			tournamentGameId(tournament.code, round.number, index, round.matches[index]?.attempt ?? 0)
		)
	);
}

/**
 * Feeds a finished game's score back into the round that owns it — the only path victory points
 * have from a table into the standing. Called once the game's own mutation has committed, from
 * the advance-phase handler and from retention's auto-finish alike.
 *
 * Never throws: the game is finished either way, and failing the player's last click over
 * bookkeeping the tournament may not even want any more (a cancelled event, a round the organizer
 * already moved on from) would strand them on a scoreboard that is already correct.
 */
export async function reportFinishedGame(game: OnlineGameState): Promise<void> {
	const ref = onlineGameTournament(game);
	const summary = game.resultSummary;
	if (ref === null || game.status !== 'finished' || summary === null) return;
	try {
		await mutateOpenTournament(ref.code, (tournament) => {
			const next = recordTableResult(
				tournament,
				ref.tableIndex,
				{ kind: 'played', winner: summary.winner, vp: summary.finalVp },
				new Date().toISOString()
			);
			// Already scored — a duplicate report must not add the same points twice.
			if (next === tournament) throw new NothingToRecord();
			return {
				next,
				events: {
					type: 'table-finished',
					actor: 'server',
					payload: {
						round: ref.round,
						tableIndex: ref.tableIndex,
						winner: summary.winner,
						finalVp1: summary.finalVp.player1,
						finalVp2: summary.finalVp.player2,
						phase: next.round?.phase
					}
				}
			};
		});
		notifyTournamentChanged(ref.code, 'table-finished');
	} catch (error) {
		if (error instanceof NothingToRecord) return;
		console.error(`Could not report game ${game.id} to its tournament`, error);
	}
}

/**
 * Tells the tables' board that one of its matches died. Nothing is written — the closed game
 * already says so — but the organizer's screen reads each table's live status when it refetches,
 * and without a nudge it would keep showing a match nobody can finish.
 */
export async function reportClosedGame(game: OnlineGameState): Promise<void> {
	const ref = onlineGameTournament(game);
	if (ref === null) return;
	notifyTournamentChanged(ref.code, 'table-abandoned');
}
