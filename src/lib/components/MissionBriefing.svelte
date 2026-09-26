<script lang="ts">
	import type { Mission, ResultsEntry, RuleCallout } from '$lib/domain';
	import type { BriefingArmy } from './briefingArmy';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import MissionDescriptionPanel from './MissionDescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import MissionTitlePanel from './MissionTitlePanel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsBriefingPanel from './ResultsBriefingPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import SchemesBriefingPanel from './SchemesBriefingPanel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import SelectedArmyPanel from './SelectedArmyPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';
	import { seatAccent } from './playerAccent';

	type Props = {
		mission: Mission;
		/** Results laid out for display — plain objectives plus per-round cards. */
		entries: ResultsEntry[];
		/** One slot per player: solo brings one, hot-seat brings one per seat. */
		armies: BriefingArmy[];
		onReturn: () => void;
		/** Opens the saved-army picker for one slot. */
		onPickArmy: (slotId: string) => void;
		onClearArmy: (slotId: string) => void;
		/** Switches to the interactive tracker. */
		onStart: () => void;
	};

	let { mission, entries, armies, onReturn, onPickArmy, onClearArmy, onStart }: Props = $props();

	let confirmNoArmy = $state(false);
	let openRule = $state<RuleCallout | null>(null);

	/**
	 * A run fields its armies for its whole life — the tracker's Army views are read-only — so
	 * starting with a gap is worth a warning. Hot-seat words it per table rather than per seat:
	 * what matters is that the two of them are not both fielding a list.
	 */
	let missingArmyWarning = $derived.by((): string | null => {
		if (armies.every((slot) => slot.army)) return null;
		return armies.length > 1
			? 'It is strongly recommended to start a game with both players having an army. Do you want to proceed?'
			: 'You are starting this game without a selected army. Do you want to proceed?';
	});

	function requestStart(): void {
		if (missingArmyWarning) confirmNoArmy = true;
		else onStart();
	}
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader onBack={onReturn}>
		{#snippet actions()}
			{#each armies as slot (slot.id)}
				<button
					type="button"
					class="rounded-xl px-3 py-2 text-sm font-medium backdrop-blur transition disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600 {seatAccent(
						slot.hue
					).pickButton}"
					onclick={() => onPickArmy(slot.id)}
				>
					{slot.pickLabel}
				</button>
			{/each}
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={requestStart}
			>
				Start Game
			</button>
		{/snippet}
	</ScreenHeader>

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		<MissionTitlePanel name={mission.name} />
		<MissionDescriptionPanel
			description={mission.description}
			brokenMorale={mission.brokenMorale}
			ceasefire={mission.ceasefire}
			onOpenRule={(rule) => (openRule = rule)}
		/>
		{#each armies as slot (slot.id)}
			{#if slot.army}
				<SelectedArmyPanel
					army={slot.army}
					faction={slot.faction}
					title={slot.panelTitle}
					hue={slot.hue}
					onRemove={() => onClearArmy(slot.id)}
				/>
			{/if}
		{/each}
		<SetupPanel setup={mission.setup} />
		<MissionMap map={mission.map} />
		<ResultsBriefingPanel {entries} important={mission.important} />
		<SchemesBriefingPanel />
		<QuestRulesPanel sections={mission.questRules} />
	</div>
</div>

{#if confirmNoArmy}
	<ConfirmDialog
		text={missingArmyWarning ?? ''}
		confirmLabel="Start anyway"
		cancelLabel="Not now"
		onConfirm={() => {
			confirmNoArmy = false;
			onStart();
		}}
		onCancel={() => (confirmNoArmy = false)}
	/>
{/if}

<RuleCalloutDialog rule={openRule} onClose={() => (openRule = null)} />
