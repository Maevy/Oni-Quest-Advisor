<script lang="ts">
	type Props = {
		text: string;
		confirmLabel: string;
		cancelLabel?: string;
		confirming?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	};

	let {
		text,
		confirmLabel,
		cancelLabel = 'Cancel',
		confirming = false,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
>
	<div
		class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 text-center backdrop-blur"
	>
		<p class="text-lg text-slate-100">{text}</p>
		<div class="mt-4 flex justify-center gap-3">
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onCancel}
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				disabled={confirming}
				class="rounded-xl border-2 border-red-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20 disabled:opacity-60"
				onclick={onConfirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>
