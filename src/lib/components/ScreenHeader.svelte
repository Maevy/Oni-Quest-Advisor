<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** Screen name, rendered as the page's heading. Omit on screens that title themselves. */
		title?: string;
		/** Renders the red ← Return. Omit on a screen with nowhere to go back to. */
		onBack?: () => void;
		/** Right-hand action slot — buttons, or the tracker's view switcher. */
		actions?: Snippet;
	};

	let { title, onBack, actions }: Props = $props();
</script>

<!-- Sticky everywhere: the two full-height screens pin their header by layout already, where the
     property is a harmless no-op, and every scrolling screen keeps Return within reach.
     min-h-16 is what makes the bar the same height on every screen. Without it the row follows
     its tallest control — a lone Return (no border) is 6 px shorter than the tracker's switcher
     (border + p-0.5 around its own buttons). It has to clear that control *plus* the row's
     py-2.5, because border-box measures min-height on the padded box. -->
<header class="sticky top-0 z-30 border-b border-slate-700/40 bg-slate-950/80 backdrop-blur">
	<div class="mx-auto flex min-h-16 w-full max-w-xl items-center gap-2 px-4 py-2.5">
		{#if onBack}
			<button
				type="button"
				class="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-red-400 active:bg-red-400"
				onclick={onBack}
			>
				<span aria-hidden="true">←</span> Return
			</button>
		{/if}
		{#if title}
			<h1 class="min-w-0 truncate text-base font-semibold text-slate-100">{title}</h1>
		{/if}
		{#if actions}
			<div class="ml-auto flex items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</header>
