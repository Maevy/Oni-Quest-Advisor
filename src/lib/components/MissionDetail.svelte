<script lang="ts">
	import type {
		ArmyRosterRow,
		ArmyUpgradeSpec,
		ArmyView,
		Faction,
		Mission,
		MissionProgress,
		ResultsEntry,
		SchemeCard
	} from '$lib/domain';
	import ArmyReadonlyPanel from './ArmyReadonlyPanel.svelte';
	import ArmyUpgradeDetail from './ArmyUpgradeDetail.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import Panel from './Panel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import ScoreSummaryPanel from './ScoreSummaryPanel.svelte';
	import SchemesPanel from './SchemesPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';
	import UnitCard from './UnitCard.svelte';

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
		progress: MissionProgress;
		totalVP: number;
		factions: Faction[];
		drawnSchemes: SchemeCard[];
		chosenSchemeCard: SchemeCard | null;
		/** The army attached to this run, resolved for display; null when none is picked. */
		armyView: ArmyView | null;
		/** Called once the player confirms — abandoning discards the whole run. */
		onAbandon: () => void;
		onReset: () => void;
		onSetObjectiveChecked: (objectiveId: string, checkedCount: number, maxCount: number) => void;
		onSetDraftFaction: (factionId: string) => void;
		onSetDraftIntelligence: (intelligence: number | null) => void;
		onDrawSchemes: () => void;
		onChooseScheme: (schemeId: string) => void;
		onSetSchemeChecked: (checkedIncrements: number) => void;
		onDeleteScheme: () => void;
		onSetRound: (round: number) => void;
	};

	let {
		mission,
		entries,
		progress,
		totalVP,
		factions,
		drawnSchemes,
		chosenSchemeCard,
		armyView,
		onAbandon,
		onReset,
		onSetObjectiveChecked,
		onSetDraftFaction,
		onSetDraftIntelligence,
		onDrawSchemes,
		onChooseScheme,
		onSetSchemeChecked,
		onDeleteScheme,
		onSetRound
	}: Props = $props();

	/** A started game always opens on the score sheet; the other two views are reference. */
	let view = $state<GameView>('scoring');
	let confirmAbandon = $state(false);

	// The army popups live at the screen root: the sliding strip carries a transform, which
	// would become the containing block for their fixed overlays and trap them inside a pane.
	let armyCardRow = $state<ArmyRosterRow | null>(null);
	let armyDetailUpgrade = $state<ArmyUpgradeSpec | null>(null);

	/** Which of the three view buttons the spotlight sits under. */
	let activeIndex = $derived(VIEWS.findIndex((candidate) => candidate.id === view));

	// Swipe detection, same contract as the army builder: a mostly-horizontal pointer gesture
	// steps between the views, so the app has one swipe feel. Vertical scrolling cancels it.
	// Touch and pen only: a mouse drag is a text selection on desktop, and letting it double as
	// a swipe makes the browser cancel the gesture (and swallow the click) mid-drag.
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
	<header class="border-b border-slate-700/40 bg-slate-950/80 backdrop-blur">
		<div class="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-2.5">
			<button
				type="button"
				class="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-red-400 active:bg-red-400"
				onclick={() => (confirmAbandon = true)}
			>
				<span aria-hidden="true">←</span> Return
			</button>
			<div
				class="relative ml-auto grid grid-cols-3 rounded-xl border border-slate-600/60 bg-slate-900/60 p-0.5"
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
						class="relative z-10 rounded-lg px-2 py-2 text-sm font-semibold transition-colors duration-300 {view ===
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
		</div>
	</header>

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
					<ScoreSummaryPanel {totalVP} round={progress.currentRound} {onSetRound} {onReset} />
					<ResultsPanel
						{entries}
						important={mission.important}
						checkedObjectiveCounts={progress.checkedObjectiveCounts}
						onSetChecked={onSetObjectiveChecked}
					/>
					<SchemesPanel
						{factions}
						schemeDraft={progress.schemeDraft}
						{drawnSchemes}
						chosenScheme={progress.scheme}
						{chosenSchemeCard}
						onSetFaction={onSetDraftFaction}
						onSetIntelligence={onSetDraftIntelligence}
						onDraw={onDrawSchemes}
						onChoose={onChooseScheme}
						onSetChecked={onSetSchemeChecked}
						onDelete={onDeleteScheme}
					/>
				</div>
			</div>
			<div class="min-h-0 w-1/3 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					{#if armyView}
						<ArmyReadonlyPanel
							view={armyView}
							onShowUnit={(row) => (armyCardRow = row)}
							onShowUpgrade={(upgrade) => (armyDetailUpgrade = upgrade)}
						/>
					{:else}
						<Panel title="Army">
							<p class="text-sm text-slate-400">
								No army is attached to this run. Pick one from the mission briefing before starting
								the game.
							</p>
						</Panel>
					{/if}
				</div>
			</div>
			<div class="min-h-0 w-1/3 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<DescriptionPanel
						name={mission.name}
						description={mission.description}
						brokenMorale={mission.brokenMorale}
						ceasefire={mission.ceasefire}
					/>
					<SetupPanel setup={mission.setup} />
					<MissionMap map={mission.map} />
					<QuestRulesPanel sections={mission.questRules} />
				</div>
			</div>
		</div>
	</div>
</div>

{#if confirmAbandon}
	<ConfirmDialog
		text="Abandon this game? All progress will be lost."
		confirmLabel="Abandon"
		cancelLabel="Keep playing"
		onConfirm={onAbandon}
		onCancel={() => (confirmAbandon = false)}
	/>
{/if}

{#if armyView && armyCardRow}
	<UnitCard
		unit={armyCardRow.upgradedUnit}
		faction={armyView.faction}
		classIndex={armyView.classIndex}
		skillIndex={armyView.skillIndex}
		traitIndex={armyView.traitIndex}
		combatArtIndex={armyView.combatArtIndex}
		spellcraftIndex={armyView.spellcraftIndex}
		spells={armyView.spells}
		stratagemIndex={armyView.stratagemIndex}
		itemIndex={{ ...armyView.itemIndex, ...armyCardRow.itemOverrides }}
		stats={armyCardRow.effectiveStats}
		size={armyCardRow.effectiveSize}
		mounted={armyCardRow.mounted}
		mountName={armyCardRow.mount?.name}
		onClose={() => (armyCardRow = null)}
	/>
{/if}

{#if armyView && armyDetailUpgrade}
	<ArmyUpgradeDetail
		upgrade={armyDetailUpgrade}
		cost={armyDetailUpgrade.cost}
		factionColor={armyView.faction.color}
		onClose={() => (armyDetailUpgrade = null)}
	/>
{/if}
