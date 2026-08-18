<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';

	type Props = {
		onSelect: () => void;
	};

	let { onSelect }: Props = $props();
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
	<div class="mx-auto flex w-full max-w-xl flex-col items-center gap-8">
		<div class="flex w-full flex-col items-center gap-2">
			<div
				class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-3 py-5 backdrop-blur"
			>
				<img src={chiohime} alt="Chiohime" class="w-[70px] shrink-0 object-contain sm:w-[106px]" />
				<h1
					class="flex-1 text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)] sm:text-4xl"
				>
					Oni Quest Advisor
				</h1>
				<img src={rasetsu} alt="Rasetsu" class="w-16 shrink-0 object-contain sm:w-24" />
			</div>
			<p class="text-slate-400">Select Game Mode</p>
		</div>

		<div class="flex w-full flex-col gap-3">
			<button
				type="button"
				class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onSelect}
			>
				Solo Quest Tracker
			</button>
			<button
				type="button"
				class="cursor-not-allowed rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-8 py-4 text-lg font-medium text-slate-600 backdrop-blur"
				disabled
			>
				2 Player Tracking
				<span class="block text-xs font-normal text-slate-700">Coming Soon</span>
			</button>
			<button
				type="button"
				class="cursor-not-allowed rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-8 py-4 text-lg font-medium text-slate-600 backdrop-blur"
				disabled
			>
				2 Player Lobby
				<span class="block text-xs font-normal text-slate-700">Coming Soon</span>
			</button>
		</div>
	</div>
</div>
