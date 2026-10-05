/**
 * The medals of the final standing. Gold, silver and bronze are the podium; everybody below it
 * gets the same dark border, because the point of the colour is that a winner is readable at a
 * glance across a table of names. Tailwind only sees whole class names, so these stay literal
 * strings — the same rule `playerAccent.ts` lives by.
 */
export type VictoryMedal = 'gold' | 'silver' | 'bronze' | 'none';

export type VictoryAccent = {
	/** The row's border — thick enough to read as a medal. */
	border: string;
	/** A wash behind the row, so the podium does not rely on the border alone. */
	background: string;
	/** The place number and the name. */
	text: string;
	/** The points figure. */
	points: string;
	/** The podium's glow; the rest of the field stays flat. */
	shadow: string;
};

export const VICTORY_ACCENTS: Record<VictoryMedal, VictoryAccent> = {
	gold: {
		border: 'border-amber-300',
		background: 'bg-amber-500/10',
		text: 'text-amber-200',
		points: 'text-amber-300',
		shadow: 'shadow-[0_0_18px_rgba(252,211,77,0.35)]'
	},
	silver: {
		border: 'border-slate-300',
		background: 'bg-slate-300/10',
		text: 'text-slate-200',
		points: 'text-slate-300',
		shadow: 'shadow-[0_0_18px_rgba(203,213,225,0.28)]'
	},
	bronze: {
		border: 'border-amber-700',
		background: 'bg-amber-900/20',
		text: 'text-amber-500',
		points: 'text-amber-500',
		shadow: 'shadow-[0_0_18px_rgba(180,83,9,0.35)]'
	},
	none: {
		border: 'border-slate-700/60',
		background: 'bg-slate-900/40',
		text: 'text-slate-100',
		points: 'text-slate-300',
		shadow: ''
	}
};

/** The medal a place earned: the top three, and the same dark border for the rest. */
export function medalFor(place: number): VictoryMedal {
	if (place === 1) return 'gold';
	if (place === 2) return 'silver';
	if (place === 3) return 'bronze';
	return 'none';
}

export function victoryAccent(place: number): VictoryAccent {
	return VICTORY_ACCENTS[medalFor(place)];
}

/** "1st", "2nd", "3rd", "4th" — and the teens, which are the ones an ordinal function forgets. */
export function placeLabel(place: number): string {
	const teens = place % 100;
	if (teens >= 11 && teens <= 13) return `${place}th`;
	const unit = place % 10;
	if (unit === 1) return `${place}st`;
	if (unit === 2) return `${place}nd`;
	if (unit === 3) return `${place}rd`;
	return `${place}th`;
}
