<script lang="ts">
	import type { ArmyFactionConfig, ArmyFormat, ArmyRosterRow, ArmyUnitSpec } from '$lib/domain';

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
		onRemoveUnit
	}: Props = $props();

	let showArmy = $state(false);

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

	<div class="relative min-h-0 flex-1 overflow-hidden">
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
								class="flex items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
							>
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
								<button
									type="button"
									disabled={(counts[unit.id] ?? 0) >= unit.limit}
									aria-label={'Add ' + unit.name}
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-sky-500/50 bg-slate-900/60 text-xl font-bold text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
									onclick={() => onAddUnit(unit.id)}
								>
									+
								</button>
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
									class="flex items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
								>
									<div>
										<p class="font-medium text-slate-100">
											{row.name} <span class="text-slate-400">×{row.count}</span>
										</p>
										<p class="text-xs text-slate-400">{row.totalPoints} points</p>
									</div>
									<button
										type="button"
										aria-label={'Remove ' + row.name}
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-900/60 text-xl font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
										onclick={() => onRemoveUnit(row.unitId)}
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
</div>
