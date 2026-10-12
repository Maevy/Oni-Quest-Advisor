import {
	BYE_VICTORY_POINTS,
	tournamentGameId,
	type CompletedTournamentRound,
	type TournamentMatchResult,
	type TournamentState
} from './tournamentEvent';
import type { HistoryEntry } from './vitalityHistory';
import { sortStats, type BattleReportStat } from './battleReport';
import {
	drawHeading,
	drawReportFooters,
	drawStatTable,
	drawText,
	ensureSpace,
	newReportLayout,
	putOp,
	REPORT_ACCENT,
	REPORT_CONTENT_WIDTH,
	REPORT_MARGIN,
	REPORT_MUTED,
	REPORT_PAGE_HEIGHT,
	REPORT_PAGE_WIDTH
} from './reportLayout';
import { renderPdf } from './pdf';

/**
 * The tournament report: the event's own page (name, organizer, external link, dates), the field
 * and its armies, the missions played, every match grouped by round with what it scored, and the
 * conclusion - which models dealt the most damage and healing across the whole event. Like the
 * battle report it is built on the organizer's device and never persisted anywhere.
 */

// --- the data the report endpoint hands the organizer's device ---

export type TournamentReportOccupant =
	{ kind: 'seat'; seatIndex: number; nickname: string } | { kind: 'bye' };

export type TournamentReportTable = {
	tableIndex: number;
	tableName: string | null;
	occupants: TournamentReportOccupant[];
	result: TournamentMatchResult | null;
};

export type TournamentReportRound = {
	number: number;
	missionId: string;
	tables: TournamentReportTable[];
	/** The cumulative totals at this round's end, per seat index. */
	victoryPoints: number[];
};

export type TournamentReportMatchLog = {
	round: number;
	tableIndex: number;
	gameId: string;
	history: HistoryEntry[];
};

/** What `GET /api/tournaments/[id]/report` returns; assembled here, fetched there. */
export type TournamentReportData = {
	createdAt: string | null;
	concludedAt: string | null;
	rounds: TournamentReportRound[];
	matchLogs: TournamentReportMatchLog[];
};

function occupantName(
	state: TournamentState,
	occupant: { kind: 'seat'; seatIndex: number }
): string {
	return state.seats[occupant.seatIndex]?.participant?.name ?? `Seat ${occupant.seatIndex + 1}`;
}

/** The archived rounds as report rows: occupants resolved to names, results carried along. */
export function tournamentReportRounds(state: TournamentState): TournamentReportRound[] {
	return state.completedRounds.map((round: CompletedTournamentRound) => ({
		number: round.number,
		missionId: round.missionId,
		victoryPoints: round.victoryPoints,
		tables: round.tables.map((occupants, tableIndex) => ({
			tableIndex,
			tableName: state.tableNames[tableIndex] ?? null,
			occupants: occupants.map((occupant) =>
				occupant.kind === 'bye'
					? { kind: 'bye' as const }
					: {
							kind: 'seat' as const,
							seatIndex: occupant.seatIndex,
							nickname: occupantName(state, occupant)
						}
			),
			result: round.matches[tableIndex]?.result ?? null
		}))
	}));
}

/**
 * The derived game ids of every played match, so the endpoint can fetch each one's interaction
 * log. A BYE has no game, and a table whose match never produced a result still gets its latest
 * attempt listed - its log is whatever was recorded before it closed.
 */
export function tournamentReportGameIds(
	state: TournamentState
): Array<{ round: number; tableIndex: number; gameId: string }> {
	const ids: Array<{ round: number; tableIndex: number; gameId: string }> = [];
	for (const round of state.completedRounds) {
		round.tables.forEach((_occupants, tableIndex) => {
			const match = round.matches[tableIndex];
			if (!match || match.result?.kind === 'bye') return;
			ids.push({
				round: round.number,
				tableIndex,
				gameId: tournamentGameId(state.code, round.number, tableIndex, match.attempt)
			});
		});
	}
	return ids;
}

// --- the cross-event statistics ---

export type TournamentReportMatch = {
	round: number;
	tableIndex: number;
	/**
	 * The table's occupants in game-seat order: the occupant order IS the game's player1/player2
	 * order, which is what ties a log entry's actor back to a person.
	 */
	players: { player1: string; player2: string };
	history: HistoryEntry[];
};

/** Joins each fetched log back to its table's occupants. */
export function tournamentReportMatches(
	rounds: TournamentReportRound[],
	logs: TournamentReportMatchLog[]
): TournamentReportMatch[] {
	const matches: TournamentReportMatch[] = [];
	for (const log of logs) {
		const round = rounds.find((candidate) => candidate.number === log.round);
		const table = round?.tables.find((candidate) => candidate.tableIndex === log.tableIndex);
		const seats = (table?.occupants ?? []).filter(
			(occupant): occupant is { kind: 'seat'; seatIndex: number; nickname: string } =>
				occupant.kind === 'seat'
		);
		matches.push({
			round: log.round,
			tableIndex: log.tableIndex,
			players: {
				player1: seats[0]?.nickname ?? 'Player 1',
				player2: seats[1]?.nickname ?? 'Player 2'
			},
			history: log.history
		});
	}
	return matches;
}

/**
 * Damage and healing per model across every match of the event, highest first. A model name on
 * its own would merge two players' Chiyohimes into one statistic, so each row carries its owner;
 * self-recorded hits have no origin model and tally under the person who recorded them.
 */
export function tournamentReportStats(matches: TournamentReportMatch[]): {
	damage: BattleReportStat[];
	healing: BattleReportStat[];
} {
	const damage = new Map<string, number>();
	const healing = new Map<string, number>();
	for (const match of matches) {
		for (const entry of match.history) {
			if (entry.kind !== 'action' || entry.undoneBy !== null) continue;
			if (entry.action.kind !== 'damage' && entry.action.kind !== 'heal') continue;
			const owner = match.players[entry.actor];
			const key = entry.originName ? `${entry.originName} (${owner})` : `${owner} (unattributed)`;
			const totals = entry.action.kind === 'damage' ? damage : healing;
			totals.set(key, (totals.get(key) ?? 0) + entry.action.amount);
		}
	}
	return { damage: sortStats(damage), healing: sortStats(healing) };
}

/** One table's match as the rounds section prints it. */
export function tournamentTableLine(table: TournamentReportTable): string {
	const names = table.occupants.map((occupant) =>
		occupant.kind === 'bye' ? 'BYE' : occupant.nickname
	);
	const label = table.tableName ?? `Table ${table.tableIndex + 1}`;
	if (!table.result) return `${label}: ${names.join(' vs ')} - no result recorded`;
	if (table.result.kind === 'bye')
		return `${label}: ${names[0]} takes the BYE (+${BYE_VICTORY_POINTS} VP)`;
	const { vp, winner } = table.result;
	const outcome =
		winner === 'draw'
			? 'draw'
			: `win ${winner === 'player1' ? (names[0] ?? 'player 1') : (names[1] ?? 'player 2')}`;
	return `${label}: ${names[0] ?? '?'} ${vp.player1} : ${vp.player2} ${names[1] ?? '?'} - ${outcome}`;
}

// --- the PDF ---

export type TournamentReportInput = {
	name: string;
	code: string;
	organizerName: string;
	externalLink: string | null;
	createdAt: string | null;
	concludedAt: string | null;
	missions: Array<{ round: number; title: string }>;
	/** The field as the final standing ranks it. */
	armies: Array<{
		place: number;
		nickname: string;
		armyName: string;
		factionName: string;
		organizer: boolean;
		victoryPoints: number;
	}>;
	tableNames: string[];
	rounds: Array<{ number: number; missionTitle: string; tables: string[] }>;
	damage: BattleReportStat[];
	healing: BattleReportStat[];
};

function formatStamp(stamp: string | null): string {
	if (!stamp) return 'unknown';
	return `${stamp.slice(0, 10)} ${stamp.slice(11, 16)} UTC`;
}

/** The whole tournament report, as PDF bytes. */
export function buildTournamentReportPdf(input: TournamentReportInput): Uint8Array {
	const layout = newReportLayout();

	// --- the tournament page ---
	putOp(layout, {
		kind: 'text',
		x: REPORT_MARGIN,
		y: 40,
		text: 'ONI QUEST - TOURNAMENT REPORT',
		font: 'helvetica-bold',
		size: 17,
		color: REPORT_ACCENT
	});
	putOp(layout, {
		kind: 'line',
		x1: REPORT_MARGIN,
		y1: 48,
		x2: REPORT_MARGIN + REPORT_CONTENT_WIDTH,
		y2: 48,
		width: 1.2,
		color: REPORT_ACCENT
	});
	drawText(layout, input.name, { font: 'helvetica-bold', size: 14 });
	drawText(layout, `Event code ${input.code}`, { size: 9, color: REPORT_MUTED });
	layout.y += 4;
	drawText(layout, `Tournament Organizer: ${input.organizerName}`, { size: 10 });
	if (input.externalLink) drawText(layout, `Event page: ${input.externalLink}`, { size: 10 });
	drawText(
		layout,
		`Created ${formatStamp(input.createdAt)}   -   Concluded ${formatStamp(input.concludedAt)}`,
		{ size: 9, color: REPORT_MUTED }
	);
	drawText(
		layout,
		`${input.armies.length} player${input.armies.length === 1 ? '' : 's'} at ${input.tableNames.length} table${input.tableNames.length === 1 ? '' : 's'}`,
		{ size: 9, color: REPORT_MUTED }
	);

	// --- missions ---
	drawHeading(layout, 'Missions played');
	if (input.missions.length === 0)
		drawText(layout, 'No mission was played.', { color: REPORT_MUTED });
	for (const mission of input.missions)
		drawText(layout, `Round ${mission.round} - ${mission.title}`, { indent: 6 });

	// --- armies and final standing ---
	drawHeading(layout, 'Roster armies and final standing');
	if (input.armies.length === 0)
		drawText(layout, 'Nobody played this tournament.', { color: REPORT_MUTED });
	for (const row of input.armies) {
		ensureSpace(layout, 24);
		drawText(
			layout,
			`${row.place}. ${row.nickname}${row.organizer ? ' (organizer)' : ''} - ${row.victoryPoints} VP`,
			{ font: 'helvetica-bold', size: 10 }
		);
		drawText(layout, `"${row.armyName}" - ${row.factionName}`, {
			indent: 14,
			size: 9,
			color: REPORT_MUTED
		});
	}

	// --- matches, grouped by round ---
	drawHeading(layout, 'Matches by round');
	for (const round of input.rounds) {
		ensureSpace(layout, 32);
		drawText(layout, `Round ${round.number} - ${round.missionTitle}`, {
			font: 'helvetica-bold',
			size: 10
		});
		if (round.tables.length === 0)
			drawText(layout, 'No table was paired in this round.', { indent: 10, color: REPORT_MUTED });
		for (const line of round.tables) drawText(layout, line, { indent: 10 });
		layout.y += 4;
	}

	// --- conclusion ---
	drawStatTable(
		layout,
		'Conclusion: most damage by model',
		input.damage,
		'damage',
		'No damage was recorded in any match.'
	);
	drawStatTable(
		layout,
		'Conclusion: most healing by model',
		input.healing,
		'Life',
		'No healing was recorded in any match.'
	);

	drawReportFooters(layout);
	return renderPdf({
		width: REPORT_PAGE_WIDTH,
		height: REPORT_PAGE_HEIGHT,
		title: `Oni Quest tournament report ${input.code}`,
		pages: layout.pages
	});
}
