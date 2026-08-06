<script lang="ts">
	import type { ResultObjectiveDef } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		results: ResultObjectiveDef[];
		checkedObjectiveCounts: Record<string, number>;
		onSetChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
	};

	let { results, checkedObjectiveCounts, onSetChecked }: Props = $props();
</script>

<Panel title="Results">
	<ul class="flex flex-col gap-2">
		{#each results as objective (objective.id)}
			{@const checkedCount = checkedObjectiveCounts[objective.id] ?? 0}
			{@const complete = checkedCount >= objective.count}
			<li class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
				<span class="flex items-center gap-3">
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
					<span class={complete ? 'text-slate-500 line-through' : 'text-slate-200'}>
						{objective.text}
					</span>
				</span>
				<span class="shrink-0 text-sm font-semibold text-sky-300">{objective.vp} VP</span>
			</li>
		{/each}
	</ul>
</Panel>
