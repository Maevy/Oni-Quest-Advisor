<script lang="ts">
	import {
		entryUpgradeBlock,
		upgradeCostInArmy,
		type ArmyEntry,
		type ArmyRulesIndexes,
		type ArmyUnitSpec,
		type ArmyUpgradeBlock,
		type ArmyUpgradeSpec
	} from '$lib/domain';

	type Props = {
		entry: ArmyEntry;
		unitName: string;
		upgrades: ArmyUpgradeSpec[];
		entries: ArmyEntry[];
		units: ArmyUnitSpec[];
		upgradeIndex: Record<string, ArmyUpgradeSpec>;
		rulesIndexes: ArmyRulesIndexes;
		factionColor: string;
		onSelect: (upgradeId: string) => void;
		onClose: () => void;
	};

	let {
		entry,
		unitName,
		upgrades,
		entries,
		units,
		upgradeIndex,
		rulesIndexes,
		factionColor,
		onSelect,
		onClose
	}: Props = $props();

	const BLOCK_LABELS: Record<ArmyUpgradeBlock, string> = {
		locked: 'This model cannot receive upgrades',
		owned: 'Already taken by this model',
		slots: 'No free upgrade slot',
		limit: 'Army limit reached',
		requirement: 'Model does not meet the requirement',
		'max-level': 'Already at the maximum level'
	};

	function blockFor(upgrade: ArmyUpgradeSpec): ArmyUpgradeBlock | null {
		return entryUpgradeBlock(entries, entry.id, upgrade, units, upgradeIndex, rulesIndexes);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
	role="presentation"
	onclick={onClose}
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
>
	<div
		role="dialog"
		tabindex="-1"
		aria-label={'Choose an upgrade for ' + unitName}
		class="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl"
		style="border-color: {factionColor}"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
			event.stopPropagation();
		}}
	>
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">
				Upgrade {unitName}
			</h2>
			<button
				type="button"
				aria-label="Close upgrade picker"
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800"
				onclick={onClose}
			>
				✕
			</button>
		</div>
		<div class="mt-3 space-y-2">
			{#each upgrades as upgrade (upgrade.id)}
				{@const block = blockFor(upgrade)}
				<button
					type="button"
					disabled={block !== null}
					class={'w-full rounded-xl border p-2.5 text-left transition ' +
						(block
							? 'cursor-not-allowed border-slate-700/40 bg-slate-900/40 opacity-50'
							: 'border-slate-700/50 bg-slate-800/40 hover:border-orange-400/50 hover:bg-slate-800/70 active:bg-slate-800/70')}
					onclick={() => onSelect(upgrade.id)}
				>
					<div class="flex gap-2.5">
						{#if upgrade.icon}
							<img
								src={upgrade.icon}
								alt=""
								class="h-14 w-14 shrink-0 rounded-lg border border-slate-700/50 object-cover"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-sm font-medium text-slate-100">{upgrade.name}</p>
								<p class="text-xs font-semibold whitespace-nowrap text-orange-300 tabular-nums">
									{upgradeCostInArmy(upgrade, entries, upgradeIndex)} pts
								</p>
							</div>
							{#if upgrade.limit}
								<p class="mt-0.5 text-[10px] tracking-wide text-slate-500 uppercase">
									Max {upgrade.limit} per army
								</p>
							{/if}
							<p class="mt-1 text-xs text-slate-300">
								{upgrade.description.map((segment) => segment.text).join('')}
							</p>
							{#if block}
								<p class="mt-1 text-xs font-semibold text-red-400">
									{BLOCK_LABELS[block]}
								</p>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>
