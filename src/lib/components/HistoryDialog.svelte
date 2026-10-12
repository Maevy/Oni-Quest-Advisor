<script lang="ts">
	import type { HistoryAction, HistoryEntry } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';
	import { PLAYER_SEATS, seatAccent } from './playerAccent';

	type Props = {
		/** The match's log in order; revert rows stay out - the action they walk back carries it. */
		history: HistoryEntry[];
		/** Per action seq, the sentences the fold produced: the commit, then the forced States. */
		sentences: Record<number, string[]>;
		/** The latest standing action of the seat holding this device; null hides every Undo. */
		undoableSeq: number | null;
		onUndo: (seq: number) => void;
		onClose: () => void;
	};

	let { history, sentences, undoableSeq, onUndo, onClose }: Props = $props();

	$effect(() => onEscapeKey(onClose));

	let rounds = $derived.by(() => {
		const groups: Array<{ round: number; entries: HistoryAction[] }> = [];
		for (const entry of history) {
			if (entry.kind !== 'action') continue;
			const group = groups.find((candidate) => candidate.round === entry.round);
			if (group) group.entries.push(entry);
			else groups.push({ round: entry.round, entries: [entry] });
		}
		return groups;
	});
</script>

<!-- The backdrop is the click-outside, as a button so the keyboard can reach it too: the dialog
     renders at the screen root, because the tracker's sliding strip carries a transform that
     would trap a fixed overlay in one pane. -->
<button
	type="button"
	class="fixed inset-0 z-50 cursor-default bg-slate-950/70 backdrop-blur-sm"
	aria-label="Close interaction history"
	onclick={onClose}
></button>
<div class="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Interaction history"
		class="pointer-events-auto flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl"
	>
		<header class="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
			<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">
				Interaction history
			</h2>
			<button
				type="button"
				class="rounded-lg border border-slate-600/60 px-2 py-1 text-sm text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800/80"
				aria-label="Close history"
				onclick={onClose}
			>
				×
			</button>
		</header>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
			{#if rounds.length === 0}
				<p class="text-sm text-slate-400">
					Nothing has happened yet. The log opens with the first interaction of the match.
				</p>
			{/if}
			{#each rounds as group (group.round)}
				<p class="mt-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase first:mt-0">
					Round {group.round}
				</p>
				<ul class="mt-1.5 flex flex-col gap-1.5">
					{#each group.entries as entry (entry.seq)}
						{@const accent = seatAccent(PLAYER_SEATS[entry.actor].hue)}
						<li
							class="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2 transition {entry.undoneBy !==
							null
								? 'opacity-60'
								: ''}"
						>
							<div class="flex items-start gap-2">
								<span
									class="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {accent.wash} {accent.text}"
									>{entry.actor === 'player1' ? 'P1' : 'P2'}</span
								>
								<div class="min-w-0 flex-1">
									{#each sentences[entry.seq] ?? [] as line (line)}
										<p
											class="text-[12px] leading-snug text-slate-200 {entry.undoneBy !== null
												? 'line-through'
												: ''}"
										>
											{line}
										</p>
									{/each}
									{#if entry.undoneBy !== null}
										<p class="mt-0.5 text-[10px] text-slate-500">undone</p>
									{/if}
								</div>
								{#if entry.seq === undoableSeq}
									<button
										type="button"
										class="shrink-0 rounded-lg border border-amber-500/60 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/10 active:bg-amber-500/20"
										onclick={() => onUndo(entry.seq)}
									>
										Undo
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	</div>
</div>
