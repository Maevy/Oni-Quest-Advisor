<script lang="ts">
	import { pickedArmyFormat } from '$lib/domain';
	import type {
		ArmyFactionConfig,
		ArmyRosterRow,
		ArmyView,
		OnlineGameView,
		PickedArmy,
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
		/** Resolved rosters per seat; the reveal already happened, so both are browsable here. */
		rosterViews: Record<PlayerKey, ArmyView | null>;
		/** This seat's own combat army resolved into rows, for the Leader choice. */
		combatView: ArmyView | null;
		/** Opens the borrowed army builder on this seat's registered Roster army. */
		onCutArmy: () => void;
		onSetLeader: (row: ArmyRosterRow) => void;
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
		combatView,
		onCutArmy,
		onSetLeader,
		onAdvance,
		onCloseGame
	}: Props = $props();

	let confirmingClose = $state(false);
	let acting = $state(false);
	let browsing = $state<PlayerKey | null>(null);

	/**
	 * What one seat panel shows. The own seat carries its combat list so it can be edited; the
	 * opponent only ever carries the readiness flag, because their list never leaves the server.
	 */
	type SeatPanel = {
		nickname: string;
		registered: PublicArmy;
		combat: PickedArmy | null;
		isRoster: boolean;
		ready: boolean;
		hasLeader: boolean;
		own: boolean;
	};

	function ownPanel(): SeatPanel {
		const format = pickedArmyFormat(view.self.army);
		return {
			nickname: view.self.nickname,
			registered: { name: view.self.army.name, factionId: view.self.army.factionId, format },
			combat: view.self.combatArmy,
			isRoster: format === 'roster',
			ready: view.self.combatArmy !== null,
			hasLeader: view.self.leader !== null,
			own: true
		};
	}

	function opponentPanel(): SeatPanel | null {
		const opponent = view.opponent;
		if (opponent === null) return null;
		return {
			nickname: opponent.nickname,
			registered: opponent.army,
			combat: null,
			isRoster: opponent.army.format === 'roster',
			ready: opponent.combatReady,
			hasLeader: opponent.hasLeader,
			own: false
		};
	}

	let panels = $derived<Record<PlayerKey, SeatPanel | null>>({
		player1: view.seat === 'player1' ? ownPanel() : opponentPanel(),
		player2: view.seat === 'player2' ? ownPanel() : opponentPanel()
	});

	let myCombatReady = $derived(view.self.combatArmy !== null);
	let bothCombatReady = $derived(myCombatReady && (view.opponent?.combatReady ?? false));
	let myLeaderSet = $derived(view.self.leader !== null);
	let canProceed = $derived(bothCombatReady && myLeaderSet && (view.opponent?.hasLeader ?? false));

	/** Names whichever of the four gates Proceed is still waiting on, in the order they are met. */
	let proceedHint = $derived.by(() => {
		if (view.opponent === null) return 'Waiting for a second player.';
		if (!myCombatReady) return 'Prepare your army to continue.';
		if (!myLeaderSet) return 'Choose your Leader to continue.';
		if (!view.opponent.combatReady) return 'Waiting for the other player to prepare their army.';
		return 'Waiting for the other player to choose their Leader.';
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
				{#if rosterViews[seat]}
					<button
						type="button"
						class="self-start rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-100 transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
						onclick={() => (browsing = seat)}
					>
						{panel.own ? 'View your roster' : 'View their roster'}
					</button>
				{/if}
				<p
					class={panel.ready
						? 'text-sm font-semibold text-emerald-300'
						: 'text-sm font-semibold text-amber-300'}
				>
					{panel.ready ? 'Combat ready' : 'Needs a match list'}
				</p>
				{#if panel.own}
					{#if panel.combat && panel.isRoster}
						<ArmyBadge
							name={panel.combat.name}
							factionId={panel.combat.factionId}
							format={pickedArmyFormat(panel.combat)}
							factions={armyFactions}
						/>
						<button
							type="button"
							disabled={acting}
							class="self-start rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-100 transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={onCutArmy}
						>
							Edit match list
						</button>
					{:else if panel.isRoster}
						<button
							type="button"
							disabled={acting}
							class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-4 py-2.5 font-medium text-emerald-100 transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={onCutArmy}
						>
							Create army out of a roster
						</button>
					{:else}
						<p class="text-xs text-slate-200">
							Your registered army is already a legal match list.
						</p>
					{/if}
					{#if panel.ready && combatView}
						<h3 class="pt-1 text-xs font-semibold tracking-wide text-sky-300 uppercase">
							Your Leader
						</h3>
						<div class="flex flex-col gap-1.5">
							{#each combatView.rows as row (row.entryId)}
								{@const chosen = view.self.leader?.entryId === row.entryId}
								<button
									type="button"
									aria-pressed={chosen}
									disabled={acting}
									class={'flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ' +
										(chosen
											? 'border-emerald-400 bg-emerald-400/15 text-emerald-100'
											: 'border-slate-600/60 bg-slate-900/60 text-slate-100 enabled:hover:bg-slate-800/60')}
									onclick={() => onSetLeader(row)}
								>
									<span class="min-w-0 truncate font-semibold">
										{row.name}{row.mounted ? ' (mounted)' : ''}
									</span>
									<span class="shrink-0 text-xs text-slate-200 tabular-nums">
										M {row.effectiveStats.M ?? '—'} · INT {row.effectiveStats.INT ?? '—'}
									</span>
								</button>
							{/each}
						</div>
						<p class="text-xs text-slate-200">
							Only your Leader may use Stratagems. The M and INT shown here become visible to your
							opponent at Scheme selection; which model it is stays yours.
						</p>
					{/if}
				{:else if !panel.ready}
					<p class="text-xs text-slate-200 italic">Preparing their army…</p>
				{:else if !panel.hasLeader}
					<p class="text-xs text-slate-200 italic">Choosing their Leader…</p>
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
		<p class="text-slate-200">Army Preparation</p>
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
		A match is 85 points. A Standard army is combat-ready as registered; a Roster army is cut down
		to the list you field, out of nothing but what it held.
	</p>

	{@render seatPanel('player1')}
	{@render seatPanel('player2')}

	{#if isLeader}
		<button
			type="button"
			disabled={!canProceed || acting}
			class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
			onclick={handleAdvance}
		>
			Proceed to the mission
		</button>
		{#if !canProceed}
			<p class="-mt-1 text-center text-xs text-slate-200">{proceedHint}</p>
		{/if}
	{:else}
		<p class="text-center text-xs text-slate-200">
			The game leader continues once both armies are combat-ready.
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
