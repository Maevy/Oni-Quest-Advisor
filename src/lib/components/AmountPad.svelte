<script lang="ts">
	import { PAD_AMOUNTS } from '$lib/domain';

	type Tone = 'damage' | 'heal';

	type Props = {
		/** Heading above the grid: what the amount is for, e.g. "Damage" or "Healing". */
		label: string;
		/** Damage reads red, healing green - the same hue each one's flying glyph wears. */
		tone: Tone;
		/** OK confirms the single tapped amount (1-9). */
		onConfirm: (amount: number) => void;
		/** Optional; the parent overlay's backdrop usually dismisses too. */
		onCancel?: () => void;
		/** OK button text. */
		confirmLabel?: string;
	};

	let { label, tone, onConfirm, onCancel, confirmLabel = 'OK' }: Props = $props();

	/** The one amount the player has tapped; OK is dead until there is one. */
	let selected = $state<number | null>(null);

	/** Literal class strings - Tailwind only sees whole names, never built by interpolation. */
	const TONE: Record<Tone, { label: string; ok: string; selected: string }> = {
		damage: {
			label: 'text-red-300',
			ok: 'border-red-500/50 bg-red-500/10 text-red-100 hover:bg-red-500/20',
			selected: 'border-red-400 bg-red-400/15 text-red-100'
		},
		heal: {
			label: 'text-emerald-300',
			ok: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
			selected: 'border-emerald-400 bg-emerald-400/15 text-emerald-100'
		}
	};

	const DIGIT = 'border-slate-600/60 bg-slate-950/60 text-slate-200 hover:border-slate-400';

	function confirm(): void {
		if (selected === null) return;
		onConfirm(selected);
	}
</script>

<div class="rounded-2xl border border-slate-600/60 bg-slate-900/95 p-4">
	<p class="text-xs tracking-wide uppercase {TONE[tone].label}">{label}</p>
	<div class="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={label}>
		{#each PAD_AMOUNTS as value (value)}
			<button
				type="button"
				aria-label={`${label} ${value}`}
				aria-pressed={selected === value}
				class="aspect-square rounded-xl border-2 text-lg font-semibold transition-colors
					duration-150 outline-none focus-visible:border-sky-200
					{selected === value ? TONE[tone].selected : DIGIT}"
				onclick={() => (selected = value)}
			>
				{value}
			</button>
		{/each}
	</div>
	<div class="mt-3 flex gap-2">
		{#if onCancel}
			<button
				type="button"
				class="rounded-lg border border-slate-600/60 px-3 py-2 text-sm text-slate-300
					outline-none focus-visible:border-sky-200"
				onclick={onCancel}
			>
				Cancel
			</button>
		{/if}
		<button
			type="button"
			disabled={selected === null}
			aria-label={selected === null
				? `${confirmLabel} - choose an amount first`
				: `${confirmLabel} ${selected}`}
			class="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors
				duration-150 outline-none focus-visible:border-sky-200
				disabled:cursor-not-allowed disabled:opacity-40 {TONE[tone].ok}"
			onclick={confirm}
		>
			{confirmLabel}
		</button>
	</div>
</div>
