<script lang="ts">
	import type {
		ArmyView,
		BattleFlowerSpec,
		Faction,
		Mission,
		PlayerKey,
		ResultsEntry,
		RuleCallout,
		SchemeCard,
		TwoPlayerMissionProgress
	} from '$lib/domain';
	import ActivePlayerPanel from './ActivePlayerPanel.svelte';
	import BattleFlowerFocus from './BattleFlowerFocus.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import BattleFlowersPanel from './BattleFlowersPanel.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import CountdownOverlay from './CountdownOverlay.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import SchemesPanelTwoPlayer from './SchemesPanelTwoPlayer.svelte';
	import ScoreSummaryPanelTwoPlayer from './ScoreSummaryPanelTwoPlayer.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type GameView = 'scoring' | 'army' | 'mission';

	const VIEWS: Array<{ id: GameView; label: string }> = [
		{ id: 'scoring', label: 'Scoring' },
		{ id: 'army', label: 'Army' },
		{ id: 'mission', label: 'Mission' }
	];

	type Props = {
		mission: Mission;
		/** Results laid out by {@link groupResults} — plain objectives plus per-round cards. */
		entries: ResultsEntry[];
		progress: TwoPlayerMissionProgress;
		totalVPP1: number;
		totalVPP2: number;
		factions: Faction[];
		drawnP1: SchemeCard[];
		drawnP2: SchemeCard[];
		chosenCardP1: SchemeCard | null;
		chosenCardP2: SchemeCard | null;
		activePlayer: PlayerKey;
		/** Each seat's attached army, resolved for display; null when that seat picked none. */
		armyViewP1: ArmyView | null;
		armyViewP2: ArmyView | null;
		/** Called once the player confirms — abandoning discards both seats' progress. */
		onAbandon: () => void;
		onSetObjectiveChecked: (
			player: PlayerKey,
			objectiveId: string,
			checkedCount: number,
			maxCount: number
		) => void;
		onSetDraftFaction: (player: PlayerKey, factionId: string) => void;
		onSetDraftIntelligence: (player: PlayerKey, intelligence: number | null) => void;
		onDrawSchemes: (player: PlayerKey) => void;
		onChooseScheme: (player: PlayerKey, schemeId: string) => void;
		onSetSchemeChecked: (player: PlayerKey, checkedIncrements: number) => void;
		onDeleteScheme: (player: PlayerKey) => void;
		onRevealScheme: (player: PlayerKey) => void;
		onSetRound: (round: number) => void;
		onSwap: () => void;
	};

	let {
		mission,
		entries,
		progress,
		totalVPP1,
		totalVPP2,
		factions,
		drawnP1,
		drawnP2,
		chosenCardP1,
		chosenCardP2,
		activePlayer,
		armyViewP1,
		armyViewP2,
		onAbandon,
		onSetObjectiveChecked,
		onSetDraftFaction,
		onSetDraftIntelligence,
		onDrawSchemes,
		onChooseScheme,
		onSetSchemeChecked,
		onDeleteScheme,
		onRevealScheme,
		onSetRound,
		onSwap
	}: Props = $props();

	/** A started game always opens on the score sheet; the other two views are reference. */
	let view = $state<GameView>('scoring');
	let confirmAbandon = $state(false);
	let isSwapping = $state(false);

	// The rule popups live at the screen root: the sliding strip carries a transform, which
	// would become the containing block for their fixed overlays and trap them inside a pane.
	let openRule = $state<RuleCallout | null>(null);
	// The focused flower, and the slot its overlay glides from and back to.
	let focus = $state<{ flower: BattleFlowerSpec; rect: FlowerRect } | null>(null);

	/** Which of the three view buttons the spotlight sits under. */
	let activeIndex = $derived(VIEWS.findIndex((candidate) => candidate.id === view));

	// Swipe detection, same contract as the solo tracker and the army builder: a mostly-horizontal
	// pointer gesture steps between the views. Touch and pen only — a mouse drag is a text
	// selection on desktop, and letting it double as a swipe makes the browser cancel the gesture
	// (and swallow the click) mid-drag.
	const SWIPE_MIN_PX = 50;
	let swipeStart: { x: number; y: number } | null = null;

	function stepView(delta: number): void {
		const index = VIEWS.findIndex((candidate) => candidate.id === view);
		view = VIEWS[Math.min(Math.max(index + delta, 0), VIEWS.length - 1)].id;
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

	function onPointerCancel(): void {
		// The browser took the gesture over for scrolling - no swipe.
		swipeStart = null;
	}

	function finishSwap(): void {
		isSwapping = false;
		onSwap();
	}
</script>

<!-- The swipe is a redundant shortcut for the three labelled view buttons in the header; the
     surface itself is not a widget, so it deliberately carries no ARIA role. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-dvh touch-pan-y flex-col overflow-hidden"
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
>
	<ScreenHeader onBack={() => (confirmAbandon = true)}>
		{#snippet actions()}
			<div
				class="relative grid grid-cols-3 rounded-xl border border-slate-600/60 bg-slate-900/60 p-0.5"
				aria-label="Game views"
			>
				<!-- The spotlight: one cell wide, slides to whichever view is active. -->
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-lg bg-sky-500/25 shadow-[0_0_18px_rgba(56,189,248,0.45)] ring-1 ring-sky-300/70 transition-transform duration-300 ease-out motion-reduce:transition-none"
					style="transform: translateX({activeIndex * 100}%)"
				></div>
				{#each VIEWS as item (item.id)}
					<button
						type="button"
						class="relative z-10 rounded-lg px-1.5 py-2 text-xs font-semibold transition-colors duration-300 sm:px-2 sm:text-sm {view ===
						item.id
							? 'text-sky-100'
							: 'text-slate-400 hover:text-slate-200'}"
						aria-pressed={view === item.id}
						onclick={() => (view = item.id)}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/snippet}
	</ScreenHeader>

	<!-- One strip, three panes side by side: switching views slides the whole surface, so the
	     outgoing view leaves the way the gesture came from. Each pane scrolls itself, otherwise
	     the document scroll would strand the player below a short pane after reading a long one. -->
	<div class="relative min-h-0 flex-1 overflow-hidden">
		<div
			class="flex h-full w-[300%] transition-transform duration-300 ease-out motion-reduce:transition-none"
			style="transform: translateX(-{(activeIndex * 100) / 3}%)"
		>
			<div class="min-h-0 w-1/3 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<ActivePlayerPanel
						{activePlayer}
						armyName={progress[activePlayer].pickedArmy?.name ?? null}
					/>
					<ScoreSummaryPanelTwoPlayer
						{totalVPP1}
						{totalVPP2}
						round={progress.currentRound}
						{activePlayer}
						{onSetRound}
						onSwap={() => (isSwapping = true)}
					/>
					<!-- Objectives are the active seat's own: swapping hands the sheet over. -->
					<ResultsPanel
						{entries}
						important={mission.important}
						checkedObjectiveCounts={progress[activePlayer].checkedObjectiveCounts}
						onSetChecked={(objectiveId, checkedCount, maxCount) =>
							onSetObjectiveChecked(activePlayer, objectiveId, checkedCount, maxCount)}
					/>
					<SchemesPanelTwoPlayer
						{factions}
						draftP1={progress.player1.schemeDraft}
						draftP2={progress.player2.schemeDraft}
						{drawnP1}
						{drawnP2}
						chosenP1={progress.player1.scheme}
						chosenP2={progress.player2.scheme}
						{chosenCardP1}
						{chosenCardP2}
						revealedP1={progress.player1.schemeRevealed}
						revealedP2={progress.player2.schemeRevealed}
						{activePlayer}
						onSetFaction={onSetDraftFaction}
						onSetIntelligence={onSetDraftIntelligence}
						onDraw={onDrawSchemes}
						onChoose={onChooseScheme}
						onSetChecked={onSetSchemeChecked}
						onDelete={onDeleteScheme}
						onReveal={onRevealScheme}
					/>
				</div>
			</div>
			<div class="min-h-0 w-1/3 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<BattleFlowersPanel
						p1={armyViewP1}
						p2={armyViewP2}
						dimmed={focus !== null}
						onSelect={(flower, rect) => (focus = { flower, rect })}
					/>
				</div>
			</div>
			<div class="min-h-0 w-1/3 touch-pan-y overflow-y-auto overscroll-contain pb-6">
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

{#if isSwapping}
	<CountdownOverlay onComplete={finishSwap} onSkip={finishSwap} />
{/if}

{#if confirmAbandon}
	<ConfirmDialog
		text="Abandon this game? Both players' progress will be lost."
		confirmLabel="Abandon"
		cancelLabel="Keep playing"
		onConfirm={onAbandon}
		onCancel={() => (confirmAbandon = false)}
	/>
{/if}

<RuleCalloutDialog rule={openRule} onClose={() => (openRule = null)} />

<!-- At the screen root, like the rule dialog: the strip's transform would trap a fixed overlay
     rendered inside the pane, and the focused flower has to paint above the blur. -->
{#if focus}
	<BattleFlowerFocus flower={focus.flower} from={focus.rect} onClosed={() => (focus = null)} />
{/if}
