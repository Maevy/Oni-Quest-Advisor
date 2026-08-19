<script lang="ts">
	import { fly } from 'svelte/transition';
	import { MAX_ROUND, MAX_TOTAL_VP, MIN_ROUND, type PlayerKey } from '$lib/domain';

	type Props = {
		totalVPP1: number;
		totalVPP2: number;
		round: number;
		activePlayer: PlayerKey;
		onSetRound: (round: number) => void;
		onReset: () => void;
		onSwap: () => void;
	};

	let { totalVPP1, totalVPP2, round, activePlayer, onSetRound, onReset, onSwap }: Props = $props();

	let open = $state(false);

	const ROUND_ACCENTS: Record<number, { border: string; text: string }> = {
		1: { border: 'border-emerald-500', text: 'text-emerald-300' },
		2: { border: 'border-lime-500', text: 'text-lime-300' },
		3: { border: 'border-amber-400', text: 'text-amber-300' },
		4: { border: 'border-orange-500', text: 'text-orange-300' },
		5: { border: 'border-red-500', text: 'text-red-300' }
	};

	let accent = $derived(ROUND_ACCENTS[round]);
</script>

<div class="fixed top-1/2 right-0 z-40 flex -translate-y-1/2 items-stretch">
	{#if open}
		<div
			in:fly={{ x: 140, duration: 200 }}
			out:fly={{ x: 140, duration: 200 }}
			class="rounded-l-2xl border border-r-0 border-slate-700/60 bg-slate-900/85 p-3 backdrop-blur"
		>
			<div class="flex flex-col items-center gap-3">
				<div class="flex gap-4">
					<div class="text-center">
						<p class="text-[10px] font-semibold tracking-wide text-sky-400 uppercase">P1 VP</p>
						<p class="text-xl font-bold text-sky-300">
							{totalVPP1}<span class="text-sm font-semibold text-slate-400"> / {MAX_TOTAL_VP}</span>
						</p>
					</div>
					<div class="text-center">
						<p class="text-[10px] font-semibold tracking-wide text-orange-400 uppercase">P2 VP</p>
						<p class="text-xl font-bold text-orange-300">
							{totalVPP2}<span class="text-sm font-semibold text-slate-400"> / {MAX_TOTAL_VP}</span>
						</p>
					</div>
				</div>
				<div class="h-px w-full bg-slate-700/60"></div>
				<div class="flex flex-col items-center gap-1.5">
					<span class="text-[10px] font-semibold tracking-wide uppercase {accent.text}">Round</span>
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
						class="flex h-10 w-10 items-center justify-center rounded-lg border-2 bg-slate-950 text-xl font-bold {accent.border} {accent.text}"
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
				<div class="h-px w-full bg-slate-700/60"></div>
				<button
					type="button"
					class="w-full rounded-lg border-2 border-violet-500/50 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20 active:bg-violet-500/30"
					onclick={onSwap}
				>
					Swap Player
				</button>
				<button
					type="button"
					class="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
					onclick={onReset}
				>
					Reset
				</button>
			</div>
		</div>
	{/if}
	<button
		type="button"
		class="flex flex-col items-center justify-center gap-2 border border-r-0 border-slate-700/60 bg-slate-900/85 px-1.5 py-4 backdrop-blur transition hover:bg-slate-800/85 active:bg-slate-800/85 {open
			? ''
			: 'rounded-l-xl'}"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-label={open ? 'Close command panel' : 'Open command panel'}
	>
		<div class="flex flex-col items-center gap-0.5">
			<span
				class="rotate-180 text-[8px] font-semibold tracking-wide text-slate-500 uppercase [writing-mode:vertical-rl]"
				>Active</span
			>
			<span
				class="text-xs font-bold {activePlayer === 'player1' ? 'text-sky-300' : 'text-orange-300'}"
			>
				{activePlayer === 'player1' ? 'P1' : 'P2'}
			</span>
		</div>
		<div class="h-px w-4 bg-slate-700/60"></div>
		<span class="text-xs leading-none text-slate-300">{open ? '›' : '‹'}</span>
		<span
			class="rotate-180 text-[10px] font-semibold tracking-wide text-sky-300 uppercase [writing-mode:vertical-rl]"
		>
			Command Panel
		</span>
	</button>
</div>
