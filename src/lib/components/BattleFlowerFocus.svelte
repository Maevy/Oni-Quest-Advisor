<script lang="ts">
	import type { BattleFlowerSpec, UnitStatus } from '$lib/domain';
	import {
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
	import BattleFlower from './BattleFlower.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import AmountPad from './AmountPad.svelte';
	import StatusGlyph from './StatusGlyph.svelte';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		flower: BattleFlowerSpec;
		/** The slot the flower was clicked in, in viewport coordinates. */
		from: FlowerRect;
		/** Whether the model's card is open; the info petal is lit only while it is. */
		infoOpen: boolean;
		/** The info petal was pressed: the screen opens the model's card above this overlay. */
		onInfo: () => void;
		/** The sword was confirmed on the pad: the screen deals it to this very model. */
		onDamage: (amount: number) => void;
		/** The cross was confirmed on the pad: the screen heals this very model. */
		onHeal: (amount: number) => void;
		/** The ring was confirmed: the screen writes the draft to this very model. */
		onStatuses: (statuses: UnitStatus[]) => void;
		/** A Stamina step was tapped: the screen commits it to the focused copy's seat. */
		onStamina: (delta: number) => void;
		/** A ring box was tapped: the screen sets that half of the focused copy straight to it. */
		onSetStat: (half: 'life' | 'stamina', value: number) => void;
		/** Called once the petals have retracted and the flower has glided back into its slot. */
		onClosed: () => void;
	};

	let {
		flower,
		from,
		infoOpen,
		onInfo,
		onDamage,
		onHeal,
		onStatuses,
		onStamina,
		onSetStat,
		onClosed
	}: Props = $props();

	/** The focused flower grows a third; it is a focus aid, not a full-screen card. */
	const GROWTH = 1.3;
	const GLIDE_MS = 340;
	const FADE_MS = 260;

	let placed = $state(false);
	let petalsOut = $state(false);
	let closing = $state<null | 'petals' | 'flower'>(null);
	/** The petal whose press lit it; at most one glows, and dismissal drops the glow first. */
	let activePetal = $state<string | null>(null);
	// The info petal's light is the open card's, not a standing selection: once the card closes
	// the petal falls back to the ring's default grey, while the other petals keep theirs until
	// another petal is pressed or the ring retracts.
	let litPetal = $derived(activePetal === 'info' && !infoOpen ? null : activePetal);

	// Every petal now acts on the flower at the centre - choosing a target is what the
	// drag-and-drop Interaction panel is for. Damage and heal ask their amount on the pad, the
	// States bloom their ring around this same flower, and Stamina keeps its two steps.
	type Flow = 'damage' | 'heal' | 'status' | 'stamina';
	let flow = $state<Flow | null>(null);
	let subRingOut = $state(false);
	let statusRingOut = $state(false);
	let statusDraft = $state<UnitStatus[]>([]);
	let statusArmed = $state(false);

	// The values the centred flower's rings now show, and the walk they are mid-way through.
	// The flower prop is the snapshot taken when the overlay opened, so the flows keep their
	// own running record: a commit lands in the store at once and the ring catches up box by
	// box. A tap mid-walk restarts from what the player now sees, and the token drops the old
	// walk's timers instead of letting two walks fight over the ring.
	let shownVitality = $state<{ entryId: string; token: number; hp: number; sta: number } | null>(
		null
	);
	let walkToken = 0;

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

	function cancelFlow(): void {
		flow = null;
		subRingOut = false;
		statusRingOut = false;
		statusArmed = false;
	}

	/**
	 * Layered dismissal: an open States ring goes with the whole overlay - its draft was never
	 * committed, so leaving writes nothing - while an open pad or the Stamina ring folds back to
	 * the petals first.
	 */
	function close(): void {
		if (closing) return;
		if (statusRingOut) {
			dismiss();
			return;
		}
		if (flow) {
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
	// Stamina ring sits outside that band and paints beyond the viewBox, which overflow-visible
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
		/** The flow this petal opens; null for the one that is not a flow. */
		flow: Flow | null;
	};

	/**
	 * The five petals, clockwise from 12 o'clock: the model's card, then what a run does to
	 * this model's Life, States and Stamina. None of them declares a target - the flower at the
	 * centre is the target, and acting on another model is the Interaction panel's job.
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
			label: 'Deal damage to this model',
			glyph: 'sword',
			glyphClasses: 'fill-red-400',
			flow: 'damage'
		},
		{
			id: 'heal',
			label: 'Heal this model',
			glyph: 'cross',
			glyphClasses: 'fill-emerald-400',
			flow: 'heal'
		},
		{
			id: 'status',
			label: "Edit this model's statuses",
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

	// Pressing a petal lights it - the selection its flow blooms from. Pressing the same petal
	// again folds its flow away, pressing another switches the flow, and pressing the one that
	// is not a flow folds whatever is open away first. A model with no Stamina has nothing for
	// its petal to move, so the petal is dead rather than a ring of two disabled steps.
	function select(petal: Petal): void {
		if (closing) return;
		if (petal.flow === 'stamina' && !flower.stamina) return;
		if (petal.flow) {
			const next = petal.flow;
			activePetal = petal.id;
			if (flow === next) cancelFlow();
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

	function openFlow(next: Flow): void {
		flow = next;
		if (next === 'stamina') {
			subRingOut = true;
			return;
		}
		if (next === 'status') {
			statusDraft = [...flower.statuses];
			statusArmed = false;
			statusRingOut = true;
		}
		// damage and heal render the pad straight from `flow`.
	}

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

	/** The pad's OK: the hit lands on the model at the centre and its Life walks to meet it. */
	function confirmSelfAmount(amount: number): void {
		const life = flower.life;
		const from = displayed('life');
		if (!life || from === null || closing) return;
		const healing = flow === 'heal';
		const applied = healing ? healApplied(amount, from, life.max) : damageApplied(amount, from);
		flow = null;
		if (applied === 0) return;
		const goal = healing
			? Math.min(lifeCap(life.max), from + applied)
			: Math.max(0, from - applied);
		if (healing) onHeal(amount);
		else onDamage(amount);
		walk('life', from, goal);
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
		if (!sta || from === null || closing) return;
		const goal = Math.min(staminaCap(sta.max), Math.max(0, from + delta));
		if (goal === from) return;
		onStamina(delta);
		walk('stamina', from, goal);
	}

	// Translation from the anchor slot to the viewport centre. translate() runs before scale()
	// in the transform list, so this centres the UNSCALED box; the scale then grows it about its
	// own centre and the centre stays put. Centring in the grown frame instead lands the flower
	// half a growth-step off centre.
	let shift = $derived.by(() => ({
		dx: (window.innerWidth - from.width) / 2 - from.x,
		dy: (window.innerHeight - from.width) / 2 - from.y
	}));

	let transform = $derived(
		closing === 'flower' || !placed
			? 'none'
			: `translate(${shift.dx}px, ${shift.dy}px) scale(${GROWTH})`
	);
	let petalsOpen = $derived(petalsOut && closing === null);
	let statusRingOpen = $derived(statusRingOut && closing === null);
	/** The model icon's commit target: the orb inside the flower, 75% of its grown box. */
	let iconSize = $derived(Math.round(from.width * GROWTH * 0.75));

	// Box taps: the ring's boxes are themselves the control on the focused flower, while the
	// petals hold their place just outside the ring - so the boxes steal no petal click. Only
	// while the ring is idle: mid-flow the player's hand is somewhere else.
	let boxesLive = $derived(petalsOpen && flow === null && !closing && !infoOpen);

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
		if (!shownVitality || shownVitality.entryId !== flower.entryId) return flower;
		let spec = flower;
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

	/**
	 * Toggles one State in the draft. The States the rules force on a fallen copy are not
	 * offered: the store re-applies them to every commit, so clearing one would only show the
	 * tap undone. Editing disarms the pending commit, so a tap after a toggle never writes.
	 */
	function toggleDraft(status: UnitStatus): void {
		if (closing) return;
		if (
			statusLockedAtZeroHp(
				status,
				displayed('life') ?? flower.life?.current ?? 1,
				flower.undead,
				flower.statuses
			)
		)
			return;
		statusDraft = toggleUnitStatus(statusDraft, status);
		statusArmed = false;
	}

	/** The model icon is the commit: the first tap arms the crosshair, the second writes. */
	function tapIcon(): void {
		if (!statusRingOut || closing) return;
		if (!statusArmed) {
			statusArmed = true;
			return;
		}
		onStatuses(statusDraft);
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
		if (flow !== 'status') return [];
		const hp = displayed('life') ?? flower.life?.current ?? 1;
		const step = (360 / RING_STATUSES.length) * (Math.PI / 180);
		return RING_STATUSES.map((status, index) => ({
			status,
			label: UNIT_STATUS_LABELS[status],
			x: statusRadius * Math.sin(index * step),
			y: -statusRadius * Math.cos(index * step),
			on: statusDraft.includes(status),
			locked: statusLockedAtZeroHp(status, hp, flower.undead, flower.statuses)
		}));
	});
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
     holds. Over the model icon it rings the commit. -->
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
	style="left: {from.x}px; top: {from.y}px; width: {from.width}px; transform: {transform}"
>
	<!-- Before the flower in paint order, so the ring blooms out from behind it and retracts
	     behind it. The flower copy is pointer-inert, which is what still lets the petals -
	     painted beneath it - receive their own clicks; clicks on the flower itself fall through
	     to this wrapper and are swallowed, so only a click beyond it reaches the backdrop. -->
	<svg
		viewBox="0 0 125 125"
		class="pointer-events-none absolute left-1/2 aspect-square w-[125%] overflow-visible
			transition-all duration-300 ease-out motion-reduce:transition-none"
		style="top: {from.width / 2}px; transform: translate(-50%, -50%) scale({petalsOpen ? 1 : 0.55});
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
		<!-- The Stamina ring: the two steps this model has, -1 and +1, dead at the floor and at
		     the over-Stamina cap. Painted first, so it blooms out from behind the action ring. -->
		<g
			class="transition-all duration-300 ease-out motion-reduce:transition-none"
			style="transform-origin: 62.5px 62.5px; transform: scale({subRingOut ? 1 : 0.55});
				opacity: {subRingOut ? 1 : 0}"
			aria-hidden={!subRingOut}
		>
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

<!-- Damage and heal ask their amount on the pad, below the centred flower. -->
{#if flow === 'damage' || flow === 'heal'}
	<div
		class="fixed right-0 left-0 z-50 mx-auto w-[min(92vw,20rem)] transition-all duration-200
			ease-out motion-reduce:transition-none"
		style="top: calc(50% + {Math.round(from.width * 1.05)}px)"
	>
		<AmountPad
			label={flow === 'heal' ? 'Healing' : 'Damage'}
			tone={flow === 'heal' ? 'heal' : 'damage'}
			onConfirm={confirmSelfAmount}
			onCancel={() => (flow = null)}
		/>
	</div>
{/if}

<!-- The States ring: every State the game has, all at once, around the model at the centre -
     the petals act on this flower, so the ring does too. A carried State lights the same yellow
     rim the pressed petal does and wears its own colour; the rest are the dark glass the petals
     are, with a grey glyph. The two States the rules force on a fallen copy are locked rather
     than offered, because the store puts them back on every commit. -->
{#if statusRingOpen}
	<div class="pointer-events-none fixed inset-0 z-50" aria-hidden={!statusRingOpen}>
		{#each statusRing as orb (orb.status)}
			<button
				type="button"
				disabled={orb.locked}
				class="pointer-events-auto absolute flex items-center justify-center rounded-full
					border-2 bg-slate-900 transition-all duration-200 ease-out outline-none
					motion-reduce:transition-none
					{orb.on ? 'border-yellow-300 shadow-[0_0_12px_2px_rgba(253,224,71,0.5)]' : 'border-slate-500'}
					{orb.locked ? 'cursor-not-allowed opacity-50' : 'hover:border-yellow-300'}
					focus-visible:border-sky-200"
				style="left: calc(50% + {Math.round(orb.x)}px); top: calc(50% + {Math.round(orb.y)}px);
					width: {STATUS_ORB}px; height: {STATUS_ORB}px; transform: translate(-50%, -50%)"
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
			class="pointer-events-auto absolute rounded-full outline-none focus-visible:ring-2
				focus-visible:ring-sky-200"
			style="left: 50%; top: 50%; width: {iconSize}px; height: {iconSize}px;
				transform: translate(-50%, -50%)"
			aria-label={statusArmed
				? `Confirm the States on ${flower.name}`
				: `Arm the commit for ${flower.name}`}
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
