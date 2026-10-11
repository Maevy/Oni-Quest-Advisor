<script lang="ts">
	import type { UnitStatus, VitalityTarget } from '$lib/domain';
	import { damageApplied, healApplied, staminaCap, vitalityRingStates } from '$lib/domain';
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
		/**
		 * Self mode: one model acting on itself. The header shows it alone, inert, between two
		 * "Self Interaction" labels; Stagger/Stun/Trade are dropped and Model Info and Activation
		 * Management take their place. `origin` and `target` are then the same copy.
		 */
		self?: boolean;
		onDamage: (target: VitalityTarget, amount: number) => void;
		onHeal: (target: VitalityTarget, amount: number) => void;
		onStatuses: (target: VitalityTarget, statuses: UnitStatus[]) => void;
		/** Stagger spends one of the target's activations. Cross-model only. */
		onStagger: (target: VitalityTarget) => void;
		/** Stun spends every one of the target's activations. Cross-model only. */
		onStun: (target: VitalityTarget) => void;
		/** Activation Management committed a net change to the model's own Stamina. Self only. */
		onStamina?: (target: VitalityTarget, delta: number) => void;
		/** Model Info was pressed: the screen opens the model's card above this dialog. Self only. */
		onInfo?: () => void;
		onClose: () => void;
	};

	let {
		origin,
		target,
		self = false,
		onDamage,
		onHeal,
		onStatuses,
		onStagger,
		onStun,
		onStamina,
		onInfo,
		onClose
	}: Props = $props();

	const STRIKE_MS = 460;
	const FADE_MS = 220;
	const SETTLE_MS = 340;

	/** Which sub-flow the menu has opened; null shows the action buttons. */
	type Sub = 'damage' | 'heal' | 'status' | 'stagger' | 'stun' | 'stamina';
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
	/** A box walk in flight; `shown` is the model's displayed vitality, which outlives the walk. */
	let walkActive = $state(false);
	let shown = $state<{ life: number; sta: number } | null>(null);
	/** The Stamina value Activation Management has staged, committed on Accept. */
	let actValue = $state(0);
	let closing = $state(false);

	const timers: ReturnType<typeof setTimeout>[] = [];
	function later(ms: number, fn: () => void): void {
		timers.push(setTimeout(fn, ms));
	}
	$effect(() => () => timers.forEach(clearTimeout));

	let animating = $derived(!!strike || !!statusFly || walkActive);

	// Layered dismissal, like the old focus overlay: a sub-flow folds back to the menu first, and
	// only a bare menu closes the whole dialog. Nothing folds mid-animation - a strike owns the
	// gesture until it lands and the boxes finish walking.
	function back(): void {
		if (closing || animating) return;
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

	/** A model with no Life cannot be damaged or healed; with no Stamina it has no activations. */
	const canDamage = $derived(target.flower.life !== null);
	const hasStamina = $derived(target.flower.stamina !== null);
	const staminaBase = $derived(target.flower.stamina?.max ?? 0);
	const staminaCeil = $derived(staminaCap(staminaBase));

	/** The model's displayed value for a half: the walk's running record, or the flower's own. */
	function displayed(half: 'life' | 'stamina'): number {
		if (shown) return half === 'life' ? shown.life : shown.sta;
		return (half === 'life' ? target.flower.life?.current : target.flower.stamina?.current) ?? 0;
	}

	function centreOf(selector: string): { x: number; y: number } {
		const el = document.querySelector(selector);
		if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		const r = el.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	}

	/**
	 * Walks one half from where it is on screen to where the commit put it, one box a step. The
	 * displayed value persists afterwards (the flower prop is a snapshot), and `closeAfter` folds
	 * the dialog once the walk settles.
	 */
	function startWalk(
		half: 'life' | 'stamina',
		from: number,
		to: number,
		closeAfter: boolean
	): void {
		const count = Math.abs(to - from);
		const step = Math.sign(to - from);
		if (!shown)
			shown = {
				life: target.flower.life?.current ?? 0,
				sta: target.flower.stamina?.current ?? 0
			};
		walkActive = true;
		for (let i = 1; i <= count; i++)
			later(FADE_MS * i, () => {
				if (!shown) return;
				const value = from + step * i;
				if (half === 'life') shown.life = value;
				else shown.sta = value;
			});
		later(FADE_MS * count + (closeAfter ? SETTLE_MS : 0), () => {
			walkActive = false;
			if (closeAfter) close();
		});
	}

	/**
	 * The shared shape of a cross-model strike: the glyph flies from the origin flower to the
	 * target, lands, commits, and the target's boxes walk before the dialog folds. Self actions
	 * have only one model, so they skip the flight and walk in place.
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
			startWalk(half, from, to, true);
		});
	}

	function confirmDamage(amount: number): void {
		const life = target.flower.life;
		if (!life) return;
		const from = displayed('life');
		const to = Math.max(0, from - damageApplied(amount, from));
		sub = null;
		if (self) {
			onDamage(target, amount);
			startWalk('life', from, to, true);
			return;
		}
		launch('damage', 'life', () => onDamage(target, amount), from, to);
	}

	function confirmHeal(amount: number): void {
		const life = target.flower.life;
		if (!life) return;
		const from = displayed('life');
		const to = from + healApplied(amount, from, life.max);
		sub = null;
		if (self) {
			onHeal(target, amount);
			startWalk('life', from, to, true);
			return;
		}
		launch('heal', 'life', () => onHeal(target, amount), from, to);
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
		sub = null;
		if (self) {
			onStatuses(target, draft);
			later(SETTLE_MS, close);
			return;
		}
		const added = draft.filter((status) => !target.flower.statuses.includes(status));
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

	/** Activation Management's Accept: commit the staged Stamina as a delta and walk the bars. */
	function confirmActivation(): void {
		const from = displayed('stamina');
		const to = actValue;
		sub = null;
		if (to === from) {
			later(SETTLE_MS, close);
			return;
		}
		onStamina?.(target, to - from);
		startWalk('stamina', from, to, true);
	}

	/** The target flower as the walk leaves it: the walked halves repainted box by box. */
	let shownTarget = $derived.by(() => {
		if (!shown) return target.flower;
		let spec = target.flower;
		if (spec.life)
			spec = {
				...spec,
				life: {
					...spec.life,
					current: shown.life,
					states: vitalityRingStates(shown.life, spec.life.max)
				}
			};
		if (spec.stamina)
			spec = {
				...spec,
				stamina: {
					...spec.stamina,
					current: shown.sta,
					states: vitalityRingStates(shown.sta, spec.stamina.max)
				}
			};
		return spec;
	});

	type ActionId =
		'damage' | 'heal' | 'status' | 'buff' | 'stagger' | 'stun' | 'trade' | 'info' | 'stamina';
	type Action = { id: ActionId; label: string; enabled: boolean };
	const CROSS_ACTIONS: Action[] = [
		{ id: 'damage', label: 'Assign Damage', enabled: true },
		{ id: 'heal', label: 'Assign Healing', enabled: true },
		{ id: 'status', label: 'Assign / Remove Status', enabled: true },
		{ id: 'buff', label: 'Assign / Remove Buff', enabled: false },
		{ id: 'stagger', label: 'Deal Stagger', enabled: true },
		{ id: 'stun', label: 'Deal Stun', enabled: true },
		{ id: 'trade', label: 'Trade Item', enabled: false }
	];
	// A model acts on itself with damage, healing, statuses and (one day) buffs, then looks
	// itself up and manages its own activations; Stagger, Stun and Trade are things one model
	// does to another, so the self dialog swaps them for Model Info and Activation Management.
	const SELF_ACTIONS: Action[] = [
		{ id: 'damage', label: 'Assign Damage', enabled: true },
		{ id: 'heal', label: 'Assign Healing', enabled: true },
		{ id: 'status', label: 'Assign / Remove Status', enabled: true },
		{ id: 'buff', label: 'Assign / Remove Buff', enabled: false },
		{ id: 'info', label: 'Model Info', enabled: true },
		{ id: 'stamina', label: 'Activation Management', enabled: true }
	];
	let actions = $derived(self ? SELF_ACTIONS : CROSS_ACTIONS);

	function openAction(action: Action): void {
		if (closing || animating || !action.enabled) return;
		if (action.id === 'buff' || action.id === 'trade') return;
		if (action.id === 'info') {
			onInfo?.();
			return;
		}
		if (action.id === 'stamina') {
			actValue = displayed('stamina');
			sub = 'stamina';
			return;
		}
		if (
			action.id === 'damage' ||
			action.id === 'heal' ||
			action.id === 'status' ||
			action.id === 'stagger' ||
			action.id === 'stun'
		)
			sub = action.id;
	}

	const originAccent = $derived(playerAccent(origin.player));
	const targetAccent = $derived(playerAccent(target.player));
</script>

<!-- The action glyph, drawn in the petal's own -6..6 space and scaled into a 24 box so the menu
     icons and the flying glyph are the same shape. -->
{#snippet glyph(kind: ActionId, cls: string)}
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
			{:else if kind === 'stamina'}
				<!-- Activation Management: a plain yellow orb, the hue of the Stamina boxes. -->
				<circle r="4.6" class="fill-yellow-400" />
			{:else if kind === 'info'}
				<!-- Model Info: the grey bang in a grey ring the info petal wore. -->
				<g class="fill-slate-400 stroke-slate-400">
					<circle r="5.2" fill="none" stroke-width="1.2" />
					<rect x="-0.75" y="-3.2" width="1.5" height="4.1" rx="0.75" stroke="none" />
					<circle cy="2.4" r="0.85" stroke="none" />
				</g>
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
	border: string
)}
	<div class="flex flex-col items-center gap-1">
		<div data-io={which} class="w-24 rounded-full border-2 bg-slate-900/60 p-0.5 {border}">
			<BattleFlower flower={spec} showLabel={false} showStatuses={false} inert />
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
	{#if self}
		<!-- One model, alone and inert, between two Self Interaction labels: everything you can
		     do to it is a button below, so the picture up top is just the picture. -->
		<div class="mt-[max(1.5rem,6dvh)] flex items-center justify-center gap-3">
			<span class="w-16 text-center text-[10px] tracking-wide text-slate-400 uppercase">
				Self Interaction
			</span>
			<!-- The rim must stay a circle: BattleFlower caps at 104px, so a wider box stops being
			     square once the flower no longer fills it, and rounded-full on a wide box draws an
			     egg. 108 = the 104px flower plus the p-0.5 rim padding on both sides. -->
			<div class="w-[108px] rounded-full border-2 bg-slate-900/60 p-0.5 {targetAccent.border}">
				<BattleFlower flower={shownTarget} showLabel={false} showStatuses inert />
			</div>
			<span class="w-16 text-center text-[10px] tracking-wide text-slate-400 uppercase">
				Self Interaction
			</span>
		</div>
	{:else}
		<!-- The two flowers and the Interaction arrow, up top. -->
		<div class="mt-[max(1.5rem,6dvh)] flex items-start justify-center gap-3">
			{@render seatFlower('origin', origin, origin.flower, originAccent.border)}
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
			{@render seatFlower('target', target, shownTarget, targetAccent.border)}
		</div>
	{/if}

	<!-- The menu, or the sub-flow it opened. The menu hides mid-animation so the walk reads clean. -->
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
				hp={displayed('life') || 1}
				undead={target.flower.undead}
				onAccept={confirmStatuses}
				onCancel={() => (sub = null)}
			/>
		{:else if sub === 'stamina'}
			<div class="rounded-2xl border border-slate-600/60 bg-slate-900/95 p-4">
				<p class="text-xs tracking-wide text-yellow-300 uppercase">Activation Management</p>
				<div class="mt-3 flex items-center justify-center gap-5">
					<button
						type="button"
						aria-label="Spend one activation"
						disabled={actValue <= 0}
						class="h-12 w-12 rounded-full border-2 border-slate-600/60 bg-slate-950/60 text-lg
							font-semibold text-slate-200 transition-colors duration-150 outline-none
							hover:border-slate-400 focus-visible:border-sky-200
							disabled:cursor-not-allowed disabled:opacity-40"
						onclick={() => (actValue = Math.max(0, actValue - 1))}
					>
						−1
					</button>
					<span class="w-10 text-center text-3xl font-semibold text-yellow-300 tabular-nums">
						{actValue}
					</span>
					<button
						type="button"
						aria-label="Gain one activation"
						disabled={actValue >= staminaCeil}
						class="h-12 w-12 rounded-full border-2 border-slate-600/60 bg-slate-950/60 text-lg
							font-semibold text-slate-200 transition-colors duration-150 outline-none
							hover:border-slate-400 focus-visible:border-sky-200
							disabled:cursor-not-allowed disabled:opacity-40"
						onclick={() => (actValue = Math.min(staminaCeil, actValue + 1))}
					>
						+1
					</button>
				</div>
				<div class="mt-3 flex gap-2">
					<button
						type="button"
						class="rounded-lg border border-slate-600/60 px-3 py-2 text-sm text-slate-300
							outline-none focus-visible:border-sky-200"
						onclick={() => (sub = null)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-3 py-2
							text-sm font-semibold text-yellow-100 outline-none hover:bg-yellow-500/20
							focus-visible:border-sky-200"
						onclick={confirmActivation}
					>
						Accept
					</button>
				</div>
			</div>
		{:else if !animating}
			<div
				class="grid grid-cols-2 gap-2 rounded-2xl border border-slate-600/40 bg-slate-950/70 p-3"
			>
				{#each actions as action (action.id)}
					{@const enabled =
						action.enabled &&
						(action.id === 'damage' || action.id === 'heal' ? canDamage : true) &&
						(action.id === 'stagger' || action.id === 'stun' || action.id === 'stamina'
							? hasStamina
							: true)}
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
						<span class="h-6 w-6 shrink-0">{@render glyph(action.id, 'h-6 w-6')}</span>
						<span class="min-w-0">{action.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- The flying glyph: from the origin flower's centre to the target's. Cross-model only. -->
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
		class="pointer-events-none fixed top-0 left-0 z-[60] flex gap-1 transition-transform
			duration-[460ms] ease-in motion-reduce:transition-none"
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
