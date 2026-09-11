<script lang="ts">
	type Props = {
		kind: 'hp' | 'stamina';
		/** Points the model currently has; equals `max` until damage tracking exists. */
		current: number;
		max: number;
	};

	let { kind, current, max }: Props = $props();

	/** Four markers per line, then wrap - a tough model must not stretch the row sideways. */
	const PER_ROW = 4;

	let lines = $derived.by(() => {
		const rows: number[][] = [];
		for (let start = 0; start < max; start += PER_ROW) {
			rows.push(Array.from({ length: Math.min(PER_ROW, max - start) }, (_, i) => start + i));
		}
		return rows;
	});

	let isHp = $derived(kind === 'hp');
</script>

<div
	class="flex flex-col items-end gap-0.5"
	role="img"
	aria-label={`${isHp ? 'HP' : 'Stamina'} ${current} of ${max}`}
>
	{#each lines as line (line[0])}
		<div class="flex gap-1">
			{#each line as index (index)}
				{@const filled = index < current}
				{#if isHp}
					<svg
						viewBox="0 0 24 24"
						class="h-3.5 w-3.5 {filled
							? 'fill-red-500 stroke-red-500'
							: 'fill-black/70 stroke-red-500'}"
						aria-hidden="true"
					>
						<path
							d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
							stroke-width="1.5"
						/>
					</svg>
				{:else}
					<span
						class="h-3.5 w-3.5 rounded-full border {filled
							? 'border-yellow-400 bg-yellow-400'
							: 'border-yellow-400 bg-black/70'}"
						aria-hidden="true"
					></span>
				{/if}
			{/each}
		</div>
	{/each}
</div>
