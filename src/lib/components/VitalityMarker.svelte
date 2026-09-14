<script lang="ts">
	type Props = {
		kind: 'hp' | 'stamina';
		state: 'full' | 'empty' | 'over';
		/** Drawn inside the glyph — the vitality menu's step buttons carry it. */
		sign?: 'minus' | 'plus';
		/** Tailwind box classes; the glyph scales to whatever it is given. */
		size?: string;
	};

	let { kind, state, sign, size = 'h-3.5 w-3.5' }: Props = $props();

	let isHp = $derived(kind === 'hp');

	/** Beyond the base count a Life marker is overheal and reads blue instead of red. */
	let bodyClasses = $derived.by(() => {
		if (isHp) {
			if (state === 'over') return 'fill-sky-400 stroke-sky-400';
			if (state === 'empty') return 'fill-black/70 stroke-red-500';
			return 'fill-red-500 stroke-red-500';
		}
		if (state === 'empty') return 'fill-black/70 stroke-yellow-400';
		return 'fill-yellow-400 stroke-yellow-400';
	});

	/** The sign must read against both a filled glyph and a blacked-out one. */
	let signClasses = $derived(state === 'empty' ? 'stroke-slate-200' : 'stroke-slate-950');
</script>

<svg viewBox="0 0 24 24" class="{size} {bodyClasses}" aria-hidden="true">
	{#if isHp}
		<path
			d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
			stroke-width="1.5"
		/>
	{:else}
		<circle cx="12" cy="12" r="11" stroke-width="2" />
	{/if}
	{#if sign === 'minus'}
		<path
			d="M7.5 11.5h9"
			class={signClasses}
			stroke-width="2.5"
			stroke-linecap="round"
			fill="none"
		/>
	{:else if sign === 'plus'}
		<path
			d="M7.5 11.5h9M12 7v9"
			class={signClasses}
			stroke-width="2.5"
			stroke-linecap="round"
			fill="none"
		/>
	{/if}
</svg>
