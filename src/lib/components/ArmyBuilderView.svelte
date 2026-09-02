<script lang="ts">
	import {
		spellcraftLevelCap,
		upgradeCostInArmy,
		upgradeSlotsFor,
		type ArmyEntry,
		type ArmyFactionConfig,
		type ArmyFormat,
		type ArmyItemSpec,
		type ArmyRosterRow,
		type ArmyRulesIndexes,
		type ArmyRulesSpec,
		type ArmySpellSpec,
		type ArmySpellcraftOption,
		type ArmyStats,
		type ArmyStratagemSpec,
		type ArmyUnitSpec,
		type ArmyUpgradeSelection,
		type ArmyUpgradeSpec
	} from '$lib/domain';
	import ArmyUpgradeDetail from './ArmyUpgradeDetail.svelte';
	import ArmyUpgradePicker from './ArmyUpgradePicker.svelte';
	import UnitCard from './UnitCard.svelte';

	type Props = {
		faction: ArmyFactionConfig;
		units: ArmyUnitSpec[];
		classIndex: Record<string, ArmyRulesSpec>;
		skillIndex: Record<string, ArmyRulesSpec>;
		traitIndex: Record<string, ArmyRulesSpec>;
		combatArtIndex: Record<string, ArmyRulesSpec>;
		spellcraftIndex: Record<string, ArmyRulesSpec>;
		spells: ArmySpellSpec[];
		stratagemIndex: Record<string, ArmyStratagemSpec>;
		itemIndex: Record<string, ArmyItemSpec>;
		entries: ArmyEntry[];
		upgrades: ArmyUpgradeSpec[];
		upgradeIndex: Record<string, ArmyUpgradeSpec>;
		rulesIndexes: ArmyRulesIndexes;
		armyRows: ArmyRosterRow[];
		counts: Record<string, number>;
		format: ArmyFormat;
		points: number;
		limit: number;
		isOverLimit: boolean;
		/** Import flow: open directly on the Your-Army panel. */
		startOnArmyPanel: boolean;
		onReturn: () => void;
		onSetFormat: (format: ArmyFormat) => void;
		onCopyCode: () => Promise<{ code: string; copied: boolean } | null>;
		onAddUnit: (unitId: string) => void;
		onRemoveUnit: (unitId: string) => void;
		onRemoveEntry: (entryId: string) => void;
		onToggleMount: (entryId: string) => void;
		onAddUpgrade: (entryId: string, upgradeId: string, selection?: ArmyUpgradeSelection) => void;
		onRemoveUpgrade: (entryId: string, upgradeId: string) => void;
	};

	let {
		faction,
		units,
		classIndex,
		skillIndex,
		traitIndex,
		combatArtIndex,
		spellcraftIndex,
		spells,
		stratagemIndex,
		itemIndex,
		entries,
		upgrades,
		upgradeIndex,
		rulesIndexes,
		armyRows,
		counts,
		format,
		points,
		limit,
		isOverLimit,
		startOnArmyPanel,
		onReturn,
		onSetFormat,
		onCopyCode,
		onAddUnit,
		onRemoveUnit,
		onRemoveEntry,
		onToggleMount,
		onAddUpgrade,
		onRemoveUpgrade
	}: Props = $props();

	let showArmy = $state(false);
	// Import flow: the store flags a code import, open on the Your-Army panel.
	$effect(() => {
		if (startOnArmyPanel) showArmy = true;
	});
	/** Outcome of the last copy attempt, shown until the army changes. */
	let copyResult = $state<{ code: string; copied: boolean } | null>(null);
	// A stale code is worse than none - drop the panel on any army change.
	$effect(() => {
		if (entries && format) copyResult = null;
	});
	let selectedCard = $state<{
		unit: ArmyUnitSpec;
		stats: ArmyStats;
		mounted: boolean;
		mountName?: string;
		/** Item index with upgrade item overrides merged in (roster cards only). */
		itemIndex?: Record<string, ArmyItemSpec>;
	} | null>(null);
	/** The roster row currently choosing an upgrade, while the picker is open. */
	let pickerRow = $state<ArmyRosterRow | null>(null);
	/** The upgrade shown in the detail window, while it is open. */
	let detailUpgrade = $state<ArmyUpgradeSpec | null>(null);

	function freeUpgradeSlots(row: ArmyRosterRow): number {
		return Math.max(0, upgradeSlotsFor(row.upgradedUnit, row.upgrades) - row.upgrades.length);
	}

	/** One entry per free upgrade slot, keyed by slot index for the each block. */
	function upgradeSlotIndexes(row: ArmyRosterRow): number[] {
		return Array.from({ length: freeUpgradeSlots(row) }, (value, index) => index);
	}

	/** The row's spellcrafts with their upgradability, for the picker's choice step. */
	function spellcraftOptionsFor(row: ArmyRosterRow): ArmySpellcraftOption[] {
		return (row.upgradedUnit.spellcrafts ?? []).flatMap((ref) => {
			const group = spellcraftIndex[ref.id];
			if (!group) return [];
			const cap = spellcraftLevelCap(ref.id, row.upgradedUnit, spells);
			return [
				{ id: ref.id, name: group.name, level: ref.level, upgradable: cap > 0 && ref.level < cap }
			];
		});
	}

	// Swipe detection: a mostly-horizontal pointer gesture flips the panels.
	const SWIPE_MIN_PX = 50;
	let swipeStartX = 0;
	let swipeStartY = 0;

	function formatTabClasses(target: ArmyFormat): string {
		return format === target ? 'bg-sky-500/20 text-sky-100' : 'text-slate-400';
	}

	async function copyArmyCode(): Promise<void> {
		copyResult = await onCopyCode();
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

	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap items-center gap-2">
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
					disabled
					title="Not yet implemented"
					class="cursor-not-allowed px-4 py-1.5 text-sm font-semibold text-slate-500"
				>
					Roster
					<span class="block text-[10px] font-medium">not yet implemented</span>
				</button>
			</div>
			<button
				type="button"
				aria-label="Copy Army Code to Clipboard"
				disabled={entries.length === 0}
				class={'rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition ' +
					(copyResult?.copied
						? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200 active:bg-emerald-200'
						: 'bg-sky-300 text-slate-950 hover:bg-sky-200 active:bg-sky-200') +
					' disabled:cursor-not-allowed disabled:opacity-50'}
				onclick={copyArmyCode}
			>
				{copyResult?.copied ? 'Copied ✓' : 'Copy Army Code'}
			</button>
			<button
				type="button"
				disabled
				title="Not yet implemented"
				class="cursor-not-allowed rounded-xl border-2 border-slate-600/60 bg-slate-900/40 px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-400"
			>
				Save Army
			</button>
		</div>
		<div
			class={'rounded-xl border-2 px-4 py-2 text-sm font-bold tabular-nums ' +
				(isOverLimit ? 'border-red-500/60 text-red-400' : 'border-emerald-500/60 text-emerald-300')}
		>
			{points}/{limit}
		</div>
	</div>

	{#if copyResult}
		<div class="rounded-xl border border-slate-600/60 bg-slate-900/60 px-3 py-2">
			{#if copyResult.copied}
				<p class="text-xs font-semibold text-emerald-300">Army code copied to clipboard ✓</p>
			{:else}
				<p class="text-xs font-semibold text-orange-300">
					Clipboard unavailable — long-press the code below to copy it.
				</p>
			{/if}
			<p class="mt-1 font-mono text-xs break-all text-sky-100 select-all">{copyResult.code}</p>
		</div>
	{/if}

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
								class="flex items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
							>
								{#if unit.icon}
									<button
										type="button"
										aria-label={'Show unit details for ' + unit.name}
										class="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900/60 transition hover:bg-slate-800/60 active:bg-slate-800/80"
										style="border-color: {faction.color}"
										onclick={() => (selectedCard = { unit, stats: unit.stats, mounted: false })}
									>
										<img src={unit.icon} alt="" class="h-full w-full object-contain" />
									</button>
								{/if}
								<div>
									<p class="font-medium text-slate-100">{unit.name}</p>
									<div class="mt-1 flex items-center justify-center gap-1.5">
										<span
											class="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"
										>
											Limit {unit.limit}
										</span>
										<span
											class="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 tabular-nums"
										>
											{unit.points} pts
										</span>
									</div>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									{#if (counts[unit.id] ?? 0) > 0}
										<button
											type="button"
											aria-label={'Remove ' + unit.name}
											class="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-900/60 text-lg font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
											onclick={() => onRemoveUnit(unit.id)}
										>
											−
										</button>
										<span
											class="min-w-4 text-center text-sm font-semibold text-slate-300 tabular-nums"
										>
											{counts[unit.id] ?? 0}
										</span>
									{/if}
									<button
										type="button"
										disabled={(counts[unit.id] ?? 0) >= unit.limit}
										aria-label={'Add ' + unit.name}
										class="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-sky-500/50 bg-slate-900/60 text-lg font-bold text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
										onclick={() => onAddUnit(unit.id)}
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
							{#each armyRows as row (row.entryId)}
								<div class="rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5">
									<div class="flex items-center justify-between gap-2">
										{#if row.icon}
											<button
												type="button"
												aria-label={'Show unit details for ' + row.name}
												class="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900/60 transition hover:bg-slate-800/60 active:bg-slate-800/80"
												style="border-color: {faction.color}"
												onclick={() => {
													selectedCard = {
														unit: row.upgradedUnit,
														stats: row.effectiveStats,
														mounted: row.mounted,
														mountName: row.mount?.name,
														itemIndex: { ...itemIndex, ...row.itemOverrides }
													};
												}}
											>
												<img src={row.icon} alt="" class="h-full w-full object-contain" />
											</button>
										{/if}
										{#if format === 'standard'}
											<div class="flex shrink-0 flex-col gap-1">
												{#each upgradeSlotIndexes(row) as slotIndex (slotIndex)}
													<button
														type="button"
														aria-label={'Add an upgrade to ' + row.name}
														class="flex h-7 w-7 items-center justify-center rounded-md border-2 border-orange-400/50 bg-slate-900/60 text-base font-bold text-orange-300 transition hover:bg-orange-400/10 active:bg-orange-400/20"
														onclick={() => (pickerRow = row)}
													>
														+
													</button>
												{/each}
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="font-medium text-slate-100">
												{row.name}
											</p>
											<span
												class="mt-1 inline-block rounded-md border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 tabular-nums"
											>
												{row.points} pts
											</span>
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
												onclick={() => onToggleMount(row.entryId)}
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
											onclick={() => onRemoveEntry(row.entryId)}
										>
											−
										</button>
									</div>
									{#if format === 'standard' && row.upgrades.length > 0}
										<div class="mt-1.5 space-y-1 pl-8">
											{#each row.upgrades as upgrade (upgrade.id)}
												<div class="flex items-center justify-between gap-2">
													<div class="flex min-w-0 items-center gap-1.5">
														<span class="text-slate-500">└</span>
														<button
															type="button"
															aria-label={'Show details for ' + upgrade.name}
															class="flex min-w-0 items-center gap-1.5 rounded-full bg-orange-400 py-0.5 pr-2.5 pl-0.5 text-[11px] font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
															onclick={() => (detailUpgrade = upgrade)}
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
														<span
															class="shrink-0 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 tabular-nums"
														>
															{upgradeCostInArmy(upgrade, entries, upgradeIndex)} pts
														</span>
													</div>
													<button
														type="button"
														aria-label={'Remove ' + upgrade.name + ' from ' + row.name}
														class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-red-500/50 bg-slate-900/60 text-xs font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
														onclick={() => onRemoveUpgrade(row.entryId, upgrade.id)}
													>
														✕
													</button>
												</div>
											{/each}
										</div>
									{/if}
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
			{classIndex}
			{skillIndex}
			{traitIndex}
			{combatArtIndex}
			{spellcraftIndex}
			{spells}
			{stratagemIndex}
			itemIndex={selectedCard.itemIndex ?? itemIndex}
			stats={selectedCard.stats}
			mounted={selectedCard.mounted}
			mountName={selectedCard.mountName}
			onClose={() => (selectedCard = null)}
		/>
	{/if}

	{#if pickerRow}
		{@const row = pickerRow}
		{@const pickerEntry = entries.find((candidate) => candidate.id === row.entryId)}
		{#if pickerEntry}
			<ArmyUpgradePicker
				entry={pickerEntry}
				unitName={row.name}
				unit={row.upgradedUnit}
				{upgrades}
				{entries}
				{units}
				{upgradeIndex}
				{rulesIndexes}
				{spells}
				{itemIndex}
				spellcraftOptions={spellcraftOptionsFor(row)}
				factionColor={faction.color}
				onSelect={(upgradeId) => {
					onAddUpgrade(row.entryId, upgradeId);
					pickerRow = null;
				}}
				onSelectSpellcraft={(upgradeId, spellcraftId) => {
					onAddUpgrade(row.entryId, upgradeId, { spellcraftId });
					pickerRow = null;
				}}
				onSelectChoice={(upgradeId, optionId, selection) => {
					onAddUpgrade(row.entryId, upgradeId, { optionId, ...selection });
					pickerRow = null;
				}}
				onClose={() => (pickerRow = null)}
			/>
		{/if}
	{/if}

	{#if detailUpgrade}
		<ArmyUpgradeDetail
			upgrade={detailUpgrade}
			cost={upgradeCostInArmy(detailUpgrade, entries, upgradeIndex)}
			factionColor={faction.color}
			onClose={() => (detailUpgrade = null)}
		/>
	{/if}
</div>
