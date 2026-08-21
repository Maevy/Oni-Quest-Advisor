import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rateLimit';

describe('checkRateLimit', () => {
	it('allows requests up to the limit and rejects the next one', () => {
		const now = 1_000_000;
		for (let i = 0; i < 3; i += 1) {
			expect(checkRateLimit('t:allow', 3, 60_000, now + i)).toBe(true);
		}
		expect(checkRateLimit('t:allow', 3, 60_000, now + 10)).toBe(false);
	});

	it('starts a fresh window once the previous one has expired', () => {
		const now = 2_000_000;
		expect(checkRateLimit('t:window', 1, 60_000, now)).toBe(true);
		expect(checkRateLimit('t:window', 1, 60_000, now + 1)).toBe(false);
		expect(checkRateLimit('t:window', 1, 60_000, now + 60_000)).toBe(true);
	});

	it('tracks keys independently', () => {
		const now = 3_000_000;
		expect(checkRateLimit('t:a', 1, 60_000, now)).toBe(true);
		expect(checkRateLimit('t:b', 1, 60_000, now)).toBe(true);
		expect(checkRateLimit('t:a', 1, 60_000, now)).toBe(false);
	});
});
