<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** Omit for panels whose content is self-evident — no heading is rendered. */
		title?: string;
		/**
		 * Heading colour. Sky is the app default; a hot-seat panel belonging to Player 2 passes
		 * the orange accent so the seat reads the same everywhere it appears.
		 */
		titleClass?: string;
		/**
		 * `frosted` is the app default: a translucent slate-800 over the key art. `dark` is
		 * slate-900 at 80% — for a panel whose content is thin and low-contrast against that art
		 * (the roadmap's grey dots), where readability beats the glass.
		 */
		tone?: 'frosted' | 'dark';
		children: Snippet;
		/** Online mission screens get crowded on phones — collapsible panels free up space. */
		collapsible?: boolean;
		defaultOpen?: boolean;
	};

	let {
		title,
		titleClass = 'text-sky-300',
		tone = 'frosted',
		children,
		collapsible = false,
		defaultOpen = true
	}: Props = $props();

	// Initial value only — later prop changes shouldn't override the user's toggle.
	// svelte-ignore state_referenced_locally
	let open = $state(defaultOpen);
</script>

<section
	class="rounded-2xl border border-slate-700/50 p-4 backdrop-blur {tone === 'dark'
		? 'bg-slate-900/80'
		: 'bg-slate-800/40'}"
>
	{#if title}
		{#if collapsible}
			<button
				type="button"
				class="mb-3 flex w-full items-center justify-between text-left text-sm font-semibold tracking-wide uppercase {titleClass}"
				onclick={() => (open = !open)}
			>
				{title}
				<span aria-hidden="true" class="text-slate-400">{open ? '▾' : '▸'}</span>
			</button>
		{:else}
			<h2 class="mb-3 text-sm font-semibold tracking-wide uppercase {titleClass}">{title}</h2>
		{/if}
	{/if}
	{#if open}
		{@render children()}
	{/if}
</section>
