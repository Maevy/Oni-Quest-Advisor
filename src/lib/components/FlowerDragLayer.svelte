<script lang="ts">
	import type { BattleFlowerSpec } from '$lib/domain';
	import BattleFlower from './BattleFlower.svelte';

	type Props = {
		/** The lifted copy's flower, drawn as the clone that follows the finger. */
		flower: BattleFlowerSpec;
		/** Pointer position in viewport coordinates. */
		x: number;
		y: number;
		/** The clone's box, taken from the slot it was lifted from. */
		size: number;
		/** The slot under the finger, if it is another flower: the drop target's crosshair. */
		hoverRect: { x: number; y: number; width: number } | null;
	};

	let { flower, x, y, size, hoverRect }: Props = $props();
</script>

<!-- The drop target's crosshair, ringed round the hovered slot. -->
{#if hoverRect}
	<svg
		viewBox="0 0 40 40"
		fill="none"
		class="pointer-events-none fixed z-[55] animate-[spin_5s_linear_infinite] stroke-emerald-400
			motion-reduce:animate-none"
		style="left: {hoverRect.x}px; top: {hoverRect.y}px; width: {hoverRect.width}px;
			height: {hoverRect.width}px"
		aria-hidden="true"
	>
		<circle cx="20" cy="20" r="16.5" stroke-width="1.6" stroke-dasharray="6 5" />
		<path d="M 20 0 V 7 M 20 33 V 40 M 0 20 H 7 M 33 20 H 40" stroke-width="2" />
	</svg>
{/if}

<!-- The lifted clone. It rides above the strip and the panel, grows a little and glows so it
     reads as picked up, and never takes the pointer - the screen tracks the gesture on window. -->
<div
	class="pointer-events-none fixed z-[55] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-transform duration-100
		ease-out motion-reduce:transition-none"
	style="left: {x - size / 2}px; top: {y - size / 2}px; width: {size}px"
	aria-hidden="true"
>
	<BattleFlower {flower} showLabel={false} showStatuses={false} inert />
</div>
