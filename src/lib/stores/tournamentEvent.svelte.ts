import {
	assignTournamentOccupant as apiAssignOccupant,
	cancelTournament as apiCancelTournament,
	concludeTournament as apiConcludeTournament,
	createTournament as apiCreateTournament,
	enterTournamentTableGame as apiEnterTableGame,
	fetchTournamentPeek,
	fetchTournamentReport,
	fetchTournamentView,
	generateTournamentToken,
	joinTournament as apiJoinTournament,
	leaveTournament as apiLeaveTournament,
	markTournamentMessagesRead as apiMarkMessagesRead,
	nextTournamentRound as apiNextRound,
	sendTournamentMessage as apiSendMessage,
	startTournament as apiStartTournament,
	startTournamentRound as apiStartRound,
	tournamentEventsUrl,
	TournamentApiError,
	type TableGameSession,
	type TournamentConfiguration
} from '$lib/data/tournamentApi';
import {
	clearTournamentSession,
	loadTournamentSession,
	saveTournamentSession,
	type TournamentSession
} from '$lib/data/tournamentSession';
import type {
	PickedArmy,
	TournamentEventView,
	TournamentOccupant,
	TournamentPeek,
	TournamentReportData
} from '$lib/domain';

function messageOf(error: unknown): string {
	if (error instanceof TournamentApiError) return error.message;
	return 'Could not reach the tournament server.';
}

/**
 * The live tournament on this device: the organizer's lobby or a player's read-only copy of it.
 * Server-authoritative like `onlineGameStore` — every action is an intent to the API followed
 * by a refetch of the visibility-filtered view, and SSE notifications trigger refetches so a
 * join shows up on every phone in the lobby without polling.
 */
class TournamentEventStore {
	view = $state<TournamentEventView | null>(null);
	/** The join page's pre-join look at the tournament; null once seated or left. */
	peek = $state<TournamentPeek | null>(null);
	error = $state<string | null>(null);
	resuming = $state(false);
	/**
	 * Something happened server-side that ends this device's participation — today only the
	 * organizer cancelling. Survives the teardown that follows, so the page can say why the
	 * lobby is gone instead of dropping the player on the menu in silence.
	 */
	notice = $state<string | null>(null);

	private session: TournamentSession | null = null;
	private eventSource: EventSource | null = null;
	private fetchSeq = 0;

	get code(): string | null {
		return this.view?.code ?? this.session?.code ?? null;
	}

	get isOrganizer(): boolean {
		return this.session?.role === 'organizer';
	}

	/** The event's name for the resume prompt; null when the server could not be reached. */
	get tournamentName(): string | null {
		return this.view?.name ?? null;
	}

	/**
	 * Restores a stored seat on app start: fetches the current view and subscribes, but leaves
	 * navigation to the page, which offers to return rather than dropping straight into the
	 * lobby. True when a session this device can still use was restored.
	 */
	async resumeSession(): Promise<boolean> {
		const session = loadTournamentSession();
		if (!session) return false;
		this.session = session;
		this.resuming = true;
		try {
			await this.refreshState();
			this.subscribeToEvents();
			// A tournament cancelled while the app was shut tears its session down in
			// `refreshState`; there is then nothing to return to, only the notice.
			return this.session !== null;
		} catch (error) {
			if (error instanceof TournamentApiError && (error.status === 401 || error.status === 404)) {
				this.teardown();
				return false;
			}
			// Network trouble: keep the session so the prompt can offer a retry from the lobby.
			this.error = messageOf(error);
			return true;
		} finally {
			this.resuming = false;
		}
	}

	/**
	 * Refetches after a resume that did not get through. A token or tournament the server no
	 * longer knows ends the session outright — the device would otherwise keep offering a return
	 * into a lobby that is gone.
	 */
	async retry(): Promise<void> {
		if (!this.session) return;
		this.error = null;
		try {
			await this.refreshState();
			// A resumed-then-retried session never got its stream, so without this the lobby
			// would sit on the fetched view and miss every later change until a reload.
			this.subscribeToEvents();
		} catch (error) {
			if (error instanceof TournamentApiError && (error.status === 401 || error.status === 404)) {
				this.teardown();
				this.notice = 'This tournament no longer exists.';
				return;
			}
			this.error = messageOf(error);
		}
	}

	/** Creates the tournament on the server and seats the organizer. True on success. */
	async create(configuration: TournamentConfiguration): Promise<boolean> {
		this.error = null;
		try {
			const created = await apiCreateTournament(configuration);
			this.session = {
				code: created.code,
				role: 'organizer',
				token: created.token,
				seatIndex: configuration.organizerPlays ? 0 : null
			};
			saveTournamentSession(this.session);
			await this.refreshState();
			this.subscribeToEvents();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/** The join page's first look at a tournament; a missing one lands in `error`. */
	async loadPeek(code: string): Promise<void> {
		this.error = null;
		try {
			this.peek = await fetchTournamentPeek(code);
		} catch (error) {
			this.peek = null;
			this.error = messageOf(error);
		}
	}

	/** Takes the first free seat and enters the lobby as that player. True on success. */
	async join(code: string, name: string, army: PickedArmy): Promise<boolean> {
		this.error = null;
		try {
			const token = generateTournamentToken();
			const joined = await apiJoinTournament(code, name, army, token);
			this.session = { code, role: 'player', token, seatIndex: joined.seatIndex };
			saveTournamentSession(this.session);
			this.peek = null;
			await this.refreshState();
			this.subscribeToEvents();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * The organizer starts the event. The lobby closes with it — nobody joins or leaves a running
	 * round — and round 1 opens with every table empty, waiting to be assigned.
	 */
	async start(): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiStartTournament(this.session.code, this.session.token);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * The organizer moves one occupant — a player's seat or the BYE — to a table, or back to the
	 * pool when `tableIndex` is null. Server-authoritative like everything else: the board the
	 * players see is the refetched one, never a locally patched copy.
	 */
	async assign(occupant: TournamentOccupant, tableIndex: number | null): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiAssignOccupant(this.session.code, this.session.token, occupant, tableIndex);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * The organizer starts the round. The roadmap moves a step on for every device and the tables
	 * lock — the pairing a match is played from cannot change while it is being played.
	 */
	async startRound(): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiStartRound(this.session.code, this.session.token);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * A player sits down at the match their table plays. The session that comes back is an
	 * ordinary online game seat, which the page hands to `onlineGameStore` — from there the match
	 * is an ordinary online game, mission already set, and both players follow the online flow.
	 */
	async enterTableGame(tableIndex: number): Promise<TableGameSession | null> {
		if (!this.session) return null;
		this.error = null;
		try {
			const session = await apiEnterTableGame(this.session.code, this.session.token, tableIndex);
			// The board changed for everybody: this table's match exists now.
			await this.refreshState();
			return session;
		} catch (error) {
			this.error = messageOf(error);
			return null;
		}
	}

	/** The organizer opens the next round once every table has reported. */
	async nextRound(): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiNextRound(this.session.code, this.session.token);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/** The organizer ends the event after its last round; every device moves to the standing. */
	async conclude(): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiConcludeTournament(this.session.code, this.session.token);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * The organizer's megaphone: a shout at one table, or at every table when `tableIndex` is
	 * null. It reaches the players wherever they are, including inside the match it interrupts.
	 */
	async sendMessage(tableIndex: number | null, text: string): Promise<boolean> {
		if (!this.session) return false;
		this.error = null;
		try {
			await apiSendMessage(this.session.code, this.session.token, tableIndex, text);
			await this.refreshState();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/**
	 * The inbox closes, so the megaphone stops glowing. A failure is swallowed: all it would mean
	 * is a badge that stays lit, and the next refetch tries again.
	 */
	async readMessages(): Promise<void> {
		if (!this.session) return;
		try {
			await apiMarkMessagesRead(this.session.code, this.session.token);
			await this.refreshState();
		} catch {
			// Nothing worth telling the player about — the messages are already on screen.
		}
	}

	/**
	 * Walks out of an event that has concluded. Unlike every other exit this one is local: there
	 * is no seat left to free, and freeing one would drop that player out of the archived standing
	 * the report window exists to keep.
	 */
	leaveConcluded(): void {
		this.teardown();
	}

	/**
	 * Gives up this device's place in the tournament — the only way out, and it always reaches
	 * the server: a player frees their seat for the next joiner, the organizer cancels the event
	 * for everyone. False (with the reason in `error`) when the server could not be told, in
	 * which case the session is kept so the player can retry rather than stranding a seat.
	 */
	async abandon(): Promise<boolean> {
		if (!this.session) return true;
		this.error = null;
		// A concluded event has nothing left to free — and freeing a seat would drop that player
		// out of the archived standing the report window exists to keep.
		if (this.view?.status === 'concluded') {
			this.leaveConcluded();
			return true;
		}
		try {
			if (this.session.role === 'organizer') {
				await apiCancelTournament(this.session.code, this.session.token);
			} else {
				await apiLeaveTournament(this.session.code, this.session.token);
			}
			this.teardown();
			return true;
		} catch (error) {
			this.error = messageOf(error);
			return false;
		}
	}

	/** Gives up a join attempt without touching a session this device may already hold. */
	cancelJoin(): void {
		this.peek = null;
		this.error = null;
	}

	/** Acknowledges the cancellation notice; the session is already gone by then. */
	dismissNotice(): void {
		this.notice = null;
	}

	/**
	 * The report's raw material - the organizer's own call; the endpoint refuses everybody else.
	 * Returns null (with the error surfaced) when the fetch fails, so the button can stay put.
	 */
	async fetchReport(): Promise<TournamentReportData | null> {
		if (!this.session) return null;
		try {
			this.error = null;
			return await fetchTournamentReport(this.session.code, this.session.token);
		} catch (error) {
			this.error = messageOf(error);
			return null;
		}
	}

	private async refreshState(): Promise<void> {
		if (!this.session) return;
		const seq = ++this.fetchSeq;
		const view = await fetchTournamentView(this.session.code, this.session.token);
		if (seq !== this.fetchSeq) return;
		if (view.status === 'closed') {
			// The organizer cancelled while this device was watching (or away): there is no
			// lobby to return to, so say why and drop the session.
			this.teardown();
			this.notice = 'The organizer cancelled this tournament.';
			return;
		}
		this.view = view;
		this.error = null;
	}

	/** SSE carries change notifications; every notification triggers a full view refetch. */
	private subscribeToEvents(): void {
		this.unsubscribeFromEvents();
		if (!this.session) return;
		const source = new EventSource(tournamentEventsUrl(this.session.code, this.session.token));
		const refetch = () => {
			this.refreshState().catch(() => {
				// Next notification or the manual retry covers transient failures.
			});
		};
		source.addEventListener('change', refetch);
		source.addEventListener('open', refetch);
		this.eventSource = source;
	}

	private unsubscribeFromEvents(): void {
		this.eventSource?.close();
		this.eventSource = null;
	}

	/**
	 * Drops everything about this device's participation. Invalidates the fetch sequence so an
	 * in-flight response cannot resurrect a view for a session that is already gone, and keeps
	 * `notice` — that one is for the page to show *after* the teardown.
	 */
	private teardown(): void {
		this.fetchSeq += 1;
		this.unsubscribeFromEvents();
		clearTournamentSession();
		this.session = null;
		this.view = null;
		this.peek = null;
		this.error = null;
	}
}

export const tournamentEventStore = new TournamentEventStore();
