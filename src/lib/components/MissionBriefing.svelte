<script lang="ts">
	import type { Mission, ResultsEntry } from '$lib/domain';
	import MissionDescriptionPanel from './MissionDescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import MissionTitlePanel from './MissionTitlePanel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsBriefingPanel from './ResultsBriefingPanel.svelte';
	import SchemesBriefingPanel from './SchemesBriefingPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type Props = {
		mission: Mission;
		/** Results laid out for display — plain objectives plus per-round cards. */
		entries: ResultsEntry[];
		onReturn: () => void;
	};

	let { mission, entries, onReturn }: Props = $props();
</script>

<div class="min-h-dvh pb-6">
	<header class="sticky top-0 z-30 border-b border-slate-700/40 bg-slate-950/80 backdrop-blur">
		<div class="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-2.5">
			<button
				type="button"
				class="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-red-400 active:bg-red-400"
				onclick={onReturn}
			>
				<span aria-hidden="true">←</span> Return
			</button>
			<div class="ml-auto flex items-center gap-2">
				<!-- Wired up once armies attach to a mission run. -->
				<button
					type="button"
					disabled
					class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				>
					Upload Army
				</button>
				<!-- Phase 2 of the solo flow. -->
				<button
					type="button"
					disabled
					class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				>
					Start Game
				</button>
			</div>
		</div>
	</header>

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		<MissionTitlePanel name={mission.name} />
		<MissionDescriptionPanel
			description={mission.description}
			brokenMorale={mission.brokenMorale}
			ceasefire={mission.ceasefire}
		/>
		<SetupPanel setup={mission.setup} />
		<MissionMap map={mission.map} />
		<ResultsBriefingPanel {entries} important={mission.important} />
		<SchemesBriefingPanel />
		<QuestRulesPanel sections={mission.questRules} />
	</div>
</div>
