<script lang="ts">
	import type { ArmyFactionConfig, ArmyFactionId } from '$lib/domain';

	type Props = {
		factions: ArmyFactionConfig[];
		onSelect: (factionId: ArmyFactionId) => void;
		onReturn: () => void;
	};

	let { factions, onSelect, onReturn }: Props = $props();
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
	<button
		type="button"
		class="fixed top-4 left-4 rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={onReturn}
	>
		← Back
	</button>
	<div class="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
		<div class="flex w-full flex-col items-center gap-2">
			<h1
				class="text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)]"
			>
				Army Builder
			</h1>
			<p class="text-slate-400">Choose your faction.</p>
		</div>

		<div class="grid w-full grid-cols-3 gap-3">
			{#each factions as faction (faction.id)}
				<button
					type="button"
					class="flex flex-col items-center gap-2 rounded-xl border-2 bg-slate-900/60 px-2 py-3 backdrop-blur transition hover:bg-slate-800/60 active:bg-slate-800/80"
					style="border-color: {faction.color}; color: {faction.color}"
					onclick={() => onSelect(faction.id)}
				>
					<img src={faction.logo} alt="{faction.name} logo" class="h-14 w-14 object-contain" />
					<span class="text-xs leading-tight font-semibold">{faction.name}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
