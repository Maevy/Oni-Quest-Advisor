<script lang="ts">
	import { CEASEFIRE_OBJECTIVE_ID, type PlayerKey, type ResultObjectiveDef } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		results: ResultObjectiveDef[];
		important?: string[];
		mySeat: PlayerKey;
		myNickname: string;
		myChecked: Record<string, number>;
		opponentNickname: string;
		opponentChecked: Record<string, number>;
		/** Own boxes are only editable during the Scoring phase. */
		editable: boolean;
		onSetChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
	};

	let {
		results,
		important,
		mySeat,
		myNickname,
		myChecked,
		opponentNickname,
		opponentChecked,
		editable,
		onSetChecked
	}: Props = $props();

	const ACCENTS = {
		player1: { border: 'border-sky-500/30', text: 'text-sky-300' },
		player2: { border: 'border-orange-500/30', text: 'text-orange-300' }
	} as const;

	let myAccent = $derived(ACCENTS[mySeat]);
	let opponentAccent = $derived(ACCENTS[mySeat === 'player1' ? 'player2' : 'player1']);
</script>

<Panel title="Results">
	<div class="flex flex-col gap-3">
		{#each results as objective (objective.id)}
			{@const isCeasefire = objective.id === CEASEFIRE_OBJECTIVE_ID}
			<div
				class="rounded-xl border p-3 {isCeasefire
					? 'border-red-500/40 bg-red-950/20'
					: 'border-slate-600/30 bg-slate-900/30'}"
			>
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm {isCeasefire ? 'text-red-200' : 'text-slate-200'}">
						{objective.text}
					</p>
					<span
						class="shrink-0 text-sm font-semibold {isCeasefire ? 'text-red-300' : 'text-sky-300'}"
					>
						{objective.vp} VP
					</span>
				</div>
				<div class="mt-2 grid grid-cols-2 gap-2">
					<div class="rounded-lg border p-2 {myAccent.border}">
						<p class="mb-1 text-xs font-semibold {myAccent.text}">{myNickname} (you)</p>
						<IncrementBoxes
							count={objective.count}
							checkedCount={myChecked[objective.id] ?? 0}
							disabled={!editable}
							onSetChecked={(count) => onSetChecked(objective.id, count, objective.count)}
						/>
					</div>
					<div class="rounded-lg border p-2 {opponentAccent.border}">
						<p class="mb-1 text-xs font-semibold {opponentAccent.text}">{opponentNickname}</p>
						<IncrementBoxes
							count={objective.count}
							checkedCount={opponentChecked[objective.id] ?? 0}
							disabled
							onSetChecked={() => {}}
						/>
					</div>
				</div>
			</div>
		{/each}
		{#if important && important.length > 0}
			<div class="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3">
				<p class="text-xs font-semibold tracking-wide text-amber-300 uppercase">Important</p>
				<ul class="mt-1 list-disc pl-5 text-sm text-amber-100">
					{#each important as note, index (index)}
						<li>{note}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</Panel>
