const HEARTBEAT_MS = 25_000;

type Sender = (frame: string) => void;

type ChannelRegistry = {
	/** How many SSE streams are currently attached to one id (0 when none). */
	subscriberCount: (id: string) => number;
	/** Total number of open streams in this registry (operational probe). */
	openStreamCount: () => number;
	notify: (id: string, eventType: string) => void;
	subscribe: (id: string, signal?: AbortSignal) => ReadableStream<Uint8Array>;
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
		subscribe(id, signal) {
			const encoder = new TextEncoder();
			let heartbeat: ReturnType<typeof setInterval> | null = null;
			let send: Sender | null = null;
			let detached = false;

			// The one cleanup path, reached from three triggers: the consumer cancelling, the
			// request's abort signal firing when the client disconnects, and the heartbeat finding
			// the stream already dead. Idempotent because whichever fires first wins. It has to be
			// reachable from more than cancel() alone because a sender left behind in the channel
			// keeps occupying a slot of the subscriber cap — eight per game — so a leak eventually
			// locks out the real players reconnecting to that game.
			const detach = () => {
				if (detached) return;
				detached = true;
				if (heartbeat) clearInterval(heartbeat);
				heartbeat = null;
				signal?.removeEventListener('abort', detach);
				const channel = channels.get(id);
				if (channel && send) {
					channel.delete(send);
					if (channel.size === 0) channels.delete(id);
				}
				send = null;
			};

			return new ReadableStream<Uint8Array>({
				start(controller) {
					// A request already aborted on arrival gets no stream and takes no cap slot.
					if (signal?.aborted) {
						controller.close();
						return;
					}
					send = (frame) => {
						try {
							controller.enqueue(encoder.encode(frame));
						} catch {
							// enqueue throws once the stream is closed or errored, which is the
							// consumer saying it is gone.
							detach();
						}
					};
					let channel = channels.get(id);
					if (!channel) {
						channel = new Set();
						channels.set(id, channel);
					}
					channel.add(send);
					controller.enqueue(encoder.encode(': connected\n\n'));
					heartbeat = setInterval(() => {
						// desiredSize is null once the stream is closed or errored. A consumer that
						// vanishes without cancelling never reaches cancel(), so this is the backstop
						// that stops the interval — and frees the cap slot — instead of letting both
						// run for the lifetime of the process.
						if (controller.desiredSize === null) {
							detach();
							return;
						}
						send?.(': heartbeat\n\n');
					}, HEARTBEAT_MS);
					signal?.addEventListener('abort', detach, { once: true });
				},
				cancel() {
					detach();
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

/**
 * Opens a stream on a game's channel. Pass the route's `request.signal`: it aborts when the client
 * disconnects, which is what frees the subscriber slot. Omitting it leaves cleanup to `cancel()`
 * alone, and a consumer that vanishes without cancelling is never reclaimed.
 */
export function subscribeToGame(gameId: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
	return games.subscribe(gameId, signal);
}

/** As `subscribeToGame`, for a tournament lobby's channel. */
export function subscribeToTournament(
	tournamentId: string,
	signal?: AbortSignal
): ReadableStream<Uint8Array> {
	return tournaments.subscribe(tournamentId, signal);
}
