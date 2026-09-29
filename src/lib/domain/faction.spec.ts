import { describe, expect, it } from 'vitest';
import { MONSTER_SCHEME_FACTION_ID, schemeFactionForArmy } from './faction';
import type { ArmyFactionId } from './army';

describe('schemeFactionForArmy', () => {
	it('passes through the five army factions that are also scheme factions', () => {
		const shared: ArmyFactionId[] = [
			'helian-league',
			'coalition-of-thenion',
			'sand-kingdoms',
			'empire-of-soga',
			'adventurers-guild'
		];
		for (const factionId of shared) {
			expect(schemeFactionForArmy(factionId)).toBe(factionId);
		}
	});

	it('sends both monster army factions to the deck they share', () => {
		expect(schemeFactionForArmy('oni-clans')).toBe(MONSTER_SCHEME_FACTION_ID);
		expect(schemeFactionForArmy('goblin-wartribes')).toBe(MONSTER_SCHEME_FACTION_ID);
	});

	it('never invents a scheme faction for a monster army', () => {
		expect(schemeFactionForArmy('oni-clans')).not.toBe('oni-clans');
		expect(schemeFactionForArmy('goblin-wartribes')).not.toBe('goblin-wartribes');
	});
});
