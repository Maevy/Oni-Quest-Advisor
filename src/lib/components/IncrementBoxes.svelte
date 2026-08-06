<script lang="ts">
	type Props = {
		count: number;
		checkedCount: number;
		onSetChecked: (checkedCount: number) => void;
	};

	let { count, checkedCount, onSetChecked }: Props = $props();

	function boxNumbers(n: number): number[] {
		return Array.from({ length: n }, (_unused, index) => index + 1);
	}

	function handleClick(box: number): void {
		onSetChecked(box <= checkedCount ? box - 1 : box);
	}
</script>

<div class="flex gap-2">
	{#each boxNumbers(count) as box (box)}
		{@const achieved = box <= checkedCount}
		<button
			type="button"
			class="flex h-7 w-7 items-center justify-center rounded border-2 text-sm font-bold {achieved
				? 'border-sky-500 bg-sky-500/40 text-sky-100'
				: 'border-slate-500 bg-slate-900 text-transparent'}"
			onclick={() => handleClick(box)}
			aria-label={`${box} of ${count} achieved`}
		>
			✓
		</button>
	{/each}
</div>
