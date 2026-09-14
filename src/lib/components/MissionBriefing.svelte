<script lang="ts">
	import type { ArmyFactionConfig, Mission, PickedArmy, ResultsEntry } from '$lib/domain';
	import MissionDescriptionPanel from './MissionDescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import MissionTitlePanel from './MissionTitlePanel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsBriefingPanel from './ResultsBriefingPanel.svelte';
	import SchemesBriefingPanel from './SchemesBriefingPanel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import SelectedArmyPanel from './SelectedArmyPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type Props = {
		mission: Mission;
		/** Results laid out for display — plain objectives plus per-round cards. */
		entries: ResultsEntry[];
		/** The army attached to this run, if any. */
		pickedArmy: PickedArmy | null;
		pickedArmyFaction: ArmyFactionConfig | undefined;
		onReturn: () => void;
		/** Opens the saved-army picker. */
		onPickArmy: () => void;
		onClearArmy: () => void;
		/** Switches to the interactive tracker. */
		onStart: () => void;
	};

	let {
		mission,
		entries,
		pickedArmy,
		pickedArmyFaction,
		onReturn,
		onPickArmy,
		onClearArmy,
		onStart
	}: Props = $props();
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader onBack={onReturn}>
		{#snippet actions()}
			<button
				type="button"
				class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={onPickArmy}
			>
				Pick Army
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={onStart}
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
		/>
		{#if pickedArmy}
			<SelectedArmyPanel army={pickedArmy} faction={pickedArmyFaction} onRemove={onClearArmy} />
		{/if}
		<SetupPanel setup={mission.setup} />
		<MissionMap map={mission.map} />
		<ResultsBriefingPanel {entries} important={mission.important} />
		<SchemesBriefingPanel />
		<QuestRulesPanel sections={mission.questRules} />
	</div>
</div>
