<script lang="ts">
	import { MAX_ROUND, MAX_TOTAL_VP, MIN_ROUND, type PlayerKey } from '$lib/domain';
	import Panel from './Panel.svelte';
	import { PLAYER_SEATS, SEAT_ACCENTS, type SeatHue } from './playerAccent';
	import { roundAccent } from './roundAccent';

	type Props = {
		totalVPP1: number;
		totalVPP2: number;
		round: number;
		activePlayer: PlayerKey;
		onSetRound: (round: number) => void;
		/** Starts the swap countdown — the hot-seat hand-over, and this panel's only action. */
		onSwap: () => void;
	};

	let { totalVPP1, totalVPP2, round, activePlayer, onSetRound, onSwap }: Props = $props();

	let accent = $derived(roundAccent(round));
	/** One round for the table, and Player 1 is the seat that carries it. */
	let controlsRound = $derived(activePlayer === 'player1');

	const roundButton =
		'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30';
</script>

{#snippet vpBlock(player: PlayerKey, hue: SeatHue, vp: number)}
	{@const colours = SEAT_ACCENTS[hue]}
	<div
		class="rounded-xl border bg-slate-900/40 px-2 py-2 text-center {player === activePlayer
			? colours.border
			: 'border-slate-700/40'}"
	>
		<p class="text-[10px] font-semibold tracking-wide uppercase {colours.label}">
			{PLAYER_SEATS[player].label} Total VP
		</p>
		<p class="text-4xl font-bold {colours.text}">
			{vp}<span class="text-base font-semibold text-slate-400"> / {MAX_TOTAL_VP}</span>
		</p>
	</div>
{/snippet}

<Panel>
	<div class="grid grid-cols-2 gap-3">
		{@render vpBlock('player1', 'sky', totalVPP1)}
		{@render vpBlock('player2', 'orange', totalVPP2)}
	</div>

	<div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-700/50 pt-3">
		<div class="flex items-center gap-2">
			<span class="text-[10px] font-semibold tracking-wide uppercase {accent.text}">Round</span>
			<button
				type="button"
				class={roundButton}
				onclick={() => onSetRound(round - 1)}
				disabled={!controlsRound || round <= MIN_ROUND}
				aria-label="Previous round"
			>
				−
			</button>
			<span
				class="flex h-10 w-10 items-center justify-center rounded-lg border-2 bg-slate-950 text-xl font-bold {accent.border} {accent.text}"
			>
				{round}
			</span>
			<button
				type="button"
				class={roundButton}
				onclick={() => onSetRound(round + 1)}
				disabled={!controlsRound || round >= MAX_ROUND}
				aria-label="Next round"
			>
				+
			</button>
		</div>
		<button
			type="button"
			class="neon-border neon-violet rounded-xl border-2 border-violet-500/50 bg-slate-900/60 px-4 py-2.5 text-sm font-bold text-violet-200 backdrop-blur transition hover:bg-violet-500/20 active:bg-violet-500/30"
			onclick={onSwap}
		>
			Swap Player
		</button>
	</div>
	{#if !controlsRound}
		<p class="mt-2 text-[10px] text-slate-500 italic">
			Only {PLAYER_SEATS.player1.label} advances the round.
		</p>
	{/if}
</Panel>
