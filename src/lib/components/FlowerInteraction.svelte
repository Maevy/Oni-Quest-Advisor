<script lang="ts">
	import type { UnitStatus, VitalityTarget } from '$lib/domain';
	import { damageApplied, healApplied, vitalityRingStates } from '$lib/domain';
	import BattleFlower from './BattleFlower.svelte';
	import AmountPad from './AmountPad.svelte';
	import StatusPicker from './StatusPicker.svelte';
	import StatusGlyph from './StatusGlyph.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { playerAccent } from './playerAccent';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		/** The flower that was dragged: the interaction's source, on the left. */
		origin: VitalityTarget;
		/** The flower it was dropped on: the interaction's target, on the right. */
		target: VitalityTarget;
		onDamage: (target: VitalityTarget, amount: number) => void;
		onHeal: (target: VitalityTarget, amount: number) => void;
		onStatuses: (target: VitalityTarget, statuses: UnitStatus[]) => void;
		/** Stagger spends one of the target's activations. */
		onStagger: (target: VitalityTarget) => void;
		/** Stun spends every one of the target's activations. */
		onStun: (target: VitalityTarget) => void;
		onClose: () => void;
	};

	let { origin, target, onDamage, onHeal, onStatuses, onStagger, onStun, onClose }: Props =
		$props();

	const STRIKE_MS = 460;
	const FADE_MS = 220;
	const SETTLE_MS = 340;

	/** Which sub-flow the menu has opened; null shows the seven buttons. */
	type Sub = 'damage' | 'heal' | 'status' | 'stagger' | 'stun';
	let sub = $state<Sub | null>(null);

	type StrikeKind = 'damage' | 'heal' | 'stagger' | 'stun';
	let strike = $state<null | {
		kind: StrikeKind;
		x: number;
		y: number;
		tx: number;
		ty: number;
		flying: boolean;
	}>(null);
	/** The added States flying at the target once the picker is accepted. */
	let statusFly = $state<null | { added: UnitStatus[]; flying: boolean }>(null);
	/** The target half mid-walk, and how far the boxes have travelled. */
	let walk = $state<null | { half: 'life' | 'stamina'; from: number; to: number; step: number }>(
		null
	);
	let closing = $state(false);

	const timers: ReturnType<typeof setTimeout>[] = [];
	function later(ms: number, fn: () => void): void {
		timers.push(setTimeout(fn, ms));
	}
	$effect(() => () => timers.forEach(clearTimeout));

	// Layered dismissal, like the focus overlay: a sub-flow folds back to the menu first, and
	// only a bare menu closes the whole panel. Nothing folds mid-animation - the strike owns the
	// gesture until it lands and the boxes finish walking.
	function back(): void {
		if (closing || strike || statusFly || walk) return;
		if (sub) {
			sub = null;
			return;
		}
		close();
	}
	function close(): void {
		if (closing) return;
		closing = true;
		later(180, onClose);
	}
	$effect(() => onEscapeKey(back));

	/** A model with no Life cannot be damaged or healed; with no Stamina it cannot be staggered. */
	const canDamage = $derived(target.flower.life !== null);
	const canStagger = $derived(target.flower.stamina !== null);

	function centreOf(selector: string): { x: number; y: number } {
		const el = document.querySelector(selector);
		if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const r = el.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	}

	/**
	 * The shared shape of a strike: the glyph flies from the origin flower to the target, lands,
	 * commits to the store, and the target's boxes walk to the new value before the panel folds.
	 * `from`/`to` are the displayed half's start and end, so the walk runs against the state the
	 * player confirmed even though the commit already landed.
	 */
	function launch(
		kind: StrikeKind,
		half: 'life' | 'stamina' | null,
		apply: () => void,
		from: number,
		to: number
	): void {
		const o = centreOf('[data-io="origin"]');
		const t = centreOf('[data-io="target"]');
		sub = null;
		strike = { kind, x: o.x, y: o.y, tx: t.x, ty: t.y, flying: false };
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				if (strike) strike.flying = true;
			})
		);
		later(STRIKE_MS, () => {
			strike = null;
			apply();
			if (half === null || to === from) {
				later(SETTLE_MS, close);
				return;
			}
			startWalk(half, from, to);
		});
	}

	function startWalk(half: 'life' | 'stamina', from: number, to: number): void {
		const count = Math.abs(to - from);
		walk = { half, from, to, step: 0 };
		for (let i = 1; i <= count; i++)
			later(FADE_MS * i, () => {
				if (walk) walk.step = i;
			});
		later(FADE_MS * count + SETTLE_MS, close);
	}

	function confirmDamage(amount: number): void {
		const life = target.flower.life;
		if (!life) return;
		const from = life.current;
		launch(
			'damage',
			'life',
			() => onDamage(target, amount),
			from,
			from - damageApplied(amount, from)
		);
	}

	function confirmHeal(amount: number): void {
		const life = target.flower.life;
		if (!life) return;
		const from = life.current;
		launch(
			'heal',
			'life',
			() => onHeal(target, amount),
			from,
			from + healApplied(amount, from, life.max)
		);
	}

	function confirmStagger(): void {
		const sta = target.flower.stamina;
		if (!sta) return;
		launch(
			'stagger',
			'stamina',
			() => onStagger(target),
			sta.current,
			Math.max(0, sta.current - 1)
		);
	}

	function confirmStun(): void {
		const sta = target.flower.stamina;
		if (!sta) return;
		launch('stun', 'stamina', () => onStun(target), sta.current, 0);
	}

	/** Accepting the picker flies the newly-added States at the target; removals just clear. */
	function confirmStatuses(draft: UnitStatus[]): void {
		const added = draft.filter((status) => !target.flower.statuses.includes(status));
		sub = null;
		if (added.length === 0) {
			onStatuses(target, draft);
			later(SETTLE_MS, close);
			return;
		}
		statusFly = { added, flying: false };
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				if (statusFly) statusFly.flying = true;
			})
		);
		later(STRIKE_MS, () => {
			statusFly = null;
			onStatuses(target, draft);
			later(SETTLE_MS, close);
		});
	}

	/** The target flower as the walk leaves it: the walked half repainted box by box. */
	let shownTarget = $derived.by(() => {
		if (!walk) return target.flower;
		const current = walk.from + Math.sign(walk.to - walk.from) * walk.step;
		if (walk.half === 'life' && target.flower.life)
			return {
				...target.flower,
				life: {
					...target.flower.life,
					current,
					states: vitalityRingStates(current, target.flower.life.max)
				}
			};
		if (walk.half === 'stamina' && target.flower.stamina)
			return {
				...target.flower,
				stamina: {
					...target.flower.stamina,
					current,
					states: vitalityRingStates(current, target.flower.stamina.max)
				}
			};
		return target.flower;
	});

	type Action = {
		id: Sub | 'buff' | 'trade';
		label: string;
		enabled: boolean;
		glyph: StrikeKind | 'status' | 'buff' | 'trade';
	};
	const ACTIONS: Action[] = [
		{ id: 'damage', label: 'Assign Damage', enabled: true, glyph: 'damage' },
		{ id: 'heal', label: 'Assign Healing', enabled: true, glyph: 'heal' },
		{ id: 'status', label: 'Assign / Remove Status', enabled: true, glyph: 'status' },
		{ id: 'buff', label: 'Assign / Remove Buff', enabled: false, glyph: 'buff' },
		{ id: 'stagger', label: 'Deal Stagger', enabled: true, glyph: 'stagger' },
		{ id: 'stun', label: 'Deal Stun', enabled: true, glyph: 'stun' },
		{ id: 'trade', label: 'Trade Item', enabled: false, glyph: 'trade' }
	];

	function openAction(action: Action): void {
		if (closing || strike || statusFly || walk || !action.enabled) return;
		if (action.id === 'buff' || action.id === 'trade') return;
		sub = action.id;
	}

	const originAccent = $derived(playerAccent(origin.player));
	const targetAccent = $derived(playerAccent(target.player));
</script>

<!-- The action glyph, drawn in the petal's own -6..6 space and scaled into a 24 box so the menu
     icons and the flying glyph are the same shape. -->
{#snippet glyph(kind: StrikeKind | 'status' | 'buff' | 'trade', cls: string)}
	<svg viewBox="0 0 24 24" class={cls} aria-hidden="true">
		<g transform="translate(12 12) scale(1.15)">
			{#if kind === 'damage'}
				<g class="fill-red-400">
					<path d="M 0 -5.4 L 1.2 -2.6 L 1.2 1.4 L -1.2 1.4 L -1.2 -2.6 Z" />
					<rect x="-2.7" y="1.4" width="5.4" height="1.1" rx="0.5" />
					<rect x="-0.6" y="2.5" width="1.2" height="1.9" rx="0.5" />
					<circle cy="4.7" r="0.9" />
				</g>
			{:else if kind === 'heal'}
				<path
					class="fill-emerald-400"
					d="M -1.5 -4.6 H 1.5 V -1.5 H 4.6 V 1.5 H 1.5 V 4.6 H -1.5 V 1.5 H -4.6 V -1.5 H -1.5 Z"
				/>
			{:else if kind === 'status'}
				<path
					class="fill-orange-400"
					d="M 0 -5.2 L 1.29 -1.78 L 4.95 -1.61 L 2.09 0.68 L 3.06 4.21 L 0 2.2 L -3.06 4.21 L -2.09 0.68 L -4.95 -1.61 L -1.29 -1.78 Z"
				/>
			{:else if kind === 'buff'}
				<path
					class="fill-sky-400"
					d="M 0 -5.2 L 3.6 -1.2 L 1.4 -1.2 L 1.4 5.2 L -1.4 5.2 L -1.4 -1.2 L -3.6 -1.2 Z"
				/>
			{:else if kind === 'stagger'}
				<!-- The Stamina disc, broken: a yellow ring with a gap where an activation went. -->
				<circle
					r="4.6"
					fill="none"
					stroke="currentColor"
					class="text-yellow-400"
					stroke-width="1.8"
					stroke-dasharray="18 6"
					stroke-linecap="round"
				/>
			{:else if kind === 'stun'}
				<!-- The Stamina disc, struck through: a yellow ring with an X across it. -->
				<circle
					r="4.6"
					fill="none"
					stroke="currentColor"
					class="text-yellow-400"
					stroke-width="1.8"
				/>
				<path
					d="M -3.4 -3.4 L 3.4 3.4 M 3.4 -3.4 L -3.4 3.4"
					stroke="currentColor"
					class="text-yellow-400"
					stroke-width="1.8"
					stroke-linecap="round"
					fill="none"
				/>
			{:else}
				<!-- Trade: two arrows passing - inert until the feature lands. -->
				<g
					stroke="currentColor"
					class="text-slate-400"
					stroke-width="1.6"
					fill="none"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M -4.6 -1.6 H 3.2 M 1.2 -3.6 L 3.4 -1.6 L 1.2 0.4" />
					<path d="M 4.6 1.6 H -3.2 M -1.2 -0.4 L -3.4 1.6 L -1.2 3.6" />
				</g>
			{/if}
		</g>
	</svg>
{/snippet}

{#snippet seatFlower(
	which: 'origin' | 'target',
	t: VitalityTarget,
	spec: typeof target.flower,
	accent: { border: string }
)}
	<div class="flex flex-col items-center gap-1">
		<div data-io={which} class="w-24 rounded-full border-2 bg-slate-900/60 p-0.5 {accent.border}">
			<BattleFlower flower={spec} showLabel={false} showStatuses={false} />
		</div>
		<p class="w-24 truncate text-center text-[10px] font-semibold text-slate-200">
			{t.flower.name}
		</p>
	</div>
{/snippet}

<div
	class="fixed inset-0 z-50 flex flex-col items-center bg-slate-950/70 px-4 backdrop-blur-sm
		transition-opacity duration-200 motion-reduce:transition-none {closing
		? 'opacity-0'
		: 'opacity-100'}"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) back();
	}}
>
	<!-- The two flowers and the Interaction arrow, up top. -->
	<div class="mt-[max(1.5rem,6dvh)] flex items-start justify-center gap-3">
		{@render seatFlower('origin', origin, origin.flower, originAccent)}
		<div class="flex flex-col items-center gap-1 pt-6">
			<svg viewBox="0 0 48 24" class="h-6 w-12 text-slate-400" aria-hidden="true">
				<path
					d="M2 12 H38 M32 5 L40 12 L32 19"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="text-[10px] tracking-wide text-slate-400 uppercase">Interaction</span>
		</div>
		{@render seatFlower('target', target, shownTarget, targetAccent)}
	</div>

	<!-- The menu, or the sub-flow it opened. -->
	<div class="mt-6 w-full max-w-sm">
		{#if sub === 'damage'}
			<AmountPad
				label="Damage"
				tone="damage"
				onConfirm={confirmDamage}
				onCancel={() => (sub = null)}
			/>
		{:else if sub === 'heal'}
			<AmountPad
				label="Healing"
				tone="heal"
				onConfirm={confirmHeal}
				onCancel={() => (sub = null)}
			/>
		{:else if sub === 'status'}
			<StatusPicker
				statuses={target.flower.statuses}
				hp={target.flower.life?.current ?? 1}
				undead={target.flower.undead}
				onAccept={confirmStatuses}
				onCancel={() => (sub = null)}
			/>
		{:else}
			<div
				class="grid grid-cols-2 gap-2 rounded-2xl border border-slate-600/40 bg-slate-950/70 p-3"
			>
				{#each ACTIONS as action (action.id)}
					{@const enabled =
						action.enabled &&
						(action.id !== 'damage' && action.id !== 'heal' ? true : canDamage) &&
						(action.id !== 'stagger' && action.id !== 'stun' ? true : canStagger)}
					<button
						type="button"
						disabled={!enabled}
						aria-label={action.label}
						class="flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-900/70
							px-3 py-3 text-left text-xs font-semibold text-slate-200 transition-colors
							duration-150 outline-none focus-visible:border-sky-200
							{enabled ? 'hover:border-slate-400' : 'cursor-not-allowed opacity-40'}"
						onclick={() => openAction(action)}
					>
						<span class="h-6 w-6 shrink-0">{@render glyph(action.glyph, 'h-6 w-6')}</span>
						<span class="min-w-0">{action.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- The flying glyph: from the origin flower's centre to the target's. -->
{#if strike}
	<div
		class="pointer-events-none fixed top-0 left-0 z-[60] transition-transform duration-[460ms]
			ease-in motion-reduce:transition-none"
		style="transform: translate({(strike.flying ? strike.tx : strike.x) - 14}px,
			{(strike.flying ? strike.ty : strike.y) - 14}px)"
	>
		{@render glyph(strike.kind, 'h-7 w-7')}
	</div>
{/if}

<!-- The added States, flying as a cluster from the panel's centre to the target flower. -->
{#if statusFly}
	{@const t = centreOf('[data-io="target"]')}
	<div
		class="pointer-events-none fixed top-0 left-0 z-[60] flex -translate-x-1/2 -translate-y-1/2
			gap-1 transition-transform duration-[460ms] ease-in motion-reduce:transition-none"
		style="transform: translate({statusFly.flying ? t.x : window.innerWidth / 2}px,
			{statusFly.flying ? t.y : window.innerHeight * 0.62}px) translate(-50%, -50%)"
	>
		{#each statusFly.added as status (status)}
			<StatusGlyph {status} active size="h-6 w-6" />
		{/each}
	</div>
{/if}

<!-- Stagger and Stun ask before they spend the target's activations. -->
{#if sub === 'stagger'}
	<ConfirmDialog
		text="Assign Stagger to the target? It spends one activation."
		confirmLabel="Stagger"
		cancelLabel="Back"
		onConfirm={confirmStagger}
		onCancel={() => (sub = null)}
	/>
{:else if sub === 'stun'}
	<ConfirmDialog
		text="Assign Stun to the target? It spends every activation."
		confirmLabel="Stun"
		cancelLabel="Back"
		onConfirm={confirmStun}
		onCancel={() => (sub = null)}
	/>
{/if}
