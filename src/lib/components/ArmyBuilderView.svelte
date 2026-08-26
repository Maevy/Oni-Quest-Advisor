<script lang="ts">
	import type {
		ArmyFactionConfig,
		ArmyFormat,
		ArmyRosterRow,
		ArmyStats,
		ArmyUnitSpec
	} from '$lib/domain';
	import UnitCard from './UnitCard.svelte';

	type Props = {
		faction: ArmyFactionConfig;
		units: ArmyUnitSpec[];
		armyRows: ArmyRosterRow[];
		counts: Record<string, number>;
		format: ArmyFormat;
		points: number;
		limit: number;
		isOverLimit: boolean;
		onReturn: () => void;
		onSetFormat: (format: ArmyFormat) => void;
		onAddUnit: (unitId: string) => void;
		onRemoveUnit: (unitId: string) => void;
		onToggleMount: (unitId: string) => void;
	};

	let {
		faction,
		units,
		armyRows,
		counts,
		format,
		points,
		limit,
		isOverLimit,
		onReturn,
		onSetFormat,
		onAddUnit,
		onRemoveUnit,
		onToggleMount
	}: Props = $props();

	let showArmy = $state(false);
	let selectedCard = $state<{
		unit: ArmyUnitSpec;
		stats: ArmyStats;
		mounted: boolean;
		mountName?: string;
	} | null>(null);

	// Swipe detection: a mostly-horizontal pointer gesture flips the panels.
	const SWIPE_MIN_PX = 50;
	let swipeStartX = 0;
	let swipeStartY = 0;

	function formatTabClasses(target: ArmyFormat): string {
		return format === target ? 'bg-sky-500/20 text-sky-100' : 'text-slate-400';
	}
</script>

<div class="flex min-h-dvh flex-col gap-4 px-4 pt-4 pb-6">
	<div class="flex items-center justify-between">
		<button
			type="button"
			class="rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
			onclick={onReturn}
		>
			← Main Menu
		</button>
		<span class="text-sm font-semibold" style="color: {faction.color}">{faction.name}</span>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div class="flex overflow-hidden rounded-xl border border-slate-600/60 bg-slate-900/60">
			<button
				type="button"
				class={'px-4 py-2 text-sm font-semibold transition ' + formatTabClasses('standard')}
				onclick={() => onSetFormat('standard')}
			>
				Standard
			</button>
			<button
				type="button"
				class={'px-4 py-2 text-sm font-semibold transition ' + formatTabClasses('tournament')}
				onclick={() => onSetFormat('tournament')}
			>
				Tournament
			</button>
		</div>
		<div
			class={'rounded-xl border-2 px-4 py-2 text-sm font-bold tabular-nums ' +
				(isOverLimit ? 'border-red-500/60 text-red-400' : 'border-emerald-500/60 text-emerald-300')}
		>
			{points}/{limit}
		</div>
	</div>

	<div
		class="relative min-h-0 flex-1 overflow-hidden"
		role="group"
		aria-label="Army list panels"
		onpointerdown={(e) => {
			swipeStartX = e.clientX;
			swipeStartY = e.clientY;
		}}
		onpointerup={(e) => {
			const dx = e.clientX - swipeStartX;
			const dy = e.clientY - swipeStartY;
			if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
				showArmy = dx < 0;
			}
		}}
	>
		<div
			class={'flex h-full w-[200%] transition-transform duration-300 ease-in-out' +
				(showArmy ? ' -translate-x-1/2' : '')}
		>
			<section class="flex w-1/2 flex-col pr-2">
				<div
					class="flex min-h-0 flex-1 flex-col rounded-2xl border bg-slate-800/40 p-4 backdrop-blur"
					style="border-color: {faction.color}"
				>
					<h2 class="mb-3 text-sm font-semibold tracking-wide text-sky-300 uppercase">
						Available Units
					</h2>
					<div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
						{#each units as unit (unit.id)}
							<div
								class="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
								role="button"
								tabindex="0"
								onclick={() => (selectedCard = { unit, stats: unit.stats, mounted: false })}
								onkeydown={(event) => {
									if (event.key === 'Enter')
										selectedCard = { unit, stats: unit.stats, mounted: false };
								}}
							>
								{#if unit.icon}
									<img
										src={unit.icon}
										alt=""
										class="h-[70px] w-[70px] shrink-0 rounded-lg border-2 bg-slate-900/60 object-contain"
										style="border-color: {faction.color}"
									/>
								{/if}
								<div>
									<div class="flex flex-wrap items-center gap-1.5">
										<p class="font-medium text-slate-100">{unit.name}</p>
										<span
											class="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"
										>
											Limit {unit.limit}
										</span>
									</div>
									<p class="text-xs text-slate-400">{unit.points} points</p>
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<button
										type="button"
										disabled={(counts[unit.id] ?? 0) === 0}
										aria-label={'Remove ' + unit.name}
										class="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-900/60 text-xl font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
										onclick={(event) => {
											event.stopPropagation();
											onRemoveUnit(unit.id);
										}}
									>
										−
									</button>
									<span
										class="min-w-5 text-center text-sm font-semibold text-slate-300 tabular-nums"
									>
										{counts[unit.id] ?? 0}
									</span>
									<button
										type="button"
										disabled={(counts[unit.id] ?? 0) >= unit.limit}
										aria-label={'Add ' + unit.name}
										class="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-sky-500/50 bg-slate-900/60 text-xl font-bold text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
										onclick={(event) => {
											event.stopPropagation();
											onAddUnit(unit.id);
										}}
									>
										+
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>

			<section class="flex w-1/2 flex-col pl-2">
				<div
					class="flex min-h-0 flex-1 flex-col rounded-2xl border bg-slate-800/40 p-4 backdrop-blur"
					style="border-color: {faction.color}"
				>
					<h2 class="mb-3 text-sm font-semibold tracking-wide text-sky-300 uppercase">Your Army</h2>
					{#if armyRows.length === 0}
						<p class="text-sm text-slate-500">No units yet. Add some from the unit list.</p>
					{:else}
						<div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
							{#each armyRows as row (row.unitId)}
								<div
									class="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
									role="button"
									tabindex="0"
									onclick={() => {
										const found = units.find((candidate) => candidate.id === row.unitId);
										if (found)
											selectedCard = {
												unit: found,
												stats: row.effectiveStats,
												mounted: row.mounted,
												mountName: row.mount?.name
											};
									}}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											const found = units.find((candidate) => candidate.id === row.unitId);
											if (found)
												selectedCard = {
													unit: found,
													stats: row.effectiveStats,
													mounted: row.mounted,
													mountName: row.mount?.name
												};
										}
									}}
								>
									{#if row.icon}
										<img
											src={row.icon}
											alt=""
											class="h-[70px] w-[70px] shrink-0 rounded-lg border-2 bg-slate-900/60 object-contain"
											style="border-color: {faction.color}"
										/>
									{/if}
									<div>
										<p class="font-medium text-slate-100">
											{row.name} <span class="text-slate-400">×{row.count}</span>
										</p>
										<p class="text-xs text-slate-400">{row.totalPoints} points</p>
									</div>
									{#if row.mount}
										<button
											type="button"
											aria-label={(row.mounted ? 'Remove ' : 'Add ') +
												row.mount.name +
												' mount for ' +
												row.name}
											class={'relative shrink-0 rounded-lg border-2 p-0.5 transition ' +
												(row.mounted ? 'border-emerald-500/60' : 'border-slate-600/60')}
											onclick={(event) => {
												event.stopPropagation();
												onToggleMount(row.unitId);
											}}
										>
											{#if row.mount.icon}
												<img src={row.mount.icon} alt="" class="h-9 w-9 rounded object-contain" />
											{/if}
											<span
												class={'absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ' +
													(row.mounted
														? 'bg-emerald-500 text-slate-950'
														: 'bg-red-500/80 text-slate-100')}
											>
												{row.mounted ? '✓' : '✕'}
											</span>
										</button>
									{/if}
									<button
										type="button"
										aria-label={'Remove ' + row.name}
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-900/60 text-xl font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
										onclick={(event) => {
											event.stopPropagation();
											onRemoveUnit(row.unitId);
										}}
									>
										−
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>

	{#if showArmy}
		<button
			type="button"
			aria-label="Show available units"
			class="fixed top-1/2 left-0 -translate-y-1/2 rounded-r-xl border border-l-0 border-slate-600/60 bg-slate-800/80 px-2 py-8 text-xl text-sky-300 backdrop-blur transition hover:bg-slate-700/80 active:bg-slate-700"
			onclick={() => (showArmy = false)}
		>
			‹
		</button>
	{:else}
		<button
			type="button"
			aria-label="Show your army"
			class="fixed top-1/2 right-0 -translate-y-1/2 rounded-l-xl border border-r-0 border-slate-600/60 bg-slate-800/80 px-2 py-8 text-xl text-sky-300 backdrop-blur transition hover:bg-slate-700/80 active:bg-slate-700"
			onclick={() => (showArmy = true)}
		>
			›
		</button>
	{/if}

	{#if selectedCard}
		<UnitCard
			unit={selectedCard.unit}
			{faction}
			stats={selectedCard.stats}
			mounted={selectedCard.mounted}
			mountName={selectedCard.mountName}
			onClose={() => (selectedCard = null)}
		/>
	{/if}
</div>
