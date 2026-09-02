<script lang="ts">
	type Props = {
		/** Persists the army under the given name; null on success, the error otherwise. */
		onSave: (name: string) => string | null;
		onCancel: () => void;
	};

	let { onSave, onCancel }: Props = $props();

	let name = $state('');
	let error = $state<string | null>(null);

	function save(): void {
		error = onSave(name);
	}
</script>

<div
	role="presentation"
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') onCancel();
	}}
>
	<div
		class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<h2 class="text-center text-lg font-semibold text-slate-100">Save Army</h2>
		<input
			type="text"
			bind:value={name}
			oninput={() => (error = null)}
			placeholder="Name this army list"
			aria-label="Army list name"
			maxlength="40"
			autocomplete="off"
			autocapitalize="words"
			spellcheck="false"
			class="mt-4 w-full rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-center text-sm text-sky-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
		/>
		{#if error}
			<p class="mt-2 text-center text-sm text-red-400" role="alert">{error}</p>
		{/if}
		<div class="mt-4 flex justify-center gap-3">
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onCancel}
			>
				Cancel
			</button>
			<button
				type="button"
				disabled={name.trim() === ''}
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-emerald-300 transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
				onclick={save}
			>
				Save
			</button>
		</div>
	</div>
</div>
