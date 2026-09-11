<script lang="ts">
	import { CEASEFIRE_OBJECTIVE_ID, type ResultsEntry } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';
	import { roundAccent } from './roundAccent';

	type Props = {
		/** Results laid out by {@link groupResults} — plain objectives and per-round cards. */
		entries: ResultsEntry[];
		important?: string[];
		collapsible?: boolean;
	};

	let { entries, important, collapsible = false }: Props = $props();

	function entryKey(entry: ResultsEntry): string {
		return entry.kind === 'roundGroup' ? `group:${entry.group}` : `objective:${entry.objective.id}`;
	}
</script>

<Panel title="Results" {collapsible}>
	<ul class="flex flex-col gap-2.5">
		{#each entries as entry (entryKey(entry))}
			{#if entry.kind === 'roundGroup'}
				<li class="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
					<div class="flex items-start justify-between gap-3">
						<span class="text-slate-200">{entry.text}</span>
						<span class="shrink-0 text-sm font-semibold text-sky-300">{entry.vp} VP</span>
					</div>
					<ul class="mt-2.5 flex flex-col gap-1.5">
						{#each entry.rows as row (row.round)}
							{@const accent = roundAccent(row.round)}
							<li
								class="flex items-center gap-3 rounded-lg border px-2.5 py-1.5 {row.objective
									? `border-slate-600/30 ${accent.background}`
									: 'border-slate-700/25 bg-slate-800/20'}"
							>
								<span
									class="w-16 shrink-0 text-[10px] font-bold tracking-wide uppercase {row.objective
										? accent.text
										: 'text-slate-600'}"
								>
									Round {row.round}
								</span>
								{#if row.objective}
									<IncrementBoxes
										count={row.objective.count}
										checkedCount={0}
										disabled
										onSetChecked={() => {}}
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
				{@const isCeasefire = objective.id === CEASEFIRE_OBJECTIVE_ID}
				<li
					class="flex flex-col gap-2 rounded-xl border px-3 py-2 {isCeasefire
						? 'border-red-500/60 bg-red-500/10'
						: 'border-slate-700/40 bg-slate-900/40'}"
				>
					<div class="flex items-start justify-between gap-3">
						<span class="text-slate-200">{objective.text}</span>
						<span
							class="shrink-0 text-sm font-semibold {isCeasefire ? 'text-red-300' : 'text-sky-300'}"
						>
							{objective.vp} VP
						</span>
					</div>
					<IncrementBoxes
						count={objective.count}
						checkedCount={0}
						disabled
						tone={isCeasefire ? 'penalty' : 'score'}
						onSetChecked={() => {}}
					/>
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
