<script lang="ts">
	import type { Mission } from '$lib/domain';
	import ScreenHeader from './ScreenHeader.svelte';

	type Props = {
		season: string;
		missions: Mission[];
		onReturn: () => void;
		onRandom: () => void;
		onSelectMission: (missionId: string) => void;
	};

	let { season, missions, onReturn, onRandom, onSelectMission }: Props = $props();
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader title={season} onBack={onReturn}>
		{#snippet actions()}
			<button
				type="button"
				class="rounded-xl border-2 border-orange-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-orange-100 backdrop-blur transition enabled:hover:bg-orange-500/10 enabled:active:bg-orange-500/20"
				onclick={onRandom}
			>
				Random
			</button>
		{/snippet}
	</ScreenHeader>

	<div class="mx-auto w-full max-w-xl px-4 pt-4">
		{#if missions.length > 0}
			<p class="text-center text-slate-400">Pick your mission or press random.</p>
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
			<p class="text-center text-slate-500">No missions in this season yet.</p>
		{/if}
	</div>
</div>
