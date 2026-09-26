import type { ArmyFactionConfig, PickedArmy } from '$lib/domain';
import type { SeatHue } from './playerAccent';

/**
 * One army slot on the mission briefing. Solo has a single slot; hot-seat has two, one per seat,
 * each with its own button label, panel heading and colour.
 */
export type BriefingArmy = {
	/** Identifies the slot in the pick/clear callbacks — `'solo'`, or a `PlayerKey`. */
	id: string;
	/** Header button label, e.g. `Pick Army` or `Pick P2 Army`. */
	pickLabel: string;
	/** Heading of the panel shown once an army is attached. */
	panelTitle: string;
	hue: SeatHue;
	army: PickedArmy | null;
	faction: ArmyFactionConfig | undefined;
};
