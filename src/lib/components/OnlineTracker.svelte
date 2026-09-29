<script lang="ts">
	import { MAX_ROUND } from '$lib/domain';
	import type {
		Mission,
		OnlineGameView,
		PlayerKey,
		ResultsEntry,
		RuleCallout,
		SchemeCard
	} from '$lib/domain';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import OnlineScoringPanel from './OnlineScoringPanel.svelte';
	import Panel from './Panel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type TrackerView = 'p1' | 'p2' | 'army' | 'mission';

	const VIEWS: Array<{ id: TrackerView; label: string }> = [
		{ id: 'p1', label: 'P1 Scoring' },
		{ id: 'p2', label: 'P2 Scoring' },
		{ id: 'army', label: 'Army' },
		{ id: 'mission', label: 'Mission' }
	];

	type Props = {
		view: OnlineGameView;
		mission: Mission;
		/** Results laid out by {@link groupResults} for this mission. */
		entries: ResultsEntry[];
		isLeader: boolean;
		error: string | null;
		myCard: SchemeCard | null;
		/** The opponent's card once revealed; null while it is hidden. */
		opponentCard: SchemeCard | null;
		myVP: number;
		opponentVP: number;
		onSetObjectiveChecked: (objectiveId: string, checkedCount: number) => void;
		onSetSchemeChecked: (checkedIncrements: number) => void;
		onRevealScheme: () => void;
		onAdvance: () => void;
		onReturn: () => void;
	};

	let {
		view,
		mission,
		entries,
		isLeader,
		error,
		myCard,
		opponentCard,
		myVP,
		opponentVP,
		onSetObjectiveChecked,
		onSetSchemeChecked,
		onRevealScheme,
		onAdvance,
		onReturn
	}: Props = $props();

	let activeView = $state<TrackerView>('p1');
	let confirmingReveal = $state(false);
	let openRule = $state<RuleCallout | null>(null);

	let activeIndex = $derived(VIEWS.findIndex((candidate) => candidate.id === activeView));
	let isFinalRound = $derived(view.currentRound >= MAX_ROUND);
	let p1VP = $derived(view.seat === 'player1' ? myVP : opponentVP);
	let p2VP = $derived(view.seat === 'player2' ? myVP : opponentVP);

	/** One seat's scoring data, from whichever side of the filter it sits on. */
	function scoringFor(seat: PlayerKey) {
		const own = view.seat === seat;
		const publicSeat = own ? null : view.opponent;
		return {
			own,
			nickname: own ? view.self.nickname : (publicSeat?.nickname ?? ''),
			checked: own
				? view.self.progress.checkedObjectiveCounts
				: (publicSeat?.checkedObjectiveCounts ?? {}),
			scheme: own ? view.self.progress.scheme : (publicSeat?.revealedScheme ?? null),
			hasScheme: own ? view.self.progress.scheme !== null : (publicSeat?.hasScheme ?? false),
			revealed: own ? view.self.progress.schemeRevealed : (publicSeat?.schemeRevealed ?? false),
			card: own ? myCard : opponentCard,
			vp: seat === 'player1' ? p1VP : p2VP
		};
	}

	// Swipe contract copied from the local trackers: a mostly-horizontal touch or pen gesture of
	// 50 px or more steps between views; a mouse drag stays a text selection.
	const SWIPE_MIN_PX = 50;
	let swipeStart: { x: number; y: number } | null = null;

	function stepView(delta: number): void {
		const index = VIEWS.findIndex((candidate) => candidate.id === activeView);
		activeView = VIEWS[Math.min(Math.max(index + delta, 0), VIEWS.length - 1)].id;
	}

	function onPointerDown(event: PointerEvent): void {
		swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: PointerEvent): void {
		if (!swipeStart) return;
		const dx = event.clientX - swipeStart.x;
		const dy = event.clientY - swipeStart.y;
		swipeStart = null;
		if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
			stepView(dx < 0 ? 1 : -1);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-dvh touch-pan-y flex-col overflow-hidden"
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={() => (swipeStart = null)}
>
	<ScreenHeader title={mission.name} onBack={onReturn}>
		{#snippet actions()}
			<div
				class="relative grid grid-cols-4 rounded-xl border border-slate-600/60 bg-slate-900/60 p-0.5"
				aria-label="Game views"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/4)] rounded-lg bg-sky-500/25 shadow-[0_0_18px_rgba(56,189,248,0.45)] ring-1 ring-sky-300/70 transition-transform duration-300 ease-out motion-reduce:transition-none"
					style="transform: translateX({activeIndex * 100}%)"
				></div>
				{#each VIEWS as item (item.id)}
					<button
						type="button"
						class="relative z-10 rounded-lg px-1.5 py-2 text-xs font-semibold transition-colors duration-300 sm:px-2 sm:text-sm {activeView ===
						item.id
							? 'text-sky-100'
							: 'text-slate-400 hover:text-slate-200'}"
						aria-pressed={activeView === item.id}
						onclick={() => (activeView = item.id)}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/snippet}
	</ScreenHeader>

	<div class="border-b border-slate-700/40 bg-slate-950/60 px-4 py-2">
		<div class="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
			<p class="text-sm font-semibold text-slate-100">
				Round {view.currentRound} / {MAX_ROUND}
			</p>
			<p class="text-sm font-semibold tabular-nums">
				<span class="text-sky-300">{p1VP}</span>
				<span class="text-slate-200"> : </span>
				<span class="text-orange-300">{p2VP}</span>
			</p>
			{#if isLeader}
				<button
					type="button"
					class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10 active:bg-emerald-500/20"
					onclick={onAdvance}
				>
					{isFinalRound ? 'Conclude game' : 'Advance to next round'}
				</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div
			class="border-b border-red-500/40 bg-slate-800/40 px-4 py-2 text-sm text-red-300"
			role="alert"
		>
			{error}
		</div>
	{/if}

	<div class="relative min-h-0 flex-1 overflow-hidden">
		<div
			class="flex h-full w-[400%] transition-transform duration-300 ease-out motion-reduce:transition-none"
			style="transform: translateX(-{(activeIndex * 100) / 4}%)"
		>
			{#each [scoringFor('player1'), scoringFor('player2')] as scoring, index (index)}
				<div class="min-h-0 w-1/4 touch-pan-y overflow-y-auto overscroll-contain pb-6">
					<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
						<OnlineScoringPanel
							seat={index === 0 ? 'player1' : 'player2'}
							nickname={scoring.nickname}
							{entries}
							important={mission.important}
							checked={scoring.checked}
							editable={scoring.own}
							onSetChecked={(objectiveId, checkedCount) =>
								onSetObjectiveChecked(objectiveId, checkedCount)}
							scheme={scoring.scheme}
							schemeCard={scoring.card}
							hasScheme={scoring.hasScheme}
							revealed={scoring.revealed}
							isOwn={scoring.own}
							vp={scoring.vp}
							{onSetSchemeChecked}
							onReveal={() => (confirmingReveal = true)}
						/>
					</div>
				</div>
			{/each}

			<div class="min-h-0 w-1/4 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<Panel title="Army">
						<p class="text-sm text-slate-200 italic">Nothing tracked here yet.</p>
					</Panel>
				</div>
			</div>

			<div class="min-h-0 w-1/4 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<DescriptionPanel
						name={mission.name}
						description={mission.description}
						brokenMorale={mission.brokenMorale}
						ceasefire={mission.ceasefire}
						onOpenRule={(rule) => (openRule = rule)}
					/>
					<SetupPanel setup={mission.setup} />
					<MissionMap map={mission.map} />
					<QuestRulesPanel sections={mission.questRules} />
				</div>
			</div>
		</div>
	</div>
</div>

{#if confirmingReveal}
	<ConfirmDialog
		text="Reveal your scheme? Your opponent will see it and its boxes unlock. This cannot be undone."
		confirmLabel="Reveal"
		cancelLabel="Keep it hidden"
		onConfirm={() => {
			confirmingReveal = false;
			onRevealScheme();
		}}
		onCancel={() => (confirmingReveal = false)}
	/>
{/if}

{#if openRule}
	<RuleCalloutDialog rule={openRule} onClose={() => (openRule = null)} />
{/if}
