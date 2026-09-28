<script lang="ts">
	import type {
		ArmyFactionConfig,
		Mission,
		TournamentEventView,
		TournamentOccupant,
		TournamentRoundView
	} from '$lib/domain';
	import Panel from './Panel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import TournamentRoadmap from './TournamentRoadmap.svelte';

	type Props = {
		view: TournamentEventView;
		/** The round being prepared; the screen only renders while there is one. */
		round: TournamentRoundView;
		/** Every mission the tournament may reference; the control panel resolves the round's. */
		missions: Mission[];
		/** Faction colours for the assigned players' armies. */
		factions: ArmyFactionConfig[];
		error?: string | null;
		/** Organizer only: moves one occupant to a table, or back to the pool when null. */
		onAssign: (occupant: TournamentOccupant, tableIndex: number | null) => Promise<void> | void;
		/** Organizer only: starts the round, moving the roadmap on and locking the tables. */
		onStartRound: () => Promise<void> | void;
		onLeave: () => void;
	};

	let {
		view,
		round,
		missions,
		factions,
		error = null,
		onAssign,
		onStartRound,
		onLeave
	}: Props = $props();

	const field = 'shrink-0 text-xs tracking-wide text-slate-400 uppercase';
	const value = 'min-w-0 text-right text-sm break-words text-slate-100';
	const placeButton =
		'mt-2 w-full rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600';
	const chipBase = 'rounded-xl border-2 px-3 py-2 text-sm font-semibold backdrop-blur transition';
	const playerChip = 'border-sky-500/50 bg-slate-900/60 text-sky-100';
	const byeChip = 'border-amber-500/50 bg-amber-950/40 text-amber-100';

	const isOrganizer = $derived(view.role === 'organizer');
	/** The board is the organizer's, and only while the round is still being prepared. */
	const canAssign = $derived(isOrganizer && round.phase === 'setup');
	const mission = $derived(missions.find((candidate) => candidate.id === round.missionId) ?? null);
	const tableName = (index: number) => view.tableNames[index] || `Table ${index + 1}`;

	/** An occupant's identity — a keyed-list key and the tap-to-place selection at once. */
	function key(occupant: TournamentOccupant): string {
		return occupant.kind === 'bye' ? 'bye' : `seat-${occupant.seatIndex}`;
	}

	function occupantLabel(occupant: TournamentOccupant): string {
		if (occupant.kind === 'bye') return 'BYE';
		return view.seats[occupant.seatIndex]?.name ?? `Seat ${occupant.seatIndex + 1}`;
	}

	/** The army faction's colour for a player chip; the BYE has no army. */
	function chipStyle(occupant: TournamentOccupant): string | undefined {
		if (occupant.kind !== 'seat') return undefined;
		const factionId = view.seats[occupant.seatIndex]?.army?.factionId;
		const color = factions.find((faction) => faction.id === factionId)?.color;
		return color ? `color: ${color}` : undefined;
	}

	const holdsBye = (table: TournamentOccupant[]) =>
		table.some((occupant) => occupant.kind === 'bye');

	// --- drag (pointer events, so a finger works as well as a mouse) and tap-to-place ---
	let drag = $state<{
		occupant: TournamentOccupant;
		x: number;
		y: number;
		startX: number;
		startY: number;
		moved: boolean;
	} | null>(null);
	/** The key of the occupant a tap picked up; null when nothing is selected. */
	let selected = $state<string | null>(null);
	let dropTarget = $state<number | 'pool' | null>(null);
	/** An assignment is in flight — the board is frozen so drops cannot overtake each other. */
	let busy = $state(false);
	/** A finished drag must not also count as the tap that follows it. */
	let suppressClick = $state(false);

	const dragKey = $derived(drag !== null && drag.moved ? key(drag.occupant) : null);
	const selectedOccupant = $derived.by(() => {
		if (selected === null) return null;
		const all = [...round.pool, ...round.tables.flat()];
		return all.find((occupant) => key(occupant) === selected) ?? null;
	});
	const selectedIsSeated = $derived(
		selectedOccupant !== null &&
			round.tables.some((table) => table.some((occupant) => key(occupant) === selected))
	);

	function tableAccepts(table: TournamentOccupant[], occupant: TournamentOccupant | null): boolean {
		if (occupant === null) return false;
		// Dropping onto the table an occupant already sits at changes nothing, so it is allowed.
		if (table.some((other) => key(other) === key(occupant))) return true;
		return table.length < round.maxOccupants;
	}

	/** The container under a point: a table index, the pool, or nothing at all. */
	function targetAt(x: number, y: number): number | 'pool' | null {
		const element = document.elementFromPoint(x, y);
		const table = element?.closest('[data-table-index]');
		if (table) return Number(table.getAttribute('data-table-index'));
		return element?.closest('[data-pool]') ? 'pool' : null;
	}

	function beginDrag(event: PointerEvent, occupant: TournamentOccupant): void {
		if (!canAssign || busy) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = {
			occupant,
			x: event.clientX,
			y: event.clientY,
			startX: event.clientX,
			startY: event.clientY,
			moved: false
		};
	}

	function moveDrag(event: PointerEvent): void {
		if (drag === null) return;
		drag.x = event.clientX;
		drag.y = event.clientY;
		if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) {
			drag.moved = true;
		}
		dropTarget = drag.moved ? targetAt(event.clientX, event.clientY) : null;
	}

	async function endDrag(event: PointerEvent): Promise<void> {
		const current = drag;
		drag = null;
		dropTarget = null;
		if (current === null || !current.moved) return; // a tap, not a drag — the click takes it
		suppressClick = true;
		const target = targetAt(event.clientX, event.clientY);
		if (target === null) return; // dropped nowhere: the occupant stays where it was
		await place(current.occupant, target === 'pool' ? null : target);
	}

	function cancelDrag(): void {
		drag = null;
		dropTarget = null;
	}

	function tapSelect(occupant: TournamentOccupant): void {
		if (!canAssign || busy) return;
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		selected = selected === key(occupant) ? null : key(occupant);
	}

	/** A start is in flight — the button is the only thing that needs freezing for it. */
	let starting = $state(false);

	async function start(): Promise<void> {
		starting = true;
		await onStartRound();
		starting = false;
	}

	async function place(occupant: TournamentOccupant, tableIndex: number | null): Promise<void> {
		busy = true;
		await onAssign(occupant, tableIndex);
		busy = false;
		selected = null;
	}

	function placeSelected(tableIndex: number | null): void {
		const occupant = selectedOccupant;
		if (occupant === null) return;
		void place(occupant, tableIndex);
	}
</script>

{#snippet chip(occupant: TournamentOccupant)}
	{@const isSelected = selected === key(occupant)}
	{@const isDragging = dragKey === key(occupant)}
	{@const classes = [
		chipBase,
		occupant.kind === 'bye' ? byeChip : playerChip,
		isSelected ? 'ring-2 ring-sky-400' : '',
		isDragging || busy ? 'opacity-40' : ''
	]
		.filter(Boolean)
		.join(' ')}
	{#if canAssign}
		<button
			type="button"
			class="touch-none {classes}"
			style={chipStyle(occupant)}
			disabled={busy}
			aria-pressed={isSelected}
			onpointerdown={(event) => beginDrag(event, occupant)}
			onpointermove={moveDrag}
			onpointerup={(event) => void endDrag(event)}
			onpointercancel={cancelDrag}
			onclick={() => tapSelect(occupant)}
		>
			{occupantLabel(occupant)}
		</button>
	{:else}
		<span class={classes} style={chipStyle(occupant)}>{occupantLabel(occupant)}</span>
	{/if}
{/snippet}

<div class="min-h-dvh pb-6">
	<ScreenHeader title={view.name} onBack={onLeave} />

	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4">
		{#if error}
			<div
				class="rounded-xl border border-red-500/40 bg-slate-800/40 p-3 text-sm text-red-300 backdrop-blur"
			>
				{error}
			</div>
		{/if}

		<Panel title="Progress" titleClass="text-sky-300 text-center" tone="dark">
			<TournamentRoadmap steps={round.roadmap.steps} currentIndex={round.roadmap.currentIndex} />
		</Panel>

		<Panel title="Round Control">
			<dl class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between gap-3 border-b border-slate-700/30 pb-2">
					<dt class={field}>Tournament Round</dt>
					<dd class={value}>Round {round.number}</dd>
				</div>
				<div class="flex items-baseline justify-between gap-3">
					<dt class={field}>Mission</dt>
					<dd class={value}>
						{mission?.name ?? round.missionId}
						{#if mission}
							<span class="text-xs text-slate-400">· {mission.season}</span>
						{/if}
					</dd>
				</div>
			</dl>

			<h3 class="mt-4 text-xs font-semibold tracking-wide text-slate-400 uppercase">
				Victory Points
			</h3>
			<ul class="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
				{#each round.standings as standing (standing.seatIndex)}
					<li
						class="flex items-baseline justify-between gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2"
					>
						<span class="min-w-0 truncate text-sm text-slate-100">
							{standing.name}
							{#if view.seats[standing.seatIndex]?.you}
								<span class="text-sky-300">(you)</span>
							{/if}
						</span>
						<span class="shrink-0 text-sm font-bold text-emerald-300">
							{standing.victoryPoints}
						</span>
					</li>
				{/each}
			</ul>
		</Panel>

		{#if round.phase === 'setup' && isOrganizer}
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/60 bg-emerald-500/15 px-8 py-4 text-xl font-bold text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/25 enabled:active:bg-emerald-500/35 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-900/60 disabled:text-slate-600"
				disabled={!round.canStartRound || starting}
				onclick={() => void start()}
			>
				Start Round
			</button>
			<p class="-mt-2 text-center text-xs text-slate-400">
				{#if round.ready}
					Every player is paired. Starting locks the tables and moves the round on.
				{:else if round.pool.length === 0}
					Every table needs two occupants — nobody plays alone.
				{:else if view.needsBye}
					Assign every player and the BYE to a table to start the round.
				{:else}
					Assign every player to a table to start the round.
				{/if}
			</p>
		{:else}
			<p class="text-center text-sm text-slate-300">
				{#if round.phase === 'setup'}
					The organizer starts the round once every player is paired.
				{:else if round.phase === 'game'}
					Round {round.number} is being played.
				{:else}
					Round {round.number} is being scored.
				{/if}
			</p>
		{/if}

		<Panel title="Table Assignment">
			<p class="mb-3 text-xs text-slate-400">
				{#if round.phase !== 'setup'}
					The tables are locked — this round is under way.
				{:else if isOrganizer}
					Drag a player onto a table — or tap one, then tap where it goes.
				{:else}
					The organizer assigns the tables.
				{/if}
			</p>

			<div
				data-pool
				class="rounded-xl border-2 border-dashed p-3 transition {dropTarget === 'pool'
					? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-400'
					: 'border-slate-600/50 bg-slate-900/40'}"
			>
				<h3 class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
					{view.needsBye ? 'Players & Bye' : 'Players'}
					<span class="ml-1 text-slate-500">({round.pool.length})</span>
				</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each round.pool as occupant (key(occupant))}
						{@render chip(occupant)}
					{:else}
						<p class="text-xs text-slate-500">Everybody is at a table.</p>
					{/each}
				</div>
				{#if canAssign && selectedOccupant !== null && selectedIsSeated}
					<button
						type="button"
						class={placeButton}
						disabled={busy}
						onclick={() => placeSelected(null)}
					>
						Move {occupantLabel(selectedOccupant)} back here
					</button>
				{/if}
			</div>

			<ul class="mt-3 flex flex-col gap-3">
				{#each round.tables as table, index (index)}
					<li
						data-table-index={index}
						class="rounded-xl border-2 p-3 transition {dropTarget === index
							? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400'
							: 'border-slate-700/50 bg-slate-900/50'}"
					>
						<div class="flex items-baseline justify-between gap-3">
							<h3 class="min-w-0 truncate text-sm font-semibold text-slate-100">
								{tableName(index)}
							</h3>
							<span class="shrink-0 text-xs text-slate-500">
								{table.length}/{round.maxOccupants}
							</span>
						</div>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each table as occupant (key(occupant))}
								{@render chip(occupant)}
							{:else}
								<p class="text-xs text-slate-500">Empty — drop a player here</p>
							{/each}
						</div>
						{#if holdsBye(table)}
							<p class="mt-2 text-xs text-amber-300">
								The BYE sits at this table: its player sits this round out and takes it as a win.
							</p>
						{/if}
						{#if canAssign && selectedOccupant !== null && tableAccepts(table, selectedOccupant)}
							<button
								type="button"
								class={placeButton}
								disabled={busy}
								onclick={() => placeSelected(index)}
							>
								Place {occupantLabel(selectedOccupant)} here
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</Panel>
	</div>
</div>

{#if drag !== null && drag.moved}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-emerald-400 bg-slate-800 px-3 py-2 text-sm font-semibold text-emerald-100 shadow-lg"
		style="left: {drag.x}px; top: {drag.y}px"
	>
		{occupantLabel(drag.occupant)}
	</div>
{/if}
