<script lang="ts">
	import {
		ARMY_STAT_KEYS,
		type ArmyFactionConfig,
		type ArmyStats,
		type ArmyUnitSpec
	} from '$lib/domain';

	type Props = {
		unit: ArmyUnitSpec;
		faction: ArmyFactionConfig;
		stats: ArmyStats;
		mounted: boolean;
		mountName?: string;
		onClose: () => void;
	};

	let { unit, faction, stats, mounted, mountName, onClose }: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
	role="presentation"
	onclick={onClose}
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
>
	<div
		role="dialog"
		tabindex="-1"
		aria-label={unit.name}
		class="w-full max-w-md rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl"
		style="border-color: {faction.color}"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
			event.stopPropagation();
		}}
	>
		<div class="flex items-start gap-3">
			{#if unit.icon}
				<img
					src={unit.icon}
					alt=""
					class="h-[70px] w-[70px] shrink-0 rounded-lg border-2 bg-slate-800/60 object-contain"
					style="border-color: {faction.color}"
				/>
			{/if}
			<div class="min-w-0">
				<h2 class="text-lg font-bold text-slate-100">{unit.name}</h2>
				<p class="text-sm font-semibold" style="color: {faction.color}">{faction.name}</p>
				{#if mounted && mountName}
					<p class="mt-1 text-xs font-semibold text-emerald-300">Mounted on {mountName}</p>
				{/if}
			</div>
		</div>

		<table class="mt-4 w-full table-fixed border-collapse text-center">
			<thead>
				<tr>
					{#each ARMY_STAT_KEYS as key (key)}
						<th
							class="border border-slate-700/50 bg-slate-800/60 px-0.5 py-1 text-[10px] font-semibold tracking-wide text-sky-300"
						>
							{key}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr>
					{#each ARMY_STAT_KEYS as key (key)}
						<td
							class="border border-slate-700/50 px-0.5 py-1 text-xs font-medium text-slate-100 tabular-nums"
						>
							{stats[key] ?? '–'}
						</td>
					{/each}
				</tr>
			</tbody>
		</table>
	</div>
</div>
