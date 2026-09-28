<script lang="ts">
	type Props = {
		/** Why the tournament could not be loaded; null while the first fetch is still running. */
		error: string | null;
		onRetry: () => void;
		onAbandon: () => void;
	};

	let { error, onRetry, onAbandon }: Props = $props();
</script>

<!--
	This device holds a seat but no view arrived — the fetch did not get through. Offer a retry
	and the way out rather than an empty screen; abandoning still reaches the server, so a seat
	is never stranded by a device that simply gave up on it locally.
-->
<div class="flex min-h-dvh flex-col items-center justify-center px-6">
	<div
		class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 text-center backdrop-blur"
	>
		<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Tournament</h2>
		<p class="mt-3 text-sm text-slate-300">{error ?? 'Loading the tournament…'}</p>
		<div class="mt-4 flex flex-col gap-3">
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onRetry}
			>
				Try Again
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-red-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
				onclick={onAbandon}
			>
				Abandon
			</button>
		</div>
	</div>
</div>
