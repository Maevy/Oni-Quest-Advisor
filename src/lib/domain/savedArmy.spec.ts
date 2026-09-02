import { describe, expect, it } from 'vitest';
import { groupSavedArmies, type SavedArmy } from './savedArmy';

function saved(id: string, factionId: SavedArmy['factionId'], createdAt: string): SavedArmy {
	return { id, name: id, factionId, code: 'a' + id, createdAt };
}

describe('groupSavedArmies', () => {
	it('returns no groups for no armies', () => {
		expect(groupSavedArmies([], ['helian-league', 'empire-of-soga'])).toEqual([]);
	});

	it('groups by faction in the given order, skipping empty factions', () => {
		const armies = [
			saved('s1', 'empire-of-soga', '2026-09-01T10:00:00.000Z'),
			saved('s2', 'helian-league', '2026-09-02T10:00:00.000Z')
		];
		const groups = groupSavedArmies(armies, [
			'helian-league',
			'coalition-of-thenion',
			'empire-of-soga'
		]);
		expect(groups.map((group) => group.factionId)).toEqual(['helian-league', 'empire-of-soga']);
	});

	it('orders armies within a group newest first', () => {
		const armies = [
			saved('old', 'helian-league', '2026-08-01T10:00:00.000Z'),
			saved('new', 'helian-league', '2026-09-01T10:00:00.000Z'),
			saved('mid', 'helian-league', '2026-08-15T10:00:00.000Z')
		];
		const groups = groupSavedArmies(armies, ['helian-league']);
		expect(groups[0].armies.map((army) => army.id)).toEqual(['new', 'mid', 'old']);
	});

	it('ignores armies of factions not in the order list', () => {
		const armies = [saved('s1', 'sand-kingdoms', '2026-09-01T10:00:00.000Z')];
		expect(groupSavedArmies(armies, ['helian-league'])).toEqual([]);
	});
});
