<script lang="ts">
	import type { ArmyRosterRow, ArmyUpgradeSpec, ArmyView } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = {
		view: ArmyView;
		/** Opened from the screen root: the sliding strip's transform would trap a fixed overlay. */
		onShowUnit: (row: ArmyRosterRow) => void;
		onShowUpgrade: (upgrade: ArmyUpgradeSpec) => void;
	};

	let { view, onShowUnit, onShowUpgrade }: Props = $props();

	let totalPoints = $derived(view.rows.reduce((sum, row) => sum + row.points, 0));
</script>

<Panel title="Army">
	<div class="flex items-baseline justify-between gap-2">
		<p class="min-w-0 truncate text-sm font-semibold text-slate-100">{view.army.name}</p>
		<p class="shrink-0 text-sm font-semibold" style="color: {view.faction.color}">
			{totalPoints} pts
		</p>
	</div>
	<p class="mt-0.5 text-xs" style="color: {view.faction.color}">{view.faction.name}</p>

	<ul class="mt-3 flex flex-col gap-2">
		{#each view.rows as row (row.entryId)}
			<li class="rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5">
				<div class="flex items-center gap-3">
					{#if row.icon}
						<button
							type="button"
							aria-label={'Show unit details for ' + row.name}
							class="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900/60 transition hover:bg-slate-800/60 active:bg-slate-800/80"
							style="border-color: {view.faction.color}"
							onclick={() => onShowUnit(row)}
						>
							<img src={row.icon} alt="" class="h-full w-full object-contain" />
						</button>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-slate-100">{row.name}</p>
						<p class="mt-0.5 text-xs text-slate-400">
							{row.points} pts{#if row.mounted}
								· mounted on {row.mount?.name}{/if}
						</p>
					</div>
				</div>
				{#if row.upgrades.length > 0}
					<div class="mt-1.5 space-y-1 pl-8">
						{#each row.upgrades as upgrade (upgrade.id)}
							<div class="flex min-w-0 items-center gap-1.5">
								<span class="text-slate-500">└</span>
								<button
									type="button"
									aria-label={'Show details for ' + upgrade.name}
									class="flex min-w-0 items-center gap-1.5 rounded-full bg-orange-400 py-0.5 pr-2.5 pl-0.5 text-[11px] font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
									onclick={() => onShowUpgrade(upgrade)}
								>
									{#if upgrade.icon}
										<img
											src={upgrade.icon}
											alt=""
											class="h-5 w-5 shrink-0 rounded-full border border-slate-950/30 object-cover"
										/>
									{/if}
									<span class="truncate">{upgrade.name}</span>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</li>
		{:else}
			<li class="text-sm text-slate-500">This army has no units.</li>
		{/each}
	</ul>
</Panel>
