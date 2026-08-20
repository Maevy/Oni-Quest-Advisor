<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
		/** Online mission screens get crowded on phones — collapsible panels free up space. */
		collapsible?: boolean;
		defaultOpen?: boolean;
	};

	let { title, children, collapsible = false, defaultOpen = true }: Props = $props();

	// Initial value only — later prop changes shouldn't override the user's toggle.
	// svelte-ignore state_referenced_locally
	let open = $state(defaultOpen);
</script>

<section class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
	{#if collapsible}
		<button
			type="button"
			class="mb-3 flex w-full items-center justify-between text-left text-sm font-semibold tracking-wide text-sky-300 uppercase"
			onclick={() => (open = !open)}
		>
			{title}
			<span aria-hidden="true" class="text-slate-400">{open ? '▾' : '▸'}</span>
		</button>
	{:else}
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-sky-300 uppercase">{title}</h2>
	{/if}
	{#if open}
		{@render children()}
	{/if}
</section>
