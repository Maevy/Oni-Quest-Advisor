import type { ArmyFactionId } from './army';

export type Faction = {
	id: string;
	name: string;
};

/** The scheme deck shared by the two monster army factions. */
export const MONSTER_SCHEME_FACTION_ID = 'monster-factions';

const MONSTER_ARMY_FACTION_IDS: ArmyFactionId[] = ['oni-clans', 'goblin-wartribes'];

/**
 * The scheme faction an army faction draws its Scheme deck from.
 *
 * The two id spaces are not the same set: five of the seven army factions are also scheme
 * factions under the same id, but Oni Clans and Goblin Wartribes are the two halves of the scheme
 * data's Monster Factions and share its deck. Resolving an army faction against the scheme
 * catalogs without this would find nothing for exactly those two.
 */
export function schemeFactionForArmy(armyFactionId: ArmyFactionId): string {
	return MONSTER_ARMY_FACTION_IDS.includes(armyFactionId)
		? MONSTER_SCHEME_FACTION_ID
		: armyFactionId;
}
