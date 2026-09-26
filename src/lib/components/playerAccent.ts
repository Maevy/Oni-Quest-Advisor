import type { PlayerKey } from '$lib/domain';

/**
 * The two seat colours. Player 1 keeps the app's standard sky accent, Player 2 is orange — the
 * same pair the Schemes cards, the Results sub-cells and the VP blocks have always used, now in
 * one place so a seat reads the same everywhere it appears. Tailwind only sees whole class names,
 * so these have to stay literal strings.
 *
 * Solo is not a seat, but it is Player 1's blue: anything that takes a `SeatHue` can be handed
 * `'sky'` for a single-player screen without inventing a third colour.
 */
export type SeatHue = 'sky' | 'orange';

export type SeatAccent = {
	/** Bright accent — headings, VP numbers, the active-player line. */
	text: string;
	/** Small uppercase micro-labels. */
	label: string;
	/** Card titles and button type on a translucent seat background. */
	strong: string;
	/** Panel and cell borders. */
	border: string;
	/** The outlined header-button recipe (Pick P1 Army / Pick P2 Army). */
	pickButton: string;
	/** An interactive army row at rest and under the pointer. */
	rowHover: string;
};

export const SEAT_ACCENTS: Record<SeatHue, SeatAccent> = {
	sky: {
		text: 'text-sky-300',
		label: 'text-sky-400',
		strong: 'text-sky-100',
		border: 'border-sky-500/40',
		pickButton:
			'border-2 border-sky-500/50 bg-slate-900/60 text-sky-100 enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20',
		rowHover: 'hover:border-sky-400/60 hover:shadow-[0_0_12px_rgba(56,189,248,0.35)]'
	},
	orange: {
		text: 'text-orange-300',
		label: 'text-orange-400',
		strong: 'text-orange-100',
		border: 'border-orange-500/40',
		pickButton:
			'border-2 border-orange-500/50 bg-slate-900/60 text-orange-100 enabled:hover:bg-orange-500/10 enabled:active:bg-orange-500/20',
		rowHover: 'hover:border-orange-400/60 hover:shadow-[0_0_12px_rgba(251,146,60,0.35)]'
	}
};

/** A hot-seat seat: its two names and its colour. */
export type PlayerSeat = {
	label: string;
	short: string;
	hue: SeatHue;
};

export const PLAYER_SEATS: Record<PlayerKey, PlayerSeat> = {
	player1: { label: 'Player 1', short: 'P1', hue: 'sky' },
	player2: { label: 'Player 2', short: 'P2', hue: 'orange' }
};

export function seatAccent(hue: SeatHue): SeatAccent {
	return SEAT_ACCENTS[hue];
}

export function playerAccent(player: PlayerKey): SeatAccent {
	return SEAT_ACCENTS[PLAYER_SEATS[player].hue];
}
