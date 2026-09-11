<script lang="ts">
	import {
		CEASEFIRE_OBJECTIVE_ID,
		type ObjectiveRoundRow,
		type ResultObjectiveDef,
		type ResultsEntry
	} from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';
	import { roundAccent } from './roundAccent';

	type Props = {
		/** Results laid out by {@link groupResults} — plain objectives and per-round cards. */
		entries: ResultsEntry[];
		important?: string[];
		checkedObjectiveCounts: Record<string, number>;
		onSetChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
	};

	let { entries, important, checkedObjectiveCounts, onSetChecked }: Props = $props();

	function entryKey(entry: ResultsEntry): string {
		return entry.kind === 'roundGroup' ? `group:${entry.group}` : `objective:${entry.objective.id}`;
	}

	function checkedCountOf(objective: ResultObjectiveDef): number {
		return checkedObjectiveCounts[objective.id] ?? 0;
	}

	function isComplete(objective: ResultObjectiveDef): boolean {
		return checkedCountOf(objective) >= objective.count;
	}

	/** A per-round card is done once every round that can score is maxed out. */
	function isGroupComplete(rows: ObjectiveRoundRow[]): boolean {
		const scoreable = rows.flatMap((row) => (row.objective ? [row.objective] : []));
		return scoreable.length > 0 && scoreable.every(isComplete);
	}
</script>

<Panel title="Results">
	<ul class="flex flex-col gap-2.5">
		{#each entries as entry (entryKey(entry))}
			{#if entry.kind === 'roundGroup'}
				{@const complete = isGroupComplete(entry.rows)}
				<li class="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
					<div class="flex items-start justify-between gap-3">
						<span class={complete ? 'text-slate-500 line-through' : 'text-slate-200'}>
							{entry.text}
						</span>
						<span class="shrink-0 text-sm font-semibold text-sky-300">{entry.vp} VP</span>
					</div>
					<ul class="mt-2.5 flex flex-col gap-1.5">
						{#each entry.rows as row (row.round)}
							{@const objective = row.objective}
							{@const accent = roundAccent(row.round)}
							<li
								class="flex items-center gap-3 rounded-lg border px-2.5 py-1.5 {objective
									? `border-slate-600/30 ${accent.background}`
									: 'border-slate-700/25 bg-slate-800/20'}"
							>
								<span
									class="w-16 shrink-0 text-[10px] font-bold tracking-wide uppercase {objective
										? accent.text
										: 'text-slate-600'}"
								>
									Round {row.round}
								</span>
								{#if objective}
									<IncrementBoxes
										count={objective.count}
										checkedCount={checkedCountOf(objective)}
										onSetChecked={(count) => onSetChecked(objective.id, count, objective.count)}
									/>
								{:else}
									<span class="text-xs text-slate-600 italic">No VP</span>
								{/if}
							</li>
						{/each}
					</ul>
				</li>
			{:else}
				{@const objective = entry.objective}
				{@const checkedCount = checkedCountOf(objective)}
				{@const complete = checkedCount >= objective.count}
				{@const isCeasefire = objective.id === CEASEFIRE_OBJECTIVE_ID}
				<li
					class="flex flex-col gap-2 rounded-lg {isCeasefire
						? 'border border-red-500/60 bg-red-500/10 px-3 py-2'
						: 'px-2 py-1.5'}"
				>
					<div class="flex items-start justify-between gap-3">
						<span class={complete ? 'text-slate-500 line-through' : 'text-slate-200'}>
							{objective.text}
						</span>
						<span
							class="shrink-0 text-sm font-semibold {isCeasefire ? 'text-red-300' : 'text-sky-300'}"
						>
							{objective.vp} VP
						</span>
					</div>
					{#if objective.count > 1}
						<IncrementBoxes
							count={objective.count}
							{checkedCount}
							tone={isCeasefire ? 'penalty' : 'score'}
							onSetChecked={(count) => onSetChecked(objective.id, count, objective.count)}
						/>
					{:else}
						<input
							type="checkbox"
							checked={checkedCount > 0}
							onchange={(event) =>
								onSetChecked(objective.id, (event.target as HTMLInputElement).checked ? 1 : 0, 1)}
							class="h-5 w-5 rounded border-slate-500 bg-slate-900 {isCeasefire
								? 'text-red-500 focus:ring-red-500'
								: 'text-sky-500 focus:ring-sky-500'}"
						/>
					{/if}
				</li>
			{/if}
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
