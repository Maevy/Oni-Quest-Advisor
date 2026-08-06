<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
	};

	let { title, children }: Props = $props();
</script>

<section class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-sky-300 uppercase">{title}</h2>
	{@render children()}
</section>
