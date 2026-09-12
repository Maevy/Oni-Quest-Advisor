<script lang="ts">
	type Props = {
		kind: 'hp' | 'stamina';
		/** Points the model currently has; may exceed `max` for an overhealed Life. */
		current: number;
		max: number;
		/** The bigger rendering used inside the vitality menu. */
		large?: boolean;
		/** Centre the markers instead of hugging the right edge (vitality menu). */
		centered?: boolean;
	};

	let { kind, current, max, large = false, centered = false }: Props = $props();

	/** Four markers per line, then wrap - a tough model must not stretch the row sideways. */
	const PER_ROW = 4;

	let isHp = $derived(kind === 'hp');

	/** Overheal adds markers beyond the base count, so the track grows with `current`. */
	let lines = $derived.by(() => {
		const total = Math.max(max, current);
		const rows: number[][] = [];
		for (let start = 0; start < total; start += PER_ROW) {
			rows.push(Array.from({ length: Math.min(PER_ROW, total - start) }, (_, i) => start + i));
		}
		return rows;
	});

	/** Beyond the base count a Life marker is overheal and reads blue instead of red. */
	function stateOf(index: number): 'full' | 'empty' | 'over' {
		if (index >= max) return 'over';
		return index < current ? 'full' : 'empty';
	}

	let size = $derived(large ? 'h-5 w-5' : 'h-3.5 w-3.5');

	function heartClasses(state: 'full' | 'empty' | 'over'): string {
		if (state === 'over') return 'fill-sky-400 stroke-sky-400';
		if (state === 'empty') return 'fill-black/70 stroke-red-500';
		return 'fill-red-500 stroke-red-500';
	}

	function orbClasses(state: 'full' | 'empty' | 'over'): string {
		if (state === 'empty') return 'border-yellow-400 bg-black/70';
		return 'border-yellow-400 bg-yellow-400';
	}
</script>

<div
	class="flex flex-col gap-0.5 {centered ? 'items-center' : 'items-end'}"
	role="img"
	aria-label={`${isHp ? 'HP' : 'Stamina'} ${current} of ${max}`}
>
	{#each lines as line (line[0])}
		<div class="flex gap-1">
			{#each line as index (index)}
				{@const state = stateOf(index)}
				{#if isHp}
					<svg viewBox="0 0 24 24" class="{size} {heartClasses(state)}" aria-hidden="true">
						<path
							d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
							stroke-width="1.5"
						/>
					</svg>
				{:else}
					<span class="{size} rounded-full border {orbClasses(state)}" aria-hidden="true"></span>
				{/if}
			{/each}
		</div>
	{/each}
</div>
