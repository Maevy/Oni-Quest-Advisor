import {
	acceptJoin as apiAcceptJoin,
	advancePhase as apiAdvancePhase,
	chooseScheme as apiChooseScheme,
	closeGame as apiCloseGame,
	createGame as apiCreateGame,
	deleteScheme as apiDeleteScheme,
	denyJoin as apiDenyJoin,
	draftSeat as apiDraftSeat,
	drawSchemes as apiDrawSchemes,
	fetchGameState,
	fetchJoinStatus,
	finishGame as apiFinishGame,
	gameEventsUrl,
	generateJoinToken,
	OnlineApiError,
	requestJoin as apiRequestJoin,
	selectMission as apiSelectMission,
	setObjectiveChecked as apiSetObjectiveChecked,
	setSchemeBoxChecked as apiSetSchemeBoxChecked,
	startGame as apiStartGame,
	toggleRevealIntent as apiToggleRevealIntent,
	type JoinStatus
} from '$lib/data/onlineApi';
import {
	clearOnlineSession,
	loadOnlineSession,
	saveOnlineSession,
	type OnlineSession
} from '$lib/data/onlineSession';
import { calculateTwoPlayerVP } from '$lib/domain';
import type { Mission, OnlineGameView, SchemeCard } from '$lib/domain';

/** Pending join request from the perspective of the joining phone (no seat yet). */
type PendingJoinAttempt = { gameId: string; nickname: string; token: string };

class OnlineGameStore {
	view = $state<OnlineGameView | null>(null);
	error = $state<string | null>(null);
	resuming = $state(false);
	/** Set while this phone waits for the leader to answer its join request. */
	pendingJoin = $state<PendingJoinAttempt | null>(null);

	private session: OnlineSession | null = null;
	private eventSource: EventSource | null = null;
	private fetchSeq = 0;

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
			await this.refreshState();
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

	async createGame(nickname: string): Promise<void> {
		const created = await apiCreateGame(nickname);
		this.session = { gameId: created.gameId, seat: created.seat, token: created.token };
		saveOnlineSession(this.session);
		this.error = null;
		await this.refreshState();
		this.subscribeToEvents();
	}

	async requestJoin(gameId: string, nickname: string): Promise<void> {
		const token = generateJoinToken();
		await apiRequestJoin(gameId, nickname, token);
		this.pendingJoin = { gameId, nickname, token };
	}

	/** Polls the join request; when accepted, takes the seat and loads the game. */
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
			this.pendingJoin = null;
			this.error = null;
			await this.refreshState();
			this.subscribeToEvents();
		}
		return status;
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

	async draftFaction(factionId: string | null): Promise<void> {
		await this.sendSetup((gameId, token) => apiDraftSeat(gameId, token, { factionId }));
	}

	async draftIntelligence(intelligence: number | null): Promise<void> {
		await this.sendSetup((gameId, token) => apiDraftSeat(gameId, token, { intelligence }));
	}

	async drawSchemes(): Promise<void> {
		await this.sendSetup((gameId, token) => apiDrawSchemes(gameId, token));
	}

	async chooseScheme(schemeId: string): Promise<void> {
		await this.sendSetup((gameId, token) => apiChooseScheme(gameId, token, schemeId));
	}

	async deleteScheme(): Promise<void> {
		await this.sendSetup((gameId, token) => apiDeleteScheme(gameId, token));
	}

	async selectMission(season: string, missionId: string): Promise<void> {
		await this.sendSetup((gameId, token) => apiSelectMission(gameId, token, season, missionId));
	}

	async startGame(): Promise<void> {
		await this.sendSetup((gameId, token) => apiStartGame(gameId, token));
	}

	// --- round engine actions ---

	async toggleRevealIntent(): Promise<void> {
		await this.sendSetup((gameId, token) => apiToggleRevealIntent(gameId, token));
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

	async advancePhase(): Promise<void> {
		await this.sendSetup((gameId, token) => apiAdvancePhase(gameId, token));
	}

	async finishGame(): Promise<void> {
		await this.sendSetup((gameId, token) => apiFinishGame(gameId, token));
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

	/** SSE carries change notifications; every notification triggers a full state refetch. */
	private subscribeToEvents(): void {
		this.unsubscribeFromEvents();
		if (!this.session) return;
		const source = new EventSource(gameEventsUrl(this.session.gameId, this.session.token));
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

	private teardown(): void {
		this.unsubscribeFromEvents();
		clearOnlineSession();
		this.session = null;
		this.view = null;
		this.pendingJoin = null;
		this.error = null;
	}
}

export const onlineGameStore = new OnlineGameStore();
