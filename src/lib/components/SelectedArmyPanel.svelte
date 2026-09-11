<script lang="ts">
	import type { ArmyFactionConfig, PickedArmy } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = {
		army: PickedArmy;
		faction: ArmyFactionConfig | undefined;
		onRemove: () => void;
	};

	let { army, faction, onRemove }: Props = $props();
</script>

<Panel title="Selected Army">
	<div class="flex items-center gap-3">
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-semibold text-slate-100">{army.name}</p>
			<p
				class="mt-0.5 truncate text-xs {faction ? '' : 'text-slate-400'}"
				style={faction ? `color: ${faction.color}` : undefined}
			>
				{faction?.name ?? army.factionId}
			</p>
		</div>
		<button
			type="button"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
			aria-label={'Remove ' + army.name + ' from this run'}
			onclick={onRemove}
		>
			<span aria-hidden="true">✕</span>
		</button>
	</div>
</Panel>
