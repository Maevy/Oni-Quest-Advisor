<script lang="ts">
	import { romanNumeral, type ArmyUnitSpec, type AvailableSummon } from '$lib/domain';

	type Props = {
		/** What this model may call, in catalog order (tier, then name). */
		summons: AvailableSummon[];
		/** A portrait was tapped: the screen opens that creature's card above this dialog. */
		onInfo: (unit: ArmyUnitSpec) => void;
		/** Summon was pressed: the parent commits the creature and folds the dialog. */
		onSummon: (unitId: string) => void;
		/** Optional; the parent overlay's backdrop usually dismisses too. */
		onCancel?: () => void;
		/** Heading above the list. */
		title?: string;
	};

	let { summons, onInfo, onSummon, onCancel, title = 'Summon Creature' }: Props = $props();

	/** How the creature is reached, which is what tells the two summoning families apart. */
	function sourceLabel(summon: AvailableSummon): string {
		const tier = `Tier ${romanNumeral(summon.tier)}`;
		if (summon.source.kind === 'necromancy') return `${tier} · Necromancy`;
		const element = summon.source.element.charAt(0).toUpperCase() + summon.source.element.slice(1);
		return `${tier} · Conjuration (${element})`;
	}
</script>

<div class="rounded-2xl border border-slate-600/60 bg-slate-900/95 p-4">
	<p class="text-xs tracking-wide text-purple-300 uppercase">{title}</p>
	<div class="mt-3 max-h-[42dvh] space-y-2 overflow-y-auto overscroll-contain">
		{#each summons as summon (summon.unit.id)}
			<div
				class="flex items-center gap-3 rounded-xl border border-slate-600/60 bg-slate-950/60 p-2"
			>
				<!-- The portrait is its own control: tapping it looks the creature up rather than
				     calling it, so a player can check a statline before committing a summon. -->
				<button
					type="button"
					aria-label="Show {summon.unit.name}"
					class="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-purple-400/50
						bg-slate-900 transition-colors duration-150 outline-none hover:border-purple-300
						focus-visible:border-purple-200"
					onclick={() => onInfo(summon.unit)}
				>
					{#if summon.unit.icon}
						<img src={summon.unit.icon} alt="" class="h-full w-full object-contain" />
					{:else}
						<span
							class="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300"
						>
							{summon.unit.name.charAt(0)}
						</span>
					{/if}
				</button>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-semibold text-slate-100">{summon.unit.name}</p>
					<p class="truncate text-[10px] text-slate-400">{sourceLabel(summon)}</p>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-lg border border-purple-400/50 bg-purple-400/10 px-3 py-2
						text-xs font-semibold text-purple-100 transition-colors duration-150 outline-none
						hover:bg-purple-400/20 focus-visible:border-purple-200"
					onclick={() => onSummon(summon.unit.id)}
				>
					Summon
				</button>
			</div>
		{/each}
	</div>
	<p class="mt-3 text-center text-[11px] text-slate-400">Tap a portrait for the model's card</p>
	{#if onCancel}
		<div class="mt-2 flex gap-2">
			<button
				type="button"
				class="rounded-lg border border-slate-600/60 px-3 py-2 text-sm text-slate-300
					outline-none focus-visible:border-sky-200"
				onclick={onCancel}
			>
				Cancel
			</button>
		</div>
	{/if}
</div>
