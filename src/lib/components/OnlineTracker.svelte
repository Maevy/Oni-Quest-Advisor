<script lang="ts">
	import { battleFlowersFor, MAX_ROUND } from '$lib/domain';
	import type {
		ArmyView,
		BattleFlowerSpec,
		HistoryEntry,
		Mission,
		OnlineGameView,
		PlayerKey,
		ResultsEntry,
		RuleCallout,
		SchemeCard,
		UnitStatus,
		VitalityAction,
		VitalityCommitInput,
		VitalityTarget
	} from '$lib/domain';
	import BattleFlowersPanel from './BattleFlowersPanel.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import FlowerDragLayer from './FlowerDragLayer.svelte';
	import FlowerInteraction from './FlowerInteraction.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import HistoryDialog from './HistoryDialog.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import OnlineScoringPanel from './OnlineScoringPanel.svelte';
	import Panel from './Panel.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import type { MegaphoneInbox } from './toMegaphone';
	import UnitCard from './UnitCard.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type TrackerView = 'p1' | 'p2' | 'army' | 'mission';

	/**
	 * The switcher labels carry a suffix only where there is room for it: at 320 px four
	 * single-line labels do not fit beside Return, and nowrap would make them overlap rather
	 * than wrap. The panes are titled in full, so the short form loses nothing.
	 */
	const VIEWS: Array<{ id: TrackerView; short: string; suffix: string }> = [
		{ id: 'p1', short: 'P1', suffix: ' Scoring' },
		{ id: 'p2', short: 'P2', suffix: ' Scoring' },
		{ id: 'army', short: 'Army', suffix: '' },
		{ id: 'mission', short: 'Mission', suffix: '' }
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
		/** The organizer's announcements, when this match belongs to a tournament table. */
		megaphone?: MegaphoneInbox | null;
		/** Both seats' flower boards, folded from the match's interaction log. */
		boards: Record<PlayerKey, ArmyView | null>;
		/** The match's interaction log, in order: the history panel and dialog read it. */
		history: HistoryEntry[];
		/** Per action seq, the sentences the fold produced. */
		sentences: Record<number, string[]>;
		/** This seat's latest standing action, while it is still the last one; null hides Undo. */
		undoableSeq: number | null;
		/** One flower-dialog commit, appended to the log; both boards refold from it. */
		onCommit: (commit: VitalityCommitInput) => void;
		onUndo: (seq: number) => void;
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
		onReturn,
		megaphone = null,
		boards,
		history,
		sentences,
		undoableSeq,
		onCommit,
		onUndo
	}: Props = $props();

	let activeView = $state<TrackerView>('p1');
	let confirmingReveal = $state(false);
	let openRule = $state<RuleCallout | null>(null);
	let historyOpen = $state(false);

	// The flower dialogs live at the screen root: the sliding strip carries a transform, which
	// would become the containing block for their fixed overlays and trap them inside a pane.
	let selfDialog = $state<{ target: VitalityTarget; army: ArmyView } | null>(null);
	let selfInfo = $state(false);
	let interaction = $state<{ origin: VitalityTarget; target: VitalityTarget } | null>(null);

	/** The tapped copy's roster row, while its card is open; null the rest of the time. */
	let selfRow = $derived.by(() => {
		const current = selfDialog;
		if (!current || !selfInfo) return null;
		return (
			current.army.rows.find((candidate) => candidate.entryId === current.target.entryId) ?? null
		);
	});

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
			card: own ? myCard : opponentCard
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
		suppressFocus = false;
		swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
		// A flower under the finger is a possible drag, but it is still a tap until it moves past
		// the threshold - so the click that opens the dialog is left alone until then. Only this
		// seat's own flowers lift: the opponent's models are drop targets, never origins.
		const el = (event.target as HTMLElement | null)?.closest?.('[data-flower-key]');
		const key = el instanceof HTMLElement ? el.dataset.flowerKey : undefined;
		if (!(el instanceof HTMLElement) || !key) return;
		const target = targetForKey(key);
		if (!target || target.player !== view.seat) return;
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

	// --- Flower drag ---------------------------------------------------------------
	// Picking one of your flowers up and dropping it on another opens the Interaction panel. The
	// state and the gesture live here, at the screen root, so the lifted clone and the panel can
	// be fixed overlays clear of the pane's overflow and the strip's translateX.
	const DRAG_MIN_PX = 8;
	let drag = $state<{
		origin: VitalityTarget;
		size: number;
		x: number;
		y: number;
		hoverRect: FlowerRect | null;
		hoverKey: string | null;
	} | null>(null);
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

	/** Both seats' flowers in seat order: what a drag's data-flower-key resolves against. */
	let seatFlowers = $derived.by(() => {
		const seats: Array<{ player: PlayerKey; flowers: BattleFlowerSpec[] }> = [];
		if (boards.player1)
			seats.push({ player: 'player1', flowers: battleFlowersFor(boards.player1) });
		if (boards.player2)
			seats.push({ player: 'player2', flowers: battleFlowersFor(boards.player2) });
		return seats;
	});

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
		if (!drag) return; // it was a tap - the click that follows opens the dialog
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

	// --- commits -------------------------------------------------------------------
	// The dialogs compute nothing themselves: each confirm becomes one log entry, and both
	// boards - this device's and the opponent's - are the log folded.

	/** The model that acted, when the open dialog is the cross-model one; a self commit has none. */
	function currentOrigin(): VitalityTarget | null {
		if (selfDialog) return null;
		return interaction?.origin ?? null;
	}

	function commitFor(target: VitalityTarget, action: VitalityAction): VitalityCommitInput {
		const origin = currentOrigin();
		return {
			targetSeat: target.player,
			targetEntryId: target.entryId,
			targetName: target.flower.name,
			targetCopy: target.copy,
			originEntryId: origin?.entryId ?? null,
			originName: origin?.flower.name ?? null,
			action
		};
	}

	function onDamage(target: VitalityTarget, amount: number): void {
		onCommit(commitFor(target, { kind: 'damage', amount }));
	}

	function onHeal(target: VitalityTarget, amount: number): void {
		onCommit(commitFor(target, { kind: 'heal', amount }));
	}

	function onStatuses(target: VitalityTarget, statuses: UnitStatus[]): void {
		const carried = target.flower.statuses;
		onCommit(
			commitFor(target, {
				kind: 'statuses',
				statuses,
				added: statuses.filter((status) => !carried.includes(status)),
				removed: carried.filter((status) => !statuses.includes(status))
			})
		);
	}

	function onStamina(target: VitalityTarget, delta: number): void {
		onCommit(commitFor(target, { kind: 'stamina', delta }));
	}

	function onStagger(target: VitalityTarget): void {
		onCommit(commitFor(target, { kind: 'stagger' }));
	}

	function onStun(target: VitalityTarget): void {
		onCommit(commitFor(target, { kind: 'stun' }));
	}

	function openSelf(
		flower: BattleFlowerSpec,
		_rect: FlowerRect,
		army: ArmyView,
		player: PlayerKey
	): void {
		// A drag ends with the browser firing a click on the flower it left; that click must not
		// also open the dialog. The gesture that dragged set the flag, and this consumes it.
		if (suppressFocus) {
			suppressFocus = false;
			return;
		}
		// The opponent's models are drop targets and history, not selves: only your own copies
		// open the Self Interaction dialog, exactly as only your own flowers lift.
		if (player !== view.seat) return;
		selfDialog = { target: { player, entryId: flower.entryId, flower, copy: null }, army };
		selfInfo = false;
	}

	function closeSelf(): void {
		selfDialog = null;
		selfInfo = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-dvh touch-pan-y flex-col overflow-hidden"
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={() => (swipeStart = null)}
>
	<!-- No title: the two local trackers omit one for the same reason. The mission name is the
	     Description panel's heading on the Mission view, and the switcher needs the row to itself
	     at 320 px. -->
	<ScreenHeader onBack={onReturn} {megaphone}>
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
						class="relative z-10 rounded-lg px-1 py-2 text-[11px] leading-tight font-semibold whitespace-nowrap transition-colors duration-300 sm:px-2 sm:text-xs {activeView ===
						item.id
							? 'text-sky-100'
							: 'text-slate-400 hover:text-slate-200'}"
						aria-pressed={activeView === item.id}
						onclick={() => (activeView = item.id)}
					>
						{item.short}<span class="hidden min-[340px]:inline">{item.suffix}</span>
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
							{onSetSchemeChecked}
							onReveal={() => (confirmingReveal = true)}
						/>
					</div>
				</div>
			{/each}

			<div class="min-h-0 w-1/4 touch-pan-y overflow-y-auto overscroll-contain pb-6">
				<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
					<HistoryPanel {history} {sentences} onOpen={() => (historyOpen = true)} />
					{#if boards.player1 || boards.player2}
						<BattleFlowersPanel
							p1={boards.player1}
							p2={boards.player2}
							dragging={drag !== null}
							onSelect={openSelf}
						/>
					{:else}
						<Panel title="Army">
							<p class="text-sm text-slate-200 italic">
								The board opens once the round is running and both devices have published their
								armies.
							</p>
						</Panel>
					{/if}
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

{#if historyOpen}
	<HistoryDialog
		{history}
		{sentences}
		{undoableSeq}
		onUndo={(seq) => onUndo(seq)}
		onClose={() => (historyOpen = false)}
	/>
{/if}

<!-- A tap on one of your own flowers: the same shell as the cross-model panel, one model acting
     on itself. The opponent's flowers never open it - their states are yours to inflict, not to
     manage. -->
{#if selfDialog}
	<FlowerInteraction
		self
		origin={selfDialog.target}
		target={selfDialog.target}
		{onDamage}
		{onHeal}
		{onStatuses}
		{onStagger}
		{onStun}
		{onStamina}
		onInfo={() => (selfInfo = true)}
		onClose={closeSelf}
	/>
{/if}

{#if selfDialog && selfRow}
	<UnitCard
		unit={selfRow.upgradedUnit}
		faction={selfDialog.army.faction}
		classIndex={selfDialog.army.classIndex}
		skillIndex={selfDialog.army.skillIndex}
		traitIndex={selfDialog.army.traitIndex}
		combatArtIndex={selfDialog.army.combatArtIndex}
		spellcraftIndex={selfDialog.army.spellcraftIndex}
		spells={selfDialog.army.spells}
		stratagemIndex={selfDialog.army.stratagemIndex}
		itemIndex={{ ...selfDialog.army.itemIndex, ...selfRow.itemOverrides }}
		stats={selfRow.effectiveStats}
		size={selfRow.effectiveSize}
		mounted={selfRow.mounted}
		mountName={selfRow.mount?.name}
		onClose={() => (selfInfo = false)}
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

<!-- One of your models acting on any other, friend or foe: origin left, target right. -->
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
