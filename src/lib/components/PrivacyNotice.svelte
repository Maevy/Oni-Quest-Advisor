<script lang="ts">
	type Props = {
		onDismiss: () => void;
	};

	let { onDismiss }: Props = $props();
</script>

<!--
	A modal, not a strip: as a bare `fixed bottom-0` card this notice sat over the bottom of
	whatever screen was underneath — which on a phone is exactly where that screen's primary
	button lives — and silently swallowed every tap aimed at it, reading as page chrome rather
	than as something in the way. Dimming the whole viewport says "answer me first", the same
	way every other acknowledgement in the app does.
-->
<div class="fixed inset-0 z-50 flex items-end bg-slate-950/80 px-4 pb-4 backdrop-blur-sm">
	<div
		class="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/95 p-4 backdrop-blur"
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
