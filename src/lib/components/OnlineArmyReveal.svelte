<script lang="ts">
	import { pickedArmyFormat } from '$lib/domain';
	import type {
		ArmyFactionConfig,
		ArmyView,
		OnlineGameView,
		PlayerKey,
		PublicArmy
	} from '$lib/domain';
	import ArmyBadge from './ArmyBadge.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import RosterBrowseDialog from './RosterBrowseDialog.svelte';
	import { PLAYER_SEATS, playerAccent } from './playerAccent';

	type Props = {
		view: OnlineGameView;
		isLeader: boolean;
		error: string | null;
		missionName: string | null;
		armyFactions: ArmyFactionConfig[];
		/** Resolved rosters per seat; null where there is nothing to browse (or not loaded yet). */
		rosterViews: Record<PlayerKey, ArmyView | null>;
		onAdvance: () => Promise<void>;
		onCloseGame: () => Promise<void>;
	};

	let {
		view,
		isLeader,
		error,
		missionName,
		armyFactions,
		rosterViews,
		onAdvance,
		onCloseGame
	}: Props = $props();

	let confirmingClose = $state(false);
	let acting = $state(false);
	let browsing = $state<PlayerKey | null>(null);

	type SeatPanel = {
		nickname: string;
		registered: PublicArmy;
		own: boolean;
	};

	function ownPanel(): SeatPanel {
		return {
			nickname: view.self.nickname,
			registered: {
				name: view.self.army.name,
				factionId: view.self.army.factionId,
				format: pickedArmyFormat(view.self.army)
			},
			own: true
		};
	}

	function opponentPanel(): SeatPanel | null {
		const opponent = view.opponent;
		if (opponent === null) return null;
		return { nickname: opponent.nickname, registered: opponent.army, own: false };
	}

	let panels = $derived<Record<PlayerKey, SeatPanel | null>>({
		player1: view.seat === 'player1' ? ownPanel() : opponentPanel(),
		player2: view.seat === 'player2' ? ownPanel() : opponentPanel()
	});

	async function handleAdvance() {
		if (acting) return;
		acting = true;
		try {
			await onAdvance();
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

{#snippet seatPanel(seat: PlayerKey)}
	{@const panel = panels[seat]}
	{@const accent = playerAccent(seat)}
	<div class={'rounded-2xl border bg-slate-800/40 p-4 backdrop-blur ' + accent.border}>
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class={'font-semibold ' + accent.text}>{PLAYER_SEATS[seat].label}</span>
				{#if seat === 'player1'}
					<span class="rounded-full border border-sky-500/50 px-2 py-0.5 text-xs text-sky-200">
						Game Leader
					</span>
				{/if}
			</div>
			<span class="text-slate-100">{panel?.nickname ?? ''}</span>
		</div>
		{#if panel}
			<div class="mt-3 flex flex-col gap-2">
				<ArmyBadge {...panel.registered} factions={armyFactions} />
				{#if panel.registered.format === 'roster'}
					<button
						type="button"
						disabled={rosterViews[seat] === null}
						class="self-start rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-100 transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => (browsing = seat)}
					>
						{panel.own ? 'View your roster' : 'View their roster'}
					</button>
				{:else}
					<p class="text-xs text-slate-200">
						Fields a Standard list — its contents stay secret until deployment.
					</p>
				{/if}
			</div>
		{:else}
			<p class="mt-3 text-center text-slate-200">No Player 2, invite someone</p>
		{/if}
	</div>
{/snippet}

<div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-4 py-4">
	{#if isLeader}
		<button
			type="button"
			class="self-start rounded-lg border-2 border-red-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
			onclick={() => (confirmingClose = true)}
		>
			Close Game
		</button>
	{/if}

	<div class="text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-slate-100">Game#{view.id}</h1>
		<p class="text-slate-200">Army Reveal</p>
		{#if missionName}
			<p class="mt-1 text-sm text-slate-100">{view.season} — {missionName}</p>
		{/if}
	</div>

	{#if error}
		<div
			class="rounded-xl border border-red-500/40 bg-slate-800/40 p-3 text-sm text-red-300 backdrop-blur"
			role="alert"
		>
			{error}
		</div>
	{/if}

	<p class="text-sm text-slate-200">
		Both factions and rosters are open now. What each player builds from their roster stays private
		until deployment.
	</p>

	{@render seatPanel('player1')}
	{@render seatPanel('player2')}

	{#if isLeader}
		<button
			type="button"
			disabled={acting || view.opponent === null}
			class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
			onclick={handleAdvance}
		>
			Continue to army preparation
		</button>
		{#if view.opponent === null}
			<p class="-mt-1 text-center text-xs text-slate-200">Waiting for a second player.</p>
		{/if}
	{:else}
		<p class="text-center text-xs text-slate-200">
			The game leader continues once both rosters have been looked at.
		</p>
	{/if}
</div>

{#if browsing}
	{@const browseView = rosterViews[browsing]}
	{#if browseView}
		<RosterBrowseDialog
			view={browseView}
			title="{panels[browsing]?.nickname ?? ''} — roster"
			onClose={() => (browsing = null)}
		/>
	{/if}
{/if}

{#if confirmingClose}
	<ConfirmDialog
		text="Do you really want to close the game?"
		confirmLabel="Close Game"
		cancelLabel="Cancel"
		onConfirm={handleConfirmedClose}
		onCancel={() => (confirmingClose = false)}
	/>
{/if}
