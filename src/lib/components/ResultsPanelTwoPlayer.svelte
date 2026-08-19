<script lang="ts">
	import { CEASEFIRE_OBJECTIVE_ID, type ResultObjectiveDef } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		results: ResultObjectiveDef[];
		important?: string[];
		checkedP1: Record<string, number>;
		checkedP2: Record<string, number>;
		onSetCheckedP1: (objectiveId: string, checkedCount: number, maxCount: number) => void;
		onSetCheckedP2: (objectiveId: string, checkedCount: number, maxCount: number) => void;
	};

	let { results, important, checkedP1, checkedP2, onSetCheckedP1, onSetCheckedP2 }: Props =
		$props();
</script>

<Panel title="Results">
	<ul class="flex flex-col gap-3">
		{#each results as objective (objective.id)}
			{@const countP1 = checkedP1[objective.id] ?? 0}
			{@const countP2 = checkedP2[objective.id] ?? 0}
			{@const isCeasefire = objective.id === CEASEFIRE_OBJECTIVE_ID}
			<li
				class="flex flex-col gap-2 rounded-lg {isCeasefire
					? 'border border-red-500/60 bg-red-500/10 px-3 py-2'
					: 'px-2 py-1.5'}"
			>
				<div class="flex items-start justify-between gap-3">
					<span class="text-slate-200">{objective.text}</span>
					<span
						class="shrink-0 text-sm font-semibold {isCeasefire ? 'text-red-300' : 'text-sky-300'}"
					>
						{objective.vp} VP
					</span>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div class="rounded-lg border border-sky-500/40 bg-sky-500/5 px-2 py-1.5">
						<span class="mb-1 block text-[10px] font-semibold tracking-wide text-sky-400 uppercase"
							>P1</span
						>
						{#if objective.count > 1}
							<IncrementBoxes
								count={objective.count}
								checkedCount={countP1}
								onSetChecked={(count) => onSetCheckedP1(objective.id, count, objective.count)}
							/>
						{:else}
							<input
								type="checkbox"
								checked={countP1 > 0}
								onchange={(event) =>
									onSetCheckedP1(
										objective.id,
										(event.target as HTMLInputElement).checked ? 1 : 0,
										1
									)}
								class="h-5 w-5 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
							/>
						{/if}
					</div>
					<div class="rounded-lg border border-orange-500/40 bg-orange-500/5 px-2 py-1.5">
						<span
							class="mb-1 block text-[10px] font-semibold tracking-wide text-orange-400 uppercase"
							>P2</span
						>
						{#if objective.count > 1}
							<IncrementBoxes
								count={objective.count}
								checkedCount={countP2}
								onSetChecked={(count) => onSetCheckedP2(objective.id, count, objective.count)}
							/>
						{:else}
							<input
								type="checkbox"
								checked={countP2 > 0}
								onchange={(event) =>
									onSetCheckedP2(
										objective.id,
										(event.target as HTMLInputElement).checked ? 1 : 0,
										1
									)}
								class="h-5 w-5 rounded border-slate-500 bg-slate-900 text-orange-500 focus:ring-orange-500"
							/>
						{/if}
					</div>
				</div>
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
