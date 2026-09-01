<script lang="ts">
	import {
		entryUpgradeBlock,
		inscribableItems,
		upgradeCostInArmy,
		upgradeOptionUsable,
		type ArmyEntry,
		type ArmyItemSpec,
		type ArmyRulesIndexes,
		type ArmySpellSpec,
		type ArmySpellcraftOption,
		type ArmyUnitSpec,
		type ArmyUpgradeBlock,
		type ArmyUpgradeSpec
	} from '$lib/domain';

	type Props = {
		entry: ArmyEntry;
		unitName: string;
		/** The upgraded unit of the entry, for spellcraft/option/item steps. */
		unit: ArmyUnitSpec;
		upgrades: ArmyUpgradeSpec[];
		entries: ArmyEntry[];
		units: ArmyUnitSpec[];
		upgradeIndex: Record<string, ArmyUpgradeSpec>;
		rulesIndexes: ArmyRulesIndexes;
		spells: ArmySpellSpec[];
		itemIndex: Record<string, ArmyItemSpec>;
		spellcraftOptions: ArmySpellcraftOption[];
		factionColor: string;
		onSelect: (upgradeId: string) => void;
		onSelectSpellcraft: (upgradeId: string, spellcraftId: string) => void;
		onSelectChoice: (upgradeId: string, optionId: string, itemId?: string) => void;
		onClose: () => void;
	};

	let {
		entry,
		unitName,
		unit,
		upgrades,
		entries,
		units,
		upgradeIndex,
		rulesIndexes,
		spells,
		itemIndex,
		spellcraftOptions,
		factionColor,
		onSelect,
		onSelectSpellcraft,
		onSelectChoice,
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

	/** Set while extra selections (spellcraft, option, item) are needed. */
	let pendingUpgrade = $state<ArmyUpgradeSpec | null>(null);
	let pendingOptionId = $state<string | null>(null);

	function blockFor(upgrade: ArmyUpgradeSpec): ArmyUpgradeBlock | null {
		return entryUpgradeBlock(
			entries,
			entry.id,
			upgrade,
			units,
			upgradeIndex,
			rulesIndexes,
			spells,
			itemIndex
		);
	}

	function choiceEffectOf(upgrade: ArmyUpgradeSpec | null) {
		return upgrade?.effects.find(
			(effect): effect is Extract<ArmyUpgradeSpec['effects'][number], { kind: 'choice' }> =>
				effect.kind === 'choice'
		);
	}

	function pickUpgrade(upgrade: ArmyUpgradeSpec): void {
		const needsSpellcraft =
			upgrade.effects.some((effect) => effect.kind === 'spellcraftLevelUp') &&
			spellcraftOptions.filter((option) => option.upgradable).length > 1;
		if (needsSpellcraft || choiceEffectOf(upgrade) !== undefined) {
			pendingUpgrade = upgrade;
			pendingOptionId = null;
		} else {
			onSelect(upgrade.id);
		}
	}

	function back(): void {
		if (pendingOptionId !== null) pendingOptionId = null;
		else pendingUpgrade = null;
	}

	function inscribableFor(optionId: string): ArmyItemSpec[] {
		const option = choiceEffectOf(pendingUpgrade)?.options.find(
			(candidate) => candidate.id === optionId
		);
		if (!option?.inscribeItem) return [];
		return inscribableItems(unit, itemIndex, option.inscribeItem.except);
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
		{#if pendingUpgrade && choiceEffectOf(pendingUpgrade) && pendingOptionId !== null}
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Choose an Item</h2>
				<button
					type="button"
					aria-label="Back to the options"
					class="rounded-lg border border-slate-600/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800"
					onclick={back}
				>
					Back
				</button>
			</div>
			<p class="mt-2 text-xs text-slate-400">
				{pendingUpgrade.name}: choose the item to inscribe. Its weight drops by 1 and its Strike
				rises by 1.
			</p>
			<div class="mt-3 space-y-2">
				{#each inscribableFor(pendingOptionId) as item (item.id)}
					<button
						type="button"
						class="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5 text-left transition hover:border-orange-400/50 hover:bg-slate-800/70 active:bg-slate-800/70"
						onclick={() =>
							pendingUpgrade &&
							pendingOptionId !== null &&
							onSelectChoice(pendingUpgrade.id, pendingOptionId, item.id)}
					>
						<p class="text-sm font-medium text-slate-100">{item.name}</p>
						<p class="text-[10px] whitespace-nowrap text-slate-400 uppercase">
							WGT {item.weight}
						</p>
					</button>
				{/each}
			</div>
		{:else if pendingUpgrade && choiceEffectOf(pendingUpgrade)}
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Choose an Option</h2>
				<button
					type="button"
					aria-label="Back to the upgrade list"
					class="rounded-lg border border-slate-600/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800"
					onclick={back}
				>
					Back
				</button>
			</div>
			<p class="mt-2 text-xs text-slate-400">{pendingUpgrade.name}: choose one option.</p>
			<div class="mt-3 space-y-2">
				{#each choiceEffectOf(pendingUpgrade)?.options ?? [] as option (option.id)}
					{@const usable = upgradeOptionUsable(option, unit, itemIndex)}
					<button
						type="button"
						disabled={!usable}
						class={'w-full rounded-xl border p-2.5 text-left transition ' +
							(usable
								? 'border-slate-700/50 bg-slate-800/40 hover:border-orange-400/50 hover:bg-slate-800/70 active:bg-slate-800/70'
								: 'cursor-not-allowed border-slate-700/40 bg-slate-900/40 opacity-50')}
						onclick={() => {
							if (!pendingUpgrade) return;
							if (option.inscribeItem) pendingOptionId = option.id;
							else onSelectChoice(pendingUpgrade.id, option.id);
						}}
					>
						<p class="text-sm font-medium text-slate-100">{option.label}</p>
						{#if !usable}
							<p class="mt-0.5 text-xs font-semibold text-red-400">No item to inscribe</p>
						{/if}
					</button>
				{/each}
			</div>
		{:else if pendingUpgrade}
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">
					Advance a Spellcraft
				</h2>
				<button
					type="button"
					aria-label="Back to the upgrade list"
					class="rounded-lg border border-slate-600/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800"
					onclick={back}
				>
					Back
				</button>
			</div>
			<p class="mt-2 text-xs text-slate-400">
				{pendingUpgrade.name}: choose which spellcraft to raise one level.
			</p>
			<div class="mt-3 space-y-2">
				{#each spellcraftOptions as option (option.id)}
					<button
						type="button"
						disabled={!option.upgradable}
						class={'w-full rounded-xl border p-2.5 text-left transition ' +
							(option.upgradable
								? 'border-slate-700/50 bg-slate-800/40 hover:border-orange-400/50 hover:bg-slate-800/70 active:bg-slate-800/70'
								: 'cursor-not-allowed border-slate-700/40 bg-slate-900/40 opacity-50')}
						onclick={() => pendingUpgrade && onSelectSpellcraft(pendingUpgrade.id, option.id)}
					>
						<p class="text-sm font-medium text-slate-100">{option.name}</p>
						{#if option.upgradable}
							<p class="mt-0.5 text-xs text-slate-300">
								Level {option.level} → {option.level + 1}
							</p>
						{:else}
							<p class="mt-0.5 text-xs font-semibold text-red-400">Already at the maximum level</p>
						{/if}
					</button>
				{/each}
			</div>
		{:else}
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
						onclick={() => pickUpgrade(upgrade)}
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
		{/if}
	</div>
</div>
