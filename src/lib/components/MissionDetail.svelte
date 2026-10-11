<script lang="ts">
	import type {
		ArmyRosterRow,
		ArmyView,
		BattleFlowerSpec,
		Faction,
		Mission,
		MissionProgress,
		ResultsEntry,
		RuleCallout,
		SchemeCard,
		UnitStatus,
		VitalityTarget
	} from '$lib/domain';
	import { battleFlowersFor } from '$lib/domain';
	import BattleFlowersPanel from './BattleFlowersPanel.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import FlowerDragLayer from './FlowerDragLayer.svelte';
	import FlowerInteraction from './FlowerInteraction.svelte';
	import MissionMap from './MissionMap.svelte';
	import Panel from './Panel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import ScoreSummaryPanel from './ScoreSummaryPanel.svelte';
	import SchemesPanel from './SchemesPanel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
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
		/** The flower dialogs committed a change to the attached army's copy. */
		onDamage: (target: VitalityTarget, amount: number) => void;
		onHeal: (target: VitalityTarget, amount: number) => void;
		onStatuses: (target: VitalityTarget, statuses: UnitStatus[]) => void;
		onStagger: (target: VitalityTarget) => void;
		onStun: (target: VitalityTarget) => void;
		onStamina: (target: VitalityTarget, delta: number) => void;
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
		onSetRound,
		onDamage,
		onHeal,
		onStatuses,
		onStagger,
		onStun,
		onStamina
	}: Props = $props();

	/** A started game always opens on the score sheet; the other two views are reference. */
	let view = $state<GameView>('scoring');
	let confirmAbandon = $state(false);

	// The army popups and the flower overlays live at the screen root: the sliding strip carries
	// a transform, which would become the containing block for their fixed overlays and trap
	// them inside a pane.
	let armyCardRow = $state<ArmyRosterRow | null>(null);
	let openRule = $state<RuleCallout | null>(null);

	/** Which of the three view buttons the spotlight sits under. */
	let activeIndex = $derived(VIEWS.findIndex((candidate) => candidate.id === view));

	// --- The flower board: one seat, the two gestures of the hot-seat board. ---
	// A tap opens the Self Interaction dialog; a drag onto another flower opens the cross-model
	// Interaction panel. Solo fields a single army, so every target is player1 and a "cross"
	// interaction is one of your own models acting on another.
	let selfDialog = $state<VitalityTarget | null>(null);
	let interaction = $state<{ origin: VitalityTarget; target: VitalityTarget } | null>(null);
	let drag = $state<{
		origin: VitalityTarget;
		size: number;
		x: number;
		y: number;
		hoverRect: { x: number; y: number; width: number } | null;
		hoverKey: string | null;
	} | null>(null);
	let grab: null | {
		key: string;
		flower: BattleFlowerSpec;
		rect: { x: number; y: number; width: number };
		startX: number;
		startY: number;
	} = null;
	// Set once a drag has run, so the click the browser fires on release does not also open the
	// self dialog. The next pointerdown clears it.
	let suppressSelf = false;

	let seatFlowers = $derived.by(() => (armyView ? battleFlowersFor(armyView) : []));

	/** The copy a strip key (`player1:entryId`) names, or null if it is not on the field. */
	function targetForKey(key: string): VitalityTarget | null {
		const split = key.indexOf(':');
		if (split < 0) return null;
		const entryId = key.slice(split + 1);
		const flower = seatFlowers.find((candidate) => candidate.entryId === entryId);
		return flower ? { player: 'player1', entryId, flower, copy: null } : null;
	}

	/** The slot under the pointer, when it is a flower other than the one being dragged. */
	function hoverSlot(
		x: number,
		y: number
	): { key: string; rect: { x: number; y: number; width: number } } | null {
		const originKey = drag ? `player1:${drag.origin.entryId}` : null;
		let found: { key: string; rect: { x: number; y: number; width: number } } | null = null;
		for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-flower-key]'))) {
			const key = el.dataset.flowerKey;
			if (!key || key === originKey) continue;
			const r = el.getBoundingClientRect();
			if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
				found = { key, rect: { x: r.x, y: r.y, width: r.width } };
		}
		return found;
	}

	function openSelf(flower: BattleFlowerSpec): void {
		if (suppressSelf) {
			suppressSelf = false;
			return;
		}
		selfDialog = { player: 'player1', entryId: flower.entryId, flower, copy: null };
	}

	function closeSelf(): void {
		selfDialog = null;
	}

	const DRAG_MIN_PX = 8;

	function onGrabMove(event: PointerEvent): void {
		if (!grab) return;
		if (!drag) {
			if (Math.hypot(event.clientX - grab.startX, event.clientY - grab.startY) < DRAG_MIN_PX)
				return;
			drag = {
				origin: {
					player: 'player1',
					entryId: grab.flower.entryId,
					flower: grab.flower,
					copy: null
				},
				size: grab.rect.width,
				x: event.clientX,
				y: event.clientY,
				hoverRect: null,
				hoverKey: null
			};
			swipeStart = null;
		} else {
			drag.x = event.clientX;
			drag.y = event.clientY;
		}
		const hovered = hoverSlot(drag.x, drag.y);
		drag.hoverKey = hovered?.key ?? null;
		drag.hoverRect = hovered?.rect ?? null;
	}

	function detachGrab(): void {
		window.removeEventListener('pointermove', onGrabMove);
		window.removeEventListener('pointerup', onGrabUp);
		window.removeEventListener('pointercancel', onGrabCancel);
	}

	function onGrabUp(): void {
		detachGrab();
		grab = null;
		if (!drag) return; // it was a tap - the click that follows opens the self dialog
		suppressSelf = true;
		const origin = drag.origin;
		const target = drag.hoverKey ? targetForKey(drag.hoverKey) : null;
		drag = null;
		if (target) interaction = { origin, target };
	}

	function onGrabCancel(): void {
		detachGrab();
		grab = null;
		drag = null;
	}

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
		suppressSelf = false;
		swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
		// A flower under the finger is a possible drag, but it is still a tap until it moves past
		// the threshold - so the click that opens the self dialog is left alone until then. The
		// gesture is tracked on window, because the lifted clone is a fixed overlay the pane
		// would clip.
		const el = (event.target as HTMLElement | null)?.closest?.('[data-flower-key]');
		const key = el instanceof HTMLElement ? el.dataset.flowerKey : undefined;
		if (!(el instanceof HTMLElement) || !key) return;
		const target = targetForKey(key);
		if (!target) return;
		const r = el.getBoundingClientRect();
		grab = {
			key,
			flower: target.flower,
			rect: { x: r.x, y: r.y, width: r.width },
			startX: event.clientX,
			startY: event.clientY
		};
		window.addEventListener('pointermove', onGrabMove);
		window.addEventListener('pointerup', onGrabUp);
		window.addEventListener('pointercancel', onGrabCancel);
	}

	function onPointerUp(event: PointerEvent): void {
		// A flower drag owns this gesture; the window handler resolves the drop. No view swipe.
		if (drag) {
			swipeStart = null;
			return;
		}
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
						<BattleFlowersPanel
							p1={armyView}
							p2={null}
							dragging={drag !== null}
							onSelect={openSelf}
						/>
					{:else}
						<Panel title="Army">
							<p class="text-sm text-slate-200">
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

{#if confirmAbandon}
	<ConfirmDialog
		text="Abandon this game? All progress will be lost."
		confirmLabel="Abandon"
		cancelLabel="Keep playing"
		onConfirm={onAbandon}
		onCancel={() => (confirmAbandon = false)}
	/>
{/if}

<!-- The lifted clone and its drop crosshair, at the screen root: the pane's overflow and the
     strip's translateX would clip a fixed overlay rendered inside them. -->
{#if drag}
	<FlowerDragLayer
		flower={drag.origin.flower}
		x={drag.x}
		y={drag.y}
		size={drag.size}
		hoverRect={drag.hoverRect}
	/>
{/if}

<!-- A tap opens the Self Interaction dialog; a drop opens the cross-model panel. The unit card
     is rendered after both, so its own backdrop is the layer an outside click meets first. -->
{#if selfDialog}
	<FlowerInteraction
		self
		origin={selfDialog}
		target={selfDialog}
		{onDamage}
		{onHeal}
		{onStatuses}
		{onStagger}
		{onStun}
		{onStamina}
		onInfo={() => {
			if (armyView)
				armyCardRow = armyView.rows.find((row) => row.entryId === selfDialog?.entryId) ?? null;
		}}
		onClose={closeSelf}
	/>
{/if}

{#if interaction}
	<FlowerInteraction
		origin={interaction.origin}
		target={interaction.target}
		{onDamage}
		{onHeal}
		{onStatuses}
		{onStagger}
		{onStun}
		{onStamina}
		onClose={() => (interaction = null)}
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

<RuleCalloutDialog rule={openRule} onClose={() => (openRule = null)} />
