<script lang="ts" module>
	/** The clicked flower's slot in viewport coordinates; the focus overlay glides from it. */
	export type FlowerRect = { x: number; y: number; width: number };
</script>

<script lang="ts">
	import type {
		BattleFlowerSpec,
		BattleRingSpec,
		UnitStatus,
		VitalityRingState
	} from '$lib/domain';
	import { UNIT_STATUS_LABELS } from '$lib/domain';
	import StatusGlyph from './StatusGlyph.svelte';

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
		/**
		 * The States band. Suppressed wherever a ring of its own surrounds the flower - the
		 * focus overlay's petals and the target row's cells both sit at the band's radius.
		 */
		showStatuses?: boolean;
		/**
		 * The copy's seat-and-entry key, mirrored onto the root as `data-flower-key` so a flow
		 * can measure this flower's slot in the strip - the slot a focus that moved onto the
		 * copy has to glide home into, which the target row's own cells are not.
		 */
		flowerKey?: string | null;
	};

	let {
		flower,
		dimmed = false,
		onSelect,
		showLabel = true,
		inert = false,
		showStatuses = true,
		flowerKey = null
	}: Props = $props();

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
		const states =
			flower.statuses.length > 0
				? `, States: ${flower.statuses.map((status) => UNIT_STATUS_LABELS[status]).join(', ')}`
				: '';
		return `${flower.name}${mounted}: ${halves.join(', ') || 'no tracked stats'}${states}`;
	});

	/**
	 * The States band, in the flower's own 120-unit box: eight slots arcing over the shoulders -
	 * four down the left, four down the right, 12 o'clock left clear where the two ring halves
	 * meet. The radius clears the vitality ring's outer edge (55) by the orb's own half-width;
	 * the outermost slots stop above 3 and 9 o'clock's underside so no orb reaches the unit's
	 * name, and their outer edge lands a few px into the padding the half leaves beside the
	 * flower - the band's only horizontal slack. The topmost pair reaches ~19px past the box,
	 * into the gap the panel leaves between flowers.
	 */
	const STATUS_BAND = { radius: 70, orb: 30, first: 18, step: 27, perSide: 4 };
	/** The orb's box as a percentage of the flower's, so it scales with the slot. */
	const ORB_PCT = (STATUS_BAND.orb / 120) * 100;
	/** The slot angles clockwise from 12 o'clock: the left four top-down, then the right four. */
	const STATUS_SLOTS = Array.from({ length: 2 * STATUS_BAND.perSide }, (_, index) => {
		const side = index < STATUS_BAND.perSide ? -1 : 1;
		return side * (STATUS_BAND.first + STATUS_BAND.step * (index % STATUS_BAND.perSide));
	});

	type StatusChip = {
		status: UnitStatus | null;
		label: string;
		extra: number;
		left: number;
		top: number;
	};

	let statusChips = $derived.by(() => {
		if (!showStatuses || flower.statuses.length === 0) return [];
		// The States fill the left slots from the top down and then the right; past eight the
		// last right slot counts the rest instead of a ninth orb overlapping its neighbour.
		const overflow = flower.statuses.length > STATUS_SLOTS.length;
		const shown = flower.statuses.slice(
			0,
			overflow ? STATUS_SLOTS.length - 1 : STATUS_SLOTS.length
		);
		const extra = flower.statuses.length - shown.length;
		const chips: StatusChip[] = shown.map((status) => ({
			status,
			label: UNIT_STATUS_LABELS[status],
			extra: 0,
			left: 50,
			top: 50
		}));
		if (extra > 0)
			chips.push({ status: null, label: `${extra} more States`, extra, left: 50, top: 50 });
		return chips.map((chip, index) => {
			const angle = (STATUS_SLOTS[index] * Math.PI) / 180;
			return {
				...chip,
				left: 50 + ((STATUS_BAND.radius * Math.sin(angle)) / 120) * 100,
				top: 50 - ((STATUS_BAND.radius * Math.cos(angle)) / 120) * 100
			};
		});
	});
</script>

<!-- w-full max-w-[104px] on the root, not the orb: inside a flex column the root would otherwise
     shrink-wrap to its label and the percentage-wide orb would collapse with it. -->
<button
	type="button"
	class="flex w-full max-w-[104px] flex-col items-center gap-1 transition-opacity duration-300
		{dimmed ? 'opacity-25' : 'opacity-100'} {inert ? 'pointer-events-none' : ''}"
	aria-label={summary}
	data-flower-key={flowerKey ?? undefined}
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
		<!-- The States band: the carried States as orbs arcing over the flower's shoulders, each
		     in its own colour - the left four slots first, then the right four. Display-only -
		     the flower's own click still focuses it - and past eight States the last right slot
		     counts the rest. The button's aria-label names them, so the band is hidden from AT. -->
		{#if statusChips.length > 0}
			<div class="pointer-events-none absolute inset-0" aria-hidden="true">
				{#each statusChips as chip (chip.label)}
					<span
						class="absolute flex items-center justify-center rounded-full border
							border-slate-500/80 bg-slate-950/90"
						style="left: {chip.left}%; top: {chip.top}%; width: {ORB_PCT}%;
							height: {ORB_PCT}%; transform: translate(-50%, -50%)"
					>
						{#if chip.status}
							<StatusGlyph status={chip.status} active size="h-[72%] w-[72%]" />
						{:else}
							<span class="text-[10px] leading-none font-bold text-slate-200">
								+{chip.extra}
							</span>
						{/if}
					</span>
				{/each}
			</div>
		{/if}
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
