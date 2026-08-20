const HEARTBEAT_MS = 25_000;

type Sender = (frame: string) => void;

/** In-process channel registry, keyed by game id. One Node process = one registry. */
const channels = new Map<string, Set<Sender>>();

/**
 * SSE events are lightweight change notifications — clients refetch the full
 * (visibility-filtered) state when they receive one, so no replay logic is needed.
 */
export function notifyGameChanged(gameId: string, eventType: string): void {
	const channel = channels.get(gameId);
	if (!channel || channel.size === 0) return;
	const frame = `event: change\ndata: ${JSON.stringify({ type: eventType })}\n\n`;
	for (const send of channel) send(frame);
}

export function subscribeToGame(gameId: string): ReadableStream<Uint8Array> {
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
			let channel = channels.get(gameId);
			if (!channel) {
				channel = new Set();
				channels.set(gameId, channel);
			}
			channel.add(send);
			controller.enqueue(encoder.encode(': connected\n\n'));
			heartbeat = setInterval(() => send?.(': heartbeat\n\n'), HEARTBEAT_MS);
		},
		cancel() {
			if (heartbeat) clearInterval(heartbeat);
			const channel = channels.get(gameId);
			if (channel && send) {
				channel.delete(send);
				if (channel.size === 0) channels.delete(gameId);
			}
		}
	});
}
