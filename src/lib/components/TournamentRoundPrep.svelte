<script lang="ts">
	import type {
		ArmyFactionConfig,
		Mission,
		TournamentEventView,
		TournamentOccupant,
		TournamentRoundView,
		TournamentTableView
	} from '$lib/domain';
	import Panel from './Panel.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import ToMegaphone from './ToMegaphone.svelte';
	import TournamentRoadmap from './TournamentRoadmap.svelte';
	import type { MegaphoneInbox } from './toMegaphone';

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
		/** Organizer only, once every table reported: opens the next round on the next mission. */
		onNextRound?: () => Promise<void> | void;
		/** Organizer only, after the last mission's round: ends the event. */
		onConclude?: () => Promise<void> | void;
		/** Organizer only: the megaphone — one table, or every table when the index is null. */
		onShout?: (tableIndex: number | null, text: string) => Promise<boolean>;
		/** A player's own: sits down at the match their table plays. */
		onEnterGame?: (tableIndex: number) => Promise<void> | void;
		/**
		 * The online game this device is in, so a table can offer a way back into a match that is
		 * already running instead of a second Enter Game.
		 */
		activeGameId?: string | null;
		/** The player's inbox in the top bar; null for the organizer, who only sends. */
		megaphone?: MegaphoneInbox | null;
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
		onNextRound,
		onConclude,
		onShout,
		onEnterGame,
		activeGameId = null,
		megaphone = null,
		onLeave
	}: Props = $props();

	const field = 'shrink-0 text-xs tracking-wide text-slate-200 uppercase';
	const value = 'min-w-0 text-right text-sm break-words text-slate-100';
	const placeButton =
		'mt-2 w-full rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600';
	const chipBase = 'rounded-xl border-2 px-3 py-2 text-sm font-semibold backdrop-blur transition';
	const playerChip = 'border-sky-500/50 bg-slate-900/60 text-sky-100';
	const byeChip = 'border-amber-500/50 bg-amber-950/40 text-amber-100';
	const enterButton =
		'mt-3 w-full rounded-xl border-2 border-sky-400/70 bg-sky-500/20 px-3 py-3 text-base font-bold text-sky-50 backdrop-blur transition enabled:hover:bg-sky-500/30 enabled:active:bg-sky-500/40 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-900/60 disabled:text-slate-600';

	const isOrganizer = $derived(view.role === 'organizer');
	/** The board is the organizer's, and only while the round is still being prepared. */
	const canAssign = $derived(isOrganizer && round.phase === 'setup');
	/** Once the round runs the tables are locked, and the panels talk about matches instead. */
	const running = $derived(round.phase !== 'setup');
	const canShout = $derived(isOrganizer && running && onShout !== undefined);
	const mission = $derived(missions.find((candidate) => candidate.id === round.missionId) ?? null);
	const tableName = (index: number) => view.tableNames[index] || `Table ${index + 1}`;
	/** The last round has nowhere to advance to, so the organizer's button ends the event instead. */
	const concluding = $derived(!round.hasNextRound);

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

	/** Whether this device's player sits at that table, and may therefore enter its match. */
	function iPlayAt(table: TournamentTableView): boolean {
		const mine = view.seatIndex;
		if (mine === null) return false;
		return table.occupants.some(
			(occupant) => occupant.kind === 'seat' && occupant.seatIndex === mine
		);
	}

	/** What a table's panel says once the round runs. */
	type TableState = 'bye' | 'finished' | 'abandoned' | 'mine' | 'live' | 'unplayed';

	function tableState(table: TournamentTableView): TableState {
		if (!table.plays) return 'bye';
		if (table.match.result !== null) return 'finished';
		const status = table.match.status;
		if (status === 'closed') return 'abandoned';
		if (status !== null && activeGameId === table.match.gameId) return 'mine';
		if (status !== null) return 'live';
		return 'unplayed';
	}

	/**
	 * Enter Game is the seated players', and only while there is a match left to enter. A match
	 * this device holds no session for is included on purpose: a cleared browser, or a second
	 * device, gets back into its chair through the same button, which re-mints the seat.
	 */
	function canEnter(table: TournamentTableView): boolean {
		if (round.phase !== 'game') return false;
		if (!iPlayAt(table) || onEnterGame === undefined) return false;
		const state = tableState(table);
		return state !== 'finished' && state !== 'bye';
	}

	/** The points a finished table awards, looked up by seat — the panel's score column. */
	function scoreFor(table: TournamentTableView, occupant: TournamentOccupant): number | null {
		if (occupant.kind !== 'seat') return null;
		return table.match.scores.find((score) => score.seatIndex === occupant.seatIndex)?.vp ?? null;
	}

	/** Whether a seat won its table's match, so the score line can name the winner. */
	function won(table: TournamentTableView, occupant: TournamentOccupant): boolean {
		const result = table.match.result;
		if (result === null || result.kind !== 'played' || occupant.kind !== 'seat') return false;
		const seats = table.occupants.filter((other) => other.kind === 'seat');
		const position = seats.findIndex((other) => key(other) === key(occupant));
		return (
			(result.winner === 'player1' && position === 0) ||
			(result.winner === 'player2' && position === 1)
		);
	}

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
		const all = [...round.pool, ...round.tables.flatMap((table) => table.occupants)];
		return all.find((occupant) => key(occupant) === selected) ?? null;
	});
	const selectedIsSeated = $derived(
		selectedOccupant !== null &&
			round.tables.some((table) => table.occupants.some((occupant) => key(occupant) === selected))
	);

	function tableAccepts(table: TournamentTableView, occupant: TournamentOccupant | null): boolean {
		if (occupant === null) return false;
		// Dropping onto the table an occupant already sits at changes nothing, so it is allowed.
		if (table.occupants.some((other) => key(other) === key(occupant))) return true;
		return table.occupants.length < round.maxOccupants;
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

	async function advance(): Promise<void> {
		starting = true;
		if (concluding) await onConclude?.();
		else await onNextRound?.();
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

	/** One Enter Game at a time: a second press would only re-mint the seat it is about to take. */
	let entering = $state<number | null>(null);

	async function enter(tableIndex: number): Promise<void> {
		if (entering !== null) return;
		entering = tableIndex;
		await onEnterGame?.(tableIndex);
		entering = null;
	}

	/**
	 * The megaphone's send, in one place: the header's shout goes to every table and a panel's to
	 * its own, and both need the callback narrowed once rather than at every use site.
	 */
	async function shout(tableIndex: number | null, text: string): Promise<boolean> {
		const send = onShout;
		if (!send) return false;
		return send(tableIndex, text);
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
	<ScreenHeader title={view.name} onBack={onLeave} {megaphone}>
		{#snippet trailing()}
			<!-- The organizer's own megaphone: one shout at every table at once. A player's inbox is
			     the header's `megaphone` slot, and a playing organizer sends rather than reads. -->
			{#if canShout && !megaphone}
				<ToMegaphone
					label="Shout at every table"
					target="Every table"
					{error}
					onSend={(text) => shout(null, text)}
				/>
			{/if}
		{/snippet}
	</ScreenHeader>

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
							<span class="text-xs text-slate-200">· {mission.season}</span>
						{/if}
					</dd>
				</div>
			</dl>

			<h3 class="mt-4 text-xs font-semibold tracking-wide text-slate-200 uppercase">
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
			{#if running}
				<p class="mt-2 text-xs text-slate-200">The standing counts every round played so far.</p>
			{/if}
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
			<p class="-mt-2 text-center text-xs text-slate-200">
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
		{:else if round.phase === 'scoring' && isOrganizer}
			<button
				type="button"
				class="rounded-xl border-2 border-emerald-500/60 bg-emerald-500/15 px-8 py-4 text-xl font-bold text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/25 enabled:active:bg-emerald-500/35 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-900/60 disabled:text-slate-600"
				disabled={!round.scored || starting}
				onclick={() => void advance()}
			>
				{concluding ? 'Conclude Tournament' : 'Next Round'}
			</button>
			<p class="-mt-2 text-center text-xs text-slate-200">
				{#if concluding}
					Every table has reported. Ending the event freezes the standing for good.
				{:else}
					Every table has reported. The next round opens on the next mission, with the tables empty
					for a new pairing.
				{/if}
			</p>
		{:else}
			<p class="text-center text-sm text-slate-100">
				{#if round.phase === 'setup'}
					The organizer starts the round once every player is paired.
				{:else if round.phase === 'game'}
					Round {round.number} is being played.
				{:else}
					Round {round.number} is being scored — the organizer moves the event on.
				{/if}
			</p>
		{/if}

		<Panel title={running ? 'Tables' : 'Table Assignment'}>
			<p class="mb-3 text-xs text-slate-200">
				{#if round.phase !== 'setup'}
					The tables are locked — this round is under way.
				{:else if isOrganizer}
					Drag a player onto a table — or tap one, then tap where it goes.
				{:else}
					The organizer assigns the tables.
				{/if}
			</p>

			{#if !running}
				<div
					data-pool
					class="rounded-xl border-2 border-dashed p-3 transition {dropTarget === 'pool'
						? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-400'
						: 'border-slate-600/50 bg-slate-900/40'}"
				>
					<h3 class="text-xs font-semibold tracking-wide text-slate-200 uppercase">
						{view.needsBye ? 'Players & Bye' : 'Players'}
						<span class="ml-1 text-slate-300">({round.pool.length})</span>
					</h3>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each round.pool as occupant (key(occupant))}
							{@render chip(occupant)}
						{:else}
							<p class="text-xs text-slate-300">Everybody is at a table.</p>
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
			{/if}

			<ul class="{running ? '' : 'mt-3'} flex flex-col gap-3">
				{#each round.tables as table, index (index)}
					{@const state = running ? tableState(table) : null}
					{@const finished = state === 'finished' || state === 'bye'}
					<li
						data-table-index={index}
						class="relative rounded-xl border-2 p-3 transition {dropTarget === index
							? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400'
							: finished
								? 'border-slate-700/40 bg-slate-900/60 opacity-70'
								: 'border-slate-700/50 bg-slate-900/50'}"
					>
						<div class="flex items-baseline justify-between gap-3">
							<h3 class="min-w-0 truncate text-sm font-semibold text-slate-100">
								{tableName(index)}
							</h3>
							<div class="flex shrink-0 items-center gap-2">
								{#if finished}
									<span class="text-xs font-semibold text-slate-300 uppercase">
										{state === 'bye' ? 'Bye' : 'Game finished'}
									</span>
								{:else if state === 'abandoned'}
									<span class="text-xs font-semibold text-red-300 uppercase">Abandoned</span>
								{:else if state === 'live' || state === 'mine'}
									<span class="text-xs font-semibold text-emerald-300 uppercase">Playing</span>
								{/if}
								{#if canShout}
									<ToMegaphone
										small
										label="Shout at {tableName(index)}"
										target={tableName(index)}
										{error}
										onSend={(text) => shout(index, text)}
									/>
								{/if}
								{#if !running}
									<span class="text-xs text-slate-300">
										{table.occupants.length}/{round.maxOccupants}
									</span>
								{/if}
							</div>
						</div>

						{#if finished}
							<!-- The panel a concluded match leaves behind: greyed, with what it scored. -->
							<ul class="mt-2 flex flex-col gap-1">
								{#each table.occupants as occupant (key(occupant))}
									<li class="flex items-baseline justify-between gap-3 text-sm">
										<span
											class="min-w-0 truncate {won(table, occupant)
												? 'font-bold text-emerald-300'
												: 'text-slate-200'}"
										>
											{occupantLabel(occupant)}
										</span>
										<span class="shrink-0 font-bold text-slate-100">
											{#if scoreFor(table, occupant) !== null}
												{scoreFor(table, occupant)} VP
											{:else}
												—
											{/if}
										</span>
									</li>
								{/each}
							</ul>
							{#if state === 'bye'}
								<p class="mt-2 text-xs text-amber-300">
									The BYE sits at this table: its player sits this round out and takes it as a win.
								</p>
							{/if}
						{:else}
							<div class="mt-2 flex flex-wrap gap-2">
								{#each table.occupants as occupant (key(occupant))}
									{@render chip(occupant)}
								{:else}
									<p class="text-xs text-slate-300">Empty — drop a player here</p>
								{/each}
							</div>
							{#if holdsBye(table.occupants)}
								<p class="mt-2 text-xs text-amber-300">
									The BYE sits at this table: its player sits this round out and takes it as a win.
								</p>
							{/if}
							{#if state === 'abandoned'}
								<p class="mt-2 text-xs text-red-300">
									That match was closed before it ended. Enter Game again to play it from the top.
								</p>
							{:else if state === 'live'}
								<p class="mt-2 text-xs text-slate-200">This table is playing its match.</p>
							{/if}
							{#if canEnter(table)}
								<button
									type="button"
									class={enterButton}
									disabled={entering !== null}
									onclick={() => void enter(index)}
								>
									{#if entering === index}
										Entering…
									{:else if state === 'mine'}
										Return to your game
									{:else if state === 'abandoned'}
										Enter Game (replay)
									{:else}
										Enter Game
									{/if}
								</button>
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
