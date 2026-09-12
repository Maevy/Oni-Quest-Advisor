<script lang="ts">
	import type { ArmyRosterRow, ArmyUpgradeSpec, ArmyView } from '$lib/domain';
	import Panel from './Panel.svelte';
	import VitalityTrack from './VitalityTrack.svelte';

	type Props = {
		view: ArmyView;
		/** Opened from the screen root: the sliding strip's transform would trap a fixed overlay. */
		onShowUnit: (row: ArmyRosterRow) => void;
		onShowUpgrade: (upgrade: ArmyUpgradeSpec) => void;
		/** Opens the vitality menu for a copy. */
		onOpenVitality: (row: ArmyRosterRow) => void;
	};

	let { view, onShowUnit, onShowUpgrade, onOpenVitality }: Props = $props();

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
			{@const vit = view.vitality[row.entryId]}
			{@const currentHp = vit?.hp ?? row.effectiveStats.HP}
			{@const currentSta = vit?.sta ?? row.effectiveStats.STA}
			<li>
				<div
					role="button"
					tabindex="0"
					aria-label={'Adjust Life and stamina of ' + row.name}
					class="cursor-pointer rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5 transition hover:border-sky-400/60"
					onclick={() => onOpenVitality(row)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onOpenVitality(row);
						}
					}}
				>
					<div class="flex items-center gap-3">
						{#if row.icon}
							<button
								type="button"
								aria-label={'Show unit details for ' + row.name}
								class="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900/60 transition hover:bg-slate-800/60 active:bg-slate-800/80"
								style="border-color: {view.faction.color}"
								onclick={(event) => {
									event.stopPropagation();
									onShowUnit(row);
								}}
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
						<div class="flex shrink-0 flex-col items-end gap-1">
							{#if row.effectiveStats.HP !== null && currentHp !== null}
								<VitalityTrack kind="hp" current={currentHp} max={row.effectiveStats.HP} />
							{/if}
							{#if row.effectiveStats.STA !== null && currentSta !== null}
								<VitalityTrack kind="stamina" current={currentSta} max={row.effectiveStats.STA} />
							{/if}
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
										onclick={(event) => {
											event.stopPropagation();
											onShowUpgrade(upgrade);
										}}
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
				</div>
			</li>
		{:else}
			<li class="text-sm text-slate-500">This army has no units.</li>
		{/each}
	</ul>
</Panel>
