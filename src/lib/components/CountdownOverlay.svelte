<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	const DURATION = 6;

	type Props = {
		onComplete: () => void;
		onSkip: () => void;
	};

	let { onComplete, onSkip }: Props = $props();

	let remaining = $state(DURATION);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		intervalId = setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) {
				if (intervalId) clearInterval(intervalId);
				onComplete();
			}
		}, 1000);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

<div
	class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm"
>
	<p class="mb-4 text-lg font-semibold tracking-wide text-slate-400 uppercase">
		Player swapping in
	</p>
	<p class="text-8xl font-extrabold text-slate-100 drop-shadow-[0_0_24px_rgba(56,189,248,0.4)]">
		{remaining}
	</p>
	<button
		type="button"
		class="mt-8 rounded-xl border-2 border-slate-600/50 bg-slate-800/60 px-6 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700/60 active:bg-slate-700/80"
		onclick={onSkip}
	>
		Skip
	</button>
</div>
