<script lang="ts">
	import type { Mission } from '$lib/domain';

	type Props = {
		season: string;
		missions: Mission[];
		onReturn: () => void;
		onRandom: () => void;
		onSelectMission: (missionId: string) => void;
	};

	let { season, missions, onReturn, onRandom, onSelectMission }: Props = $props();
</script>

<div class="min-h-dvh px-4 py-4">
	<div class="mx-auto w-full max-w-xl">
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-lg font-semibold text-slate-100">{season}</h1>
			<div class="flex gap-2">
				<button
					type="button"
					class="rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
					onclick={onReturn}
				>
					Return
				</button>
				<button
					type="button"
					class="rounded-lg bg-orange-400 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
					onclick={onRandom}
				>
					Random
				</button>
			</div>
		</div>

		{#if missions.length > 0}
			<p class="mt-6 text-center text-slate-400">Pick your mission or press random.</p>
			<div class="mt-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
				<div class="grid grid-cols-3 gap-3">
					{#each missions as mission (mission.id)}
						<button
							type="button"
							class="rounded-xl border-2 border-sky-500/40 bg-slate-900/60 px-2 py-4 text-center text-sm font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
							onclick={() => onSelectMission(mission.id)}
						>
							{mission.name}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<p class="mt-6 text-center text-slate-500">No missions in this season yet.</p>
		{/if}
	</div>
</div>
