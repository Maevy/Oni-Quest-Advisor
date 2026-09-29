<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';
	import { MAX_NICKNAME_LENGTH, pickedArmyFormat } from '$lib/domain';
	import type { ArmyFactionConfig, PickedArmy } from '$lib/domain';
	import type { JoinStatus } from '$lib/data/onlineApi';

	const POLL_INTERVAL_MS = 2000;

	type Props = {
		gameCode: string;
		/** Non-null while waiting for the leader's decision; polling runs in this step. */
		pendingNickname: string | null;
		/** The army picked for this screen; null until the player picks one. */
		army: PickedArmy | null;
		/** The picked army's faction resolved for display, when there is one. */
		armyFaction: ArmyFactionConfig | undefined;
		onRequestJoin: (nickname: string, army: PickedArmy) => Promise<void>;
		onPickArmy: () => void;
		onClearArmy: () => void;
		onPollPending: () => Promise<JoinStatus>;
		onAccepted: () => void;
		onReturn: () => void;
	};

	let {
		gameCode,
		pendingNickname,
		army,
		armyFaction,
		onRequestJoin,
		onPickArmy,
		onClearArmy,
		onPollPending,
		onAccepted,
		onReturn
	}: Props = $props();

	let nickname = $state('');
	let requesting = $state(false);
	let error = $state<string | null>(null);
	let rejection = $state<string | null>(null);

	let trimmed = $derived(nickname.trim());
	let nameValid = $derived(trimmed.length >= 1 && trimmed.length <= MAX_NICKNAME_LENGTH);
	let valid = $derived(nameValid && army !== null);

	async function handleRequest() {
		if (!valid || !army || requesting) return;
		requesting = true;
		error = null;
		try {
			await onRequestJoin(trimmed, army);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not send the join request.';
			requesting = false;
		}
	}

	$effect(() => {
		if (!pendingNickname) return;
		let cancelled = false;
		let polling = false;
		const timer = setInterval(async () => {
			if (cancelled || polling) return;
			polling = true;
			try {
				const status = await onPollPending();
				if (cancelled) return;
				if (status === 'accepted') {
					onAccepted();
				} else if (status === 'denied') {
					rejection = 'Your Request has been revoked';
				} else if (status === 'full') {
					rejection = 'This game is already full.';
				} else if (status === 'closed') {
					rejection = 'This game has been closed.';
				}
			} finally {
				polling = false;
			}
		}, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	});
</script>

<div class="flex min-h-dvh flex-col items-center gap-6 px-4 py-6 text-center">
	<button
		type="button"
		class="fixed top-4 left-4 rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={onReturn}
	>
		← Back
	</button>
	<div class="mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-6">
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
		</div>

		{#if rejection}
			<div class="w-full rounded-2xl border border-red-500/40 bg-slate-800/40 p-4 backdrop-blur">
				<p class="text-lg font-medium text-red-300">{rejection}</p>
			</div>
		{:else if pendingNickname}
			<div class="w-full rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
				<p class="text-lg text-sky-100">Waiting for the game leader to accept your request…</p>
				<p class="mt-2 animate-pulse text-sm text-slate-400">Game#{gameCode}</p>
			</div>
		{:else}
			<div
				class="flex w-full flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur"
			>
				<p class="text-left text-slate-200">
					You are about to join <span class="font-semibold text-sky-300">Game#{gameCode}</span>.
					Enter your player name and pick the army you field.
				</p>
				<input
					type="text"
					maxlength={MAX_NICKNAME_LENGTH}
					bind:value={nickname}
					placeholder="e.g. Konichan"
					aria-label="Your player name"
					autocomplete="off"
					class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-lg text-sky-100 backdrop-blur outline-none placeholder:text-slate-500 focus:border-sky-400"
				/>
				<span class="text-left text-sm font-semibold tracking-wide text-sky-300 uppercase">
					Your Army
				</span>
				{#if army}
					<div
						class="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
					>
						<button
							type="button"
							class="min-w-0 flex-1 text-left"
							aria-label="Change your army"
							onclick={onPickArmy}
						>
							<span class="block truncate text-sm font-semibold text-slate-100">{army.name}</span>
							<span
								class="mt-0.5 block truncate text-xs {armyFaction ? '' : 'text-slate-400'}"
								style={armyFaction ? `color: ${armyFaction.color}` : undefined}
							>
								{armyFaction?.name ?? army.factionId}
							</span>
						</button>
						<span
							class="shrink-0 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 uppercase"
						>
							{pickedArmyFormat(army) === 'roster' ? 'Roster' : 'Standard'}
						</span>
						<button
							type="button"
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
							aria-label="Remove your army"
							onclick={onClearArmy}
						>
							<span aria-hidden="true">✕</span>
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2.5 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
						onclick={onPickArmy}
					>
						Pick Army
					</button>
					<p class="text-left text-xs text-slate-400">
						A Standard army (85 points) is combat-ready at once. A Roster army (125 points) is cut
						down to 85 after the game starts.
					</p>
				{/if}
				<button
					type="button"
					disabled={!valid || requesting}
					class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
					onclick={handleRequest}
				>
					{requesting ? 'Requesting…' : 'Request to Join'}
				</button>
				{#if error}
					<p class="text-sm text-red-400" role="alert">{error}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
