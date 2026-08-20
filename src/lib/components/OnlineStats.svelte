<script lang="ts">
	import { MAX_ROUND } from '$lib/domain';
	import type { ChosenScheme, Faction, OnlineGameView, SchemeCard } from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		view: OnlineGameView;
		factions: Faction[];
		schemes: SchemeCard[];
		onReturnToMenu: () => void;
	};

	let { view, factions, schemes, onReturnToMenu }: Props = $props();

	type SeatInfo = {
		nickname: string;
		factionId: string | null;
		scheme: ChosenScheme | null;
		card: SchemeCard | null;
	};

	let selfInfo = $derived<SeatInfo>({
		nickname: view.self.nickname,
		factionId:
			view.self.progress.scheme?.factionId ?? view.self.progress.schemeDraft.factionId ?? null,
		scheme: view.self.progress.scheme,
		card: view.self.progress.scheme
			? (schemes.find((card) => card.id === view.self.progress.scheme?.schemeId) ?? null)
			: null
	});
	let opponentInfo = $derived<SeatInfo | null>(
		view.opponent
			? {
					nickname: view.opponent.nickname,
					factionId: view.opponent.factionId,
					scheme: view.opponent.revealedScheme,
					card: view.opponent.revealedScheme
						? (schemes.find((card) => card.id === view.opponent?.revealedScheme?.schemeId) ?? null)
						: null
				}
			: null
	);

	function seatInfo(seat: 'player1' | 'player2'): SeatInfo | null {
		if (view.seat === seat) return selfInfo;
		return opponentInfo;
	}

	function factionName(factionId: string | null): string {
		return factions.find((faction) => faction.id === factionId)?.name ?? '—';
	}

	let winnerInfo = $derived(view.winner && view.winner !== 'draw' ? seatInfo(view.winner) : null);
	let rounds = $derived(Array.from({ length: MAX_ROUND }, (_unused, index) => index + 1));
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-4 py-6">
	<div class="text-center">
		{#if view.winner === 'draw'}
			<p
				class="text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)]"
			>
				Draw
			</p>
		{:else if winnerInfo}
			<p
				class="text-3xl font-extrabold tracking-tight drop-shadow-[0_0_16px_rgba(56,189,248,0.55)] {view.winner ===
				'player1'
					? 'text-sky-300'
					: 'text-orange-300'}"
			>
				Victory for<br />
				{factionName(winnerInfo.factionId)}<br />
				{winnerInfo.nickname}
			</p>
		{/if}
	</div>

	<Panel title="Round Statistics">
		<table class="w-full text-sm">
			<thead>
				<tr class="text-left">
					<th class="py-1 pr-2 font-semibold text-slate-400">Round</th>
					<th class="py-1 pr-2 font-semibold text-sky-300">
						{seatInfo('player1')?.nickname ?? 'Player 1'}
					</th>
					<th class="py-1 font-semibold text-orange-300">
						{seatInfo('player2')?.nickname ?? 'Player 2'}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each rounds as round (round)}
					{@const snapshot = view.roundSnapshots[round]}
					<tr class="border-t border-slate-700/50">
						<td class="py-1.5 pr-2 text-slate-300">{round}</td>
						<td class="py-1.5 pr-2 text-sky-100">{snapshot?.player1 ?? '—'}</td>
						<td class="py-1.5 text-orange-100">{snapshot?.player2 ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Panel>

	<!-- All schemes are auto-revealed at finish, so both cards are shown for traceability. -->
	{#each ['player1', 'player2'] as seatKey (seatKey)}
		{@const info = seatInfo(seatKey === 'player1' ? 'player1' : 'player2')}
		{#if info}
			<div
				class="rounded-2xl border p-4 backdrop-blur {seatKey === 'player1'
					? 'border-sky-500/30'
					: 'border-orange-500/30'} bg-slate-800/40"
			>
				<p
					class="mb-2 text-xs font-semibold {seatKey === 'player1'
						? 'text-sky-300'
						: 'text-orange-300'} uppercase"
				>
					{info.nickname} — {factionName(info.factionId)}
				</p>
				{#if info.scheme && info.card}
					<h3 class="font-semibold text-slate-100">{info.card.title}</h3>
					<p class="mt-1 text-sm text-slate-300">{info.card.ruleText}</p>
					<div class="mt-2">
						<IncrementBoxes
							count={info.card.maxIncrements}
							checkedCount={info.scheme.checkedIncrements}
							disabled
							onSetChecked={() => {}}
						/>
					</div>
				{:else}
					<p class="text-sm text-slate-400 italic">No scheme</p>
				{/if}
			</div>
		{/if}
	{/each}

	<button
		type="button"
		class="mt-2 rounded-xl bg-sky-300 px-6 py-2.5 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={onReturnToMenu}
	>
		Return to Main Menu
	</button>
</div>
