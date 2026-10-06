<script lang="ts" module>
	/** The clicked flower's slot in viewport coordinates; the focus overlay glides from it. */
	export type FlowerRect = { x: number; y: number; width: number };
</script>

<script lang="ts">
	import type { BattleFlowerSpec, BattleRingSpec, VitalityRingState } from '$lib/domain';

	type Props = {
		flower: BattleFlowerSpec;
		/** Fades the flower while another one is focused in the overlay. */
		dimmed?: boolean;
		/** Absent on the focus overlay's own copy, which is already the focused flower. */
		onSelect?: (rect: FlowerRect) => void;
		/** The focused clone omits its name: the petal ring occupies that space, and the name
		 * returns with the flower when it glides back. */
		showLabel?: boolean;
		/**
		 * The focus overlay's copy: not hit-testable, so the petal ring painted beneath it still
		 * receives its clicks while the petals visually emerge from behind the flower.
		 */
		inert?: boolean;
	};

	let { flower, dimmed = false, onSelect, showLabel = true, inert = false }: Props = $props();

	function handleClick(event: MouseEvent): void {
		if (!onSelect) return;
		const slot = event.currentTarget as HTMLElement;
		const rect = slot.getBoundingClientRect();
		onSelect({ x: rect.x, y: rect.y, width: rect.width });
	}

	// Ring geometry in a 120x120 viewBox, angles clockwise from 12 o'clock. The Life half runs
	// top-to-bottom down the right side and the stamina half mirrors it down the left, so both
	// halves fill from the top and empty towards 6 o'clock - a wounded model loses boxes at the
	// bottom of its flower, on either side alike.
	const INNER = 45;
	const OUTER = 55;

	function point(radius: number, angle: number): [number, number] {
		const radians = ((angle - 90) * Math.PI) / 180;
		return [60 + radius * Math.cos(radians), 60 + radius * Math.sin(radians)];
	}

	const round = (value: number): number => Math.round(value * 100) / 100;

	/** An annular sector from a0 to a1 degrees (clockwise) as a fillable, strokeable path. */
	function sectorPath(a0: number, a1: number): string {
		const [x0, y0] = point(OUTER, a0);
		const [x1, y1] = point(OUTER, a1);
		const [x2, y2] = point(INNER, a1);
		const [x3, y3] = point(INNER, a0);
		const large = a1 - a0 > 180 ? 1 : 0;
		return (
			`M ${round(x0)} ${round(y0)} A ${OUTER} ${OUTER} 0 ${large} 1 ${round(x1)} ${round(y1)} ` +
			`L ${round(x2)} ${round(y2)} A ${INNER} ${INNER} 0 ${large} 0 ${round(x3)} ${round(y3)} Z`
		);
	}

	type RingBox = { d: string; classes: string };

	/** The vitality markers' recipes, bordered: a filled box carries a dark border so the count
	 * reads at a glance against its neighbours; a lost box keeps its coloured rim, which is what
	 * marks the slot at all. Fills sit at 75% so the ring tones into the panel instead of shouting
	 * over it; the borders stay solid because they are what the count is read from. */
	function boxClasses(kind: 'stamina' | 'life', state: VitalityRingState): string {
		if (state === 'empty') {
			return kind === 'life' ? 'fill-black/70 stroke-red-500' : 'fill-black/70 stroke-yellow-400';
		}
		if (kind === 'stamina') return 'fill-yellow-400/75 stroke-slate-950';
		return state === 'over'
			? 'fill-sky-400/75 stroke-slate-950'
			: 'fill-red-500/75 stroke-slate-950';
	}

	function ringBoxes(
		ring: BattleRingSpec,
		kind: 'stamina' | 'life',
		side: 'left' | 'right'
	): RingBox[] {
		const span = 180 / ring.states.length;
		return ring.states.map((state, index) => {
			const start = side === 'right' ? index * span : 360 - (index + 1) * span;
			// Contiguous boxes spanning the full half: their borders divide them, and the two
			// halves meeting at 12 and 6 o'clock close the outline into one circle.
			return { d: sectorPath(start, start + span), classes: boxClasses(kind, state) };
		});
	}

	let boxes = $derived.by(() => {
		const drawn: RingBox[] = [];
		if (flower.stamina) drawn.push(...ringBoxes(flower.stamina, 'stamina', 'left'));
		if (flower.life) drawn.push(...ringBoxes(flower.life, 'life', 'right'));
		return drawn;
	});

	/** The ring is the only carrier of the numbers, so it says them out loud for a screen reader. */
	let summary = $derived.by(() => {
		const halves: string[] = [];
		if (flower.stamina) {
			halves.push(`Stamina ${flower.stamina.current} of ${flower.stamina.max}`);
		}
		if (flower.life) halves.push(`Life ${flower.life.current} of ${flower.life.max}`);
		const mounted = flower.mountedOn ? ` on ${flower.mountedOn}` : '';
		return `${flower.name}${mounted}: ${halves.join(', ') || 'no tracked stats'}`;
	});
</script>

<!-- w-full max-w-[104px] on the root, not the orb: inside a flex column the root would otherwise
     shrink-wrap to its label and the percentage-wide orb would collapse with it. -->
<button
	type="button"
	class="flex w-full max-w-[104px] flex-col items-center gap-1 transition-opacity duration-300
		{dimmed ? 'opacity-25' : 'opacity-100'} {inert ? 'pointer-events-none' : ''}"
	aria-label={summary}
	onclick={handleClick}
>
	<div class="relative aspect-square w-full">
		<svg
			viewBox="0 0 120 120"
			class="absolute inset-0 h-full w-full"
			shape-rendering="geometricPrecision"
			aria-hidden="true"
		>
			{#each boxes as box (box.d)}
				<!-- The fill/stroke transition is what lets a strike darken its boxes one by one. -->
				<path
					d={box.d}
					class="{box.classes} transition-[fill,stroke] duration-300
						motion-reduce:transition-none"
					stroke-width="2"
				/>
			{/each}
		</svg>
		<!-- The orb's box is exactly the ring's inner circle (2 * INNER of the 120 viewBox), so its
		     border and the ring's inner stroke sit on the same line: the flower reads as one
		     object, separated only by those two borders, with no background gap in between. -->
		<div
			class="absolute inset-[12.5%] overflow-hidden rounded-full border-2 border-slate-600/60 bg-slate-900/70"
		>
			{#if flower.icon}
				<img src={flower.icon} alt="" class="h-full w-full object-contain" />
			{:else}
				<div
					class="flex h-full w-full items-center justify-center text-lg font-bold text-slate-300"
				>
					{flower.name.charAt(0)}
				</div>
			{/if}
		</div>
	</div>
	{#if showLabel}
		<p class="w-full truncate text-center text-[10px] font-semibold text-slate-100">
			{flower.name}
		</p>
		{#if flower.mountedOn}
			<p class="-mt-1 w-full truncate text-center text-[9px] text-slate-300">
				on {flower.mountedOn}
			</p>
		{/if}
	{/if}
</button>
