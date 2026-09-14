<script lang="ts">
	import VitalityMarker from './VitalityMarker.svelte';

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

	function stateOf(index: number): 'full' | 'empty' | 'over' {
		if (index >= max) return 'over';
		return index < current ? 'full' : 'empty';
	}

	let size = $derived(large ? 'h-5 w-5' : 'h-3.5 w-3.5');
</script>

<div
	class="flex flex-col gap-0.5 {centered ? 'items-center' : 'items-end'}"
	role="img"
	aria-label={`${isHp ? 'HP' : 'Stamina'} ${current} of ${max}`}
>
	{#each lines as line (line[0])}
		<div class="flex gap-1">
			{#each line as index (index)}
				<VitalityMarker {kind} state={stateOf(index)} {size} />
			{/each}
		</div>
	{/each}
</div>
