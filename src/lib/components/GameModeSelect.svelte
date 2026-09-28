<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';

	type Props = {
		/** A one-line heads-up about something that ended server-side, dismissible. */
		notice?: string | null;
		onDismissNotice?: () => void;
		onSoloSelect: () => void;
		onTwoPlayerSelect: () => void;
		onOnlineSelect: () => void;
		onTournamentSelect: () => void;
		onArmyBuilderSelect: () => void;
	};

	let {
		notice = null,
		onDismissNotice,
		onSoloSelect,
		onTwoPlayerSelect,
		onOnlineSelect,
		onTournamentSelect,
		onArmyBuilderSelect
	}: Props = $props();
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
			<p class="text-slate-100">Select Game Mode</p>
		</div>

		{#if notice}
			<div
				class="flex w-full items-center gap-3 rounded-xl border border-red-500/40 bg-slate-800/40 px-3 py-2.5 text-left backdrop-blur"
				role="status"
			>
				<p class="min-w-0 flex-1 text-sm text-red-300">{notice}</p>
				<button
					type="button"
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-900/60 text-sm font-bold text-slate-300 transition hover:bg-slate-800/60"
					aria-label="Dismiss"
					onclick={onDismissNotice}
				>
					<span aria-hidden="true">✕</span>
				</button>
			</div>
		{/if}

		<div class="flex w-full flex-col gap-3">
			<button
				type="button"
				class="neon-border rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onSoloSelect}
			>
				Solo Quest Tracker
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-orange-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-orange-100 backdrop-blur transition hover:bg-orange-500/10 active:bg-orange-500/20"
				onclick={onTwoPlayerSelect}
			>
				2 Player Tracking
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-emerald-100 backdrop-blur transition hover:bg-emerald-500/10 active:bg-emerald-500/20"
				onclick={onOnlineSelect}
			>
				Online 2 Player Game
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-red-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-red-100 backdrop-blur transition hover:bg-red-500/10 active:bg-red-500/20"
				onclick={onTournamentSelect}
			>
				Organize Tournament
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-violet-500/50 bg-slate-900/60 px-8 py-4 text-lg font-medium text-violet-100 backdrop-blur transition hover:bg-violet-500/10 active:bg-violet-500/20"
				onclick={onArmyBuilderSelect}
			>
				Army Builder
			</button>
		</div>
	</div>
</div>
