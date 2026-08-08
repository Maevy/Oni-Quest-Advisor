<script lang="ts">
	import { MAX_ROUND, MIN_ROUND } from '$lib/domain';

	type Props = {
		round: number;
		onSetRound: (round: number) => void;
	};

	let { round, onSetRound }: Props = $props();
</script>

<div
	class="fixed top-1/2 right-2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl border border-slate-700/60 bg-slate-900/85 p-2 backdrop-blur"
>
	<span class="text-[10px] font-semibold tracking-wide text-sky-300 uppercase">Round</span>
	<button
		type="button"
		class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30"
		onclick={() => onSetRound(round + 1)}
		disabled={round >= MAX_ROUND}
		aria-label="Next round"
	>
		+
	</button>
	<span
		class="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-sky-500 bg-slate-950 text-xl font-bold text-sky-200"
	>
		{round}
	</span>
	<button
		type="button"
		class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30"
		onclick={() => onSetRound(round - 1)}
		disabled={round <= MIN_ROUND}
		aria-label="Previous round"
	>
		−
	</button>
</div>
