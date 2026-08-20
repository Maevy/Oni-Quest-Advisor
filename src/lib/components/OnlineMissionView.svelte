<script lang="ts">
	import { CEASEFIRE_OBJECTIVE_ID, type Mission, type ResultObjectiveDef } from '$lib/domain';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import Panel from './Panel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type Props = {
		mission: Mission;
		/** Scoreable objectives (mission results + ceasefire penalty when applicable). */
		results: ResultObjectiveDef[];
	};

	let { mission, results }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<DescriptionPanel
		name={mission.name}
		description={mission.description}
		brokenMorale={mission.brokenMorale}
		ceasefire={mission.ceasefire}
		collapsible
	/>
	<SetupPanel setup={mission.setup} collapsible />
	<MissionMap map={mission.map} collapsible />
	<Panel title="Results" collapsible>
		<!-- Read-only: objective boxes unlock once the game has started -->
		<div class="flex flex-col gap-2">
			{#each results as objective (objective.id)}
				{@const isCeasefire = objective.id === CEASEFIRE_OBJECTIVE_ID}
				<div
					class="flex items-start justify-between gap-2 rounded-xl border p-3 {isCeasefire
						? 'border-red-500/40 bg-red-950/20'
						: 'border-slate-600/30 bg-slate-900/30'}"
				>
					<p class="text-sm {isCeasefire ? 'text-red-200' : 'text-slate-200'}">
						{objective.text}
					</p>
					<span
						class="shrink-0 text-sm font-semibold {isCeasefire ? 'text-red-300' : 'text-sky-300'}"
					>
						{objective.vp} VP
					</span>
				</div>
			{/each}
			{#if mission.important && mission.important.length > 0}
				<div class="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3">
					<p class="text-xs font-semibold tracking-wide text-amber-300 uppercase">Important</p>
					<ul class="mt-1 list-disc pl-5 text-sm text-amber-100">
						{#each mission.important as note, index (index)}
							<li>{note}</li>
						{/each}
					</ul>
				</div>
			{/if}
			<p class="text-xs text-slate-500">Objectives unlock once the game has started.</p>
		</div>
	</Panel>
	<QuestRulesPanel sections={mission.questRules} collapsible />
</div>
