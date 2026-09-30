<script lang="ts">
	import type {
		ArmyFactionConfig,
		ArmyView,
		Faction,
		OnlineGameView,
		PlayerKey,
		SchemeCard
	} from '$lib/domain';
	import { pickedArmyFormat } from '$lib/domain';
	import ArmyBadge from './ArmyBadge.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import OnlineSchemeSetup from './OnlineSchemeSetup.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import { PLAYER_SEATS, playerAccent } from './playerAccent';

	type Props = {
		view: OnlineGameView;
		isLeader: boolean;
		error: string | null;
		missionName: string | null;
		armyFactions: ArmyFactionConfig[];
		/** This seat's own combat army resolved into rows, to name the chosen Leader. */
		combatView: ArmyView | null;
		/** Scheme factions — the deck an army faction draws from, not the army factions themselves. */
		factions: Faction[];
		schemes: SchemeCard[];
		onDrawSchemes: () => void;
		onChooseScheme: (schemeId: string) => void;
		onDeleteScheme: () => void;
		onAdvance: () => Promise<void>;
		onCloseGame: () => Promise<void>;
		onReturn: () => void;
	};

	let {
		view,
		isLeader,
		error,
		missionName,
		armyFactions,
		combatView,
		factions,
		schemes,
		onDrawSchemes,
		onChooseScheme,
		onDeleteScheme,
		onAdvance,
		onCloseGame,
		onReturn
	}: Props = $props();

	let confirmingClose = $state(false);
	let acting = $state(false);

	let drawnCards = $derived(
		view.self.drawnSchemeIds
			.map((id) => schemes.find((card) => card.id === id))
			.filter((card): card is SchemeCard => card !== undefined)
	);
	let chosenCardSelf = $derived(
		view.self.progress.scheme
			? (schemes.find((card) => card.id === view.self.progress.scheme?.schemeId) ?? null)
			: null
	);
	/** Seeded by `leavePrep` from the combat army; there is nothing left to choose here. */
	let myFactionName = $derived(schemeFactionName(view.self.progress.schemeDraft.factionId));
	let opponentFactionName = $derived(schemeFactionName(view.opponent?.factionId ?? null));
	let ownLeaderName = $derived(
		combatView?.rows.find((row) => row.entryId === view.self.leader?.entryId)?.name ?? null
	);

	function schemeFactionName(factionId: string | null): string | null {
		if (factionId === null) return null;
		return factions.find((faction) => faction.id === factionId)?.name ?? factionId;
	}

	let bothSchemes = $derived(
		view.self.progress.scheme !== null && (view.opponent?.hasScheme ?? false)
	);
	let beginHint = $derived(
		view.opponent === null
			? 'Waiting for a second player.'
			: view.self.progress.scheme === null
				? 'Draw and choose your Scheme to continue.'
				: 'Waiting for the other player to choose a Scheme.'
	);

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
	{@const accent = playerAccent(seat)}
	{@const own = view.seat === seat}
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
			<span class="text-slate-100">
				{own ? view.self.nickname : (view.opponent?.nickname ?? '')}
			</span>
		</div>
		<div class="mt-3 flex flex-col gap-2">
			{#if own}
				<ArmyBadge
					name={view.self.army.name}
					factionId={view.self.army.factionId}
					format={pickedArmyFormat(view.self.army)}
					factions={armyFactions}
				/>
				{#if ownLeaderName}
					<p class="text-sm text-slate-100">Your Leader: {ownLeaderName}</p>
				{/if}
				<OnlineSchemeSetup
					factionName={myFactionName}
					schemeDraft={view.self.progress.schemeDraft}
					{drawnCards}
					chosenCard={chosenCardSelf}
					onDraw={onDrawSchemes}
					onChoose={onChooseScheme}
					onDelete={onDeleteScheme}
				/>
			{:else if view.opponent}
				<ArmyBadge {...view.opponent.army} factions={armyFactions} />
				<p class="text-sm text-slate-100">Faction: {opponentFactionName ?? '—'}</p>
				{#if view.opponent.leaderStats}
					<p class="text-sm text-slate-100">
						Their Leader: M {view.opponent.leaderStats.m ?? '—'} · INT
						{view.opponent.leaderStats.int ?? '—'}
					</p>
				{/if}
				{#if view.opponent.schemeRevealed && view.opponent.revealedScheme}
					{@const revealedCard = schemes.find(
						(card) => card.id === view.opponent?.revealedScheme?.schemeId
					)}
					<div class="rounded-xl border border-orange-500/40 bg-slate-900/40 p-3">
						<h3 class="font-semibold text-orange-100">{revealedCard?.title ?? ''}</h3>
						<p class="mt-1 text-sm text-slate-100">{revealedCard?.ruleText ?? ''}</p>
					</div>
				{:else if view.opponent.hasScheme}
					<p class="text-sm text-slate-200 italic">Hidden Scheme</p>
				{:else}
					<p class="text-sm text-slate-200 italic">Choosing a Scheme…</p>
				{/if}
			{:else}
				<p class="text-center text-slate-200">No Player 2, invite someone</p>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flex min-h-dvh flex-col">
	<ScreenHeader onBack={onReturn}>
		{#snippet actions()}
			{#if isLeader}
				<button
					type="button"
					class="rounded-lg border-2 border-red-500/50 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
					onclick={() => (confirmingClose = true)}
				>
					Close Game
				</button>
			{/if}
		{/snippet}
	</ScreenHeader>
	<div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
		<div class="text-center">
			<h1 class="text-2xl font-extrabold tracking-tight text-slate-100">Game#{view.id}</h1>
			<p class="text-slate-200">Scheme Selection</p>
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
			Your faction is the one your army belongs to and your intelligence is your Leader's — both
			fixed, both shown. Draw, and keep one Scheme secret.
		</p>

		{@render seatPanel('player1')}
		{@render seatPanel('player2')}

		{#if isLeader}
			<button
				type="button"
				disabled={!bothSchemes || acting}
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={handleAdvance}
			>
				Begin Round 1
			</button>
			{#if !bothSchemes}
				<p class="-mt-1 text-center text-xs text-slate-200">{beginHint}</p>
			{/if}
		{:else}
			<p class="text-center text-xs text-slate-200">
				The game leader begins round 1 once both Schemes are chosen.
			</p>
		{/if}
	</div>
</div>

{#if confirmingClose}
	<ConfirmDialog
		text="Do you really want to close the game?"
		confirmLabel="Close Game"
		cancelLabel="Cancel"
		onConfirm={handleConfirmedClose}
		onCancel={() => (confirmingClose = false)}
	/>
{/if}
