import { describe, expect, it } from 'vitest';
import {
	buildTournamentReportPdf,
	tournamentReportGameIds,
	tournamentReportMatches,
	tournamentReportRounds,
	tournamentReportStats,
	tournamentTableLine,
	type TournamentReportMatchLog
} from './tournamentReport';
import type { TournamentState } from './tournamentEvent';
import type { HistoryAction, HistoryRevert } from './vitalityHistory';
import type { PickedArmy } from './savedArmy';

const ARMY = (name: string): PickedArmy => ({
	name,
	factionId: 'helian-league',
	code: `S1${name.length}X`,
	format: 'standard'
});

function eventState(): TournamentState {
	return {
		code: 'CUP001',
		status: 'concluded',
		name: 'API Cup',
		externalLink: 'https://example.org/cup',
		organizerName: 'Marta',
		organizerTokenHash: 'hash',
		manualPairing: true,
		missionIds: ['treasure-hunt', 'quarter-war'],
		tableNames: ['Table 1', 'Table 2'],
		seats: [
			{ organizer: false, participant: { name: 'Ada', army: ARMY('Ada'), tokenHash: 'a' } },
			{ organizer: false, participant: { name: 'Bo', army: ARMY('Bo'), tokenHash: 'b' } },
			{ organizer: false, participant: { name: 'Cy', army: ARMY('Cy'), tokenHash: 'c' } },
			{ organizer: true, participant: { name: 'Marta', army: ARMY('Marta'), tokenHash: 'd' } }
		],
		round: null,
		completedRounds: [
			{
				number: 1,
				missionId: 'treasure-hunt',
				tables: [
					[
						{ kind: 'seat', seatIndex: 0 },
						{ kind: 'seat', seatIndex: 1 }
					],
					[{ kind: 'seat', seatIndex: 2 }, { kind: 'bye' }]
				],
				matches: [
					{
						attempt: 0,
						result: { kind: 'played', winner: 'player1', vp: { player1: 6, player2: 4 } }
					},
					{ attempt: 0, result: { kind: 'bye' } }
				],
				victoryPoints: [6, 4, 5, 0]
			},
			{
				number: 2,
				missionId: 'quarter-war',
				tables: [
					[
						{ kind: 'seat', seatIndex: 0 },
						{ kind: 'seat', seatIndex: 2 }
					],
					[
						{ kind: 'seat', seatIndex: 1 },
						{ kind: 'seat', seatIndex: 3 }
					]
				],
				// Table 1 was replayed once: the attempt bump gives the replay its own game id.
				matches: [
					{
						attempt: 1,
						result: { kind: 'played', winner: 'draw', vp: { player1: 5, player2: 5 } }
					},
					{ attempt: 0, result: null }
				],
				victoryPoints: [11, 4, 10, 0]
			}
		],
		messages: [],
		createdAt: '2026-10-12T09:00:00.000Z',
		updatedAt: '2026-10-12T17:00:00.000Z',
		concludedAt: '2026-10-12T17:00:00.000Z'
	};
}

let seq = 0;
function log(
	actor: 'player1' | 'player2',
	originName: string | null,
	amount: number,
	kind: 'damage' | 'heal' = 'damage'
): HistoryAction {
	seq += 1;
	return {
		kind: 'action',
		seq,
		round: 1,
		actor,
		at: '2026-10-12T10:00:00.000Z',
		targetSeat: actor === 'player1' ? 'player2' : 'player1',
		targetEntryId: `t${seq}`,
		targetName: 'Target',
		targetCopy: null,
		originEntryId: originName ? `o${seq}` : null,
		originName,
		action: { kind, amount },
		undoneBy: null
	};
}
function revertOf(entry: HistoryAction): HistoryRevert {
	seq += 1;
	return {
		kind: 'revert',
		seq,
		round: 1,
		actor: entry.actor,
		at: '2026-10-12T10:01:00.000Z',
		revertOf: entry.seq
	};
}

describe('tournamentReportRounds', () => {
	it('resolves occupants to names and carries results and tables along', () => {
		const rounds = tournamentReportRounds(eventState());
		expect(rounds).toHaveLength(2);
		expect(rounds[0].tables[0]).toEqual({
			tableIndex: 0,
			tableName: 'Table 1',
			occupants: [
				{ kind: 'seat', seatIndex: 0, nickname: 'Ada' },
				{ kind: 'seat', seatIndex: 1, nickname: 'Bo' }
			],
			result: { kind: 'played', winner: 'player1', vp: { player1: 6, player2: 4 } }
		});
		expect(rounds[0].tables[1].occupants[1]).toEqual({ kind: 'bye' });
		expect(rounds[1].tables[1].result).toBeNull();
	});
});

describe('tournamentReportGameIds', () => {
	it('derives an id per played match, skips the BYE and follows the replay attempt', () => {
		expect(tournamentReportGameIds(eventState())).toEqual([
			{ round: 1, tableIndex: 0, gameId: 'CUP001-R1T1A0' },
			{ round: 2, tableIndex: 0, gameId: 'CUP001-R2T1A1' },
			{ round: 2, tableIndex: 1, gameId: 'CUP001-R2T2A0' }
		]);
	});
});

describe('tournamentReportMatches', () => {
	it('joins each log to its table’s occupants in game-seat order', () => {
		const rounds = tournamentReportRounds(eventState());
		const logs: TournamentReportMatchLog[] = [
			{ round: 1, tableIndex: 0, gameId: 'CUP001-R1T1A0', history: [] },
			{ round: 2, tableIndex: 0, gameId: 'CUP001-R2T1A1', history: [] }
		];
		const matches = tournamentReportMatches(rounds, logs);
		expect(matches[0].players).toEqual({ player1: 'Ada', player2: 'Bo' });
		expect(matches[1].players).toEqual({ player1: 'Ada', player2: 'Cy' });
	});
});

describe('tournamentReportStats', () => {
	it('aggregates across matches with the owner beside the model, skipping undone hits', () => {
		seq = 0;
		const mistake = log('player1', 'Chiyohime', 9);
		mistake.undoneBy = 99;
		const matches = tournamentReportMatches(tournamentReportRounds(eventState()), [
			{
				round: 1,
				tableIndex: 0,
				gameId: 'g1',
				history: [
					log('player1', 'Chiyohime', 4),
					mistake,
					log('player2', 'Chiyohime', 3),
					log('player2', null, 2, 'heal')
				]
			},
			{
				round: 2,
				tableIndex: 0,
				gameId: 'g2',
				history: [log('player1', 'Chiyohime', 4), log('player1', null, 1)]
			}
		]);
		// The revert row is only needed for the fold; the stats read `undoneBy` directly.
		expect(revertOf(mistake).revertOf).toBe(mistake.seq);
		const { damage, healing } = tournamentReportStats(matches);
		expect(damage).toEqual([
			{ name: 'Chiyohime (Ada)', total: 8 },
			{ name: 'Chiyohime (Bo)', total: 3 },
			{ name: 'Ada (unattributed)', total: 1 }
		]);
		expect(healing).toEqual([{ name: 'Bo (unattributed)', total: 2 }]);
	});
});

describe('tournamentTableLine', () => {
	it('reads a played match, a draw, a BYE and a table that never reported', () => {
		const rounds = tournamentReportRounds(eventState());
		expect(tournamentTableLine(rounds[0].tables[0])).toBe('Table 1: Ada 6 : 4 Bo - win Ada');
		expect(tournamentTableLine(rounds[0].tables[1])).toBe('Table 2: Cy takes the BYE (+5 VP)');
		expect(tournamentTableLine(rounds[1].tables[0])).toBe('Table 1: Ada 5 : 5 Cy - draw');
		expect(tournamentTableLine(rounds[1].tables[1])).toBe(
			'Table 2: Bo vs Marta - no result recorded'
		);
	});
});

describe('buildTournamentReportPdf', () => {
	it('renders the tournament page, the field, the rounds and the conclusion', () => {
		seq = 0;
		const stats = tournamentReportStats(
			tournamentReportMatches(tournamentReportRounds(eventState()), [
				{
					round: 1,
					tableIndex: 0,
					gameId: 'g1',
					history: [log('player1', 'Chiyohime', 4), log('player2', null, 2, 'heal')]
				}
			])
		);
		const bytes = buildTournamentReportPdf({
			name: 'API Cup',
			code: 'CUP001',
			organizerName: 'Marta',
			externalLink: 'https://example.org/cup',
			createdAt: '2026-10-12T09:00:00.000Z',
			concludedAt: '2026-10-12T17:00:00.000Z',
			missions: [
				{ round: 1, title: 'Treasure Hunt' },
				{ round: 2, title: 'Quarter War' }
			],
			armies: [
				{
					place: 1,
					nickname: 'Ada',
					armyName: 'Ada',
					factionName: 'Helian League',
					organizer: false,
					victoryPoints: 11
				},
				{
					place: 2,
					nickname: 'Marta',
					armyName: 'Marta',
					factionName: 'Helian League',
					organizer: true,
					victoryPoints: 0
				}
			],
			tableNames: ['Table 1', 'Table 2'],
			rounds: [
				{
					number: 1,
					missionTitle: 'Treasure Hunt',
					tables: ['Table 1: Ada 6 : 4 Bo - win Ada', 'Table 2: Cy takes the BYE (+5 VP)']
				},
				{ number: 2, missionTitle: 'Quarter War', tables: ['Table 1: Ada 5 : 5 Cy - draw'] }
			],
			damage: stats.damage,
			healing: stats.healing
		});
		let text = '';
		for (const byte of bytes) text += String.fromCharCode(byte);
		expect(text.startsWith('%PDF-1.4\n')).toBe(true);
		expect(text).toContain('ONI QUEST - TOURNAMENT REPORT');
		expect(text).toContain('(API Cup)');
		expect(text).toContain('Event code CUP001');
		expect(text).toContain('Tournament Organizer: Marta');
		expect(text).toContain('Event page: https://example.org/cup');
		expect(text).toContain('2026-10-12 09:00 UTC');
		expect(text).toContain('Round 1 - Treasure Hunt');
		expect(text).toContain('1. Ada - 11 VP');
		expect(text).toContain('2. Marta \\(organizer\\) - 0 VP');
		expect(text).toContain('Table 2: Cy takes the BYE \\(+5 VP\\)');
		expect(text).toContain('CONCLUSION: MOST DAMAGE BY MODEL');
		expect(text).toContain('Chiyohime \\(Ada\\)');
		expect(text).toContain('Page 1 of 1');
	});
});
