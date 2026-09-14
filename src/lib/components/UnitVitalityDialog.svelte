<script lang="ts">
	import type { ArmyRosterRow, UnitStatus, UnitVitality } from '$lib/domain';
	import { toggleUnitStatus, UNIT_STATUSES, UNIT_STATUS_LABELS } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';
	import Panel from './Panel.svelte';
	import StatusGlyph from './StatusGlyph.svelte';
	import VitalityMarker from './VitalityMarker.svelte';
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
	// svelte-ignore state_referenced_locally
	let statuses = $state<UnitStatus[]>(vitality.statuses ?? []);

	/** Overheal reaches double the base Life; stamina has no such headroom. */
	let baseHp = $derived(row.effectiveStats.HP ?? 0);
	let baseSta = $derived(row.effectiveStats.STA ?? 0);
	let hpCap = $derived(baseHp * 2);

	$effect(() => onEscapeKey(onCancel));

	/** Circular step buttons; the sign sits inside the marker glyph they carry. */
	const stepButton =
		'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-600/60 bg-slate-800/80 transition active:bg-slate-700/80 disabled:opacity-30';
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
>
	<div
		class="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur"
	>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			<div class="flex items-center gap-3">
				{#if row.icon}
					<img
						src={row.icon}
						alt=""
						class="h-12 w-12 shrink-0 rounded-lg border border-slate-700/50 object-contain"
					/>
				{/if}
				<p class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{row.name}</p>
			</div>

			<div class="mt-4 flex flex-col gap-3">
				<Panel title="Life">
					<div class="flex items-center justify-between gap-2">
						<button
							type="button"
							class={stepButton}
							aria-label={'Deal 1 damage to ' + row.name}
							disabled={hp <= 0}
							onclick={() => (hp = Math.max(0, hp - 1))}
						>
							<VitalityMarker kind="hp" state="full" sign="minus" size="h-7 w-7" />
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
							<VitalityMarker kind="hp" state="full" sign="plus" size="h-7 w-7" />
						</button>
					</div>
				</Panel>

				<Panel title="Stamina">
					<div class="flex items-center justify-between gap-2">
						<button
							type="button"
							class={stepButton}
							aria-label={'Spend 1 stamina of ' + row.name}
							disabled={sta <= 0}
							onclick={() => (sta = Math.max(0, sta - 1))}
						>
							<VitalityMarker kind="stamina" state="full" sign="minus" size="h-7 w-7" />
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
							<VitalityMarker kind="stamina" state="full" sign="plus" size="h-7 w-7" />
						</button>
					</div>
				</Panel>
				<Panel title="Statuses">
					<div class="flex flex-wrap justify-center gap-x-2 gap-y-3">
						{#each UNIT_STATUSES as status (status)}
							{@const on = statuses.includes(status)}
							<button
								type="button"
								class="flex flex-col items-center gap-1"
								aria-pressed={on}
								aria-label={UNIT_STATUS_LABELS[status]}
								onclick={() => (statuses = toggleUnitStatus(statuses, status))}
							>
								<span class="text-[10px] leading-none whitespace-nowrap text-slate-100">
									{UNIT_STATUS_LABELS[status]}
								</span>
								<span
									class="flex h-11 w-11 items-center justify-center rounded-full border transition active:bg-slate-700/80 {on
										? 'border-slate-500/70 bg-slate-700/60'
										: 'border-slate-600/60 bg-slate-800/80'}"
								>
									<StatusGlyph {status} active={on} size="h-6 w-6" />
								</span>
							</button>
						{/each}
					</div>
				</Panel>
			</div>
		</div>

		<div class="mt-5 flex shrink-0 justify-center gap-3">
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
				onclick={() => onAccept({ hp, sta, statuses })}
			>
				Accept
			</button>
		</div>
	</div>
</div>
