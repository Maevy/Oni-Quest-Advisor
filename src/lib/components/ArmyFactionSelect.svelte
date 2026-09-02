<script lang="ts">
	import type { ArmyCodeDecodeError, ArmyFactionConfig, ArmyFactionId } from '$lib/domain';

	type Props = {
		factions: ArmyFactionConfig[];
		onSelect: (factionId: ArmyFactionId) => void;
		/** Imports a pasted army code; null on success, the error otherwise. */
		onImportCode: (code: string) => ArmyCodeDecodeError | null;
		onLoadArmy: () => void;
		onReturn: () => void;
	};

	let { factions, onSelect, onImportCode, onLoadArmy, onReturn }: Props = $props();

	const ERROR_MESSAGES: Record<ArmyCodeDecodeError, string> = {
		invalid: 'This is not a valid army code.',
		'roster-mismatch': 'This code was created with a different roster version.'
	};

	let code = $state('');
	let error = $state<string | null>(null);

	function importArmy(): void {
		try {
			const result = onImportCode(code);
			error = result ? ERROR_MESSAGES[result] : null;
		} catch {
			// E.g. a stale hot-reloaded store in dev - surface it instead of a dead button.
			error = 'Import failed — please reload the app and try again.';
		}
	}
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
	<button
		type="button"
		class="fixed top-4 left-4 rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={onReturn}
	>
		← Back
	</button>
	<div class="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
		<div class="flex w-full flex-col items-center gap-2">
			<h1
				class="text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)]"
			>
				Army Builder
			</h1>
			<p class="text-slate-100">Choose your faction.</p>
		</div>

		<div class="grid w-full grid-cols-3 gap-3">
			{#each factions as faction (faction.id)}
				<button
					type="button"
					class="flex flex-col items-center gap-2 rounded-xl border-2 bg-slate-900/60 px-2 py-3 backdrop-blur transition hover:bg-slate-800/60 active:bg-slate-800/80"
					style="border-color: {faction.color}; color: {faction.color}"
					onclick={() => onSelect(faction.id)}
				>
					<img src={faction.logo} alt="{faction.name} logo" class="h-14 w-14 object-contain" />
					<span class="text-xs leading-tight font-semibold">{faction.name}</span>
				</button>
			{/each}
		</div>

		<div class="flex w-full flex-col items-center gap-3">
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
				class="w-full max-w-sm rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-center text-sm text-sky-100 backdrop-blur outline-none placeholder:text-slate-500 focus:border-sky-400"
			/>
			<button
				type="button"
				disabled={code.trim() === ''}
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={importArmy}
			>
				Import Army
			</button>
			{#if error}
				<p class="text-sm text-red-400" role="alert">{error}</p>
			{/if}
			<button
				type="button"
				class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/10 active:bg-sky-500/20"
				onclick={onLoadArmy}
			>
				Load Army
			</button>
		</div>
	</div>
</div>
