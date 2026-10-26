import { json, type Handle, type HandleServerError } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimit';

const MAX_API_BODY_BYTES = 64 * 1024;
const GAME_CREATION_LIMIT_PER_HOUR = 20;
const ACTION_LIMIT_PER_MINUTE = 120;
const EXPORT_LIMIT_PER_MINUTE = 30;

/**
 * Client IP for the rate-limit buckets. `unknown` when it cannot be determined, so all such traffic
 * shares one bucket — the conservative direction.
 */
function clientIp(event: Parameters<Handle>[0]['event']): string {
	try {
		return event.getClientAddress();
	} catch {
		// ADDRESS_HEADER set but absent (e.g. direct internal request).
		return 'unknown';
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const isApi = event.url.pathname.startsWith('/api/');

	if (isApi && event.request.method === 'POST') {
		// The only API consumers are our own clients, whose fetch calls always
		// carry content-length; chunked bodies are rejected outright so the cap
		// cannot be bypassed, and oversized ones before it ever reaches a handler.
		const contentLength = Number(event.request.headers.get('content-length') ?? 0);
		if (event.request.headers.get('transfer-encoding') || contentLength > MAX_API_BODY_BYTES) {
			return json({ error: 'Payload too large' }, { status: 413 });
		}

		// Discord's interactions are the one POST not limited per IP: every one arrives from
		// Discord's own address range, so a shared bucket would throttle the whole bot and one
		// busy server would starve every other. That path authenticates with an Ed25519 signature
		// over the raw body instead, and refuses an unverified request with a 401.
		if (event.url.pathname !== '/api/discord/interactions') {
			const ip = clientIp(event);
			const allowed =
				event.url.pathname === '/api/games' || event.url.pathname === '/api/tournaments'
					? checkRateLimit(`create:${ip}`, GAME_CREATION_LIMIT_PER_HOUR, 60 * 60 * 1000)
					: checkRateLimit(`action:${ip}`, ACTION_LIMIT_PER_MINUTE, 60 * 1000);
			if (!allowed) return json({ error: 'Too many requests' }, { status: 429 });
		}
	}

	// The one GET worth limiting: it resolves a code and streams a large body, and it sits behind a
	// Discord button, so unlike the app's own polling GETs it is reachable by anyone in a channel.
	if (isApi && event.request.method === 'GET' && event.url.pathname === '/api/guildhall-export') {
		const allowed = checkRateLimit(`export:${clientIp(event)}`, EXPORT_LIMIT_PER_MINUTE, 60 * 1000);
		if (!allowed) return json({ error: 'Too many requests' }, { status: 429 });
	}

	const startedAt = performance.now();
	const response = await resolve(event);

	// Path only — query strings may carry seat tokens (SSE stream, join status).
	if (isApi && event.url.pathname !== '/api/health') {
		const durationMs = Math.round(performance.now() - startedAt);
		console.log(
			`api ${event.request.method} ${event.url.pathname} -> ${response.status} (${durationMs}ms)`
		);
	}

	return response;
};

/** ApiErrors become JSON responses inside the `api` wrapper and never reach this hook. */
export const handleError: HandleServerError = ({ error, event }) => {
	console.error(`unhandled error on ${event.request.method} ${event.url.pathname}`, error);
	return { message: 'Internal error' };
};
