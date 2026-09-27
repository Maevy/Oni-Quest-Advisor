<script lang="ts">
	import {
		MAX_EXTERNAL_LINK_LENGTH,
		MAX_ORGANIZER_NAME_LENGTH,
		MAX_TOURNAMENT_NAME_LENGTH,
		MAX_TOURNAMENT_PLAYERS,
		MIN_TOURNAMENT_PLAYERS,
		defaultTableName,
		type ArmyFactionConfig,
		type Mission,
		type TournamentDraft,
		type TournamentSetupStep
	} from '$lib/domain';
	import Panel from './Panel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import TournamentOverview from './TournamentOverview.svelte';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		draft: TournamentDraft;
		step: TournamentSetupStep;
		canContinue: boolean;
		/** A link was typed but is not a usable http(s) URL. */
		externalLinkInvalid: boolean;
		/** The organizer holds a seat but no army for it — a seat without a list cannot play. */
		organizerArmyMissing: boolean;
		/** The organizer's picked army resolved for display, when there is one. */
		organizerFaction: ArmyFactionConfig | undefined;
		/** Everything the Add Quest popup can offer; the popup groups it by season. */
		seasons: string[];
		missions: Mission[];
		/** At least one mission on the list — opens the overview, and creates from there. */
		canCreate: boolean;
		onNameChange: (name: string) => void;
		onExternalLinkChange: (link: string) => void;
		onOrganizerNameChange: (name: string) => void;
		onOrganizerPlaysChange: (plays: boolean) => void;
		/** Moves the field by whole pairs; positive adds, negative removes. */
		onParticipantStep: (pairs: number) => void;
		onManualPairingChange: (manual: boolean) => void;
		onPickArmy: () => void;
		onClearArmy: () => void;
		onAddMission: (missionId: string) => void;
		onRemoveMission: (missionId: string) => void;
		onTableNameChange: (index: number, name: string) => void;
		onCreate: () => void;
		onBack: () => void;
		onContinue: () => void;
		/** Missions & tables → the read-only overview. */
		onReview: () => void;
	};

	let {
		draft,
		step,
		canContinue,
		externalLinkInvalid,
		organizerArmyMissing,
		organizerFaction,
		seasons,
		missions,
		canCreate,
		onNameChange,
		onExternalLinkChange,
		onOrganizerNameChange,
		onOrganizerPlaysChange,
		onParticipantStep,
		onManualPairingChange,
		onPickArmy,
		onClearArmy,
		onAddMission,
		onRemoveMission,
		onTableNameChange,
		onCreate,
		onBack,
		onContinue,
		onReview
	}: Props = $props();

	const label = 'text-sm font-semibold tracking-wide text-sky-300 uppercase';
	const field =
		'w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-base text-sky-100 backdrop-blur outline-none placeholder:text-slate-500 focus:border-sky-400';
	const stepperButton =
		'flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/80 text-2xl font-bold text-slate-100 transition active:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-30';
	const checkbox =
		'mt-0.5 h-5 w-5 shrink-0 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500';
	const select = 'rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100';

	// Add Quest popup: which season its mission list shows. Null means the first season.
	let showAddQuest = $state(false);
	let addSeason = $state<string | null>(null);

	$effect(() => {
		if (showAddQuest) return onEscapeKey(() => (showAddQuest = false));
	});

	let activeSeason = $derived(addSeason ?? seasons[0] ?? '');
	let seasonMissions = $derived(missions.filter((mission) => mission.season === activeSeason));

	function openAddQuest(): void {
		addSeason = null;
		showAddQuest = true;
	}

	function chooseMission(missionId: string): void {
		onAddMission(missionId);
		showAddQuest = false;
	}

	const stepTitles: Record<TournamentSetupStep, string> = {
		basics: 'Organize Tournament',
		missions: 'Missions & Tables',
		overview: 'Overview'
	};

	const advanceButton =
		'rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600';
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader title={stepTitles[step]} {onBack} />

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		{#if step === 'basics'}
			<Panel title="Tournament">
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-1.5">
						<label for="tournament-name" class={label}>Tournament Name</label>
						<input
							id="tournament-name"
							type="text"
							class={field}
							maxlength={MAX_TOURNAMENT_NAME_LENGTH}
							placeholder="e.g. Eldfall Cup"
							value={draft.name}
							oninput={(event) => onNameChange(event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="tournament-link" class={label}>External Link</label>
						<input
							id="tournament-link"
							type="url"
							class="{field} {externalLinkInvalid ? '!border-red-500/60' : ''}"
							maxlength={MAX_EXTERNAL_LINK_LENGTH}
							placeholder="e.g. tabletop.events/tournaments/eldfall-cup"
							value={draft.externalLink}
							oninput={(event) => onExternalLinkChange(event.currentTarget.value)}
						/>
						{#if externalLinkInvalid}
							<p class="text-xs text-red-400">
								That does not look like a web address — it needs to be a link, e.g.
								https://tabletop.events/…
							</p>
						{:else}
							<p class="text-xs text-slate-500">
								Optional — where this tournament is listed outside the app.
							</p>
						{/if}
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="tournament-organizer" class={label}>Tournament Organizer</label>
						<input
							id="tournament-organizer"
							type="text"
							class={field}
							maxlength={MAX_ORGANIZER_NAME_LENGTH}
							placeholder="Your name"
							value={draft.organizerName}
							oninput={(event) => onOrganizerNameChange(event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-3">
						<label class="flex cursor-pointer items-start gap-3">
							<input
								type="checkbox"
								class={checkbox}
								checked={draft.organizerPlays}
								onchange={(event) => onOrganizerPlaysChange(event.currentTarget.checked)}
							/>
							<span>
								<span class="block text-sm font-medium text-slate-100">
									I am also a participant
								</span>
								<span class="mt-0.5 block text-xs text-slate-400">
									You take one of the seats below, are paired in like everyone else and field the
									Roster army you pick.
								</span>
							</span>
						</label>
						{#if draft.organizerPlays}
							{#if draft.organizerArmy}
								<div
									class="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
								>
									<button
										type="button"
										class="min-w-0 flex-1 text-left"
										aria-label="Change the organizer's army"
										onclick={onPickArmy}
									>
										<span class="block truncate text-sm font-semibold text-slate-100">
											{draft.organizerArmy.name}
										</span>
										<span
											class="mt-0.5 block truncate text-xs {organizerFaction
												? ''
												: 'text-slate-400'}"
											style={organizerFaction ? `color: ${organizerFaction.color}` : undefined}
										>
											{organizerFaction?.name ?? draft.organizerArmy.factionId}
										</span>
									</button>
									<button
										type="button"
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
										aria-label="Remove the organizer's army"
										onclick={onClearArmy}
									>
										<span aria-hidden="true">✕</span>
									</button>
								</div>
							{:else}
								<button
									type="button"
									class="rounded-xl border-2 border-red-500/60 bg-slate-900/60 px-3 py-2 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
									onclick={onPickArmy}
								>
									Pick Roster Army
								</button>
								<p class="text-xs text-red-400">
									A seat needs a list — pick the Roster army you will field to continue.
								</p>
							{/if}
						{/if}
					</div>
				</div>
			</Panel>

			<Panel title="Participants & Pairing">
				<div class="flex flex-col gap-4">
					<div class="flex items-center justify-center gap-4">
						<button
							type="button"
							class={stepperButton}
							aria-label="Fewer participants"
							disabled={draft.participantCount <= MIN_TOURNAMENT_PLAYERS}
							onclick={() => onParticipantStep(-1)}
						>
							−
						</button>
						<div class="flex flex-col items-center">
							<span
								class="flex h-14 min-w-20 items-center justify-center rounded-lg border-2 border-sky-500/40 bg-slate-950 px-3 text-3xl font-bold text-sky-300"
							>
								{draft.participantCount}
							</span>
							<span class="mt-1 text-[10px] tracking-wide text-slate-400 uppercase">
								participants
							</span>
						</div>
						<button
							type="button"
							class={stepperButton}
							aria-label="More participants"
							disabled={draft.participantCount >= MAX_TOURNAMENT_PLAYERS}
							onclick={() => onParticipantStep(1)}
						>
							+
						</button>
					</div>
					<!-- An odd field would need a bye rule — someone sitting a round out and still
					     scoring — so the stepper only ever lands on an even count. -->
					<p class="text-center text-xs text-slate-400">
						Rounds pair players off, so the field steps in pairs — nobody sits a round out.
						{#if draft.organizerPlays}You hold one of these {draft.participantCount} seats.{/if}
					</p>

					<label class="flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							class={checkbox}
							checked={draft.manualPairing}
							onchange={(event) => onManualPairingChange(event.currentTarget.checked)}
						/>
						<span>
							<span class="block text-sm font-medium text-slate-100">
								I assign the pairings myself each round
							</span>
							<span class="mt-0.5 block text-xs text-slate-400">
								Left unticked, the app pairs each round automatically with a Swiss system.
							</span>
						</span>
					</label>
				</div>
			</Panel>

			<button type="button" class={advanceButton} disabled={!canContinue} onclick={onContinue}>
				Continue
			</button>
			{#if organizerArmyMissing}
				<p class="-mt-2 text-center text-xs text-red-400">
					Pick a Roster army for your seat to continue.
				</p>
			{:else}
				<p class="-mt-2 text-center text-xs text-slate-400">Next: missions and tables.</p>
			{/if}
		{:else if step === 'missions'}
			<Panel title="Missions">
				{#if draft.missionIds.length > 0}
					<ul class="flex flex-col gap-2">
						{#each draft.missionIds as missionId (missionId)}
							{@const mission = missions.find((candidate) => candidate.id === missionId)}
							<li
								class="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-slate-100">
										{mission?.name ?? missionId}
									</p>
									{#if mission}
										<p class="mt-0.5 truncate text-xs text-slate-400">{mission.season}</p>
									{/if}
								</div>
								<button
									type="button"
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
									aria-label={'Remove ' + (mission?.name ?? missionId) + ' from the tournament'}
									onclick={() => onRemoveMission(missionId)}
								>
									<span aria-hidden="true">✕</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-slate-400">No missions yet — a tournament needs at least one.</p>
				{/if}
				<button
					type="button"
					class="mt-3 rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
					onclick={openAddQuest}
				>
					Add Quest
				</button>
			</Panel>

			<Panel title="Tables">
				<p class="text-xs text-slate-400">
					{draft.tableNames.length} tables — one per pair of players. Rename them to tell the room apart,
					e.g. "City Table".
				</p>
				<ul class="mt-3 flex flex-col gap-2">
					{#each draft.tableNames as name, index (index)}
						<li class="flex items-center gap-2">
							<span class="w-6 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
							<input
								id="table-name-{index}"
								type="text"
								class="{field} py-2"
								maxlength={MAX_ORGANIZER_NAME_LENGTH}
								placeholder={defaultTableName(index)}
								aria-label={'Name of ' + defaultTableName(index)}
								value={name}
								oninput={(event) => onTableNameChange(index, event.currentTarget.value)}
							/>
						</li>
					{/each}
				</ul>
			</Panel>

			<button type="button" class={advanceButton} disabled={!canCreate} onclick={onReview}>
				Overview
			</button>
			<p class="-mt-2 text-center text-xs text-slate-400">
				Next: review the whole tournament, then create it.
			</p>
		{:else}
			<TournamentOverview {draft} {missions} {organizerFaction} />

			<button type="button" class={advanceButton} disabled={!canCreate} onclick={onCreate}>
				Create Tournament
			</button>
		{/if}
	</div>
</div>

{#if showAddQuest}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) showAddQuest = false;
		}}
	>
		<div
			class="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
		>
			<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Add Quest</h2>
			<label class="mt-3 flex flex-col gap-1 text-sm text-slate-300">
				Season
				<select
					class={select}
					value={activeSeason}
					onchange={(event) => (addSeason = event.currentTarget.value)}
				>
					{#each seasons as season (season)}
						<option value={season}>{season}</option>
					{/each}
				</select>
			</label>
			<ul class="mt-3 flex flex-col gap-2">
				{#each seasonMissions as mission (mission.id)}
					{@const added = draft.missionIds.includes(mission.id)}
					<li>
						<button
							type="button"
							class="w-full rounded-xl border border-slate-600/40 bg-slate-900/60 px-3 py-2.5 text-left transition enabled:hover:bg-slate-700/40 enabled:active:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={added}
							onclick={() => chooseMission(mission.id)}
						>
							<span class="block text-sm font-semibold text-slate-100">{mission.name}</span>
							{#if added}
								<span class="mt-0.5 block text-xs text-slate-500">already on the list</span>
							{/if}
						</button>
					</li>
				{:else}
					<li class="text-sm text-slate-500">This season has no missions.</li>
				{/each}
			</ul>
			<button
				type="button"
				class="mt-4 w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/60"
				onclick={() => (showAddQuest = false)}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
