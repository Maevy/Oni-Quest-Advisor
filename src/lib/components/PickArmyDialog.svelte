<script lang="ts">
	import type { ArmyFactionConfig, ArmyImportError, SavedArmy } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		/** Saved armies of whichever format the caller lists, newest first. */
		armies: SavedArmy[];
		factions: ArmyFactionConfig[];
		/** One line under the heading — what attaching the list means here. */
		note?: string;
		/**
		 * Present only on the single-phone slots, where pasting a code beats building a list and
		 * naming a save before you can play. Returns null on success, the reason otherwise.
		 */
		onImportCode?: (code: string) => ArmyImportError | null;
		/** Offered when there is nothing saved to pick yet. */
		onCreate?: () => void;
		onPick: (army: SavedArmy) => void;
		onCancel: () => void;
	};

	let {
		armies,
		factions,
		note = 'The army is attached to this run as it is now.',
		onImportCode,
		onCreate,
		onPick,
		onCancel
	}: Props = $props();

	const ERROR_MESSAGES: Record<ArmyImportError, string> = {
		invalid: 'This is not a valid army code.',
		'roster-mismatch': 'This code was created with a different roster version.',
		'wrong-format': 'This is a Roster list; a mission run fields a Standard one.'
	};

	let code = $state('');
	let error = $state<string | null>(null);

	$effect(() => onEscapeKey(onCancel));

	function importCode(): void {
		if (!onImportCode) return;
		try {
			const result = onImportCode(code);
			error = result ? ERROR_MESSAGES[result] : null;
		} catch {
			// E.g. a stale hot-reloaded store in dev - surface it instead of a dead button.
			error = 'Import failed — please reload the app and try again.';
		}
	}

	function factionName(factionId: string): string {
		return factions.find((faction) => faction.id === factionId)?.name ?? factionId;
	}

	function factionColor(factionId: string): string {
		return factions.find((faction) => faction.id === factionId)?.color ?? 'text-slate-200';
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
>
	<div
		class="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<h2 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">Pick Army</h2>
		<p class="mt-1 text-xs text-slate-200">{note}</p>
		{#if armies.length > 0}
			<ul class="mt-3 flex flex-col gap-2">
				{#each armies as army (army.id)}
					<li>
						<button
							type="button"
							class="w-full rounded-xl border border-slate-600/40 bg-slate-900/60 px-3 py-2.5 text-left transition hover:bg-slate-700/40 active:bg-slate-700/60"
							onclick={() => onPick(army)}
						>
							<span class="block text-sm font-semibold text-slate-100">{army.name}</span>
							<span class="mt-0.5 block text-xs {factionColor(army.factionId)}">
								{factionName(army.factionId)}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-3 text-xs text-slate-400">No saved armies yet.</p>
		{/if}

		{#if onImportCode}
			<div class="mt-4 border-t border-slate-700/50 pt-4">
				<p class="text-xs font-semibold tracking-wide text-slate-100 uppercase">
					Or import an army code
				</p>
				<input
					type="text"
					bind:value={code}
					oninput={() => (error = null)}
					placeholder="Paste the army code"
					aria-label="Army code"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					class="mt-2 w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2.5
						text-center text-sm text-sky-100 outline-none placeholder:text-slate-400
						focus:border-sky-400"
				/>
				<button
					type="button"
					disabled={code.trim() === ''}
					class="mt-2 w-full rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3
						py-2.5 text-sm font-medium text-emerald-100 transition
						enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20
						disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
					onclick={importCode}
				>
					Import Army
				</button>
				{#if error}
					<p class="mt-2 text-xs text-red-400" role="alert">{error}</p>
				{/if}
			</div>
		{/if}

		{#if onCreate}
			<button
				type="button"
				class="mt-3 w-full rounded-xl border border-sky-500/50 bg-slate-900/60 px-3 py-2
					text-sm text-sky-100 transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onCreate}
			>
				Create an army
			</button>
		{/if}

		<button
			type="button"
			class="mt-4 w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800/60"
			onclick={onCancel}
		>
			Cancel
		</button>
	</div>
</div>
