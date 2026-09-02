<script lang="ts">
	import type {
		ArmyCodeDecodeError,
		ArmyFactionConfig,
		ArmyFormat,
		SavedArmy,
		SavedArmyGroup
	} from '$lib/domain';
	import ConfirmDialog from './ConfirmDialog.svelte';

	type Props = {
		groups: SavedArmyGroup[];
		factions: ArmyFactionConfig[];
		/** Which format's saves are listed. */
		filter: ArmyFormat;
		onSetFilter: (format: ArmyFormat) => void;
		/** Loads the saved army; null on success, the decode error otherwise. */
		onLoad: (army: SavedArmy) => ArmyCodeDecodeError | null;
		onDelete: (army: SavedArmy) => void;
		onCancel: () => void;
	};

	let { groups, factions, filter, onSetFilter, onLoad, onDelete, onCancel }: Props = $props();

	function filterTabClasses(target: ArmyFormat): string {
		return filter === target ? 'bg-sky-500/20 text-sky-100' : 'text-slate-400';
	}

	const ERROR_MESSAGES: Record<ArmyCodeDecodeError, string> = {
		invalid: 'This saved army is not valid anymore.',
		'roster-mismatch': 'This saved army was created with a different roster version.'
	};

	let error = $state<{ armyId: string; message: string } | null>(null);
	let deleteCandidate = $state<SavedArmy | null>(null);

	function factionOf(factionId: string): ArmyFactionConfig | undefined {
		return factions.find((faction) => faction.id === factionId);
	}

	function load(army: SavedArmy): void {
		const result = onLoad(army);
		error = result ? { armyId: army.id, message: ERROR_MESSAGES[result] } : null;
	}

	function cancelOrUnwind(): void {
		if (deleteCandidate) deleteCandidate = null;
		else onCancel();
	}
</script>

<div
	role="presentation"
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') cancelOrUnwind();
	}}
>
	<div
		class="flex max-h-[80dvh] w-full max-w-sm flex-col rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<h2 class="text-center text-lg font-semibold text-slate-100">Load Army</h2>
		<div class="mt-3 flex overflow-hidden rounded-xl border border-slate-600/60 bg-slate-900/60">
			<button
				type="button"
				class={'flex-1 px-4 py-2 text-sm font-semibold transition ' + filterTabClasses('standard')}
				onclick={() => onSetFilter('standard')}
			>
				Standard
			</button>
			<button
				type="button"
				class={'flex-1 px-4 py-2 text-sm font-semibold transition ' +
					filterTabClasses('tournament')}
				onclick={() => onSetFilter('tournament')}
			>
				Roster
			</button>
		</div>
		{#if groups.length === 0}
			<p class="mt-4 text-center text-sm text-slate-500">
				No saved {filter === 'standard' ? 'Standard' : 'Roster'} armies yet.
			</p>
		{:else}
			<div class="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				{#each groups as group (group.factionId)}
					<div>
						<h3 class="mb-1.5">
							<span
								class="inline-block rounded-md border-2 bg-slate-900/50 px-2 py-0.5 text-xs font-semibold tracking-wide text-slate-100 uppercase"
								style="border-color: {factionOf(group.factionId)?.color ?? '#475569'}"
							>
								{factionOf(group.factionId)?.name ?? group.factionId}
							</span>
						</h3>
						<div class="space-y-1.5">
							{#each group.armies as army (army.id)}
								<div>
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											class="min-w-0 flex-1 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5 text-left transition hover:bg-slate-800/60 active:bg-slate-800/80"
											onclick={() => load(army)}
										>
											<span class="block truncate font-medium text-slate-100">
												{army.name}
											</span>
										</button>
										<button
											type="button"
											aria-label={'Delete ' + army.name}
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition hover:bg-red-500/10 active:bg-red-500/20"
											onclick={() => (deleteCandidate = army)}
										>
											✕
										</button>
									</div>
									{#if error?.armyId === army.id}
										<p class="mt-1 text-xs text-red-400" role="alert">{error.message}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
		<div class="mt-4 flex justify-center">
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onCancel}
			>
				Cancel
			</button>
		</div>
	</div>
</div>

{#if deleteCandidate}
	<ConfirmDialog
		text={'Delete "' + deleteCandidate.name + '"?'}
		confirmLabel="Yes"
		cancelLabel="No"
		onConfirm={() => {
			const candidate = deleteCandidate;
			if (!candidate) return;
			onDelete(candidate);
			deleteCandidate = null;
			error = null;
		}}
		onCancel={() => (deleteCandidate = null)}
	/>
{/if}
