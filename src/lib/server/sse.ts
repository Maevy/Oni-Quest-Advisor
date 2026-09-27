const HEARTBEAT_MS = 25_000;

type Sender = (frame: string) => void;

type ChannelRegistry = {
	/** How many SSE streams are currently attached to one id (0 when none). */
	subscriberCount: (id: string) => number;
	/** Total number of open streams in this registry (operational probe). */
	openStreamCount: () => number;
	notify: (id: string, eventType: string) => void;
	subscribe: (id: string) => ReadableStream<Uint8Array>;
};

/**
 * In-process channel registry, keyed by entity id. One Node process = one registry, which is
 * why the app must stay at exactly one machine.
 */
function createChannelRegistry(): ChannelRegistry {
	const channels = new Map<string, Set<Sender>>();

	return {
		subscriberCount(id) {
			return channels.get(id)?.size ?? 0;
		},
		openStreamCount() {
			let total = 0;
			for (const channel of channels.values()) total += channel.size;
			return total;
		},
		/**
		 * SSE events are lightweight change notifications — clients refetch the full
		 * (visibility-filtered) state when they receive one, so no replay logic is needed.
		 */
		notify(id, eventType) {
			const channel = channels.get(id);
			if (!channel || channel.size === 0) return;
			const frame = `event: change\ndata: ${JSON.stringify({ type: eventType })}\n\n`;
			for (const send of channel) send(frame);
		},
		subscribe(id) {
			const encoder = new TextEncoder();
			let heartbeat: ReturnType<typeof setInterval> | null = null;
			let send: Sender | null = null;

			return new ReadableStream<Uint8Array>({
				start(controller) {
					send = (frame) => {
						try {
							controller.enqueue(encoder.encode(frame));
						} catch {
							// Stream already closed; cancel() cleans up.
						}
					};
					let channel = channels.get(id);
					if (!channel) {
						channel = new Set();
						channels.set(id, channel);
					}
					channel.add(send);
					controller.enqueue(encoder.encode(': connected\n\n'));
					heartbeat = setInterval(() => send?.(': heartbeat\n\n'), HEARTBEAT_MS);
				},
				cancel() {
					if (heartbeat) clearInterval(heartbeat);
					const channel = channels.get(id);
					if (channel && send) {
						channel.delete(send);
						if (channel.size === 0) channels.delete(id);
					}
				}
			});
		}
	};
}

const games = createChannelRegistry();
const tournaments = createChannelRegistry();

/** How many SSE streams are currently attached to a game (0 when none). */
export function subscriberCount(gameId: string): number {
	return games.subscriberCount(gameId);
}

/** How many SSE streams are currently attached to a tournament (0 when none). */
export function tournamentSubscriberCount(tournamentId: string): number {
	return tournaments.subscriberCount(tournamentId);
}

/** Total number of open SSE streams across games and tournaments (operational probe). */
export function openStreamCount(): number {
	return games.openStreamCount() + tournaments.openStreamCount();
}

export function notifyGameChanged(gameId: string, eventType: string): void {
	games.notify(gameId, eventType);
}

export function notifyTournamentChanged(tournamentId: string, eventType: string): void {
	tournaments.notify(tournamentId, eventType);
}

export function subscribeToGame(gameId: string): ReadableStream<Uint8Array> {
	return games.subscribe(gameId);
}

export function subscribeToTournament(tournamentId: string): ReadableStream<Uint8Array> {
	return tournaments.subscribe(tournamentId);
}
