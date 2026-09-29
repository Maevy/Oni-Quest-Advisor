<script lang="ts">
	import type { ArmyRosterRow, ArmyUpgradeSpec, ArmyView } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';
	import ArmyReadonlyPanel from './ArmyReadonlyPanel.svelte';
	import ArmyUpgradeDetail from './ArmyUpgradeDetail.svelte';
	import UnitCard from './UnitCard.svelte';

	type Props = {
		view: ArmyView;
		/** Whose roster this is — the heading names the player. */
		title: string;
		onClose: () => void;
	};

	let { view, title, onClose }: Props = $props();

	let cardRow = $state<ArmyRosterRow | null>(null);
	let detailUpgrade = $state<ArmyUpgradeSpec | null>(null);

	$effect(() => onEscapeKey(onClose));
</script>

<div
	role="presentation"
	class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-sm"
	onclick={(event) => {
		if (event.target === event.currentTarget) onClose();
	}}
>
	<div class="mx-auto flex min-h-full w-full max-w-xl flex-col gap-3 px-4 py-4">
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-lg font-bold text-slate-100">{title}</h2>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-slate-200 transition hover:bg-slate-700/80"
				aria-label="Close"
				onclick={onClose}
			>
				<span aria-hidden="true">✕</span>
			</button>
		</div>

		<ArmyReadonlyPanel
			{view}
			readOnly
			hint="The roster as it was registered — not the match list built from it."
			onShowUnit={(row) => (cardRow = row)}
			onShowUpgrade={(upgrade) => (detailUpgrade = upgrade)}
		/>
	</div>
</div>

{#if cardRow}
	<UnitCard
		unit={cardRow.upgradedUnit}
		faction={view.faction}
		classIndex={view.classIndex}
		skillIndex={view.skillIndex}
		traitIndex={view.traitIndex}
		combatArtIndex={view.combatArtIndex}
		spellcraftIndex={view.spellcraftIndex}
		spells={view.spells}
		stratagemIndex={view.stratagemIndex}
		itemIndex={{ ...view.itemIndex, ...cardRow.itemOverrides }}
		stats={cardRow.effectiveStats}
		size={cardRow.effectiveSize}
		mounted={cardRow.mounted}
		mountName={cardRow.mount?.name}
		onClose={() => (cardRow = null)}
	/>
{/if}

{#if detailUpgrade}
	<ArmyUpgradeDetail
		upgrade={detailUpgrade}
		cost={detailUpgrade.cost}
		factionColor={view.faction.color}
		onClose={() => (detailUpgrade = null)}
	/>
{/if}
