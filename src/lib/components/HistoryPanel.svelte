<script lang="ts">
	import type { HistoryEntry } from '$lib/domain';

	type Props = {
		/** The match's log; the strip previews its latest line and counts the rest. */
		history: HistoryEntry[];
		/** Per action seq, the sentences the fold produced. */
		sentences: Record<number, string[]>;
		onOpen: () => void;
	};

	let { history, sentences, onOpen }: Props = $props();

	/** The standing actions, newest last: what the strip previews and the dialog lists. */
	let actions = $derived(history.filter((entry) => entry.kind === 'action'));
	let latest = $derived.by(() => {
		for (let index = actions.length - 1; index >= 0; index -= 1) {
			const entry = actions[index];
			if (entry.undoneBy !== null) continue;
			return entry;
		}
		return null;
	});
	let latestLine = $derived.by(() => {
		if (latest) return sentences[latest.seq]?.[0] ?? null;
		// Every standing action undone: the count still says something happened.
		return actions.length > 0 ? 'The latest interaction was undone' : null;
	});
</script>

<button
	type="button"
	class="flex w-full items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-4 py-2.5 text-left backdrop-blur transition hover:bg-slate-800/60 active:bg-slate-800/70"
	aria-haspopup="dialog"
	onclick={onOpen}
>
	<span class="shrink-0 text-sm font-semibold tracking-wide text-sky-300 uppercase">History</span>
	<span
		class="shrink-0 rounded-full border border-slate-600/60 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300 tabular-nums"
		>{actions.length}</span
	>
	<span class="min-w-0 flex-1 truncate text-[11px] text-slate-400">
		{latestLine ?? 'No interactions yet - the log opens with the first one'}
	</span>
</button>
