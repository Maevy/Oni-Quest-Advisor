<script lang="ts">
	import type { ArmyRosterRow, UnitVitality } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';
	import VitalityTrack from './VitalityTrack.svelte';

	type Props = {
		row: ArmyRosterRow;
		/** The copy's committed Life and stamina when the menu opened. */
		vitality: UnitVitality;
		onAccept: (vitality: UnitVitality) => void;
		onCancel: () => void;
	};

	let { row, vitality, onAccept, onCancel }: Props = $props();

	// Pending values: seeded once at open, then owned here until Accept or Cancel. The
	// component mounts per open, so capturing the prop's initial value is the intent.
	// svelte-ignore state_referenced_locally
	let hp = $state(vitality.hp);
	// svelte-ignore state_referenced_locally
	let sta = $state(vitality.sta);

	/** Overheal reaches double the base Life; stamina has no such headroom. */
	let baseHp = $derived(row.effectiveStats.HP ?? 0);
	let baseSta = $derived(row.effectiveStats.STA ?? 0);
	let hpCap = $derived(baseHp * 2);

	$effect(() => onEscapeKey(onCancel));

	const stepButton =
		'flex h-9 w-9 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-slate-600/60 bg-slate-800/80 text-lg font-bold text-slate-100 transition active:bg-slate-700/80 disabled:opacity-30';
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
>
	<div
		class="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<div class="flex items-center gap-3">
			{#if row.icon}
				<img
					src={row.icon}
					alt=""
					class="h-12 w-12 shrink-0 rounded-lg border border-slate-700/50 object-contain"
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-semibold text-slate-100">{row.name}</p>
				<p class="text-xs text-slate-400">Life and stamina</p>
			</div>
		</div>

		<div class="mt-4 flex flex-col gap-3">
			<div class="flex items-center justify-between gap-2">
				<button
					type="button"
					class={stepButton}
					aria-label={'Deal 1 damage to ' + row.name}
					disabled={hp <= 0}
					onclick={() => (hp = Math.max(0, hp - 1))}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-3.5 w-3.5 fill-red-500 stroke-red-500"
						aria-hidden="true"
					>
						<path
							d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
							stroke-width="1.5"
						/>
					</svg>
					<span aria-hidden="true">−</span>
				</button>
				<div class="min-w-0 flex-1">
					<VitalityTrack kind="hp" current={hp} max={baseHp} large centered />
				</div>
				<button
					type="button"
					class={stepButton}
					aria-label={'Heal ' + row.name + ' by 1'}
					disabled={hp >= hpCap}
					onclick={() => (hp = Math.min(hpCap, hp + 1))}
				>
					<span aria-hidden="true">+</span>
				</button>
			</div>

			<div class="flex items-center justify-between gap-2">
				<button
					type="button"
					class={stepButton}
					aria-label={'Spend 1 stamina of ' + row.name}
					disabled={sta <= 0}
					onclick={() => (sta = Math.max(0, sta - 1))}
				>
					<span
						class="h-3.5 w-3.5 rounded-full border border-yellow-400 bg-yellow-400"
						aria-hidden="true"
					></span>
					<span aria-hidden="true">−</span>
				</button>
				<div class="min-w-0 flex-1">
					<VitalityTrack kind="stamina" current={sta} max={baseSta} large centered />
				</div>
				<button
					type="button"
					class={stepButton}
					aria-label={'Recover 1 stamina of ' + row.name}
					disabled={sta >= baseSta}
					onclick={() => (sta = Math.min(baseSta, sta + 1))}
				>
					<span aria-hidden="true">+</span>
				</button>
			</div>
		</div>

		<div class="mt-5 flex justify-center gap-3">
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onCancel}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-6 py-2 font-semibold text-emerald-300 transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20"
				onclick={() => onAccept({ hp, sta })}
			>
				Accept
			</button>
		</div>
	</div>
</div>
