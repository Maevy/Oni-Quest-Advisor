<script lang="ts">
	import type { ArmyFactionConfig, Mission, TournamentDraft } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = {
		draft: TournamentDraft;
		/** Every mission the draft may reference; the overview resolves its ids against this. */
		missions: Mission[];
		/** The organizer's picked army resolved for display, when there is one. */
		organizerFaction: ArmyFactionConfig | undefined;
	};

	let { draft, missions, organizerFaction }: Props = $props();

	const row =
		'flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2 last:border-b-0 last:pb-0';
	const label = 'shrink-0 text-xs tracking-wide text-slate-400 uppercase';
	const value = 'min-w-0 text-right text-sm break-words text-slate-100';
	const muted = 'text-slate-400';
</script>

<Panel title="Tournament">
	<dl class="flex flex-col gap-2">
		<div class={row}>
			<dt class={label}>Name</dt>
			<dd class={value}>{draft.name.trim()}</dd>
		</div>
		<div class={row}>
			<dt class={label}>External Link</dt>
			<dd class={value}>
				{#if draft.externalLink.trim() === ''}
					<span class={muted}>None</span>
				{:else}
					{draft.externalLink.trim()}
				{/if}
			</dd>
		</div>
		<div class={row}>
			<dt class={label}>Organizer</dt>
			<dd class={value}>{draft.organizerName.trim()}</dd>
		</div>
		<div class={row}>
			<dt class={label}>Also Plays</dt>
			<dd class={value}>{draft.organizerPlays ? 'Yes' : 'No'}</dd>
		</div>
		{#if draft.organizerPlays}
			<div class={row}>
				<dt class={label}>Army</dt>
				<dd class={value}>
					{#if draft.organizerArmy}
						<span class="block truncate font-semibold">{draft.organizerArmy.name}</span>
						<span
							class="mt-0.5 block truncate text-xs {organizerFaction ? '' : muted}"
							style={organizerFaction ? `color: ${organizerFaction.color}` : undefined}
						>
							{organizerFaction?.name ?? draft.organizerArmy.factionId}
						</span>
					{:else}
						<span class={muted}>None picked</span>
					{/if}
				</dd>
			</div>
		{/if}
	</dl>
</Panel>

<Panel title="Participants & Pairing">
	<dl class="flex flex-col gap-2">
		<div class={row}>
			<dt class={label}>Participants</dt>
			<dd class={value}>{draft.participantCount}</dd>
		</div>
		<div class={row}>
			<dt class={label}>Pairing</dt>
			<dd class={value}>
				{draft.manualPairing ? 'Assigned by the organizer' : 'Automatic — Swiss system'}
			</dd>
		</div>
	</dl>
	{#if draft.organizerPlays}
		<p class="mt-2 text-xs text-slate-400">
			You hold one of these {draft.participantCount} seats.
		</p>
	{/if}
</Panel>

<Panel title="Missions">
	<p class="text-xs text-slate-400">A mission plays once per tournament.</p>
	<ul class="mt-2 flex flex-col gap-2">
		{#each draft.missionIds as missionId (missionId)}
			{@const mission = missions.find((candidate) => candidate.id === missionId)}
			<li class="rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5">
				<p class="truncate text-sm font-semibold text-slate-100">
					{mission?.name ?? missionId}
				</p>
				{#if mission}
					<p class="mt-0.5 truncate text-xs text-slate-400">{mission.season}</p>
				{/if}
			</li>
		{/each}
	</ul>
</Panel>

<Panel title="Tables">
	<p class="text-xs text-slate-400">
		{draft.tableNames.length} tables — one per pair of players, so every round seats the whole field.
	</p>
	<ul class="mt-2 flex flex-col gap-1.5">
		{#each draft.tableNames as name, index (index)}
			<li class="flex items-baseline gap-2">
				<span class="w-6 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
				{#if name.trim() === ''}
					<span class="min-w-0 flex-1 truncate text-sm {muted}">unnamed</span>
				{:else}
					<span class="min-w-0 flex-1 truncate text-sm text-slate-100">{name}</span>
				{/if}
			</li>
		{/each}
	</ul>
</Panel>
