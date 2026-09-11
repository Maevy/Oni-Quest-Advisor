/**
 * Round accents — green → red as the game closes in on the final round. Shared by the Command
 * Panels' round tracker and the Results panels' per-round rows so a round always reads the same
 * color. Tailwind only sees whole class names, so these must stay literal strings.
 */
export type RoundAccent = {
	border: string;
	text: string;
	/** Translucent row background — faint enough not to compete with the objective text. */
	background: string;
};

export const ROUND_ACCENTS: Record<number, RoundAccent> = {
	1: { border: 'border-emerald-500', text: 'text-emerald-300', background: 'bg-emerald-500/10' },
	2: { border: 'border-lime-500', text: 'text-lime-300', background: 'bg-lime-500/10' },
	3: { border: 'border-amber-400', text: 'text-amber-300', background: 'bg-amber-400/10' },
	4: { border: 'border-orange-500', text: 'text-orange-300', background: 'bg-orange-500/10' },
	5: { border: 'border-red-500', text: 'text-red-300', background: 'bg-red-500/10' }
};

/** Accent for a round, falling back to the neutral slate used for locked rows. */
export function roundAccent(round: number): RoundAccent {
	return (
		ROUND_ACCENTS[round] ?? {
			border: 'border-slate-600',
			text: 'text-slate-400',
			background: 'bg-slate-500/10'
		}
	);
}
