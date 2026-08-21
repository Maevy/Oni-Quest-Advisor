type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Lazy sweep so a burst of unique keys cannot grow the map without bound. */
function prune(now: number): void {
	if (buckets.size < 1024) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

/**
 * Fixed-window in-memory limiter, keyed per IP by the caller. Returns true
 * while the key stays under its limit. Single-process by design — matches the
 * one-machine deployment (MULTIPLAYER_PLAN.md §7). `now` is injectable for tests.
 */
export function checkRateLimit(
	key: string,
	limit: number,
	windowMs: number,
	now: number = Date.now()
): boolean {
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		prune(now);
		return true;
	}
	if (bucket.count >= limit) return false;
	bucket.count += 1;
	return true;
}
