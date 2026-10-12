import {
	acceptJoin as apiAcceptJoin,
	advancePhase as apiAdvancePhase,
	chooseScheme as apiChooseScheme,
	closeGame as apiCloseGame,
	commitVitality as apiCommitVitality,
	createGame as apiCreateGame,
	deleteScheme as apiDeleteScheme,
	denyJoin as apiDenyJoin,
	drawSchemes as apiDrawSchemes,
	fetchGameState,
	fetchHistory as apiFetchHistory,
	fetchJoinStatus,
	gameEventsUrl,
	generateJoinToken,
	OnlineApiError,
	publishRoster as apiPublishRoster,
	requestJoin as apiRequestJoin,
	setCombatArmy as apiSetCombatArmy,
	setLeader as apiSetLeader,
	setObjectiveChecked as apiSetObjectiveChecked,
	setSchemeBoxChecked as apiSetSchemeBoxChecked,
	startGame as apiStartGame,
	toggleReady as apiToggleReady,
	revealScheme as apiRevealScheme,
	undoVitality as apiUndoVitality,
	type JoinStatus
} from '$lib/data/onlineApi';
import {
	clearOnlineSession,
	loadOnlineSession,
	saveOnlineSession,
	type OnlineSession
} from '$lib/data/onlineSession';
import { calculateTwoPlayerVP } from '$lib/domain';
import type {
	ArmyEntry,
	HistoryEntry,
	Mission,
	OnlineGameSetup,
	OnlineGameView,
	PickedArmy,
	SchemeCard,
	SeatLeader,
	VitalityCommitInput
} from '$lib/domain';

/** Pending join request from the perspective of the joining phone (no seat yet). */
type PendingJoinAttempt = { gameId: string; nickname: string; token: string };

class OnlineGameStore {
	view = $state<OnlineGameView | null>(null);
	error = $state<string | null>(null);
	resuming = $state(false);
	/** Set while this phone waits for the leader to answer its join request. */
	pendingJoin = $state<PendingJoinAttempt | null>(null);
	/**
	 * The match's interaction log, in order: what the history panel lists and what both boards'
	 * vitality folds from. Server-owned like everything else here - a commit refetches it.
	 */
	history = $state<HistoryEntry[]>([]);
	/** When the game was created, from the database: the battle report's match date. */
	startedAt = $state<string | null>(null);

	private session: OnlineSession | null = null;
	private eventSource: EventSource | null = null;
	private fetchSeq = 0;
	private historySeq = 0;
	/** The publish effect re-runs on every refetch; one publish in flight at a time. */
	private publishing = false;

	get gameCode(): string | null {
		return this.view?.id ?? this.session?.gameId ?? null;
	}

	get isLeader(): boolean {
		return this.session?.seat === 'player1';
	}

	/** Restores a stored seat on app start. True when a game was resumed. */
	async resumeSession(): Promise<boolean> {
		const session = loadOnlineSession();
		if (!session) return false;
		this.session = session;
		this.resuming = true;
		try {
			await this.refreshAll();
			this.subscribeToEvents();
			return true;
		} catch (error) {
			if (error instanceof OnlineApiError && (error.status === 401 || error.status === 404)) {
				this.teardown();
				return false;
			}
			// Network trouble: keep the session so the game screen can retry.
			this.error = 'Could not reach the game server.';
			return true;
		} finally {
			this.resuming = false;
		}
	}

	/** Creates the game from the draft the create screen collected. */
	async createGame(nickname: string, setup: OnlineGameSetup): Promise<void> {
		const created = await apiCreateGame(nickname, setup);
		this.session = { gameId: created.gameId, seat: created.seat, token: created.token };
		saveOnlineSession(this.session);
		this.error = null;
		await this.refreshAll();
		this.subscribeToEvents();
	}

	/**
	 * Takes over a seat this device never created: a tournament table's match, which the server
	 * built from the pairing and handed back as an ordinary session. Whatever sat here before is
	 * dropped first — one device plays one game at a time.
	 */
	async adoptSession(session: OnlineSession): Promise<void> {
		this.teardown();
		this.session = session;
		saveOnlineSession(session);
		this.error = null;
		await this.refreshAll();
		this.subscribeToEvents();
	}

	async requestJoin(gameId: string, nickname: string, army: PickedArmy): Promise<void> {
		const token = generateJoinToken();
		await apiRequestJoin(gameId, nickname, token, army);
		this.pendingJoin = { gameId, nickname, token };
	}

	/**
	 * Polls the join request; when accepted, takes the seat and loads the game.
	 * The attempt stays pending until the page calls `completePendingJoin()` —
	 * clearing it earlier would tear down the join screen's polling effect
	 * before it can navigate into the game.
	 */
	async pollPendingJoin(): Promise<JoinStatus> {
		const attempt = this.pendingJoin;
		if (!attempt) return 'pending';
		let status: JoinStatus;
		try {
			status = (await fetchJoinStatus(attempt.gameId, attempt.nickname, attempt.token)).status;
		} catch (error) {
			if (error instanceof OnlineApiError && error.status === 404) return 'closed';
			return 'pending';
		}
		if (status === 'accepted') {
			this.session = { gameId: attempt.gameId, seat: 'player2', token: attempt.token };
			saveOnlineSession(this.session);
			this.error = null;
			await this.refreshAll();
			this.subscribeToEvents();
		}
		return status;
	}

	/** Clears a successful join attempt once the page has transitioned into the game. */
	completePendingJoin(): void {
		this.pendingJoin = null;
	}

	cancelPendingJoin(): void {
		this.pendingJoin = null;
	}

	async acceptJoin(): Promise<void> {
		if (!this.session) return;
		await apiAcceptJoin(this.session.gameId, this.session.token);
		await this.refreshState();
	}

	async denyJoin(): Promise<void> {
		if (!this.session) return;
		await apiDenyJoin(this.session.gameId, this.session.token);
		await this.refreshState();
	}

	async closeGame(): Promise<void> {
		if (!this.session) return;
		await apiCloseGame(this.session.gameId, this.session.token);
		await this.refreshState();
	}

	// --- setup actions (server-authoritative: send intent, then refetch) ---

	async drawSchemes(): Promise<void> {
		await this.sendSetup((gameId, token) => apiDrawSchemes(gameId, token));
	}

	async chooseScheme(schemeId: string): Promise<void> {
		await this.sendSetup((gameId, token) => apiChooseScheme(gameId, token, schemeId));
	}

	async deleteScheme(): Promise<void> {
		await this.sendSetup((gameId, token) => apiDeleteScheme(gameId, token));
	}

	/** Flips this seat's lobby readiness; the leader's Start Game needs both seats ready. */
	async toggleReady(): Promise<void> {
		await this.sendSetup((gameId, token) => apiToggleReady(gameId, token));
	}

	// --- preparation ---

	/** Registers the Standard list this seat fields, cut down from the Roster army it brought. */
	async setCombatArmy(army: PickedArmy): Promise<void> {
		await this.sendSetup((gameId, token) => apiSetCombatArmy(gameId, token, army));
	}

	/**
	 * Assigns this seat's Leader from the match list, declaring the M and INT the initiative roll
	 * will need. Only those two numbers are ever published, and only from Scheme selection on.
	 */
	async setLeader(leader: SeatLeader | null): Promise<void> {
		await this.sendSetup((gameId, token) => apiSetLeader(gameId, token, leader));
	}

	async startGame(): Promise<void> {
		await this.sendSetup((gameId, token) => apiStartGame(gameId, token));
	}

	// --- round engine actions ---

	/**
	 * Leader-only step forward: preparation → Scheme setup → round 1, then each round's
	 * Reveal → Scoring → next round. Which step it takes is the server's decision, from the phase.
	 */
	async advancePhase(): Promise<void> {
		await this.sendSetup((gameId, token) => apiAdvancePhase(gameId, token));
	}

	/** Reveals this seat's scheme, immediately and irreversibly — the confirm lives in the UI. */
	async revealScheme(): Promise<void> {
		await this.sendSetup((gameId, token) => apiRevealScheme(gameId, token));
	}

	async setObjectiveChecked(objectiveId: string, checkedCount: number): Promise<void> {
		await this.sendSetup((gameId, token) =>
			apiSetObjectiveChecked(gameId, token, objectiveId, checkedCount)
		);
	}

	async setSchemeChecked(checkedIncrements: number): Promise<void> {
		await this.sendSetup((gameId, token) =>
			apiSetSchemeBoxChecked(gameId, token, checkedIncrements)
		);
	}

	// --- the flower board (server-authoritative: the log is the state) ---

	/** Appends one flower-dialog commit to the match's log; both boards refold from it. */
	async commitVitality(commit: VitalityCommitInput): Promise<void> {
		await this.sendBoard((gameId, token) => apiCommitVitality(gameId, token, commit));
	}

	/** Walks this seat's own latest interaction back, while it is still the last one. */
	async undoVitality(seq: number): Promise<void> {
		await this.sendBoard((gameId, token) => apiUndoVitality(gameId, token, seq));
	}

	/**
	 * Publishes this seat's combat list as board entries, once the round is running. The server
	 * cannot derive entry ids from the stored code, so each device declares its own - and the
	 * opponent's half of the board stays empty until their device has done the same. A 409 here
	 * is the once-only guard answering a duplicate publish that raced its own refetch, which is
	 * the success case, not an error the player needs to see.
	 */
	async publishRoster(entries: ArmyEntry[]): Promise<void> {
		if (!this.session || this.publishing) return;
		this.publishing = true;
		try {
			await apiPublishRoster(this.session.gameId, this.session.token, entries);
			await this.refreshAll();
		} catch (error) {
			if (error instanceof OnlineApiError && error.status === 409) {
				await this.refreshAll().catch(() => undefined);
				return;
			}
			this.error = error instanceof Error ? error.message : 'Action failed.';
		} finally {
			this.publishing = false;
		}
	}

	/** The seat's own VP (opponent scheme VP stays hidden until revealed). */
	myVP(mission: Mission, schemeCard: SchemeCard | null): number {
		if (!this.view) return 0;
		return calculateTwoPlayerVP(mission, this.view.self.progress, schemeCard);
	}

	private async sendSetup(action: (gameId: string, token: string) => Promise<void>): Promise<void> {
		if (!this.session) return;
		this.error = null;
		try {
			await action(this.session.gameId, this.session.token);
			await this.refreshState();
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Action failed.';
		}
	}

	/** A board intent changes the log rather than the state document, so both come back. */
	private async sendBoard(action: (gameId: string, token: string) => Promise<void>): Promise<void> {
		if (!this.session) return;
		this.error = null;
		try {
			await action(this.session.gameId, this.session.token);
			await this.refreshAll();
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Action failed.';
		}
	}

	/** Leaves locally (main menu / closed / finished) — the server-side game stays as it is. */
	leave(): void {
		this.teardown();
	}

	private async refreshState(): Promise<void> {
		if (!this.session) return;
		const seq = ++this.fetchSeq;
		const view = await fetchGameState(this.session.gameId, this.session.token);
		if (seq === this.fetchSeq) {
			this.view = view;
			this.error = null;
		}
	}

	private async refreshHistory(): Promise<void> {
		if (!this.session) return;
		const seq = ++this.historySeq;
		const body = await apiFetchHistory(this.session.gameId, this.session.token);
		if (seq === this.historySeq) {
			this.history = body.history;
			this.startedAt = body.startedAt;
		}
	}

	/** The state document and the interaction log, for screens that show both. */
	private async refreshAll(): Promise<void> {
		await Promise.all([this.refreshState(), this.refreshHistory()]);
	}

	/** SSE carries change notifications; every notification triggers a full state refetch. */
	private subscribeToEvents(): void {
		this.unsubscribeFromEvents();
		if (!this.session) return;
		const source = new EventSource(gameEventsUrl(this.session.gameId, this.session.token));
		const refetch = () => {
			this.refreshAll().catch(() => {
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

	private teardown(): void {
		this.unsubscribeFromEvents();
		clearOnlineSession();
		this.session = null;
		this.view = null;
		this.history = [];
		this.startedAt = null;
		this.pendingJoin = null;
		this.error = null;
	}
}

export const onlineGameStore = new OnlineGameStore();
