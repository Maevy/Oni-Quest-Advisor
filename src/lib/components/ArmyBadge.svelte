<script lang="ts">
	import type { ArmyFactionConfig, ArmyFactionId, ArmyFormat } from '$lib/domain';

	type Props = {
		name: string;
		factionId: ArmyFactionId;
		format: ArmyFormat;
		/** The army factions, to resolve the display name and its RAL colour. */
		factions: ArmyFactionConfig[];
	};

	let { name, factionId, format, factions }: Props = $props();

	let faction = $derived(factions.find((entry) => entry.id === factionId));
</script>

<div
	class="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2"
>
	<div class="min-w-0 flex-1">
		<span class="block truncate text-sm font-semibold text-slate-100">{name}</span>
		<span
			class="mt-0.5 block truncate text-xs {faction ? '' : 'text-slate-400'}"
			style={faction ? `color: ${faction.color}` : undefined}
		>
			{faction?.name ?? factionId}
		</span>
	</div>
	<span
		class="shrink-0 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 uppercase"
	>
		{format === 'roster' ? 'Roster' : 'Standard'}
	</span>
</div>
