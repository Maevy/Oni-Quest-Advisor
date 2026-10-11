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
		TwoPlayerMissionProgress,
		UnitStatus
	} from '$lib/domain';
	import { battleFlowersFor, type VitalityTarget } from '$lib/domain';
	import ActivePlayerPanel from './ActivePlayerPanel.svelte';
	import BattleFlowerFocus from './BattleFlowerFocus.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import BattleFlowersPanel from './BattleFlowersPanel.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import CountdownOverlay from './CountdownOverlay.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import FlowerDragLayer from './FlowerDragLayer.svelte';
	import FlowerInteraction from './FlowerInteraction.svelte';
	import MissionMap from './MissionMap.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import SchemesPanelTwoPlayer from './SchemesPanelTwoPlayer.svelte';
	import ScoreSummaryPanelTwoPlayer from './ScoreSummaryPanelTwoPlayer.svelte';
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
		/** A strike landed in the damage flow: commit it to the target seat's vitality map. */
		onDamage: (target: VitalityTarget, amount: number) => void;
		/** A heal landed in the heal flow: commit it to the target seat's vitality map. */
		onHeal: (target: VitalityTarget, amount: number) => void;
		/** A status ring was confirmed: commit the draft to the target seat's vitality map. */
		onStatuses: (target: VitalityTarget, statuses: UnitStatus[]) => void;
		/** A Stamina step was tapped on the focused flower: commit it to that seat's map. */
		onStamina: (target: VitalityTarget, delta: number) => void;
		/** A ring box was tapped on the focused flower: set that half straight to the box. */
		onSetStat: (target: VitalityTarget, half: 'life' | 'stamina', value: number) => void;
		/** The Interaction panel dealt a Stagger: spend one of the target's activations. */
		onStagger: (target: VitalityTarget) => void;
		/** The Interaction panel dealt a Stun: spend every one of the target's activations. */
		onStun: (target: VitalityTarget) => void;
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
		onSwap,
		onDamage,
		onHeal,
		onStatuses,
		onStamina,
		onSetStat,
		onStagger,
		onStun
	}: Props = $props();

	/** A started game always opens on the score sheet; the other two views are reference. */
	let view = $state<GameView>('scoring');
	let confirmAbandon = $state(false);
	let isSwapping = $state(false);

	// The rule popups live at the screen root: the sliding strip carries a transform, which
	// would become the containing block for their fixed overlays and trap them inside a pane.
	let openRule = $state<RuleCallout | null>(null);
	// The focused flower, the slot its overlay glides from and back to, and the seat's army it
	// belongs to - the card the info petal opens resolves against that army's row and catalogs.
	// The seat comes along because an entry id is only unique inside one army, and two seats may
	// field the same save.
	let focus = $state<{
		flower: BattleFlowerSpec;
		rect: FlowerRect;
		army: ArmyView;
		player: PlayerKey;
	} | null>(null);
	// The info petal's card, kept separate from the focus so that closing it leaves the flower
	// centred: one click outside dismisses the card, the next one sends the flower home.
	let focusInfo = $state(false);

	/** Which of the three view buttons the spotlight sits under. */
	let activeIndex = $derived(VIEWS.findIndex((candidate) => candidate.id === view));

	/** The focused copy's roster row, while its card is open; null the rest of the time. */
	let focusRow = $derived.by(() => {
		const current = focus;
		if (!current || !focusInfo) return null;
		return (
			current.army.rows.find((candidate) => candidate.entryId === current.flower.entryId) ?? null
		);
	});

	function openFocus(
		flower: BattleFlowerSpec,
		rect: FlowerRect,
		army: ArmyView,
		player: PlayerKey
	): void {
		// A drag ends with the browser firing a click on the flower it left; that click must not
		// also focus. The gesture that dragged set the flag, and this consumes it.
		if (suppressFocus) {
			suppressFocus = false;
			return;
		}
		focus = { flower, rect, army, player };
		focusInfo = false;
	}

	function closeFocus(): void {
		focus = null;
		focusInfo = false;
	}

	/** The focused copy as a vitality-flow target: every petal now acts on it and only it. */
	let selfTarget = $derived.by((): VitalityTarget | null =>
		focus
			? {
					player: focus.player,
					entryId: focus.flower.entryId,
					flower: focus.flower,
					copy: null
				}
			: null
	);

	/** Both seats' flowers in seat order: what a drag's data-flower-key resolves against. */
	let seatFlowers = $derived.by(() => {
		const seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }> = [];
		if (armyViewP1) seats.push({ player: 'player1', flowers: battleFlowersFor(armyViewP1) });
		if (armyViewP2) seats.push({ player: 'player2', flowers: battleFlowersFor(armyViewP2) });
		return seats;
	});

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
		suppressFocus = false;
		swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
		// A flower under the finger is a possible drag, but it is still a tap until it moves past
		// the threshold - so the click that focuses is left alone until then. The gesture is
		// tracked on window, because the lifted clone is a fixed overlay the pane would clip.
		const el = (event.target as HTMLElement | null)?.closest?.('[data-flower-key]');
		const key = el instanceof HTMLElement ? el.dataset.flowerKey : undefined;
		if (!(el instanceof HTMLElement) || !key) return;
		const target = targetForKey(key);
		if (!target) return;
		const r = el.getBoundingClientRect();
		grab = {
			key,
			flower: target.flower,
			player: target.player,
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

	function finishSwap(): void {
		isSwapping = false;
		onSwap();
	}

	// --- Flower drag ---------------------------------------------------------------
	// Picking a flower up and dropping it on another opens the Interaction panel. The state and
	// the gesture live here, at the screen root, so the lifted clone and the panel can be fixed
	// overlays clear of the pane's overflow and the strip's translateX.
	const DRAG_MIN_PX = 8;
	let drag = $state<{
		origin: VitalityTarget;
		size: number;
		x: number;
		y: number;
		hoverRect: FlowerRect | null;
		hoverKey: string | null;
	} | null>(null);
	let interaction = $state<{ origin: VitalityTarget; target: VitalityTarget } | null>(null);
	// A grab below the drag threshold is still a tap; it becomes a drag only once it moves.
	let grab: null | {
		key: string;
		flower: BattleFlowerSpec;
		player: PlayerKey;
		rect: FlowerRect;
		startX: number;
		startY: number;
	} = null;
	let suppressFocus = false;

	/** The seat copy a strip key (`player:entryId`) names, or null if it is not on the field. */
	function targetForKey(key: string): VitalityTarget | null {
		const split = key.indexOf(':');
		if (split < 0) return null;
		const player = key.slice(0, split) as PlayerKey;
		const entryId = key.slice(split + 1);
		for (const seat of seatFlowers) {
			if (seat.player !== player) continue;
			const flower = seat.flowers.find((candidate) => candidate.entryId === entryId);
			if (flower) return { player, entryId, flower, copy: null };
		}
		return null;
	}

	/** The slot under the pointer, when it is a flower other than the one being dragged. */
	function hoverSlot(x: number, y: number): { key: string; rect: FlowerRect } | null {
		const originKey = drag ? `${drag.origin.player}:${drag.origin.entryId}` : null;
		let found: { key: string; rect: FlowerRect } | null = null;
		for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-flower-key]'))) {
			const key = el.dataset.flowerKey;
			if (!key || key === originKey) continue;
			const r = el.getBoundingClientRect();
			if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
				found = { key, rect: { x: r.x, y: r.y, width: r.width } };
		}
		return found;
	}

	function onGrabMove(event: PointerEvent): void {
		if (!grab) return;
		if (!drag) {
			if (Math.hypot(event.clientX - grab.startX, event.clientY - grab.startY) < DRAG_MIN_PX)
				return;
			drag = {
				origin: {
					player: grab.player,
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
		if (!drag) return; // it was a tap - the click that follows focuses the flower
		suppressFocus = true;
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
						dragging={drag !== null}
						onSelect={openFocus}
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
{#if focus && selfTarget}
	{@const focused = focus}
	<BattleFlowerFocus
		flower={focused.flower}
		from={focused.rect}
		infoOpen={focusInfo}
		onInfo={() => (focusInfo = true)}
		onDamage={(amount) => onDamage(selfTarget, amount)}
		onHeal={(amount) => onHeal(selfTarget, amount)}
		onStatuses={(statuses) => onStatuses(selfTarget, statuses)}
		onStamina={(delta) => onStamina(selfTarget, delta)}
		onSetStat={(half, value) => onSetStat(selfTarget, half, value)}
		onClosed={closeFocus}
	/>
{/if}

<!-- After the flower in the document and on the same layer, so its own backdrop is what catches
     an outside click: dismissing the card leaves the flower centred, and only the next click
     outside reaches the flower's backdrop and glides it home. Escape closes one layer at a time
     for the same reason - the card registers later, so it is the one that answers. -->
{#if focus && focusRow}
	<UnitCard
		unit={focusRow.upgradedUnit}
		faction={focus.army.faction}
		classIndex={focus.army.classIndex}
		skillIndex={focus.army.skillIndex}
		traitIndex={focus.army.traitIndex}
		combatArtIndex={focus.army.combatArtIndex}
		spellcraftIndex={focus.army.spellcraftIndex}
		spells={focus.army.spells}
		stratagemIndex={focus.army.stratagemIndex}
		itemIndex={{ ...focus.army.itemIndex, ...focusRow.itemOverrides }}
		stats={focusRow.effectiveStats}
		size={focusRow.effectiveSize}
		mounted={focusRow.mounted}
		mountName={focusRow.mount?.name}
		onClose={() => (focusInfo = false)}
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

<!-- The Interaction panel: origin on the left, target on the right, the seven ways one model
     can act on another between them. -->
{#if interaction}
	<FlowerInteraction
		origin={interaction.origin}
		target={interaction.target}
		{onDamage}
		{onHeal}
		{onStatuses}
		{onStagger}
		{onStun}
		onClose={() => (interaction = null)}
	/>
{/if}
