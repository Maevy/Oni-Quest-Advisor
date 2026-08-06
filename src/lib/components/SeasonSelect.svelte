<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';

	type Props = {
		seasons: string[];
		onSelect: (season: string) => void;
	};

	let { seasons, onSelect }: Props = $props();
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
	<div class="mx-auto flex w-full max-w-xl flex-col items-center gap-8">
		<div class="flex w-full flex-col items-center gap-2">
			<div
				class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-3 py-5 backdrop-blur"
			>
				<img src={chiohime} alt="Chiohime" class="w-[70px] shrink-0 object-contain sm:w-[106px]" />
				<h1
					class="flex-1 text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)] sm:text-4xl"
				>
					Oni Quest Advisor
				</h1>
				<img src={rasetsu} alt="Rasetsu" class="w-16 shrink-0 object-contain sm:w-24" />
			</div>
			<p class="text-slate-400">Choose a Season to begin.</p>
		</div>

		{#if seasons.length > 0}
			<div class="flex flex-col gap-3">
				{#each seasons as season (season)}
					<button
						type="button"
						class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
						onclick={() => onSelect(season)}
					>
						{season}
					</button>
				{/each}
			</div>
		{:else}
			<p class="text-slate-500">No seasons available yet.</p>
		{/if}
	</div>
</div>
