<script lang="ts">
	import type { ChosenScheme, PlayerKey, ResultsEntry, SchemeCard } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import { PLAYER_SEATS, playerAccent } from './playerAccent';

	type Props = {
		seat: PlayerKey;
		nickname: string;
		entries: ResultsEntry[];
		important?: string[];
		/** This seat's checked objective counts. */
		checked: Record<string, number>;
		/** True only for the viewer's own seat. */
		editable: boolean;
		onSetChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
		scheme: ChosenScheme | null;
		schemeCard: SchemeCard | null;
		/** Whether a scheme exists at all — a hidden one is not the same as none. */
		hasScheme: boolean;
		revealed: boolean;
		isOwn: boolean;
		onSetSchemeChecked: (checkedIncrements: number) => void;
		/** Asks the screen to open its irreversibility confirm; the panel never reveals directly. */
		onReveal: () => void;
	};

	let {
		seat,
		nickname,
		entries,
		important,
		checked,
		editable,
		onSetChecked,
		scheme,
		schemeCard,
		hasScheme,
		revealed,
		isOwn,
		onSetSchemeChecked,
		onReveal
	}: Props = $props();

	let accent = $derived(playerAccent(seat));
	let increments = $derived(scheme?.checkedIncrements ?? 0);
</script>

<!-- The running total lives in the score bar above the views, so this panel only says who the
     seat is — which is what a player scrolling four panes actually needs to know. -->
<Panel title="{PLAYER_SEATS[seat].label} Scoring" titleClass={accent.text}>
	<p class="text-sm text-slate-100">{nickname} is {PLAYER_SEATS[seat].label}</p>
</Panel>

<Panel title="Scheme Results" titleClass={accent.text}>
	{#if !hasScheme}
		<p class="text-sm text-slate-200 italic">No scheme chosen.</p>
	{:else if !revealed}
		{#if isOwn}
			<h3 class="font-semibold text-slate-100">{schemeCard?.title ?? ''}</h3>
			<p class="mt-1 text-sm text-slate-100">{schemeCard?.ruleText ?? ''}</p>
			<button
				type="button"
				class="mt-2 rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onReveal}
			>
				Reveal
			</button>
			<p class="mt-1 text-xs text-slate-200">
				Revealing shows this scheme to your opponent, permanently, and unlocks its boxes.
			</p>
		{:else}
			<p class="text-sm text-slate-200 italic">Hidden Scheme</p>
		{/if}
	{:else}
		<h3 class="font-semibold text-slate-100">{schemeCard?.title ?? ''}</h3>
		<p class="mt-1 text-sm text-slate-100">{schemeCard?.ruleText ?? ''}</p>
		{#if schemeCard}
			<div class="mt-2">
				<IncrementBoxes
					count={schemeCard.maxIncrements}
					checkedCount={increments}
					disabled={!editable}
					onSetChecked={onSetSchemeChecked}
				/>
			</div>
		{/if}
	{/if}
</Panel>

<ResultsPanel {entries} {important} checkedObjectiveCounts={checked} {editable} {onSetChecked} />
