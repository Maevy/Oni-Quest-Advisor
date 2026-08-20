<script lang="ts">
	import { MAX_ROUND, MAX_TOTAL_VP } from '$lib/domain';
	import type { Mission, OnlineGameView, ResultObjectiveDef, SchemeCard } from '$lib/domain';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import OnlineResultsPanel from './OnlineResultsPanel.svelte';
	import OnlineSchemesPanel from './OnlineSchemesPanel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type Props = {
		view: OnlineGameView;
		isLeader: boolean;
		error: string | null;
		mission: Mission;
		results: ResultObjectiveDef[];
		myCard: SchemeCard | null;
		myVP: number;
		opponentRevealedCard: SchemeCard | null;
		onToggleRevealIntent: () => void;
		onSetObjectiveChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
		onSetSchemeChecked: (checkedIncrements: number) => void;
		onAdvancePhase: () => void;
		onCloseGame: () => Promise<void>;
	};

	let {
		view,
		isLeader,
		error,
		mission,
		results,
		myCard,
		myVP,
		opponentRevealedCard,
		onToggleRevealIntent,
		onSetObjectiveChecked,
		onSetSchemeChecked,
		onAdvancePhase,
		onCloseGame
	}: Props = $props();

	let confirmingClose = $state(false);
	let acting = $state(false);

	let isReveal = $derived(view.phase === 'reveal');
	let isFinalScoring = $derived(!isReveal && view.currentRound === MAX_ROUND);
	let opponentNickname = $derived(view.opponent?.nickname ?? 'Opponent');

	async function handleConfirmedClose() {
		confirmingClose = false;
		if (acting) return;
		acting = true;
		try {
			await onCloseGame();
		} finally {
			acting = false;
		}
	}
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-4 py-4">
	{#if isLeader}
		<button
			type="button"
			class="self-start rounded-lg border-2 border-red-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
			onclick={() => (confirmingClose = true)}
		>
			Close Game
		</button>
	{/if}

	<div class="text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-slate-100">Game#{view.id}</h1>
		<p class="text-slate-400">
			Round {view.currentRound} — {isReveal ? 'Reveal' : 'Scoring'} Phase
		</p>
		<p class="mt-1 text-sm text-slate-300">
			Your VP: <span class="font-semibold text-sky-300">{myVP} / {MAX_TOTAL_VP}</span>
		</p>
	</div>

	{#if error}
		<div
			class="rounded-xl border border-red-500/40 bg-slate-800/40 p-3 text-sm text-red-300 backdrop-blur"
		>
			{error}
		</div>
	{/if}

	{#if isReveal}
		<div class="rounded-xl border border-emerald-500/30 bg-slate-800/40 p-3 text-sm text-slate-300">
			Reveal phase — press <span class="font-semibold text-emerald-300">Reveal</span> on your scheme if
			you want it shown. It becomes visible to the opponent once scoring starts.
		</div>
	{:else}
		<div class="rounded-xl border border-sky-500/30 bg-slate-800/40 p-3 text-sm text-slate-300">
			Scoring phase — check your objectives and scheme boxes.
		</div>
	{/if}

	<DescriptionPanel
		name={mission.name}
		description={mission.description}
		brokenMorale={mission.brokenMorale}
		ceasefire={mission.ceasefire}
		collapsible
	/>
	<SetupPanel setup={mission.setup} collapsible />
	<MissionMap map={mission.map} collapsible />

	<OnlineResultsPanel
		{results}
		important={mission.important}
		mySeat={view.seat}
		myNickname={view.self.nickname}
		myChecked={view.self.progress.checkedObjectiveCounts}
		{opponentNickname}
		opponentChecked={view.opponent?.checkedObjectiveCounts ?? {}}
		editable={!isReveal}
		onSetChecked={onSetObjectiveChecked}
	/>

	<OnlineSchemesPanel
		mySeat={view.seat}
		myNickname={view.self.nickname}
		phase={view.phase}
		myScheme={view.self.progress.scheme}
		{myCard}
		myRevealIntent={view.self.revealIntent}
		myRevealed={view.self.progress.schemeRevealed}
		{opponentNickname}
		opponent={view.opponent}
		opponentCard={opponentRevealedCard}
		{onToggleRevealIntent}
		{onSetSchemeChecked}
	/>

	<QuestRulesPanel sections={mission.questRules} collapsible />

	<div class="pb-4">
		{#if isLeader}
			{#if isReveal}
				<button
					type="button"
					class="w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
					onclick={onAdvancePhase}
				>
					Round {view.currentRound} Scoring
				</button>
			{:else if isFinalScoring}
				<button
					type="button"
					disabled
					class="w-full cursor-not-allowed rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-8 py-3 text-lg font-medium text-slate-600"
				>
					Finish Game
				</button>
				<p class="mt-2 text-center text-xs text-slate-500">
					Finishing lands with the statistics update.
				</p>
			{:else}
				<button
					type="button"
					class="w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
					onclick={onAdvancePhase}
				>
					Proceed to next round
				</button>
			{/if}
		{:else}
			<p class="text-center text-sm text-slate-400">The game leader advances the rounds.</p>
		{/if}
	</div>
</div>

{#if confirmingClose}
	<ConfirmDialog
		text="Do you really want to close the game ?"
		confirmLabel="Close Game"
		confirming={acting}
		onConfirm={handleConfirmedClose}
		onCancel={() => (confirmingClose = false)}
	/>
{/if}
