import adventurersGuild from '$lib/assets/AdventurersGuild.png';
import coalitionOfThenion from '$lib/assets/CoalitionOfThenion.png';
import empireOfSoga from '$lib/assets/EmpireOfSoga.png';
import goblinWartribes from '$lib/assets/GoblinWartribes.png';
import helianLeague from '$lib/assets/HelianLeague.png';
import oniClans from '$lib/assets/OniClans.png';
import sandKingdoms from '$lib/assets/SandKingdoms.png';
import type { ArmyFactionConfig } from '$lib/domain';

/**
 * The tabletop roster: seven factions, each with its dominant RAL Classic
 * color. Oni Clans and Goblin Wartribes are the two halves of the scheme
 * data's Monster Factions (they share the same scheme deck).
 */
const ARMY_FACTIONS: ArmyFactionConfig[] = [
	// RAL 9001 cream white
	{ id: 'helian-league', name: 'Helian League', color: '#FDF4E3', logo: helianLeague },
	// RAL 4005 blue lilac
	{
		id: 'coalition-of-thenion',
		name: 'Coalition of Thenion',
		color: '#76689A',
		logo: coalitionOfThenion
	},
	// RAL 5018 turquoise blue
	{ id: 'sand-kingdoms', name: 'Sand Kingdoms', color: '#21888F', logo: sandKingdoms },
	// RAL 3004 purple red
	{ id: 'empire-of-soga', name: 'Empire of Soga', color: '#75151E', logo: empireOfSoga },
	// RAL 3002 carmine red
	{ id: 'oni-clans', name: 'Oni Clans', color: '#9B111E', logo: oniClans },
	// RAL 6029 mint green
	{ id: 'goblin-wartribes', name: 'Goblin Wartribes', color: '#006F3D', logo: goblinWartribes },
	// RAL 1014 ivory
	{ id: 'adventurers-guild', name: "Adventurers' Guild", color: '#DDC49A', logo: adventurersGuild }
];

export function loadArmyFactions(): ArmyFactionConfig[] {
	return ARMY_FACTIONS;
}
