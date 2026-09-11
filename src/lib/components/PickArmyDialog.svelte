<script lang="ts">
	import type { ArmyFactionConfig, SavedArmy } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		/** Saved standard-format armies, newest first. */
		armies: SavedArmy[];
		factions: ArmyFactionConfig[];
		onPick: (army: SavedArmy) => void;
		onCancel: () => void;
	};

	let { armies, factions, onPick, onCancel }: Props = $props();

	$effect(() => onEscapeKey(onCancel));

	function factionName(factionId: string): string {
		return factions.find((faction) => faction.id === factionId)?.name ?? factionId;
	}

	function factionColor(factionId: string): string {
		return factions.find((faction) => faction.id === factionId)?.color ?? 'text-slate-400';
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
>
	<div
		class="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Pick Army</h2>
		<p class="mt-1 text-xs text-slate-400">The army is attached to this run as it is now.</p>
		<ul class="mt-3 flex flex-col gap-2">
			{#each armies as army (army.id)}
				<li>
					<button
						type="button"
						class="w-full rounded-xl border border-slate-600/40 bg-slate-900/60 px-3 py-2.5 text-left transition hover:bg-slate-700/40 active:bg-slate-700/60"
						onclick={() => onPick(army)}
					>
						<span class="block text-sm font-semibold text-slate-100">{army.name}</span>
						<span class="mt-0.5 block text-xs {factionColor(army.factionId)}">
							{factionName(army.factionId)}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			class="mt-4 w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/60"
			onclick={onCancel}
		>
			Cancel
		</button>
	</div>
</div>
