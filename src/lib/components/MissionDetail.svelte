<script lang="ts">
	import type { Faction, Mission, MissionProgress, SchemeCard } from '$lib/domain';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import SchemesPanel from './SchemesPanel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';

	type Props = {
		mission: Mission;
		progress: MissionProgress;
		totalVP: number;
		factions: Faction[];
		drawnSchemes: SchemeCard[];
		chosenSchemeCard: SchemeCard | null;
		onReturn: () => void;
		onReset: () => void;
		onSetObjectiveChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
		onSetDraftFaction: (factionId: string) => void;
		onSetDraftIntelligence: (intelligence: number | null) => void;
		onDrawSchemes: () => void;
		onChooseScheme: (schemeId: string) => void;
		onSetSchemeChecked: (checkedIncrements: number) => void;
		onDeleteScheme: () => void;
	};

	let {
		mission,
		progress,
		totalVP,
		factions,
		drawnSchemes,
		chosenSchemeCard,
		onReturn,
		onReset,
		onSetObjectiveChecked,
		onSetDraftFaction,
		onSetDraftIntelligence,
		onDrawSchemes,
		onChooseScheme,
		onSetSchemeChecked,
		onDeleteScheme
	}: Props = $props();
</script>

<div class="min-h-dvh px-4 py-4">
	<div class="mx-auto flex w-full max-w-xl flex-col">
		<div class="flex items-center justify-end gap-2">
			<span class="text-sm font-semibold text-sky-300">{totalVP} VP</span>
			<button
				type="button"
				class="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
				onclick={onReset}
			>
				Reset
			</button>
			<button
				type="button"
				class="rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
				onclick={onReturn}
			>
				Return
			</button>
		</div>

		<div class="mt-6 flex flex-col gap-4">
			<DescriptionPanel
				name={mission.name}
				description={mission.description}
				brokenMorale={mission.brokenMorale}
				ceasefire={mission.ceasefire}
			/>
			<SetupPanel setup={mission.setup} />
			<MissionMap map={mission.map} />
			<ResultsPanel
				results={mission.results}
				checkedObjectiveCounts={progress.checkedObjectiveCounts}
				onSetChecked={onSetObjectiveChecked}
			/>
			<SchemesPanel
				{factions}
				schemeDraft={progress.schemeDraft}
				{drawnSchemes}
				chosenScheme={progress.scheme}
				{chosenSchemeCard}
				onSetFaction={onSetDraftFaction}
				onSetIntelligence={onSetDraftIntelligence}
				onDraw={onDrawSchemes}
				onChoose={onChooseScheme}
				onSetChecked={onSetSchemeChecked}
				onDelete={onDeleteScheme}
			/>
			<QuestRulesPanel sections={mission.questRules} />
		</div>
	</div>
</div>
