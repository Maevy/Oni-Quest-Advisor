<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';
	import { MAX_NICKNAME_LENGTH } from '$lib/domain';

	type Props = {
		onCreate: (nickname: string) => Promise<void>;
		onReturn: () => void;
	};

	let { onCreate, onReturn }: Props = $props();

	let nickname = $state('');
	let preparing = $state(false);
	let error = $state<string | null>(null);

	let trimmed = $derived(nickname.trim());
	let valid = $derived(trimmed.length >= 1 && trimmed.length <= MAX_NICKNAME_LENGTH);

	async function handleCreate() {
		if (!valid || preparing) return;
		preparing = true;
		error = null;
		try {
			await onCreate(trimmed);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not create the game.';
			preparing = false;
		}
	}
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
	<button
		type="button"
		class="fixed top-4 left-4 rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={onReturn}
	>
		← Back
	</button>
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
			<p class="text-slate-400">Online 2 Player Game</p>
		</div>

		<div
			class="flex w-full flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur"
		>
			<label
				for="create-nickname"
				class="text-left text-sm font-semibold tracking-wide text-sky-300 uppercase"
			>
				Your Nickname
			</label>
			<input
				id="create-nickname"
				type="text"
				maxlength={MAX_NICKNAME_LENGTH}
				bind:value={nickname}
				placeholder="e.g. johnDoe"
				class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-lg text-sky-100 backdrop-blur outline-none placeholder:text-slate-500 focus:border-sky-400"
			/>
			<button
				type="button"
				disabled={!valid || preparing}
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={handleCreate}
			>
				Open Lobby
			</button>
			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
		</div>
	</div>
</div>

{#if preparing}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	>
		<p class="text-xl font-semibold text-sky-200 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)]">
			Preparing the battlefield…
		</p>
	</div>
{/if}
