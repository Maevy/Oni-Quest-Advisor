<script lang="ts">
	import type { BattleFlowerSpec, UnitStatus, VitalityTarget } from '$lib/domain';
	import {
		AMOUNT_STEPS,
		damageApplied,
		healApplied,
		lifeCap,
		staminaCap,
		statusLockedAtZeroHp,
		toggleUnitStatus,
		RING_STATUSES,
		UNIT_STATUS_LABELS,
		vitalityRingStates
	} from '$lib/domain';
	import { playerAccent } from './playerAccent';
	import BattleFlower from './BattleFlower.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import StatusGlyph from './StatusGlyph.svelte';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		flower: BattleFlowerSpec;
		/** The slot the flower was clicked in, in viewport coordinates. */
		from: { x: number; y: number; width: number };
		/** Whether the model's card is open; the info petal is lit only while it is. */
		infoOpen: boolean;
		/** The info petal was pressed: the screen opens the model's card above this overlay. */
		onInfo: () => void;
		/** Every living copy of both armies, in seat order: the damage flow's target row. */
		damageTargets: VitalityTarget[];
		/** Every wounded copy of both armies, in seat order: the heal flow's target row. */
		healTargets: VitalityTarget[];
		/** Every copy of both armies, in seat order: the status flow's target row. */
		statusTargets: VitalityTarget[];
		/** The strike landed: the screen commits the damage to the target seat's vitality map. */
		onDamage: (target: VitalityTarget, amount: number) => void;
		/** The heal landed: the screen commits it to the target seat's vitality map. */
		onHeal: (target: VitalityTarget, amount: number) => void;
		/** The ring was confirmed: the screen commits the draft to the target seat's map. */
		onStatuses: (target: VitalityTarget, statuses: UnitStatus[]) => void;
		/** A Stamina step was tapped: the screen commits it to the focused copy's seat. */
		onStamina: (delta: number) => void;
		/** A ring box was tapped: the screen sets that half of the focused copy straight to it. */
		onSetStat: (half: 'life' | 'stamina', value: number) => void;
		/**
		 * A status flow moved the focus onto another copy, so the flower this overlay opened
		 * from has gone home: the screen lights that slot again in the strip.
		 */
		onFocusMoved?: () => void;
		/** Called once the petals have retracted and the flower has glided back into its slot. */
		onClosed: () => void;
	};

	let {
		flower,
		from,
		infoOpen,
		onInfo,
		damageTargets,
		healTargets,
		statusTargets,
		onDamage,
		onHeal,
		onStatuses,
		onStamina,
		onSetStat,
		onFocusMoved,
		onClosed
	}: Props = $props();

	/** The focused flower grows a third; it is a focus aid, not a full-screen card. */
	const GROWTH = 1.3;
	const GLIDE_MS = 340;
	const STRIKE_MS = 500;
	const FADE_MS = 260;
	const FADE_SETTLE_MS = 450;
	/** How long the flower dips to its slot size while a status flow swaps it for the target. */
	const SWAP_MS = 170;

	let placed = $state(false);
	let petalsOut = $state(false);
	let closing = $state<null | 'petals' | 'flower'>(null);
	/** The petal whose press lit it; at most one glows, and dismissal drops the glow first. */
	let activePetal = $state<string | null>(null);
	// The info petal's light is the open card's, not a standing selection: once the card closes
	// the petal falls back to the ring's default grey, while the other petals keep theirs until
	// another petal is pressed or the ring retracts.
	let litPetal = $derived(activePetal === 'info' && !infoOpen ? null : activePetal);

	// The vitality flows - damage and heal share one shape: ring 3 carries the amount, then the
	// field steps in front as the target row, one tap selects and the second confirms, and the
	// strike plays out on its own. The status flow has no amount: its row leads straight into
	// the ring of States around the copy the focus moved onto. Stamina has no row at all: its
	// two steps act on the flower already centred here, so the model needs no choosing.
	type Flow = 'damage' | 'heal' | 'status' | 'stamina';
	let flow = $state<Flow | null>(null);
	let subRingOut = $state(false);
	let amount = $state<number | null>(null);
	let amountEntry = $state(false);
	let amountDraft = $state<number | null>(null);
	let targetsOut = $state(false);
	let targetsIn = $state(false);
	// The row's own snapshot of the field, taken when an amount is chosen. The hit commits to
	// the store the moment the glyph lands, so rendering from the live views would change every
	// affected box at once; the fade has to run against the state the player confirmed.
	let rowTargets = $state<VitalityTarget[]>([]);
	let picked = $state<string | null>(null);
	let struck = $state<VitalityTarget | null>(null);
	let faded = $state(0);
	let strike = $state<null | {
		key: string;
		flow: Flow;
		x: number;
		y: number;
		tx: number;
		ty: number;
		flying: boolean;
	}>(null);

	// The status flow's own state: the copy the focus moved onto, the draft its ring edits, and
	// the slot the overlay will glide home into once that draft is confirmed or discarded.
	let statusTarget = $state<VitalityTarget | null>(null);
	let statusDraft = $state<UnitStatus[]>([]);
	let statusArmed = $state(false);
	let statusRingOut = $state(false);
	let homeRect = $state<FlowerRect | null>(null);
	let swapDip = $state(false);

	const keyOf = (target: VitalityTarget): string => `${target.player}:${target.entryId}`;

	/** The flower on show: the one the overlay opened from, or a status flow's target. */
	let shownFlower = $derived(statusTarget ? statusTarget.flower : flower);

	/** The slot the overlay is anchored to, and glides home to: the target's once focus moved. */
	let anchor = $derived(homeRect ?? from);

	// Translation from the anchor slot to the viewport centre. translate() runs before scale()
	// in the transform list, so this centres the UNSCALED box; the scale then grows it about its
	// own centre and the centre stays put. Centring in the grown frame instead lands the flower
	// half a growth-step off centre. Both left and the translation transition together, so a
	// mid-flight change of anchor moves neither: the two changes cancel at every step.
	let shift = $derived.by(() => ({
		dx: (window.innerWidth - anchor.width) / 2 - anchor.x,
		dy: (window.innerHeight - anchor.width) / 2 - anchor.y
	}));

	let transform = $derived(
		closing === 'flower' || !placed
			? 'none'
			: `translate(${shift.dx}px, ${shift.dy}px) scale(${swapDip ? 1 : GROWTH})`
	);
	let petalsOpen = $derived(petalsOut && closing === null);
	let statusRingOpen = $derived(statusRingOut && closing === null);
	/** The model icon's commit target: the orb inside the flower, 75% of its grown box. */
	let iconSize = $derived(Math.round(anchor.width * GROWTH * 0.75));

	const timers: ReturnType<typeof setTimeout>[] = [];
	function later(ms: number, fn: () => void): void {
		timers.push(setTimeout(fn, ms));
	}
	$effect(() => {
		return () => {
			for (const timer of timers) clearTimeout(timer);
		};
	});

	// Two frames: the first paints the flower in its slot, so the transition has a start pose.
	// The petals bloom only once the flower has landed, and on the way out they retract first so
	// the flower glides home alone. Timeouts rather than transitionend, so reduced-motion (no
	// transitions, therefore no events) still runs the whole sequence.
	$effect(() => {
		const outer = requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				placed = true;
				later(GLIDE_MS, () => {
					if (!closing) petalsOut = true;
				});
			})
		);
		return () => cancelAnimationFrame(outer);
	});

	// The row glides in a beat after it is asked for, so the icons visibly travel forward.
	$effect(() => {
		if (!targetsOut) {
			targetsIn = false;
			return;
		}
		const frame = requestAnimationFrame(() => requestAnimationFrame(() => (targetsIn = true)));
		return () => cancelAnimationFrame(frame);
	});

	function cancelFlow(): void {
		flow = null;
		subRingOut = false;
		amount = null;
		amountEntry = false;
		targetsOut = false;
		rowTargets = [];
		picked = null;
		struck = null;
		faded = 0;
		statusRingOut = false;
		statusArmed = false;
	}

	/**
	 * Layered dismissal: the X entry, then the flow, then the whole overlay. An open status ring
	 * skips the middle step - there is no flow left to fold back into, because the flower the
	 * ring belongs to is not the one the petals opened from. Its draft goes with it: nothing was
	 * committed, so leaving writes nothing.
	 */
	function close(): void {
		if (closing || strike) return;
		if (amountEntry) {
			amountEntry = false;
			return;
		}
		if (statusRingOut) {
			dismiss();
			return;
		}
		if (subRingOut || targetsOut) {
			cancelFlow();
			return;
		}
		dismiss();
	}

	function dismiss(): void {
		if (closing) return;
		activePetal = null;
		cancelFlow();
		closing = 'petals';
		petalsOut = false;
		later(GLIDE_MS, () => (closing = 'flower'));
		later(2 * GLIDE_MS, onClosed);
	}

	$effect(() => onEscapeKey(close));

	// The petals' own coordinate space: 125 units across for a flower 100 units wide, so the band
	// sits just outside the flower's ring (outer radius 45.83 here) and still fits the box. The
	// amount ring sits outside that band and paints beyond the viewBox, which overflow-visible
	// on the svg allows.
	const C = 62.5;
	const ACTION_RING = { inner: 47, outer: 61 };
	const AMOUNT_RING = { inner: 64, outer: 76 };

	function polar(radius: number, angle: number): [number, number] {
		const radians = ((angle - 90) * Math.PI) / 180;
		return [C + radius * Math.cos(radians), C + radius * Math.sin(radians)];
	}
	const round = (value: number): number => Math.round(value * 100) / 100;

	function ringPath(index: number, count: number, ring: { inner: number; outer: number }): string {
		const span = 360 / count;
		const gap = 4;
		const a0 = index * span + gap / 2;
		const a1 = a0 + span - gap;
		const [x0, y0] = polar(ring.outer, a0);
		const [x1, y1] = polar(ring.outer, a1);
		const [x2, y2] = polar(ring.inner, a1);
		const [x3, y3] = polar(ring.inner, a0);
		return (
			`M ${round(x0)} ${round(y0)} A ${ring.outer} ${ring.outer} 0 0 1 ${round(x1)} ${round(y1)} ` +
			`L ${round(x2)} ${round(y2)} A ${ring.inner} ${ring.inner} 0 0 0 ${round(x3)} ${round(y3)} Z`
		);
	}

	/** Where a ring's glyph sits: the middle of its band, halfway through the petal's arc. */
	function ringCentre(
		index: number,
		count: number,
		ring: { inner: number; outer: number }
	): [number, number] {
		const span = 360 / count;
		return polar((ring.inner + ring.outer) / 2, (index + 0.5) * span);
	}

	/** One dark-blue glass for every petal: the glyph carries the meaning, the tint no longer
	 * does, so a kind is no longer a colour. Literal strings - Tailwind only sees whole names. */
	const PETAL = 'fill-slate-900 stroke-slate-500';
	/** Hover and the pressed petal light the same bright yellow rim. The glow is the ring's own
	 * SVG filter (see `petal-glow` in layout.css): a CSS drop-shadow() would be clipped to the
	 * path's bounding box and cut the glow into a rectangle. Keyboard focus keeps its own sky
	 * rim, so yellow always means hover or pressed. */
	const PETAL_LIT = 'stroke-yellow-300 petal-glow';
	const PETAL_HOVER = 'hover:stroke-yellow-300 hover:petal-glow';
	const PETAL_FOCUS = 'focus-visible:stroke-sky-200';

	type Glyph = 'info' | 'sword' | 'cross' | 'star' | 'circle';

	type Petal = {
		id: string;
		label: string;
		glyph: Glyph;
		glyphClasses: string;
		/** The flow this petal opens; null for the two that are not flows. */
		flow: Flow | null;
	};

	/**
	 * The five petals, clockwise from 12 o'clock: the model's card, then what a run does to
	 * Life, States and Stamina. Damage and heal do not declare a target - choosing the model is
	 * the action's own step - and neither do the States: one orange star opens the row, and the
	 * ring it leads to both assigns and removes, so a second "remove" petal would only be a
	 * second door into the same room. Stamina needs no row at all: its two steps act on the
	 * flower the petals already belong to.
	 */
	const PETALS: Petal[] = [
		{
			id: 'info',
			label: "Show this model's card",
			glyph: 'info',
			glyphClasses: 'fill-slate-400 stroke-slate-400',
			flow: null
		},
		{
			id: 'damage',
			label: 'Deal damage',
			glyph: 'sword',
			glyphClasses: 'fill-red-400',
			flow: 'damage'
		},
		{ id: 'heal', label: 'Heal', glyph: 'cross', glyphClasses: 'fill-emerald-400', flow: 'heal' },
		{
			id: 'status',
			label: 'Edit statuses',
			glyph: 'star',
			glyphClasses: 'fill-orange-400',
			flow: 'status'
		},
		{
			id: 'stamina',
			label: 'Manage Stamina',
			glyph: 'circle',
			glyphClasses: 'fill-yellow-400',
			flow: 'stamina'
		}
	];

	// Pressing a petal lights it - the selection its ring blooms from. Pressing the same petal
	// again folds its flow away, pressing another switches the flow, and pressing the one that
	// is not a flow folds whatever is open away first. A model with no Stamina has nothing for
	// its petal to move, so the petal is dead rather than a ring of two disabled steps.
	function select(petal: Petal): void {
		if (strike) return;
		if (petal.flow === 'stamina' && !flower.stamina) return;
		if (petal.flow) {
			const next = petal.flow;
			activePetal = petal.id;
			if (flow === next && (subRingOut || targetsOut)) cancelFlow();
			else {
				cancelFlow();
				openFlow(next);
			}
			return;
		}
		cancelFlow();
		activePetal = petal.id;
		if (petal.glyph === 'info') onInfo();
	}

	/**
	 * Damage and heal open on their amount ring, the row following once an amount is chosen;
	 * the status flow has no amount to choose, so it opens straight onto the row.
	 */
	function openFlow(next: Flow): void {
		flow = next;
		picked = null;
		struck = null;
		faded = 0;
		if (next === 'status') {
			rowTargets = [...statusTargets];
			targetsOut = true;
			return;
		}
		subRingOut = true;
	}

	function pickAmount(value: number): void {
		amount = value;
		amountEntry = false;
		picked = null;
		struck = null;
		faded = 0;
		rowTargets = [...(flow === 'heal' ? healTargets : damageTargets)];
		targetsOut = true;
	}

	function confirmAmountEntry(): void {
		if (amountDraft === null || !Number.isFinite(amountDraft) || amountDraft < 1) return;
		pickAmount(Math.floor(amountDraft));
	}

	// The values the centred flower's rings now show, and the walk they are mid-way through.
	// The flower prop is the snapshot taken when the overlay opened, so the flows keep their
	// own running record: a commit lands in the store at once and the ring catches up box by
	// box - the row's flower does the same during a strike. A tap mid-walk restarts from what
	// the player now sees, and the token drops the old walk's timers instead of letting two
	// walks fight over the ring. Keyed by entry, because a status flow can swap the flower on
	// show mid-session.
	let shownVitality = $state<{ entryId: string; token: number; hp: number; sta: number } | null>(
		null
	);
	let walkToken = 0;

	/** One half of the focused copy as the player now sees it, snapshot and walk included. */
	function displayed(half: 'life' | 'stamina'): number | null {
		const ring = half === 'life' ? flower.life : flower.stamina;
		if (!ring) return null;
		if (shownVitality?.entryId === flower.entryId)
			return half === 'life' ? shownVitality.hp : shownVitality.sta;
		return ring.current;
	}

	/** Walks one half from where it is on screen to where the commit put it, one box a step. */
	function walk(half: 'life' | 'stamina', from: number, goal: number): void {
		const steps = goal - from;
		const count = Math.abs(steps);
		const token = ++walkToken;
		shownVitality = {
			entryId: flower.entryId,
			token,
			hp: half === 'life' ? from : (displayed('life') ?? 0),
			sta: half === 'stamina' ? from : (displayed('stamina') ?? 0)
		};
		for (let box = 1; box <= count; box++)
			later(FADE_MS * box, () => {
				if (!shownVitality || shownVitality.token !== token) return;
				const value = from + Math.sign(steps) * box;
				if (half === 'life') shownVitality.hp = value;
				else shownVitality.sta = value;
			});
	}

	/** The Stamina ring's two steps, dead at the floor and at the over-Stamina cap. */
	let staminaSteps = $derived.by(() => {
		const current = displayed('stamina') ?? 0;
		return [
			{ delta: -1, label: 'Spend 1 Stamina', enabled: current > 0 },
			{
				delta: 1,
				label: 'Gain 1 Stamina',
				enabled: current < staminaCap(flower.stamina?.max ?? 0)
			}
		];
	});

	function applyStaminaStep(delta: number): void {
		const sta = flower.stamina;
		const from = displayed('stamina');
		if (!sta || from === null || strike || closing) return;
		const goal = Math.min(staminaCap(sta.max), Math.max(0, from + delta));
		if (goal === from) return;
		onStamina(delta);
		walk('stamina', from, goal);
	}

	// Box taps: the ring's boxes are themselves the control on the focused flower, while the
	// petals hold their place just outside the ring - so the boxes steal no petal click. Only
	// while the ring is idle: mid-flow the player's hand is somewhere else, and once a status
	// flow has moved the focus the flower on show is not the one this overlay commits for.
	let boxesLive = $derived(petalsOpen && flow === null && !statusTarget && !strike && !infoOpen);

	function applyBoxTap(half: 'stamina' | 'life', index: number): void {
		const from = displayed(half);
		const max = half === 'life' ? flower.life?.max : flower.stamina?.max;
		if (!boxesLive || from === null || max === undefined) return;
		const goal = Math.min(max, Math.max(0, index + 1));
		if (goal === from) return;
		onSetStat(half, goal);
		walk(half, from, goal);
	}

	/** The flower on show, its rings at the values the steps and taps have walked them to. */
	let walkedFlower = $derived.by(() => {
		if (!shownVitality || shownVitality.entryId !== shownFlower.entryId) return shownFlower;
		let spec = shownFlower;
		if (spec.stamina)
			spec = {
				...spec,
				stamina: {
					...spec.stamina,
					current: shownVitality.sta,
					states: vitalityRingStates(shownVitality.sta, spec.stamina.max)
				}
			};
		if (spec.life)
			spec = {
				...spec,
				life: {
					...spec.life,
					current: shownVitality.hp,
					states: vitalityRingStates(shownVitality.hp, spec.life.max)
				}
			};
		return spec;
	});

	/** A row cell's slot, read while the row is still on screen - it is what carries it. */
	function slotOf(key: string): FlowerRect | null {
		const el = document.querySelector(`[data-target-key="${key}"]`);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return { x: rect.x, y: rect.y, width: rect.width };
	}

	/**
	 * A copy's slot in the strip. The row's cells are not this: they sit mid-screen in an overlay
	 * that is gone by the time the flower glides home, so a focus that moved onto a copy takes
	 * its home from the strip flower itself.
	 */
	function stripSlotOf(key: string): FlowerRect | null {
		const el = document.querySelector(`[data-flower-key="${key}"]`);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return { x: rect.x, y: rect.y, width: rect.width };
	}

	function targetCentre(key: string): { x: number; y: number } {
		const slot = slotOf(key);
		if (!slot) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		return { x: slot.x + slot.width / 2, y: slot.y + slot.width / 2 };
	}

	// Damage and heal: one tap selects a model, the second confirms - the flow's glyph leaves
	// the focused flower, and once it lands the change is committed and the target's Life walks
	// box by box. The status flow's single tap moves the focus instead; its commit is the ring's.
	function tapTarget(target: VitalityTarget): void {
		if (strike || flow === null) return;
		if (flow === 'status') {
			retarget(target);
			return;
		}
		if (amount === null) return;
		const key = keyOf(target);
		if (picked !== key) {
			picked = key;
			return;
		}
		const to = targetCentre(key);
		struck = target;
		faded = 0;
		strike = {
			key,
			flow,
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
			tx: to.x,
			ty: to.y,
			flying: false
		};
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				if (strike) strike.flying = true;
			})
		);
		later(STRIKE_MS, () => landStrike(target));
	}

	/**
	 * The status flow moves the focus onto the chosen copy: its flower takes the centre, the
	 * overlay will glide home into ITS slot, and the flower the overlay opened from goes back to
	 * the strip - lit, because that is where it now lives. The petals fold with it, since they
	 * belong to the flower that left. One dip to the slot size on the way reads as the swap:
	 * the outgoing model shrinks home while the incoming one grows into the centre.
	 */
	function retarget(target: VitalityTarget): void {
		const slot = stripSlotOf(keyOf(target));
		if (slot) homeRect = slot;
		statusTarget = target;
		statusDraft = [...target.flower.statuses];
		statusArmed = false;
		targetsOut = false;
		petalsOut = false;
		swapDip = true;
		onFocusMoved?.();
		later(SWAP_MS, () => (swapDip = false));
		later(GLIDE_MS, () => {
			if (statusTarget) statusRingOut = true;
		});
	}

	/**
	 * Toggles one State in the draft. The States the rules force on a fallen copy are not
	 * offered: the store re-applies them to every commit, so clearing one would only show the
	 * tap undone. Editing disarms the pending commit, so a tap after a toggle never writes.
	 */
	function toggleDraft(status: UnitStatus): void {
		const target = statusTarget;
		if (!target || closing) return;
		if (
			statusLockedAtZeroHp(
				status,
				target.flower.life?.current ?? 1,
				target.flower.undead,
				target.flower.statuses
			)
		)
			return;
		statusDraft = toggleUnitStatus(statusDraft, status);
		statusArmed = false;
	}

	/** The model icon is the commit: the first tap arms the crosshair, the second writes. */
	function tapIcon(): void {
		if (!statusRingOpen || !statusTarget) return;
		if (!statusArmed) {
			statusArmed = true;
			return;
		}
		onStatuses(statusTarget, statusDraft);
		dismiss();
	}

	/**
	 * The status ring's geometry, in px about the viewport centre: every State at once, on a
	 * radius that keeps a 44px orb - a real touch target - inside the smaller screen dimension.
	 * Nothing competes for this radius: the petals went home and this flow has no amount ring.
	 */
	const STATUS_ORB = 44;
	let statusRadius = $derived.by(() => {
		const room = Math.min(window.innerWidth, window.innerHeight) / 2;
		return Math.max(84, Math.min(room - STATUS_ORB / 2 - 10, 150));
	});

	type StatusOrb = {
		status: UnitStatus;
		label: string;
		x: number;
		y: number;
		on: boolean;
		locked: boolean;
	};

	let statusRing = $derived.by((): StatusOrb[] => {
		const target = statusTarget;
		if (!target) return [];
		const hp = target.flower.life?.current ?? 1;
		const step = (360 / RING_STATUSES.length) * (Math.PI / 180);
		return RING_STATUSES.map((status, index) => ({
			status,
			label: UNIT_STATUS_LABELS[status],
			x: statusRadius * Math.sin(index * step),
			y: -statusRadius * Math.cos(index * step),
			on: statusDraft.includes(status),
			locked: statusLockedAtZeroHp(status, hp, target.flower.undead, target.flower.statuses)
		}));
	});

	function landStrike(target: VitalityTarget): void {
		const life = target.flower.life;
		const current = life?.current ?? 0;
		const healing = strike?.flow === 'heal';
		if (healing) onHeal(target, amount ?? 0);
		else onDamage(target, amount ?? 0);
		const applied = healing
			? healApplied(amount ?? 0, current, life?.max ?? 0)
			: damageApplied(amount ?? 0, current);
		strike = null;
		picked = null;
		// The amount ring folds as the glyph lands, so the dismissal that follows the fade
		// closes the overlay instead of folding a flow that is already over. It has to be
		// dismiss() rather than close(): the row is still out while its boxes walk the fade,
		// and close() would read that as a layer to fold and leave the overlay open.
		subRingOut = false;
		for (let box = 1; box <= applied; box++) later(FADE_MS * box, () => (faded = box));
		later(FADE_MS * applied + FADE_SETTLE_MS, dismiss);
	}

	/** The struck copy's flower while its Life walks: boxes darken or refill from the bottom,
	 * and past the base the refilled ones paint blue - the overheal, up to double the base. */
	function rowFlower(target: VitalityTarget): BattleFlowerSpec {
		const life = target.flower.life;
		if (!struck || keyOf(target) !== keyOf(struck) || !life || faded === 0) return target.flower;
		const step = flow === 'heal' ? faded : -faded;
		const current = Math.min(lifeCap(life.max), Math.max(0, life.current + step));
		return {
			...target.flower,
			life: { ...life, current, states: vitalityRingStates(current, life.max) }
		};
	}
</script>

<!-- The blur sits under the flower and over everything else; it also freezes the pane behind
     it, because wheel events land on the backdrop instead of the scrolling panel. -->
<div
	class="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition-opacity duration-300
		{closing === 'flower' ? 'opacity-0' : 'opacity-100'}"
	role="presentation"
	onclick={close}
></div>

<!-- A petal's glyph, upright at the middle of its band: the shape says the kind, the colour
     what it does to the model, and the info petal's grey bang in a grey ring reads as "look"
     rather than "do". The whole group is inert, so a press still reaches the path beneath it.
     Drawn in local coordinates about the band's centre, which keeps every glyph the same size
     on every petal. -->
{#snippet petalGlyph(petal: Petal, cx: number, cy: number)}
	<g
		transform="translate({round(cx)} {round(cy)})"
		class="pointer-events-none {petal.glyphClasses}"
	>
		{#if petal.glyph === 'sword'}
			<path d="M 0 -5.4 L 1.2 -2.6 L 1.2 1.4 L -1.2 1.4 L -1.2 -2.6 Z" />
			<rect x="-2.7" y="1.4" width="5.4" height="1.1" rx="0.5" />
			<rect x="-0.6" y="2.5" width="1.2" height="1.9" rx="0.5" />
			<circle cy="4.7" r="0.9" />
		{:else if petal.glyph === 'cross'}
			<path
				d="M -1.5 -4.6 H 1.5 V -1.5 H 4.6 V 1.5 H 1.5 V 4.6 H -1.5 V 1.5 H -4.6 V -1.5 H -1.5 Z"
			/>
		{:else if petal.glyph === 'star'}
			<path
				d="M 0 -5.2 L 1.29 -1.78 L 4.95 -1.61 L 2.09 0.68 L 3.06 4.21 L 0 2.2 L -3.06 4.21 L -2.09 0.68 L -4.95 -1.61 L -1.29 -1.78 Z"
			/>
		{:else if petal.glyph === 'circle'}
			<!-- Stamina: a plain disc in the same hue as the ring's Stamina boxes. -->
			<circle r="4.6" />
		{:else}
			<circle r="5.2" fill="none" stroke-width="1.2" />
			<rect x="-0.75" y="-3.2" width="1.5" height="4.1" rx="0.75" stroke="none" />
			<circle cy="2.4" r="0.85" stroke="none" />
		{/if}
	</g>
{/snippet}

<!-- The selection mark: a slowly turning crosshair, still under reduced motion, where it simply
     holds. `box` places it - over a row cell it fills the cell, over the model icon it rings it. -->
{#snippet crosshair(box: string)}
	<svg
		viewBox="0 0 40 40"
		fill="none"
		class="pointer-events-none absolute {box} animate-[spin_5s_linear_infinite]
			stroke-emerald-400 motion-reduce:animate-none"
	>
		<circle cx="20" cy="20" r="16.5" stroke-width="1.6" stroke-dasharray="6 5" />
		<path d="M 20 0 V 7 M 20 33 V 40 M 0 20 H 7 M 33 20 H 40" stroke-width="2" />
	</svg>
{/snippet}

<div
	class="fixed z-50 transition-[transform,left,top,width] duration-300 ease-out
		motion-reduce:transition-none"
	style="left: {anchor.x}px; top: {anchor.y}px; width: {anchor.width}px; transform: {transform}"
>
	<!-- Before the flower in paint order, so the ring blooms out from behind it and retracts
	     behind it. The flower copy is pointer-inert, which is what still lets the petals -
	     painted beneath it - receive their own clicks; clicks on the flower itself fall through
	     to this wrapper and are swallowed, so only a click beyond it reaches the backdrop. -->
	<svg
		viewBox="0 0 125 125"
		class="pointer-events-none absolute left-1/2 aspect-square w-[125%] overflow-visible
			transition-all duration-300 ease-out motion-reduce:transition-none"
		style="top: {anchor.width / 2}px; transform: translate(-50%, -50%) scale({petalsOpen
			? 1
			: 0.55});
			opacity: {petalsOpen ? 1 : 0}"
		aria-hidden={!petalsOpen}
	>
		<!-- The lit rim's glow. Its region spans the whole petal space in user units, because the
		     default region - the path's bounding box plus 10% - cuts a thin arc's glow into a
		     rectangle; overflow-visible lets the blur reach past the viewBox edge as well. -->
		<defs>
			<filter id="petal-glow" filterUnits="userSpaceOnUse" x="-25" y="-25" width="175" height="175">
				<feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#fde047" flood-opacity="0.9" />
			</filter>
		</defs>
		<!-- The third ring: how much. Damage and heal count in steps and close with an X that
		     asks for a number; Stamina offers just the two steps it has, -1 and +1, dead at the
		     floor and at the over-Stamina cap. Painted first, so it blooms out from behind the
		     action ring and folds back behind it on the way out - the action ring and its
		     glyphs stay on top, which is what makes the bloom read as emerging. -->
		<g
			class="transition-all duration-300 ease-out motion-reduce:transition-none"
			style="transform-origin: 62.5px 62.5px; transform: scale({subRingOut ? 1 : 0.55});
				opacity: {subRingOut ? 1 : 0}"
			aria-hidden={!subRingOut}
		>
			{#if flow === 'stamina'}
				{#each staminaSteps as step, index (step.delta)}
					<path
						d={ringPath(index, 2, AMOUNT_RING)}
						class="{subRingOut && step.enabled
							? 'pointer-events-auto cursor-pointer'
							: 'pointer-events-none'} transition-all duration-200 outline-none {PETAL}
							{subRingOut && step.enabled ? PETAL_HOVER : ''} {PETAL_FOCUS}"
						role="button"
						tabindex={subRingOut && step.enabled ? 0 : -1}
						aria-label={step.label}
						aria-disabled={step.enabled ? undefined : 'true'}
						stroke-width="2"
						onclick={() => applyStaminaStep(step.delta)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								applyStaminaStep(step.delta);
							}
						}}
					/>
					{@const [ax, ay] = ringCentre(index, 2, AMOUNT_RING)}
					<text
						x={round(ax)}
						y={round(ay)}
						text-anchor="middle"
						dominant-baseline="central"
						font-size="11"
						class="pointer-events-none {step.enabled ? 'fill-slate-200' : 'fill-slate-500'}"
					>
						{step.delta < 0 ? '−1' : '+1'}
					</text>
				{/each}
			{:else}
				{#each [...AMOUNT_STEPS, null] as value, index (value === null ? 'x' : `${value}`)}
					<path
						d={ringPath(index, 7, AMOUNT_RING)}
						class="{subRingOut ? 'pointer-events-auto' : 'pointer-events-none'}
						cursor-pointer transition-all duration-200 outline-none {PETAL}
						{PETAL_HOVER} {PETAL_FOCUS}
						{subRingOut && (value === null ? amountEntry : amount === value) ? PETAL_LIT : ''}"
						role="button"
						tabindex={subRingOut ? 0 : -1}
						aria-label={value === null
							? flow === 'heal'
								? 'Choose the healing'
								: 'Choose the damage'
							: flow === 'heal'
								? `Heal ${value}`
								: `Deal ${value} damage`}
						stroke-width="2"
						onclick={() => {
							if (value === null) {
								amountDraft = null;
								amountEntry = true;
							} else {
								pickAmount(value);
							}
						}}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								if (value === null) {
									amountDraft = null;
									amountEntry = true;
								} else {
									pickAmount(value);
								}
							}
						}}
					/>
					{@const [ax, ay] = ringCentre(index, 7, AMOUNT_RING)}
					<text
						x={round(ax)}
						y={round(ay)}
						text-anchor="middle"
						dominant-baseline="central"
						font-size="11"
						class="pointer-events-none fill-slate-200"
					>
						{value === null ? 'X' : value}
					</text>
				{/each}
			{/if}
		</g>
		{#each PETALS as petal, index (petal.id)}
			{@const dead = petal.id === 'stamina' && !flower.stamina}
			<path
				d={ringPath(index, PETALS.length, ACTION_RING)}
				class="{petalsOpen && !dead
					? 'pointer-events-auto cursor-pointer'
					: 'pointer-events-none'} transition-all duration-200 outline-none {PETAL}
					{dead ? '' : PETAL_HOVER} {PETAL_FOCUS} {litPetal === petal.id ? PETAL_LIT : ''}
					{dead ? 'opacity-40' : ''}"
				role="button"
				tabindex={petalsOpen && !dead ? 0 : -1}
				aria-label={dead ? 'Manage Stamina - this model tracks no Stamina' : petal.label}
				aria-disabled={dead ? 'true' : undefined}
				stroke-width="2"
				onclick={() => select(petal)}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						select(petal);
					}
				}}
			/>
			{@const [cx, cy] = ringCentre(index, PETALS.length, ACTION_RING)}
			{@render petalGlyph(petal, cx, cy)}
		{/each}
	</svg>
	<!-- The flower on show, and no States band of its own: the petals sit at the band's radius.
	     Its rings are the walked snapshot while a step's or a tap's boxes are still moving, and
	     while the petals hold their place its boxes are themselves tappable. -->
	<BattleFlower
		flower={walkedFlower}
		showLabel={false}
		showStatuses={false}
		inert
		onBoxTap={boxesLive ? applyBoxTap : undefined}
	/>
</div>

<!-- The vitality flow's target row: the field steps out of the blurred panel and up in front,
     below the flower, the focused copy's twin among them so a model can act on itself. Which
     copies appear is the flow's business - the living field for damage, the wounded for heal,
     every copy for the States. Seat-coloured rims say whose model it is; a badge numbers
     duplicate copies. No States band here: the cells are round and tight, and the band would
     paint over the neighbouring cell. -->
{#if targetsOut}
	<div
		class="fixed right-0 left-0 z-50 mx-auto w-[min(92vw,26rem)] transition-all duration-300
			ease-out motion-reduce:transition-none"
		style="top: calc(50% + {Math.round(anchor.width * 1.05)}px);
			opacity: {targetsIn ? 1 : 0}; transform: translateY({targetsIn ? '0' : '18px'})"
	>
		<p class="mb-2 text-center text-xs tracking-wide text-slate-300">
			{flow === 'status'
				? 'Tap target to select statuses'
				: 'Tap on selected model and then confirm it again'}
		</p>
		<div
			class="max-h-[34dvh] overflow-y-auto overscroll-contain rounded-2xl
				border border-slate-600/40 bg-slate-950/70 p-3 backdrop-blur-sm"
		>
			<div class="grid grid-cols-4 gap-3">
				{#each rowTargets as target (keyOf(target))}
					<!-- A div, not a button: the flower inside is one, and buttons may not nest. -->
					<div
						role="button"
						tabindex="0"
						data-target-key={keyOf(target)}
						class="relative aspect-square w-full cursor-pointer rounded-full border-2
							bg-slate-900/60 p-0.5 outline-none focus-visible:border-sky-200
							{playerAccent(target.player).border}"
						aria-label="{target.flower.name}{target.copy !== null
							? ` copy ${target.copy}`
							: ''}, {target.player === 'player1' ? 'Player 1' : 'Player 2'}"
						onclick={() => tapTarget(target)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								tapTarget(target);
							}
						}}
					>
						<BattleFlower flower={rowFlower(target)} showLabel={false} showStatuses={false} />
						{#if target.copy !== null}
							<span
								class="absolute -top-1 -right-1 rounded-full border
									border-slate-600/60 bg-slate-950/95 px-1 text-[10px]
									leading-4 font-semibold text-slate-200"
							>
								{target.copy}
							</span>
						{/if}
						{#if picked === keyOf(target)}
							{@render crosshair('inset-0 h-full w-full')}
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- The status flow's ring: every State the game has, all at once, around the copy the focus
     moved onto. A carried State lights the same yellow rim the pressed petal does and wears its
     own colour; the rest are the dark glass the petals are, with a grey glyph. The two States
     the rules force on a fallen copy are locked rather than offered, because the store puts
     them back on every commit - a tap that silently undoes itself teaches nothing. -->
{#if statusTarget}
	<div
		class="pointer-events-none fixed inset-0 z-50 transition-opacity duration-300
			motion-reduce:transition-none"
		style="opacity: {statusRingOpen ? 1 : 0}"
		aria-hidden={!statusRingOpen}
	>
		{#each statusRing as orb (orb.status)}
			<button
				type="button"
				disabled={orb.locked}
				class="absolute flex items-center justify-center rounded-full border-2 bg-slate-900
					transition-all duration-200 ease-out outline-none
					motion-reduce:transition-none {statusRingOpen ? 'pointer-events-auto' : 'pointer-events-none'}
					{orb.on ? 'border-yellow-300 shadow-[0_0_12px_2px_rgba(253,224,71,0.5)]' : 'border-slate-500'}
					{orb.locked ? 'cursor-not-allowed opacity-50' : 'hover:border-yellow-300'}
					focus-visible:border-sky-200"
				style="left: calc(50% + {Math.round(orb.x)}px); top: calc(50% + {Math.round(orb.y)}px);
					width: {STATUS_ORB}px; height: {STATUS_ORB}px;
					transform: translate(-50%, -50%) scale({statusRingOpen ? 1 : 0.55})"
				aria-pressed={orb.on}
				aria-label={orb.locked
					? `${orb.label} - forced while Life is 0`
					: `${orb.on ? 'Remove' : 'Assign'} ${orb.label}`}
				onclick={() => toggleDraft(orb.status)}
			>
				<StatusGlyph status={orb.status} active={orb.on} size="h-7 w-7" />
			</button>
		{/each}
		<!-- The model icon is the commit: the first tap arms the crosshair, the second writes the
		     draft. It sits above the flower, which is inert, so the ring owns the whole gesture. -->
		<button
			type="button"
			class="absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-200
				{statusRingOpen ? 'pointer-events-auto' : 'pointer-events-none'}"
			style="left: 50%; top: 50%; width: {iconSize}px; height: {iconSize}px;
				transform: translate(-50%, -50%)"
			aria-label={statusArmed
				? `Confirm the States on ${statusTarget.flower.name}`
				: `Arm the commit for ${statusTarget.flower.name}`}
			onclick={tapIcon}
		>
			{#if statusArmed}
				{@render crosshair('-inset-3')}
			{/if}
		</button>
		<p
			class="absolute right-0 bottom-6 left-0 px-6 text-center text-xs tracking-wide
				text-slate-300"
		>
			Tap status effects to add or remove them. Tap model icon twice to confirm
		</p>
	</div>
{/if}

<!-- The strike: the flow's glyph leaves the focused flower and flies at the confirmed target. -->
{#if strike}
	<div
		class="pointer-events-none fixed top-0 left-0 z-[60] transition-transform duration-500
			ease-in motion-reduce:transition-none"
		style="transform: translate({(strike.flying ? strike.tx : strike.x) - 14}px,
			{(strike.flying ? strike.ty : strike.y) - 14}px)"
	>
		<svg
			viewBox="-8 -8 16 16"
			class="h-7 w-7 {strike.flow === 'heal' ? 'fill-emerald-400' : 'fill-red-400'}"
		>
			{#if strike.flow === 'heal'}
				<path
					d="M -1.5 -4.6 H 1.5 V -1.5 H 4.6 V 1.5 H 1.5 V 4.6 H -1.5 V 1.5 H -4.6 V -1.5 H -1.5 Z"
				/>
			{:else}
				<path d="M 0 -5.4 L 1.2 -2.6 L 1.2 1.4 L -1.2 1.4 L -1.2 -2.6 Z" />
				<rect x="-2.7" y="1.4" width="5.4" height="1.1" rx="0.5" />
				<rect x="-0.6" y="2.5" width="1.2" height="1.9" rx="0.5" />
				<circle cy="4.7" r="0.9" />
			{/if}
		</svg>
	</div>
{/if}

<!-- X: how much, in the player's own numbers. -->
{#if amountEntry}
	<div
		class="fixed inset-0 z-[60]"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) amountEntry = false;
		}}
	>
		<div
			class="absolute top-1/2 left-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl
				border border-slate-600/60 bg-slate-900/95 p-4"
		>
			<label class="text-xs tracking-wide text-slate-400 uppercase" for="damage-amount">
				{flow === 'heal' ? 'Healing' : 'Damage'}
			</label>
			<input
				id="damage-amount"
				type="number"
				min="1"
				inputmode="numeric"
				bind:value={amountDraft}
				class="mt-1 w-full rounded-lg border border-slate-600/60 bg-slate-950/80 px-3 py-2
					text-lg text-slate-100 outline-none focus:border-sky-400/60"
			/>
			<div class="mt-3 flex justify-end gap-2">
				<button
					type="button"
					class="rounded-lg border border-slate-600/60 px-3 py-1.5 text-sm text-slate-300"
					onclick={() => (amountEntry = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm
						text-sky-100"
					onclick={confirmAmountEntry}
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}
