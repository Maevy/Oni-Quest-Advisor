import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	notifyGameChanged,
	openStreamCount,
	subscribeToGame,
	subscribeToTournament,
	subscriberCount,
	tournamentSubscriberCount
} from './sse';

/** Mirrors HEARTBEAT_MS, which the module keeps private. */
const HEARTBEAT_MS = 25_000;

/**
 * Reads one frame. `start()` enqueues `: connected` synchronously during construction, so the first
 * read resolves without waiting on a heartbeat or a notification.
 */
async function readFrame(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
	const { value, done } = await reader.read();
	return done ? '' : new TextDecoder().decode(value);
}

describe('sse channel registry', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('takes a subscriber slot as soon as the stream is created', async () => {
		const id = 'GAME-SLOT';
		const stream = subscribeToGame(id);
		// Registration happens in start(), which the Streams spec runs during construction - so a
		// slot is consumed before anything reads the stream, and before the Response is returned.
		expect(subscriberCount(id)).toBe(1);
		await stream.cancel();
		expect(subscriberCount(id)).toBe(0);
	});

	it('frees the slot when the consumer cancels', async () => {
		const id = 'GAME-CANCEL';
		const stream = subscribeToGame(id);
		await stream.cancel();
		expect(subscriberCount(id)).toBe(0);
	});

	// The regression this file exists for: a client that vanishes without cancelling never reaches
	// cancel(), so before the abort signal was threaded through, its sender stayed in the channel
	// for the lifetime of the process - occupying one of the eight cap slots per game.
	it('frees the slot when the request signal aborts', () => {
		const id = 'GAME-ABORT';
		const controller = new AbortController();
		subscribeToGame(id, controller.signal);
		expect(subscriberCount(id)).toBe(1);
		controller.abort();
		expect(subscriberCount(id)).toBe(0);
	});

	it('takes no slot and yields a closed stream when the signal is already aborted', async () => {
		const id = 'GAME-PREABORTED';
		const controller = new AbortController();
		controller.abort();
		const stream = subscribeToGame(id, controller.signal);
		expect(subscriberCount(id)).toBe(0);
		expect((await stream.getReader().read()).done).toBe(true);
	});

	it('exhausts the eight slots a game allows, then recovers every one of them', () => {
		const id = 'GAME-CAP';
		const controllers = Array.from({ length: 8 }, () => new AbortController());
		for (const controller of controllers) subscribeToGame(id, controller.signal);
		// MAX_SUBSCRIBERS_PER_GAME in the events route refuses a ninth subscriber at this count, so
		// eight abandoned streams are enough to lock the real players out of their own game.
		expect(subscriberCount(id)).toBe(8);
		for (const controller of controllers) controller.abort();
		expect(subscriberCount(id)).toBe(0);
	});

	it('keeps the survivor attached and notified when one of two subscribers aborts', async () => {
		const id = 'GAME-TWO';
		const doomed = new AbortController();
		const kept = subscribeToGame(id);
		subscribeToGame(id, doomed.signal);
		expect(subscriberCount(id)).toBe(2);

		doomed.abort();
		expect(subscriberCount(id)).toBe(1);

		const reader = kept.getReader();
		expect(await readFrame(reader)).toContain(': connected');
		notifyGameChanged(id, 'vitality-committed');
		expect(await readFrame(reader)).toContain('vitality-committed');

		// Cancel through the reader: the stream is locked while one is held, and cancelling the
		// stream directly would throw rather than reach the source's cancel().
		await reader.cancel();
		expect(subscriberCount(id)).toBe(0);
	});

	it('survives abort and cancel both firing, in either order', async () => {
		const id = 'GAME-BOTH';
		const controller = new AbortController();
		const stream = subscribeToGame(id, controller.signal);
		controller.abort();
		await stream.cancel();
		controller.abort();
		expect(subscriberCount(id)).toBe(0);
	});

	it('sends a heartbeat while attached and stops once detached', async () => {
		vi.useFakeTimers();
		const id = 'GAME-HEARTBEAT';
		const controller = new AbortController();
		const stream = subscribeToGame(id, controller.signal);
		const reader = stream.getReader();
		expect(await readFrame(reader)).toContain(': connected');

		vi.advanceTimersByTime(HEARTBEAT_MS);
		expect(await readFrame(reader)).toContain('heartbeat');

		controller.abort();
		expect(subscriberCount(id)).toBe(0);
		// The interval must be cleared by detach(), not merely orphaned: a leaked stream would keep
		// a 25s timer running for the life of the process, which on an always-on machine is forever.
		vi.advanceTimersByTime(HEARTBEAT_MS * 3);
		expect(subscriberCount(id)).toBe(0);
		await reader.cancel();
	});

	it('keeps the tournament registry separate from the game one', () => {
		const id = 'SAME-ID-BOTH-FAMILIES';
		const controller = new AbortController();
		subscribeToTournament(id, controller.signal);
		expect(tournamentSubscriberCount(id)).toBe(1);
		expect(subscriberCount(id)).toBe(0);
		controller.abort();
		expect(tournamentSubscriberCount(id)).toBe(0);
	});

	it('reports both registries in the operational probe', () => {
		const baseline = openStreamCount();
		const game = new AbortController();
		const tournament = new AbortController();
		subscribeToGame('GAME-PROBE', game.signal);
		subscribeToTournament('TOURNAMENT-PROBE', tournament.signal);
		expect(openStreamCount()).toBe(baseline + 2);
		game.abort();
		tournament.abort();
		expect(openStreamCount()).toBe(baseline);
	});
});
