<script lang="ts">
	import {
		MAX_ORGANIZER_NAME_LENGTH,
		type ArmyFactionConfig,
		type PickedArmy,
		type TournamentPeek
	} from '$lib/domain';
	import Panel from './Panel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';

	type Props = {
		/** The tournament the invite code points at; null while loading or unknown. */
		peek: TournamentPeek | null;
		error: string | null;
		name: string;
		army: PickedArmy | null;
		/** The picked army resolved for display, when there is one. */
		armyFaction: ArmyFactionConfig | undefined;
		/** Name given, army picked and the lobby still has a free seat. */
		canJoin: boolean;
		onNameChange: (name: string) => void;
		onPickArmy: () => void;
		onClearArmy: () => void;
		onJoin: () => void;
		onLeave: () => void;
	};

	let {
		peek,
		error,
		name,
		army,
		armyFaction,
		canJoin,
		onNameChange,
		onPickArmy,
		onClearArmy,
		onJoin,
		onLeave
	}: Props = $props();

	const label = 'text-sm font-semibold tracking-wide text-sky-300 uppercase';
	const field =
		'w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-base text-sky-100 backdrop-blur outline-none placeholder:text-slate-500 focus:border-sky-400';
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader title="Join Tournament" onBack={onLeave} />

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		{#if error && !peek}
			<Panel title="Tournament">
				<p class="text-sm text-red-400">{error}</p>
				<p class="mt-2 text-xs text-slate-400">
					Check the code in your invite, or ask the organizer for a fresh link.
				</p>
			</Panel>
		{:else if peek}
			<Panel title="Tournament">
				<dl class="flex flex-col gap-2">
					<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
						<dt class="shrink-0 text-xs tracking-wide text-slate-400 uppercase">Name</dt>
						<dd class="min-w-0 text-right text-sm break-words text-slate-100">{peek.name}</dd>
					</div>
					<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
						<dt class="shrink-0 text-xs tracking-wide text-slate-400 uppercase">Organizer</dt>
						<dd class="min-w-0 text-right text-sm break-words text-slate-100">
							{peek.organizerName}
						</dd>
					</div>
					<div class="flex items-baseline justify-between gap-3">
						<dt class="shrink-0 text-xs tracking-wide text-slate-400 uppercase">Seats</dt>
						<dd class="min-w-0 text-right text-sm text-slate-100">
							{peek.joinedCount} of {peek.participantCount} taken
						</dd>
					</div>
				</dl>
				{#if peek.status === 'closed'}
					<p class="mt-3 text-xs text-red-400">This tournament was cancelled by its organizer.</p>
				{:else if peek.full}
					<p class="mt-3 text-xs text-red-400">This tournament is full — every seat is taken.</p>
				{/if}
			</Panel>

			<Panel title="Your Registration">
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-1.5">
						<label for="join-name" class={label}>Your Name</label>
						<input
							id="join-name"
							type="text"
							class={field}
							maxlength={MAX_ORGANIZER_NAME_LENGTH}
							placeholder="The name the other players see"
							value={name}
							oninput={(event) => onNameChange(event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<span class={label}>Roster Army</span>
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
									<span class="block truncate text-sm font-semibold text-slate-100">
										{army.name}
									</span>
									<span
										class="mt-0.5 block truncate text-xs {armyFaction ? '' : 'text-slate-400'}"
										style={armyFaction ? `color: ${armyFaction.color}` : undefined}
									>
										{armyFaction?.name ?? army.factionId}
									</span>
								</button>
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
								class="rounded-xl border-2 border-red-500/60 bg-slate-900/60 px-3 py-2 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
								onclick={onPickArmy}
							>
								Pick Roster Army
							</button>
							<p class="text-xs text-red-400">
								A Roster army (125 points) is required to take a seat.
							</p>
						{/if}
					</div>
				</div>
			</Panel>

			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				disabled={!canJoin}
				onclick={onJoin}
			>
				Join
			</button>
			{#if peek.status === 'closed'}
				<p class="-mt-2 text-center text-xs text-red-400">This tournament is no longer running.</p>
			{:else if peek.full}
				<p class="-mt-2 text-center text-xs text-red-400">Every seat is taken.</p>
			{:else if army === null}
				<p class="-mt-2 text-center text-xs text-slate-400">Pick a Roster army to join.</p>
			{:else if name.trim() === ''}
				<p class="-mt-2 text-center text-xs text-slate-400">Enter your name to join.</p>
			{:else}
				<p class="-mt-2 text-center text-xs text-slate-400">
					You enter the lobby like everyone else — and can see who else is in.
				</p>
			{/if}
		{:else}
			<Panel title="Tournament">
				<p class="text-sm text-slate-400">Looking up the tournament…</p>
			</Panel>
		{/if}
	</div>
</div>
