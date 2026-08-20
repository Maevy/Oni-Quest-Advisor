<script lang="ts">
	import type {
		Faction,
		Mission,
		PublicSeatState,
		ResultObjectiveDef,
		SchemeCard,
		OnlineGameView
	} from '$lib/domain';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import OnlineMissionView from './OnlineMissionView.svelte';
	import OnlineSchemeSetup from './OnlineSchemeSetup.svelte';

	type Props = {
		view: OnlineGameView;
		isLeader: boolean;
		inviteUrl: string;
		error: string | null;
		factions: Faction[];
		schemes: SchemeCard[];
		seasons: string[];
		missionsBySeason: Record<string, Mission[]>;
		selectedMission: Mission | null;
		resultsForMission: ResultObjectiveDef[];
		onAcceptJoin: () => Promise<void>;
		onDenyJoin: () => Promise<void>;
		onCloseGame: () => Promise<void>;
		onReturnToMenu: () => void;
		onDraftFaction: (factionId: string) => void;
		onDraftIntelligence: (intelligence: number | null) => void;
		onDrawSchemes: () => void;
		onChooseScheme: (schemeId: string) => void;
		onDeleteScheme: () => void;
		onSelectMission: (season: string, missionId: string) => void;
		onStartGame: () => void;
	};

	let {
		view,
		isLeader,
		inviteUrl,
		error,
		factions,
		schemes,
		seasons,
		missionsBySeason,
		selectedMission,
		resultsForMission,
		onAcceptJoin,
		onDenyJoin,
		onCloseGame,
		onReturnToMenu,
		onDraftFaction,
		onDraftIntelligence,
		onDrawSchemes,
		onChooseScheme,
		onDeleteScheme,
		onSelectMission,
		onStartGame
	}: Props = $props();

	let confirmingClose = $state(false);
	let copied = $state(false);
	let acting = $state(false);
	let seasonPick = $state('');
	let missionPick = $state('');

	function handleSeasonChange(event: Event): void {
		seasonPick = (event.target as HTMLSelectElement).value;
		missionPick = '';
	}

	let setupUnlocked = $derived(view.status === 'lobby' && view.opponent !== null);
	let opponent = $derived(view.opponent);

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

	function factionName(publicSeat: PublicSeatState): string | null {
		if (!publicSeat.factionId) return null;
		return factions.find((faction) => faction.id === publicSeat.factionId)?.name ?? null;
	}

	let canStart = $derived(
		view.status === 'lobby' &&
			view.missionId !== null &&
			view.self.progress.scheme !== null &&
			(view.opponent?.hasScheme ?? false)
	);

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

	function handleSelectMission() {
		if (seasonPick && missionPick) onSelectMission(seasonPick, missionPick);
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
	{:else}
		{#if view.status === 'lobby' && isLeader}
			<div class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
				<div class="flex items-center justify-between gap-2">
					<div class="min-w-0">
						<p class="text-sm font-semibold tracking-wide text-sky-300 uppercase">
							Share link to invite player
						</p>
						<p class="truncate font-mono text-sm text-slate-200" title={inviteUrl}>
							{inviteUrl}
						</p>
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
				{#if view.missionId && selectedMission}
					<p class="text-slate-200">
						{view.season} — <span class="font-semibold">{selectedMission.name}</span>
					</p>
				{:else}
					<div class="flex flex-col gap-2">
						<select
							class="rounded-xl border-2 bg-slate-900/60 px-3 py-2.5 backdrop-blur enabled:border-sky-500/50 enabled:text-sky-100 disabled:border-slate-600/30 disabled:text-slate-500"
							value={seasonPick}
							disabled={!setupUnlocked}
							onchange={handleSeasonChange}
						>
							<option value="" disabled>
								{setupUnlocked ? 'Select a season…' : 'Season (locked until a player joins)'}
							</option>
							{#each seasons as season (season)}
								<option value={season}>{season}</option>
							{/each}
						</select>
						<select
							class="rounded-xl border-2 bg-slate-900/60 px-3 py-2.5 backdrop-blur enabled:border-sky-500/50 enabled:text-sky-100 disabled:border-slate-600/30 disabled:text-slate-500"
							value={missionPick}
							disabled={!setupUnlocked || !seasonPick}
							onchange={(event) => (missionPick = (event.target as HTMLSelectElement).value)}
						>
							<option value="" disabled>
								{seasonPick ? 'Select a mission…' : 'Mission'}
							</option>
							{#each missionsBySeason[seasonPick] ?? [] as mission (mission.id)}
								<option value={mission.id}>{mission.name}</option>
							{/each}
						</select>
						<button
							type="button"
							disabled={!setupUnlocked || !seasonPick || !missionPick}
							class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-6 py-2.5 font-medium text-sky-100 transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
							onclick={handleSelectMission}
						>
							Select Mission
						</button>
					</div>
				{/if}
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
				<span class="text-slate-100">
					{view.seat === 'player1' ? view.self.nickname : (opponent?.nickname ?? '')}
				</span>
			</div>
			<div class="mt-3">
				{#if view.seat === 'player1'}
					{#if view.status === 'lobby' && setupUnlocked}
						<OnlineSchemeSetup
							{factions}
							schemeDraft={view.self.progress.schemeDraft}
							{drawnCards}
							chosenCard={chosenCardSelf}
							onSetFaction={onDraftFaction}
							onSetIntelligence={onDraftIntelligence}
							onDraw={onDrawSchemes}
							onChoose={onChooseScheme}
							onDelete={onDeleteScheme}
						/>
					{:else if view.status === 'lobby'}
						<p class="text-sm text-slate-500">
							Faction &amp; Scheme selection (locked until a player joins)
						</p>
					{:else if chosenCardSelf}
						<div class="rounded-xl border border-sky-500/40 bg-slate-900/40 p-3">
							<h3 class="font-semibold text-sky-100">{chosenCardSelf.title}</h3>
							<p class="mt-1 text-sm text-slate-300">{chosenCardSelf.ruleText}</p>
						</div>
					{/if}
				{:else if opponent}
					<p class="text-sm text-slate-300">Faction: {factionName(opponent) ?? '—'}</p>
					<div class="mt-2">
						{#if opponent.schemeRevealed && opponent.revealedScheme}
							{@const revealedCard = schemes.find(
								(card) => card.id === opponent.revealedScheme?.schemeId
							)}
							<div class="rounded-xl border border-orange-500/40 bg-slate-900/40 p-3">
								<h3 class="font-semibold text-orange-100">{revealedCard?.title ?? ''}</h3>
								<p class="mt-1 text-sm text-slate-300">{revealedCard?.ruleText ?? ''}</p>
							</div>
						{:else if opponent.hasScheme}
							<p class="text-sm text-slate-400 italic">Hidden Scheme</p>
						{:else}
							<p class="text-sm text-slate-400 italic">No schemes</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Player 2 seat -->
		<div class="rounded-2xl border border-orange-500/30 bg-slate-800/40 p-4 backdrop-blur">
			{#if view.seat === 'player2'}
				<div class="flex items-center justify-between gap-2">
					<span class="font-semibold text-orange-300">Player 2</span>
					<span class="text-slate-100">{view.self.nickname}</span>
				</div>
				<div class="mt-3">
					{#if view.status === 'lobby' && setupUnlocked}
						<OnlineSchemeSetup
							{factions}
							schemeDraft={view.self.progress.schemeDraft}
							{drawnCards}
							chosenCard={chosenCardSelf}
							onSetFaction={onDraftFaction}
							onSetIntelligence={onDraftIntelligence}
							onDraw={onDrawSchemes}
							onChoose={onChooseScheme}
							onDelete={onDeleteScheme}
						/>
					{:else if chosenCardSelf}
						<div class="rounded-xl border border-orange-500/40 bg-slate-900/40 p-3">
							<h3 class="font-semibold text-orange-100">{chosenCardSelf.title}</h3>
							<p class="mt-1 text-sm text-slate-300">{chosenCardSelf.ruleText}</p>
						</div>
					{/if}
				</div>
			{:else if opponent}
				<div class="flex items-center justify-between gap-2">
					<span class="font-semibold text-orange-300">Player 2</span>
					<span class="text-slate-100">{opponent.nickname}</span>
				</div>
				<div class="mt-3">
					<p class="text-sm text-slate-300">Faction: {factionName(opponent) ?? '—'}</p>
					<div class="mt-2">
						{#if opponent.schemeRevealed && opponent.revealedScheme}
							{@const revealedCard = schemes.find(
								(card) => card.id === opponent.revealedScheme?.schemeId
							)}
							<div class="rounded-xl border border-orange-500/40 bg-slate-900/40 p-3">
								<h3 class="font-semibold text-orange-100">{revealedCard?.title ?? ''}</h3>
								<p class="mt-1 text-sm text-slate-300">{revealedCard?.ruleText ?? ''}</p>
							</div>
						{:else if opponent.hasScheme}
							<p class="text-sm text-slate-400 italic">Hidden Scheme</p>
						{:else}
							<p class="text-sm text-slate-400 italic">No schemes</p>
						{/if}
					</div>
				</div>
			{:else}
				<p class="text-center text-slate-400">No Player 2, invite someone</p>
			{/if}
		</div>

		{#if selectedMission}
			<OnlineMissionView mission={selectedMission} results={resultsForMission} />
		{/if}

		{#if view.status === 'active'}
			<p class="text-center text-xs text-slate-500">Round controls arrive in the next update.</p>
		{/if}

		{#if view.status === 'lobby' && isLeader}
			<button
				type="button"
				disabled={!canStart}
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={onStartGame}
			>
				Start Game
			</button>
		{/if}
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
	<ConfirmDialog
		text="Do you really want to close the game ?"
		confirmLabel="Close Game"
		cancelLabel="Keep playing"
		confirming={acting}
		onConfirm={handleConfirmedClose}
		onCancel={() => (confirmingClose = false)}
	/>
{/if}
