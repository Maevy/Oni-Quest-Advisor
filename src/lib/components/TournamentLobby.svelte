<script lang="ts">
	import { type ArmyFactionConfig, type Mission, type TournamentEventView } from '$lib/domain';
	import Panel from './Panel.svelte';
	import QrCode from './QrCode.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		view: TournamentEventView;
		/** Every mission the tournament may reference; the lobby resolves ids against it. */
		missions: Mission[];
		/** Faction colours and names for the registered armies. */
		factions: ArmyFactionConfig[];
		onLeave: () => void;
	};

	let { view, missions, factions, onLeave }: Props = $props();

	const label = 'shrink-0 text-xs tracking-wide text-slate-400 uppercase';
	const value = 'min-w-0 text-right text-sm break-words text-slate-100';
	const inviteButton =
		'rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20';

	let showQr = $state(false);
	let copied = $state(false);
	/** The clipboard is unavailable (permissions, non-secure context) — show the link instead. */
	let clipboardFailed = $state(false);

	$effect(() => {
		if (showQr) return onEscapeKey(() => (showQr = false));
	});

	let inviteUrl = $derived(
		typeof window === 'undefined' ? '' : `${window.location.origin}/tournament-join/${view.code}`
	);

	async function shareLink(): Promise<void> {
		copied = false;
		clipboardFailed = false;
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
		} catch {
			clipboardFailed = true;
		}
	}
</script>

<div class="min-h-dvh pb-6">
	<ScreenHeader title={view.name} onBack={onLeave} />

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		{#if view.role === 'organizer'}
			<Panel title="Invite Players">
				<div class="flex flex-wrap gap-3">
					<button type="button" class={inviteButton} onclick={() => void shareLink()}>
						Share Link
					</button>
					<button type="button" class={inviteButton} onclick={() => (showQr = true)}>
						QR Code
					</button>
				</div>
				{#if copied}
					<p class="mt-2 text-xs text-emerald-300">Link copied — paste it into your messenger.</p>
				{:else if clipboardFailed}
					<p class="mt-2 text-xs text-slate-400">
						Copying is blocked here — share this link instead:
					</p>
					<p class="mt-1 text-xs break-all text-sky-300">{inviteUrl}</p>
				{:else}
					<p class="mt-2 text-xs text-slate-400">
						Players open the link, enter their name and a Roster army, and take a seat.
					</p>
				{/if}
			</Panel>
		{/if}

		<Panel title="Tournament">
			<dl class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
					<dt class={label}>Join Code</dt>
					<dd class={value}>{view.code}</dd>
				</div>
				<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
					<dt class={label}>External Link</dt>
					<dd class={value}>
						{#if view.externalLink}
							<!-- The organizer's own external URL, not an app route: nothing to resolve(). -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								class="break-all text-sky-300 underline"
								href={view.externalLink}
								target="_blank"
								rel="noopener"
							>
								{view.externalLink}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{:else}
							<span class="text-slate-400">None</span>
						{/if}
					</dd>
				</div>
				<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
					<dt class={label}>Organizer</dt>
					<dd class={value}>{view.organizerName}</dd>
				</div>
				<div class="flex items-baseline justify-between gap-3">
					<dt class={label}>Pairing</dt>
					<dd class={value}>
						{view.manualPairing ? 'Assigned by the organizer' : 'Automatic — Swiss system'}
					</dd>
				</div>
			</dl>
		</Panel>

		<Panel title="Missions">
			<ul class="flex flex-col gap-2">
				{#each view.missionIds as missionId (missionId)}
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
			<ul class="flex flex-col gap-1.5">
				{#each view.tableNames as name, index (index)}
					<li class="flex items-baseline gap-2">
						<span class="w-6 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
						<span class="min-w-0 flex-1 truncate text-sm text-slate-100">{name}</span>
					</li>
				{/each}
			</ul>
		</Panel>

		<Panel title="Participants ({view.joinedCount}/{view.seats.length})">
			<ul class="flex flex-col gap-2">
				{#each view.seats as seat, index (index)}
					<li
						class="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
					>
						<span class="w-6 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
						{#if seat.name}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold text-slate-100">
									{seat.name}
									{#if seat.you}<span class="text-sky-300">(you)</span>{/if}
									{#if seat.organizer}<span class="text-xs text-slate-400">· organizer</span>{/if}
								</p>
								{#if seat.army}
									{@const faction = factions.find(
										(candidate) => candidate.id === seat.army?.factionId
									)}
									<span
										class="mt-0.5 block truncate text-xs {faction ? '' : 'text-slate-400'}"
										style={faction ? `color: ${faction.color}` : undefined}
									>
										{seat.army.name} · {faction?.name ?? seat.army.factionId}
									</span>
								{/if}
							</div>
						{:else}
							<p class="flex-1 text-sm text-slate-500">Empty seat</p>
						{/if}
					</li>
				{/each}
			</ul>
		</Panel>

		{#if view.role === 'organizer'}
			<button
				type="button"
				class="cursor-not-allowed rounded-xl border-2 border-slate-600/30 bg-slate-900/60 px-8 py-3 text-lg font-medium text-slate-600 backdrop-blur"
				disabled
			>
				Start Tournament
			</button>
			<p class="-mt-2 text-center text-xs text-slate-400">
				Pairings and match setup arrive with the next step.
			</p>
		{:else}
			<p class="text-center text-xs text-slate-400">
				The organizer starts the tournament once everyone is in.
			</p>
		{/if}
	</div>
</div>

{#if showQr}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) showQr = false;
		}}
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
		>
			<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Join via QR code</h2>
			<div class="mt-3">
				<QrCode value={inviteUrl} />
			</div>
			<p class="mt-3 text-xs break-all text-slate-400">{inviteUrl}</p>
			<button
				type="button"
				class="mt-4 w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/60"
				onclick={() => (showQr = false)}
			>
				Close
			</button>
		</div>
	</div>
{/if}
