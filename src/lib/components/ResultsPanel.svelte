<script lang="ts">
	import type { ResultObjectiveDef } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		results: ResultObjectiveDef[];
		important?: string[];
		checkedObjectiveCounts: Record<string, number>;
		onSetChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
	};

	let { results, important, checkedObjectiveCounts, onSetChecked }: Props = $props();
</script>

<Panel title="Results">
	<ul class="flex flex-col gap-2">
		{#each results as objective (objective.id)}
			{@const checkedCount = checkedObjectiveCounts[objective.id] ?? 0}
			{@const complete = checkedCount >= objective.count}
			<li class="flex flex-col gap-2 rounded-lg px-2 py-1.5">
				<div class="flex items-start justify-between gap-3">
					<span class={complete ? 'text-slate-500 line-through' : 'text-slate-200'}>
						{objective.text}
					</span>
					<span class="shrink-0 text-sm font-semibold text-sky-300">{objective.vp} VP</span>
				</div>
				{#if objective.count > 1}
					<IncrementBoxes
						count={objective.count}
						{checkedCount}
						onSetChecked={(count) => onSetChecked(objective.id, count, objective.count)}
					/>
				{:else}
					<input
						type="checkbox"
						checked={checkedCount > 0}
						onchange={(event) =>
							onSetChecked(objective.id, (event.target as HTMLInputElement).checked ? 1 : 0, 1)}
						class="h-5 w-5 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
					/>
				{/if}
			</li>
		{/each}
	</ul>

	{#if important && important.length > 0}
		<div class="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
			<p class="text-xs font-semibold tracking-wide text-amber-300 uppercase">Important</p>
			<ul class="mt-1 list-disc pl-4 text-sm text-amber-100/90">
				{#each important as note, index (index)}
					<li>{note}</li>
				{/each}
			</ul>
		</div>
	{/if}
</Panel>
