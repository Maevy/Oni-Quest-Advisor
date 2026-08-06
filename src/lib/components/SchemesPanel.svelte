<script lang="ts">
	import {
		drawCountForIntelligence,
		type ChosenScheme,
		type Faction,
		type SchemeCard,
		type SchemeDraft
	} from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		factions: Faction[];
		schemeDraft: SchemeDraft;
		drawnSchemes: SchemeCard[];
		chosenScheme: ChosenScheme | null;
		chosenSchemeCard: SchemeCard | null;
		onSetFaction: (factionId: string) => void;
		onSetIntelligence: (intelligence: number | null) => void;
		onDraw: () => void;
		onChoose: (schemeId: string) => void;
		onSetChecked: (checkedIncrements: number) => void;
		onDelete: () => void;
	};

	let {
		factions,
		schemeDraft,
		drawnSchemes,
		chosenScheme,
		chosenSchemeCard,
		onSetFaction,
		onSetIntelligence,
		onDraw,
		onChoose,
		onSetChecked,
		onDelete
	}: Props = $props();

	let canDraw = $derived(schemeDraft.factionId !== null && schemeDraft.intelligence !== null);
	let drawCount = $derived(
		schemeDraft.intelligence !== null ? drawCountForIntelligence(schemeDraft.intelligence) : null
	);

	function handleIntelligenceInput(event: Event): void {
		const value = (event.target as HTMLInputElement).value;
		onSetIntelligence(value === '' ? null : Number(value));
	}
</script>

<Panel title="Schemes">
	{#if chosenScheme && chosenSchemeCard}
		<div
			class="flex items-start justify-between gap-3 rounded-xl border border-sky-500/40 bg-slate-900/40 p-3"
		>
			<div>
				<h3 class="font-semibold text-sky-100">{chosenSchemeCard.title}</h3>
				<p class="mt-1 text-sm text-slate-300">{chosenSchemeCard.ruleText}</p>
				<div class="mt-3">
					<IncrementBoxes
						count={chosenSchemeCard.maxIncrements}
						checkedCount={chosenScheme.checkedIncrements}
						{onSetChecked}
					/>
				</div>
			</div>
			<button
				type="button"
				class="shrink-0 rounded-lg border border-red-500/60 bg-slate-900/60 px-2 py-1 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
				onclick={onDelete}
				aria-label="Delete chosen Scheme"
			>
				✕
			</button>
		</div>
	{:else if drawnSchemes.length > 0}
		<div class="flex flex-col gap-2">
			{#each drawnSchemes as card (card.id)}
				<button
					type="button"
					class="rounded-xl border-2 border-sky-500/40 bg-slate-900/40 p-3 text-left transition hover:bg-sky-500/10"
					onclick={() => onChoose(card.id)}
				>
					<h3 class="font-semibold text-sky-100">{card.title}</h3>
					<p class="mt-1 text-sm text-slate-300">{card.ruleText}</p>
				</button>
			{/each}
		</div>
	{:else}
		<div class="flex flex-wrap items-end gap-2">
			<label class="flex flex-col gap-1 text-sm text-slate-300">
				Faction
				<select
					class="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
					value={schemeDraft.factionId ?? ''}
					onchange={(event) => onSetFaction((event.target as HTMLSelectElement).value)}
				>
					<option value="" disabled>Select…</option>
					{#each factions as faction (faction.id)}
						<option value={faction.id}>{faction.name}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1 text-sm text-slate-300">
				Intelligence
				<input
					type="number"
					min="0"
					class="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
					value={schemeDraft.intelligence ?? ''}
					oninput={handleIntelligenceInput}
				/>
			</label>
			<button
				type="button"
				disabled={!canDraw}
				class="rounded-lg border border-sky-500/50 bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40"
				onclick={onDraw}
			>
				Draw Missions
			</button>
			{#if drawCount !== null}
				<span class="text-xs text-slate-500">Draws {drawCount}</span>
			{/if}
		</div>
	{/if}
</Panel>
