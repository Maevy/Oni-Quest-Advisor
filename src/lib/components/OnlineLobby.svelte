<script lang="ts">
	import type { OnlineGameView } from '$lib/domain';

	type Props = {
		view: OnlineGameView;
		isLeader: boolean;
		inviteUrl: string;
		error: string | null;
		onAcceptJoin: () => Promise<void>;
		onDenyJoin: () => Promise<void>;
		onCloseGame: () => Promise<void>;
		onReturnToMenu: () => void;
	};

	let {
		view,
		isLeader,
		inviteUrl,
		error,
		onAcceptJoin,
		onDenyJoin,
		onCloseGame,
		onReturnToMenu
	}: Props = $props();

	let confirmingClose = $state(false);
	let copied = $state(false);
	let acting = $state(false);

	async function copyInvite() {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable (e.g. insecure context) — the link stays selectable.
		}
	}

	async function handleAccept() {
		if (acting) return;
		acting = true;
		try {
			await onAcceptJoin();
		} finally {
			acting = false;
		}
	}

	async function handleDeny() {
		if (acting) return;
		acting = true;
		try {
			await onDenyJoin();
		} finally {
			acting = false;
		}
	}

	async function handleConfirmedClose() {
		confirmingClose = false;
		if (acting) return;
		acting = true;
		try {
			await onCloseGame();
		} finally {
			acting = false;
		}
	}
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-4 py-4">
	{#if isLeader && (view.status === 'lobby' || view.status === 'active')}
		<button
			type="button"
			class="self-start rounded-lg border-2 border-red-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
			onclick={() => (confirmingClose = true)}
		>
			Close Game
		</button>
	{/if}

	<div class="text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-slate-100">Game#{view.id} Lobby</h1>
		<p class="text-slate-400">
			{#if view.status === 'lobby'}
				Setup Phase
			{:else if view.status === 'active'}
				Round {view.currentRound} — {view.phase === 'reveal' ? 'Reveal' : 'Scoring'} Phase
			{:else if view.status === 'finished'}
				Finished
			{:else}
				Closed
			{/if}
		</p>
	</div>

	{#if error}
		<div
			class="rounded-xl border border-red-500/40 bg-slate-800/40 p-3 text-sm text-red-300 backdrop-blur"
		>
			{error}
		</div>
	{/if}

	{#if view.status === 'closed'}
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 text-center backdrop-blur"
		>
			<p class="text-slate-200">This game has been closed.</p>
			<button
				type="button"
				class="mt-4 rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onReturnToMenu}
			>
				Return to Main Menu
			</button>
		</div>
	{:else if view.status === 'finished'}
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 text-center backdrop-blur"
		>
			<p class="text-slate-200">This game has finished.</p>
			<button
				type="button"
				class="mt-4 rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onReturnToMenu}
			>
				Return to Main Menu
			</button>
		</div>
	{:else if view.status === 'active'}
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 text-center backdrop-blur"
		>
			<p class="text-slate-200">The battle is underway.</p>
			<p class="mt-2 text-sm text-slate-400">Round tracking lands in the next update.</p>
		</div>
	{:else}
		{#if isLeader}
			<div class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
				<div class="flex items-center justify-between gap-2">
					<div class="min-w-0">
						<p class="text-sm font-semibold tracking-wide text-sky-300 uppercase">
							Share link to invite player
						</p>
						<p class="truncate font-mono text-sm text-slate-200" title={inviteUrl}>{inviteUrl}</p>
					</div>
					<button
						type="button"
						class="shrink-0 rounded-lg border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20"
						onclick={copyInvite}
					>
						{copied ? 'Copied!' : 'copy to clipboard'}
					</button>
				</div>
			</div>

			<div class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
				<p class="mb-3 text-sm font-semibold tracking-wide text-sky-300 uppercase">
					Mission Selection
				</p>
				<div class="flex flex-col gap-2">
					<select
						disabled
						class="rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-3 py-2.5 text-slate-500"
					>
						<option>Season (locked until a player joins)</option>
					</select>
					<select
						disabled
						class="rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-3 py-2.5 text-slate-500"
					>
						<option>Mission (locked until a player joins)</option>
					</select>
					<button
						type="button"
						disabled
						class="cursor-not-allowed rounded-xl border-2 border-slate-600/30 bg-slate-900/30 px-6 py-2.5 font-medium text-slate-600"
					>
						Select Mission
					</button>
				</div>
			</div>
		{/if}

		<!-- Player 1 seat -->
		<div class="rounded-2xl border border-sky-500/30 bg-slate-800/40 p-4 backdrop-blur">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<span class="font-semibold text-sky-300">Player 1</span>
					<span class="rounded-full border border-sky-500/50 px-2 py-0.5 text-xs text-sky-200">
						Game Leader
					</span>
				</div>
				<span class="text-slate-100">{view.self.nickname}</span>
			</div>
			<div
				class="mt-3 rounded-xl border border-slate-600/30 bg-slate-900/30 p-3 text-sm text-slate-500"
			>
				Faction &amp; Scheme selection
				{#if view.opponent}
					(unlocks in the next update)
				{:else}
					(locked until a player joins)
				{/if}
			</div>
		</div>

		<!-- Player 2 seat -->
		<div class="rounded-2xl border border-orange-500/30 bg-slate-800/40 p-4 backdrop-blur">
			{#if view.opponent}
				<div class="flex items-center justify-between gap-2">
					<span class="font-semibold text-orange-300">Player 2</span>
					<span class="text-slate-100">{view.opponent.nickname}</span>
				</div>
				<div
					class="mt-3 rounded-xl border border-slate-600/30 bg-slate-900/30 p-3 text-sm text-slate-500"
				>
					Faction &amp; Scheme selection (unlocks in the next update)
				</div>
			{:else}
				<p class="text-center text-slate-400">No Player 2, invite someone</p>
			{/if}
		</div>
	{/if}
</div>

<!-- Join request popup (leader) -->
{#if view.status === 'lobby' && isLeader && view.pendingJoinNickname}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 text-center backdrop-blur"
		>
			<p class="text-lg text-slate-100">
				<span class="font-semibold text-sky-300">{view.pendingJoinNickname}</span>
				wants to join your game
			</p>
			<div class="mt-4 flex justify-center gap-3">
				<button
					type="button"
					disabled={acting}
					class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition enabled:hover:bg-sky-200 enabled:active:bg-sky-200 disabled:opacity-60"
					onclick={handleAccept}
				>
					Accept
				</button>
				<button
					type="button"
					disabled={acting}
					class="rounded-xl border-2 border-red-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20 disabled:opacity-60"
					onclick={handleDeny}
				>
					Deny
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Close confirmation -->
{#if confirmingClose}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 text-center backdrop-blur"
		>
			<p class="text-lg text-slate-100">Do you really want to close the game ?</p>
			<div class="mt-4 flex justify-center gap-3">
				<button
					type="button"
					class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
					onclick={() => (confirmingClose = false)}
				>
					Keep playing
				</button>
				<button
					type="button"
					disabled={acting}
					class="rounded-xl border-2 border-red-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20 disabled:opacity-60"
					onclick={handleConfirmedClose}
				>
					Close Game
				</button>
			</div>
		</div>
	</div>
{/if}
