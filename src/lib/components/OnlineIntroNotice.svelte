<script lang="ts">
	type Props = {
		onConfirm: () => void;
		onCancel: () => void;
	};

	let { onConfirm, onCancel }: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
>
	<div
		class="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-slate-800/80 p-5 text-center backdrop-blur"
	>
		<h2 class="text-lg font-semibold text-emerald-300">Online 2 Player Game</h2>
		<p class="mt-3 leading-relaxed text-slate-200">
			This is an experimental feature which lives and evolves thanks to your feedback and
			experience. With time there will be new things to explore :)
		</p>
		<div class="mt-4 flex justify-center gap-3">
			<button
				type="button"
				class="rounded-xl border-2 border-slate-600/50 bg-slate-900/60 px-6 py-2 font-semibold text-slate-300 transition hover:bg-slate-700/30 active:bg-slate-700/40"
				onclick={onCancel}
			>
				Back
			</button>
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onConfirm}
			>
				Continue
			</button>
		</div>
	</div>
</div>
