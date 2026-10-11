<script lang="ts">
	import type { UnitStatus } from '$lib/domain';
	import {
		RING_STATUSES,
		UNIT_STATUS_LABELS,
		statusLockedAtZeroHp,
		toggleUnitStatus
	} from '$lib/domain';
	import StatusGlyph from './StatusGlyph.svelte';

	type Props = {
		/** The States the target already carries; the draft opens on them. */
		statuses: UnitStatus[];
		/** The target's current Life: at zero the rules force certain States, so they lock. */
		hp: number;
		/** Undead models have no Incapacitated and fall straight to Dead. */
		undead?: boolean;
		/** Accept emits the edited draft for the parent to commit. */
		onAccept: (draft: UnitStatus[]) => void;
		/** Optional; the parent overlay's backdrop usually dismisses too. */
		onCancel?: () => void;
		/** Heading above the grid. */
		title?: string;
		/** Accept button text. */
		acceptLabel?: string;
	};

	let {
		statuses,
		hp,
		undead = false,
		onAccept,
		onCancel,
		title = 'Assign / remove States',
		acceptLabel = 'Accept'
	}: Props = $props();

	// The picker edits a draft, so a tap that is never accepted writes nothing. `draft` stays
	// null until the first toggle and `states` reads through to the carried States until then -
	// which keeps the draft the single source of truth once editing starts, without capturing
	// the prop in a $state initializer (the parent mounts this fresh per interaction, so there
	// is nothing to track).
	let draft = $state<UnitStatus[] | null>(null);
	let states = $derived(draft ?? statuses);
	/** The State the player is touching: its name reads below the grid, the box's tooltip. */
	let hint = $state<string | null>(null);

	// The zero-Life States are locked rather than offered: the store re-applies them to every
	// commit, so an orb that let you clear one would only ever show the tap undone. The lock
	// reads the target's carried States, not the draft - what the rules force is not a function
	// of what the player is mid-way through choosing.
	function toggle(status: UnitStatus): void {
		if (statusLockedAtZeroHp(status, hp, undead, statuses)) return;
		draft = toggleUnitStatus(states, status);
		hint = UNIT_STATUS_LABELS[status];
	}
</script>

<div class="rounded-2xl border border-slate-600/60 bg-slate-900/95 p-4">
	<p class="text-xs tracking-wide text-slate-400 uppercase">{title}</p>
	<div class="mt-3 grid grid-cols-5 gap-2" role="group" aria-label={title}>
		{#each RING_STATUSES as status (status)}
			{@const on = states.includes(status)}
			{@const locked = statusLockedAtZeroHp(status, hp, undead, statuses)}
			<button
				type="button"
				disabled={locked}
				aria-pressed={on}
				aria-label={locked
					? `${UNIT_STATUS_LABELS[status]} - forced while Life is 0`
					: `${on ? 'Remove' : 'Assign'} ${UNIT_STATUS_LABELS[status]}`}
				class="flex aspect-square items-center justify-center rounded-full border-2
					bg-slate-900 transition-all duration-150 outline-none
					focus-visible:border-sky-200
					{on ? 'border-yellow-300 shadow-[0_0_12px_2px_rgba(253,224,71,0.5)]' : 'border-slate-500'}
					{locked ? 'cursor-not-allowed opacity-50' : 'hover:border-yellow-300'}"
				onclick={() => toggle(status)}
				onmouseenter={() => (hint = UNIT_STATUS_LABELS[status])}
				onfocus={() => (hint = UNIT_STATUS_LABELS[status])}
			>
				<StatusGlyph {status} active={on} size="h-7 w-7" />
			</button>
		{/each}
	</div>
	<p class="mt-3 min-h-5 text-center text-xs tracking-wide text-slate-300">
		{hint ?? 'Tap a State to add or remove it'}
	</p>
	<div class="mt-2 flex gap-2">
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
			class="flex-1 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm
				font-semibold text-sky-100 outline-none hover:bg-sky-500/20
				focus-visible:border-sky-200"
			onclick={() => onAccept(states)}
		>
			{acceptLabel}
		</button>
	</div>
</div>
