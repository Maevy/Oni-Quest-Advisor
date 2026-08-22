<script lang="ts">
	type Props = {
		onDismiss: () => void;
	};

	let { onDismiss }: Props = $props();
</script>

<div class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
	<div
		class="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/90 p-4 backdrop-blur"
	>
		<p class="text-sm leading-relaxed text-slate-200">
			This app stores your game progress and online sessions locally on your device (browser local
			storage, similar to cookies). It never stores personal data and uses no tracking or analytics.
		</p>
		<button
			type="button"
			class="self-end rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
			onclick={onDismiss}
		>
			Got it
		</button>
	</div>
</div>
