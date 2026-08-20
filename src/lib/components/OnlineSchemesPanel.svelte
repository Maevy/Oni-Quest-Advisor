<script lang="ts">
	import type {
		ChosenScheme,
		OnlineGamePhase,
		PlayerKey,
		PublicSeatState,
		SchemeCard
	} from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		mySeat: PlayerKey;
		myNickname: string;
		phase: OnlineGamePhase;
		myScheme: ChosenScheme | null;
		myCard: SchemeCard | null;
		myRevealIntent: boolean;
		myRevealed: boolean;
		opponentNickname: string;
		opponent: PublicSeatState | null;
		opponentCard: SchemeCard | null;
		onToggleRevealIntent: () => void;
		onSetSchemeChecked: (checkedIncrements: number) => void;
	};

	let {
		mySeat,
		myNickname,
		phase,
		myScheme,
		myCard,
		myRevealIntent,
		myRevealed,
		opponentNickname,
		opponent,
		opponentCard,
		onToggleRevealIntent,
		onSetSchemeChecked
	}: Props = $props();

	const ACCENTS = {
		player1: { border: 'border-sky-500/40', text: 'text-sky-300', title: 'text-sky-100' },
		player2: { border: 'border-orange-500/40', text: 'text-orange-300', title: 'text-orange-100' }
	} as const;

	let myAccent = $derived(ACCENTS[mySeat]);
	let opponentAccent = $derived(ACCENTS[mySeat === 'player1' ? 'player2' : 'player1']);
	let boxesEditable = $derived(phase === 'scoring');
</script>

<Panel title="Schemes">
	<div class="flex flex-col gap-3">
		<!-- Own scheme -->
		<div class="rounded-xl border p-3 {myAccent.border} bg-slate-900/40">
			<p class="mb-2 text-xs font-semibold {myAccent.text}">{myNickname} (you)</p>
			{#if myScheme && myCard}
				<div class="flex items-start justify-between gap-2">
					<div>
						<h3 class="font-semibold {myAccent.title}">{myCard.title}</h3>
						<p class="mt-1 text-sm text-slate-300">{myCard.ruleText}</p>
					</div>
					{#if myRevealed}
						<span
							class="shrink-0 rounded-full border border-emerald-500/50 px-2 py-0.5 text-xs text-emerald-300"
						>
							Revealed
						</span>
					{:else if phase === 'reveal'}
						<button
							type="button"
							class="shrink-0 rounded-lg border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10 active:bg-emerald-500/20"
							onclick={onToggleRevealIntent}
						>
							{myRevealIntent ? 'Undo reveal' : 'Reveal'}
						</button>
					{/if}
				</div>
				{#if myRevealIntent && !myRevealed}
					<p class="mt-2 text-xs text-emerald-300">
						Reveal intent set — the opponent sees it once scoring starts.
					</p>
				{/if}
				<div class="mt-3">
					{#if myRevealed}
						<IncrementBoxes
							count={myCard.maxIncrements}
							checkedCount={myScheme.checkedIncrements}
							disabled={!boxesEditable}
							onSetChecked={onSetSchemeChecked}
						/>
					{:else if phase === 'reveal'}
						<IncrementBoxes
							count={myCard.maxIncrements}
							checkedCount={myScheme.checkedIncrements}
							disabled
							onSetChecked={() => {}}
						/>
					{:else}
						<p class="text-xs text-slate-500">
							Hidden schemes can't be scored — reveal your scheme to unlock its boxes.
						</p>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-slate-400 italic">No scheme</p>
			{/if}
		</div>

		<!-- Opponent scheme -->
		<div class="rounded-xl border p-3 {opponentAccent.border} bg-slate-900/40">
			<p class="mb-2 text-xs font-semibold {opponentAccent.text}">{opponentNickname}</p>
			{#if opponent?.schemeRevealed && opponent.revealedScheme && opponentCard}
				<h3 class="font-semibold {opponentAccent.title}">{opponentCard.title}</h3>
				<p class="mt-1 text-sm text-slate-300">{opponentCard.ruleText}</p>
				<div class="mt-3">
					<IncrementBoxes
						count={opponentCard.maxIncrements}
						checkedCount={opponent.revealedScheme.checkedIncrements}
						disabled
						onSetChecked={() => {}}
					/>
				</div>
			{:else if opponent?.hasScheme}
				<p class="text-sm text-slate-400 italic">Hidden Scheme</p>
			{:else}
				<p class="text-sm text-slate-400 italic">No schemes</p>
			{/if}
		</div>
	</div>
</Panel>
