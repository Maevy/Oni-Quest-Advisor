<script lang="ts">
	import type { BattleFlowerSpec, VitalityTarget } from '$lib/domain';
	import {
		AMOUNT_STEPS,
		damageApplied,
		healApplied,
		lifeCap,
		vitalityRingStates
	} from '$lib/domain';
	import { playerAccent } from './playerAccent';
	import BattleFlower from './BattleFlower.svelte';
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
		/** The strike landed: the screen commits the damage to the target seat's vitality map. */
		onDamage: (target: VitalityTarget, amount: number) => void;
		/** The heal landed: the screen commits it to the target seat's vitality map. */
		onHeal: (target: VitalityTarget, amount: number) => void;
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
		onDamage,
		onHeal,
		onClosed
	}: Props = $props();

	/** The focused flower grows a third; it is a focus aid, not a full-screen card. */
	const GROWTH = 1.3;
	const GLIDE_MS = 340;
	const STRIKE_MS = 500;
	const FADE_MS = 260;
	const FADE_SETTLE_MS = 450;

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
	// strike plays out on its own.
	type Flow = 'damage' | 'heal';
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

	const keyOf = (target: VitalityTarget): string => `${target.player}:${target.entryId}`;

	// Translation from the clicked slot to the viewport centre. translate() runs before scale()
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
	}

	/** Layered dismissal: the X entry, then the flow, then the whole overlay. */
	function close(): void {
		if (closing || strike) return;
		if (amountEntry) {
			amountEntry = false;
			return;
		}
		if (subRingOut) {
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

	type Petal = { id: string; label: string; glyph: Glyph; glyphClasses: string };

	/**
	 * The six petals, clockwise from 12 o'clock: the model's card, then what a run does to
	 * Life and States, then Stamina. Damage and heal no longer declare a target - choosing the
	 * model is the action's own step - so one sword and one cross cover both cases; status
	 * splits the other way, into **assign** (orange) and **remove** (light blue); and the yellow
	 * circle is Stamina, the activations a model spends.
	 */
	const PETALS: Petal[] = [
		{
			id: 'info',
			label: "Show this model's card",
			glyph: 'info',
			glyphClasses: 'fill-slate-400 stroke-slate-400'
		},
		{ id: 'damage', label: 'Deal damage', glyph: 'sword', glyphClasses: 'fill-red-400' },
		{ id: 'heal', label: 'Heal', glyph: 'cross', glyphClasses: 'fill-emerald-400' },
		{
			id: 'status-apply',
			label: 'Assign a status',
			glyph: 'star',
			glyphClasses: 'fill-orange-400'
		},
		{ id: 'status-clear', label: 'Remove a status', glyph: 'star', glyphClasses: 'fill-sky-300' },
		{ id: 'stamina', label: 'Manage Stamina', glyph: 'circle', glyphClasses: 'fill-yellow-400' }
	];

	// Pressing a petal lights it - the selection a later ring of sub-petals will bloom from.
	// The sword and the cross are the petals whose sub-ring exists today; pressing one again
	// folds its flow away, pressing the other switches the flow, and pressing any other petal
	// folds whatever is open away first.
	function select(petal: Petal): void {
		if (strike) return;
		if (petal.glyph === 'sword' || petal.glyph === 'cross') {
			const next: Flow = petal.glyph === 'sword' ? 'damage' : 'heal';
			activePetal = petal.id;
			if (subRingOut && flow === next) cancelFlow();
			else {
				cancelFlow();
				flow = next;
				subRingOut = true;
			}
			return;
		}
		cancelFlow();
		activePetal = petal.id;
		if (petal.glyph === 'info') onInfo();
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

	function targetCentre(key: string): { x: number; y: number } {
		const el = document.querySelector(`[data-target-key="${key}"]`);
		if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const rect = el.getBoundingClientRect();
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	}

	// One tap selects a model, the second confirms: the flow's glyph leaves the focused flower,
	// and once it lands the change is committed and the target's Life walks box by box.
	function tapTarget(target: VitalityTarget): void {
		if (strike || amount === null || flow === null) return;
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
		// closes the overlay instead of folding a flow that is already over.
		subRingOut = false;
		for (let box = 1; box <= applied; box++) later(FADE_MS * box, () => (faded = box));
		later(FADE_MS * applied + FADE_SETTLE_MS, close);
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

<div
	class="fixed z-50 transition-transform duration-300 ease-out motion-reduce:transition-none"
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
		<!-- The third ring: how much damage. Painted first, so it blooms out from behind the
		     action ring and folds back behind it on the way out - the action ring and its
		     glyphs stay on top, which is what makes the bloom read as emerging. -->
		<g
			class="transition-all duration-300 ease-out motion-reduce:transition-none"
			style="transform-origin: 62.5px 62.5px; transform: scale({subRingOut ? 1 : 0.55});
				opacity: {subRingOut ? 1 : 0}"
			aria-hidden={!subRingOut}
		>
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
		</g>
		{#each PETALS as petal, index (petal.id)}
			<path
				d={ringPath(index, PETALS.length, ACTION_RING)}
				class="{petalsOpen ? 'pointer-events-auto' : 'pointer-events-none'} cursor-pointer
					transition-all duration-200 outline-none {PETAL} {PETAL_HOVER} {PETAL_FOCUS}
					{litPetal === petal.id ? PETAL_LIT : ''}"
				role="button"
				tabindex={petalsOpen ? 0 : -1}
				aria-label={petal.label}
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
	<BattleFlower {flower} showLabel={false} inert />
</div>

<!-- The vitality flow's target row: the field steps out of the blurred panel and up in front,
     below the flower, the focused copy's twin among them so a model can act on itself. Which
     copies appear is the flow's business - the living field for damage, the wounded for heal.
     Seat-coloured rims say whose model it is; a badge numbers duplicate copies. -->
{#if targetsOut}
	<div
		class="fixed right-0 left-0 z-50 mx-auto w-[min(92vw,26rem)] transition-all duration-300
			ease-out motion-reduce:transition-none"
		style="top: calc(50% + {Math.round(from.width * 1.05)}px);
			opacity: {targetsIn ? 1 : 0}; transform: translateY({targetsIn ? '0' : '18px'})"
	>
		<p class="mb-2 text-center text-xs tracking-wide text-slate-300">
			Tap on selected model and then confirm it again
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
						<BattleFlower flower={rowFlower(target)} showLabel={false} />
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
							<!-- The selection: a slowly turning crosshair, still under reduced
							     motion, where it simply holds. -->
							<svg
								viewBox="0 0 40 40"
								fill="none"
								class="pointer-events-none absolute inset-0 h-full w-full
									animate-[spin_5s_linear_infinite] stroke-emerald-400
									motion-reduce:animate-none"
							>
								<circle cx="20" cy="20" r="16.5" stroke-width="1.6" stroke-dasharray="6 5" />
								<path d="M 20 0 V 7 M 20 33 V 40 M 0 20 H 7 M 33 20 H 40" stroke-width="2" />
							</svg>
						{/if}
					</div>
				{/each}
			</div>
		</div>
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
