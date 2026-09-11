<script lang="ts">
	import { MAX_ROUND, MAX_TOTAL_VP, MIN_ROUND } from '$lib/domain';
	import Panel from './Panel.svelte';
	import { roundAccent } from './roundAccent';

	type Props = {
		totalVP: number;
		round: number;
		onSetRound: (round: number) => void;
		onReset: () => void;
	};

	let { totalVP, round, onSetRound, onReset }: Props = $props();

	let accent = $derived(roundAccent(round));
</script>

<Panel>
	<div class="text-center">
		<p class="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Total VP</p>
		<p class="text-5xl font-bold text-sky-300">
			{totalVP}<span class="text-xl font-semibold text-slate-400"> / {MAX_TOTAL_VP}</span>
		</p>
	</div>

	<div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-700/50 pt-3">
		<div class="flex items-center gap-2">
			<span class="text-[10px] font-semibold tracking-wide uppercase {accent.text}">Round</span>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30"
				onclick={() => onSetRound(round - 1)}
				disabled={round <= MIN_ROUND}
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
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30"
				onclick={() => onSetRound(round + 1)}
				disabled={round >= MAX_ROUND}
				aria-label="Next round"
			>
				+
			</button>
		</div>
		<button
			type="button"
			class="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
			onclick={onReset}
		>
			Reset
		</button>
	</div>
</Panel>
