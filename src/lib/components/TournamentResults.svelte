<script lang="ts">
	import type { TournamentEventView } from '$lib/domain';
	import Panel from './Panel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import { placeLabel, victoryAccent } from './victoryAccent';

	type Props = {
		view: TournamentEventView;
		error?: string | null;
		/**
		 * Both roles' exit, and a local one: the event is over, so there is no seat to free — and
		 * freeing one would drop that player out of the standing the report window keeps.
		 */
		onLeave: () => void;
	};

	let { view, error = null, onLeave }: Props = $props();

	const isOrganizer = $derived(view.role === 'organizer');
	const rounds = $derived(view.roundsPlayed);
	const roundWord = $derived(rounds === 1 ? 'round' : 'rounds');
</script>

<div class="min-h-dvh pb-6">
	<!-- No Return: the event concluded, so the only way off it is the exit below, and a red arrow
	     that does the same thing as a button twice its size would only compete with it. -->
	<ScreenHeader title={view.name} />

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		<div class="text-center">
			<p
				class="text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(252,211,77,0.45)]"
			>
				Tournament Concluded
			</p>
			<p class="mt-1 text-sm text-slate-200">
				After {rounds}
				{roundWord} of {view.name}
			</p>
			{#if view.externalLink}
				<!-- The organizer's own external URL, not an app route: nothing to resolve(). -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={view.externalLink}
					target="_blank"
					rel="noopener"
					class="mt-1 inline-block text-xs break-all text-sky-300 underline"
				>
					{view.externalLink}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>

		{#if error}
			<div
				class="rounded-xl border border-red-500/40 bg-slate-800/40 p-3 text-sm text-red-300 backdrop-blur"
			>
				{error}
			</div>
		{/if}

		<Panel title="Final Standing" titleClass="text-amber-300">
			<ol class="flex flex-col gap-2">
				{#each view.standings as row (row.seatIndex)}
					{@const accent = victoryAccent(row.place)}
					<li
						class="rounded-xl border-2 px-3 py-2.5 {accent.border} {accent.background} {accent.shadow}"
					>
						<div class="flex items-baseline gap-3">
							<span class="w-10 shrink-0 text-sm font-bold {accent.text}">
								{placeLabel(row.place)}
							</span>
							<span class="min-w-0 flex-1 truncate font-semibold {accent.text}">
								{row.name}
								{#if view.seats[row.seatIndex]?.you}
									<span class="text-xs text-sky-300">(you)</span>
								{/if}
								{#if view.seats[row.seatIndex]?.organizer}
									<span class="text-xs text-slate-300">organizer</span>
								{/if}
							</span>
							<span class="shrink-0 text-lg font-extrabold tabular-nums {accent.points}">
								{row.victoryPoints}
							</span>
						</div>
					</li>
				{:else}
					<li class="text-sm text-slate-200 italic">Nobody played this tournament.</li>
				{/each}
			</ol>
			<p class="mt-3 text-xs text-slate-200">
				Victory points from every round played. Equal totals share a place.
			</p>
		</Panel>

		{#if isOrganizer}
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onLeave}
			>
				End Tournament
			</button>
			<!-- Inert on purpose: the report is the next iteration of this feature, and the rows it
			     needs are what the 48-hour retention window exists to keep. -->
			<button
				type="button"
				class="rounded-xl border-2 border-slate-600/60 bg-slate-900/60 px-6 py-3 font-semibold text-slate-400 backdrop-blur"
				disabled
			>
				Prepare Tournament Report
			</button>
			<p class="-mt-2 text-center text-xs text-slate-200">
				This event's results are kept for 48 hours so a report can be generated.
			</p>
		{:else}
			<button
				type="button"
				class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-6 py-3 font-semibold text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onLeave}
			>
				Leave Tournament
			</button>
		{/if}
	</div>
</div>
