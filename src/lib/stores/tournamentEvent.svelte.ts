import {
	createTournament as apiCreateTournament,
	fetchTournamentPeek,
	fetchTournamentView,
	generateTournamentToken,
	joinTournament as apiJoinTournament,
	tournamentEventsUrl,
	TournamentApiError,
	type TournamentConfiguration
} from '$lib/data/tournamentApi';
import {
	clearTournamentSession,
	loadTournamentSession,
	saveTournamentSession,
	type TournamentSession
} from '$lib/data/tournamentSession';
import type { PickedArmy, TournamentEventView, TournamentPeek } from '$lib/domain';

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

	private session: TournamentSession | null = null;
	private eventSource: EventSource | null = null;
	private fetchSeq = 0;

	get code(): string | null {
		return this.view?.code ?? this.session?.code ?? null;
	}

	get isOrganizer(): boolean {
		return this.session?.role === 'organizer';
	}

	/** Restores a stored seat on app start. True when a tournament was resumed. */
	async resumeSession(): Promise<boolean> {
		const session = loadTournamentSession();
		if (!session) return false;
		this.session = session;
		this.resuming = true;
		try {
			await this.refreshState();
			this.subscribeToEvents();
			return true;
		} catch (error) {
			if (error instanceof TournamentApiError && (error.status === 401 || error.status === 404)) {
				this.teardown();
				return false;
			}
			this.error = messageOf(error);
			return true;
		} finally {
			this.resuming = false;
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

	/** Leaves locally — the server-side tournament stays as it is. */
	leave(): void {
		this.teardown();
	}

	/** Gives up a join attempt without touching a session this device may already hold. */
	cancelJoin(): void {
		this.peek = null;
		this.error = null;
	}

	private async refreshState(): Promise<void> {
		if (!this.session) return;
		const seq = ++this.fetchSeq;
		const view = await fetchTournamentView(this.session.code, this.session.token);
		if (seq === this.fetchSeq) {
			this.view = view;
			this.error = null;
		}
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

	private teardown(): void {
		this.unsubscribeFromEvents();
		clearTournamentSession();
		this.session = null;
		this.view = null;
		this.peek = null;
		this.error = null;
	}
}

export const tournamentEventStore = new TournamentEventStore();
