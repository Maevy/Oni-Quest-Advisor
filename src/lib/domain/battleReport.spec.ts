import { describe, expect, it } from 'vitest';
import {
	battleReportRounds,
	battleReportStats,
	battleReportUnits,
	buildBattleReportPdf,
	type BattleReportInput
} from './battleReport';
import type { HistoryAction, HistoryEntry, HistoryRevert } from './vitalityHistory';
import type { ArmyView } from './savedArmy';
import type { PlayerKey } from './twoPlayer';

const NICKNAMES: Record<PlayerKey, string> = { player1: 'Ana', player2: 'Ben' };

let seq = 0;
function hit(
	actor: PlayerKey,
	amount: number,
	originName: string | null,
	round = 1,
	targetSeat: PlayerKey = 'player2'
): HistoryAction {
	seq += 1;
	return {
		kind: 'action',
		seq,
		round,
		actor,
		at: '2026-10-12T10:00:00.000Z',
		targetSeat,
		targetEntryId: `t${seq}`,
		targetName: 'Clan Champion',
		targetCopy: null,
		originEntryId: originName ? `o${seq}` : null,
		originName,
		action: { kind: 'damage', amount },
		undoneBy: null
	};
}
function healed(actor: PlayerKey, amount: number, originName: string | null): HistoryAction {
	seq += 1;
	return {
		...hit(actor, amount, originName),
		action: { kind: 'heal', amount }
	};
}
function undo(revertOf: number): HistoryRevert {
	seq += 1;
	return {
		kind: 'revert',
		seq,
		round: 1,
		actor: 'player1',
		at: '2026-10-12T10:05:00.000Z',
		revertOf
	};
}

describe('battleReportStats', () => {
	it('tallies damage per acting model, highest first', () => {
		seq = 0;
		const history: HistoryEntry[] = [
			hit('player1', 2, 'Chiyohime'),
			hit('player1', 4, 'Chiyohime'),
			hit('player2', 3, 'Kogetsu')
		];
		const { damage, healing } = battleReportStats(history, NICKNAMES);
		expect(damage).toEqual([
			{ name: 'Chiyohime', total: 6 },
			{ name: 'Kogetsu', total: 3 }
		]);
		expect(healing).toEqual([]);
	});

	it('tallies a self-recorded hit under the seat, marked unattributed', () => {
		seq = 0;
		const { damage } = battleReportStats([hit('player2', 3, null)], NICKNAMES);
		expect(damage).toEqual([{ name: 'Ben (unattributed)', total: 3 }]);
	});

	it('leaves undone interactions out of every total', () => {
		seq = 0;
		const mistake = hit('player1', 9, 'Chiyohime');
		const history: HistoryEntry[] = [mistake, undo(mistake.seq), hit('player1', 1, 'Kogetsu')];
		// The join the endpoint does: the revert marks its action.
		(mistake as HistoryAction).undoneBy = 2;
		const { damage } = battleReportStats(history, NICKNAMES);
		expect(damage).toEqual([{ name: 'Kogetsu', total: 1 }]);
	});

	it('keeps healing apart from damage and sorts ties by name', () => {
		seq = 0;
		const { damage, healing } = battleReportStats(
			[
				healed('player1', 2, 'Sister'),
				healed('player2', 2, 'Abbot'),
				hit('player1', 1, 'Chiyohime')
			],
			NICKNAMES
		);
		expect(healing).toEqual([
			{ name: 'Abbot', total: 2 },
			{ name: 'Sister', total: 2 }
		]);
		expect(damage).toEqual([{ name: 'Chiyohime', total: 1 }]);
	});
});

describe('battleReportRounds', () => {
	it('groups interactions by round and carries each round’s snapshot score', () => {
		seq = 0;
		const history: HistoryEntry[] = [
			hit('player1', 2, 'Chiyohime', 1),
			hit('player2', 1, 'Kogetsu', 2),
			hit('player2', 1, 'Kogetsu', 2)
		];
		const sentences: Record<number, string[]> = {
			1: ['Chiyohime has dealt 2 damage to Clan Champion'],
			2: ['Kogetsu has dealt 1 damage to Clan Champion'],
			3: ['Kogetsu has dealt 1 damage to Clan Champion']
		};
		const rounds = battleReportRounds(history, sentences, { 1: { player1: 3, player2: 0 } }, null);
		expect(rounds).toHaveLength(2);
		expect(rounds[0].score).toEqual({ player1: 3, player2: 0 });
		expect(rounds[0].interactions).toHaveLength(1);
		expect(rounds[1].interactions).toHaveLength(2);
		expect(rounds[1].score).toEqual({ player1: null, player2: null });
	});

	it('falls back to the final tally on the last round and marks undone entries', () => {
		seq = 0;
		const mistake = hit('player1', 4, 'Chiyohime', 1);
		const history: HistoryEntry[] = [mistake, undo(mistake.seq)];
		mistake.undoneBy = 2;
		const rounds = battleReportRounds(
			history,
			{ 1: ['Chiyohime has dealt 4 damage to Clan Champion'] },
			{},
			{
				player1: 7,
				player2: 4
			}
		);
		expect(rounds).toHaveLength(1);
		expect(rounds[0].score).toEqual({ player1: 7, player2: 4 });
		expect(rounds[0].interactions[0].undone).toBe(true);
	});
});

describe('battleReportUnits', () => {
	it('groups copies per unit and totals the points', () => {
		const army = {
			rows: [
				{ unitId: 'u1', name: 'Citadel Guard', points: 9, effectiveSize: 'small' },
				{ unitId: 'u1', name: 'Citadel Guard', points: 9, effectiveSize: 'small' },
				{ unitId: 'u2', name: 'Chiyohime', points: 21, effectiveSize: 'epic' }
			]
		} as unknown as ArmyView;
		expect(battleReportUnits(army)).toEqual({
			totalPoints: 39,
			units: [
				{ name: 'Citadel Guard', copies: 2, size: 'Small', points: 18 },
				{ name: 'Chiyohime', copies: 1, size: 'Epic', points: 21 }
			]
		});
	});
});

describe('buildBattleReportPdf', () => {
	const input: BattleReportInput = {
		code: 'ABC123',
		playedAt: '2026-10-12T18:04:00.000Z',
		seasonName: 'Season 2',
		missionName: 'Treasure Hunt',
		map: {
			zone: { type: 'horizontal', rangeInches: 6 },
			markers: [
				{ id: 'a', x: 12, y: 12, shape: 'star', label: 'A', color: '#22d3ee', showRuler: false },
				{ id: 'b', x: 24, y: 24, shape: 'box', label: 'B', color: '#d946ef', showRuler: true }
			]
		},
		players: [
			{
				seat: 'player1',
				nickname: 'Ana',
				armyName: 'Helian Spears',
				factionName: 'Helian League',
				format: 'Standard',
				totalPoints: 85,
				units: [{ name: 'Chiyohime', copies: 1, size: 'Epic', points: 21 }],
				schemeTitle: 'Head Hunt',
				schemeIncrements: 2
			},
			{
				seat: 'player2',
				nickname: 'Ben',
				armyName: 'Soga Blades',
				factionName: 'Empire of Soga',
				format: 'Standard',
				totalPoints: 84,
				units: [{ name: 'Citadel Guard', copies: 2, size: 'Small', points: 18 }],
				schemeTitle: null,
				schemeIncrements: null
			}
		],
		rounds: [
			{
				round: 1,
				score: { player1: 3, player2: 1 },
				interactions: [
					{
						actor: 'player1',
						lines: ['Chiyohime has dealt 4 damage to Clan Champion'],
						undone: false
					},
					{ actor: 'player2', lines: ['Citadel Guard takes 2 damage', 'undone line'], undone: true }
				]
			}
		],
		finalScore: { player1: 7, player2: 4 },
		winner: 'player1',
		damage: [{ name: 'Chiyohime', total: 6 }],
		healing: []
	};

	function decode(bytes: Uint8Array): string {
		let text = '';
		for (const byte of bytes) text += String.fromCharCode(byte);
		return text;
	}

	it('renders a valid PDF carrying the report’s contents', () => {
		const pdf = decode(buildBattleReportPdf(input));
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
		expect(pdf).toContain('ONI QUEST - BATTLE REPORT');
		expect(pdf).toContain('Game code ABC123');
		expect(pdf).toContain('2026-10-12 18:04 UTC');
		expect(pdf).toContain('Season 2 - Treasure Hunt');
		expect(pdf).toContain('Helian Spears');
		expect(pdf).toContain('1x Chiyohime - Epic - 21 pts');
		expect(pdf).toContain('Chiyohime has dealt 4 damage to Clan Champion');
		expect(pdf).toContain('[undone]');
		expect(pdf).toContain('Final score 7 : 4 - Victory for Ana.');
		expect(pdf).toContain('DAMAGE DEALT BY MODEL');
		expect(pdf).toContain('Page 1 of 1');
	});

	it('flows onto further pages and numbers them', () => {
		const rounds = Array.from({ length: 5 }, (_unused, index) => ({
			round: index + 1,
			score: { player1: index, player2: 0 },
			interactions: Array.from({ length: 25 }, (_unused2, entry) => ({
				actor: 'player1' as PlayerKey,
				lines: [`Chiyohime has dealt ${entry} damage to Clan Champion in round ${index + 1}`],
				undone: false
			}))
		}));
		const pdf = decode(buildBattleReportPdf({ ...input, rounds }));
		expect(pdf).not.toContain('Page 1 of 1');
		expect(pdf).toContain('Page 1 of ');
		expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
	});

	it('survives a map-less mission and an unfinished match', () => {
		const pdf = decode(
			buildBattleReportPdf({
				...input,
				map: null,
				finalScore: null,
				winner: null,
				rounds: []
			})
		);
		expect(pdf).toContain('This mission carries no map.');
		expect(pdf).not.toContain('Final score');
	});

	it('draws a radial map without falling over', () => {
		const pdf = decode(
			buildBattleReportPdf({
				...input,
				map: {
					zone: { type: 'radial', rangeInches: 9 },
					quarters: true,
					markers: [
						{ id: 'c', x: 18, y: 18, shape: 'circle', label: 'C', color: 'nope', showRuler: false }
					]
				}
			})
		);
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
		expect(pdf).toContain('radial deployment, 9"');
	});
});
