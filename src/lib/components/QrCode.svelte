<script lang="ts">
	import { qrCodeMatrix } from '$lib/domain';

	type Props = {
		/** The text to encode — here always a tournament join URL. */
		value: string;
		/** Light modules of quiet zone around the symbol; scanners want at least four. */
		quietZone?: number;
	};

	let { value, quietZone = 4 }: Props = $props();

	let matrix = $derived(qrCodeMatrix(value));
	let side = $derived(matrix.length + quietZone * 2);
</script>

<svg
	viewBox="0 0 {side} {side}"
	role="img"
	aria-label={'QR code joining ' + value}
	class="mx-auto w-full max-w-64 rounded-xl bg-white p-3"
	shape-rendering="crispEdges"
>
	<rect x="0" y="0" width={side} height={side} fill="#ffffff" />
	{#each matrix as row, rowIndex (rowIndex)}
		{#each row as dark, colIndex (colIndex)}
			{#if dark}
				<rect
					x={colIndex + quietZone}
					y={rowIndex + quietZone}
					width="1"
					height="1"
					fill="#000000"
				/>
			{/if}
		{/each}
	{/each}
</svg>
