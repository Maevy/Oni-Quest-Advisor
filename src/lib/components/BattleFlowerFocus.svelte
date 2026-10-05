<script lang="ts">
	import type { BattleFlowerSpec } from '$lib/domain';
	import BattleFlower from './BattleFlower.svelte';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		flower: BattleFlowerSpec;
		/** The slot the flower was clicked in, in viewport coordinates. */
		from: { x: number; y: number; width: number };
		/** Called once the petals have retracted and the flower has glided back into its slot. */
		onClosed: () => void;
	};

	let { flower, from, onClosed }: Props = $props();

	/** The focused flower grows a third; it is a focus aid, not a full-screen card. */
	const GROWTH = 1.3;
	const GLIDE_MS = 340;

	let placed = $state(false);
	let petalsOut = $state(false);
	let closing = $state<null | 'petals' | 'flower'>(null);

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

	function close(): void {
		if (closing) return;
		closing = 'petals';
		petalsOut = false;
		later(GLIDE_MS, () => (closing = 'flower'));
		later(2 * GLIDE_MS, onClosed);
	}

	$effect(() => onEscapeKey(close));

	// The petals' own coordinate space: 125 units across for a flower 100 units wide, so the band
	// sits just outside the flower's ring (outer radius 45.83 here) and still fits the box.
	const C = 62.5;
	const PETAL_INNER = 47;
	const PETAL_OUTER = 61;

	function polar(radius: number, angle: number): [number, number] {
		const radians = ((angle - 90) * Math.PI) / 180;
		return [C + radius * Math.cos(radians), C + radius * Math.sin(radians)];
	}
	const round = (value: number): number => Math.round(value * 100) / 100;

	function petalPath(index: number): string {
		const span = 360 / PETALS.length;
		const gap = 4;
		const a0 = index * span + gap / 2;
		const a1 = a0 + span - gap;
		const [x0, y0] = polar(PETAL_OUTER, a0);
		const [x1, y1] = polar(PETAL_OUTER, a1);
		const [x2, y2] = polar(PETAL_INNER, a1);
		const [x3, y3] = polar(PETAL_INNER, a0);
		return (
			`M ${round(x0)} ${round(y0)} A ${PETAL_OUTER} ${PETAL_OUTER} 0 0 1 ${round(x1)} ${round(y1)} ` +
			`L ${round(x2)} ${round(y2)} A ${PETAL_INNER} ${PETAL_INNER} 0 0 0 ${round(x3)} ${round(y3)} Z`
		);
	}

	const DAMAGE = 'fill-red-500/40 stroke-slate-950 hover:fill-red-400/60';
	const HEAL = 'fill-emerald-500/40 stroke-slate-950 hover:fill-emerald-400/60';
	const STATUS = 'fill-violet-500/40 stroke-slate-950 hover:fill-violet-400/60';

	/** The eight actions a focused flower offers, clockwise from 12 o'clock. */
	const PETALS: Array<{ id: string; label: string; classes: string }> = [
		{ id: 'damage-self', label: 'Damage this model', classes: DAMAGE },
		{ id: 'damage-enemy', label: 'Damage an enemy model', classes: DAMAGE },
		{ id: 'damage-ally', label: 'Damage a friendly model', classes: DAMAGE },
		{ id: 'heal-self', label: 'Heal this model', classes: HEAL },
		{ id: 'heal-ally', label: 'Heal a friendly model', classes: HEAL },
		{ id: 'status-self', label: 'Assign a status to this model', classes: STATUS },
		{ id: 'status-enemy', label: 'Assign a status to an enemy model', classes: STATUS },
		{ id: 'status-ally', label: 'Assign a status to a friendly model', classes: STATUS }
	];

	// The petals' behaviour lands with the next iteration; until then they hold their place.
	function petalAction(): void {}
</script>

<!-- The blur sits under the flower and over everything else; it also freezes the pane behind
     it, because wheel events land on the backdrop instead of the scrolling panel. -->
<div
	class="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition-opacity duration-300
		{closing === 'flower' ? 'opacity-0' : 'opacity-100'}"
	role="presentation"
	onclick={close}
></div>
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
		class="pointer-events-none absolute left-1/2 aspect-square w-[125%] transition-all
			duration-300 ease-out motion-reduce:transition-none"
		style="top: {from.width / 2}px; transform: translate(-50%, -50%) scale({petalsOpen ? 1 : 0.55});
			opacity: {petalsOpen ? 1 : 0}"
		aria-hidden={!petalsOpen}
	>
		{#each PETALS as petal, index (petal.id)}
			<path
				d={petalPath(index)}
				class="pointer-events-auto cursor-pointer outline-none focus-visible:stroke-sky-200
					{petal.classes}"
				role="button"
				tabindex={petalsOpen ? 0 : -1}
				aria-label={petal.label}
				stroke-width="2"
				onclick={petalAction}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						petalAction();
					}
				}}
			/>
		{/each}
	</svg>
	<BattleFlower {flower} showLabel={false} inert />
</div>
