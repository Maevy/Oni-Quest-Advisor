import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ArmySheet } from '$lib/domain';
import { armyCard, postInteractionFollowUp, verifyInteractionSignature } from './discord';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

/** Discord publishes the key as 32 bare bytes; the jwk `x` member is exactly those bytes. */
function rawPublicKeyHex(key: KeyObject): string {
	const jwk = key.export({ format: 'jwk' }) as { x?: string };
	return Buffer.from(jwk.x ?? '', 'base64url').toString('hex');
}

const PUBLIC_KEY = rawPublicKeyHex(publicKey);
const NOW_MS = 1_800_000_000_000;

/** Signs `timestamp + body` the way Discord does, over the bytes as they would arrive. */
function signBody(timestamp: string, body: string): string {
	return sign(
		null,
		Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(body, 'utf8')]),
		privateKey
	).toString('hex');
}

function timestampAt(nowMs: number = NOW_MS): string {
	return String(Math.floor(nowMs / 1000));
}

const BODY = JSON.stringify({ type: 2, data: { name: 'chiyo' } });

describe('verifyInteractionSignature', () => {
	it('accepts a genuine signature over the raw bytes', () => {
		const timestamp = timestampAt();
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp,
				signature: signBody(timestamp, BODY),
				rawBody: Buffer.from(BODY, 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(true);
	});

	it('refuses a body altered after signing', () => {
		const timestamp = timestampAt();
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp,
				signature: signBody(timestamp, BODY),
				// Equivalent JSON, different bytes - which is the point of signing the raw body.
				rawBody: Buffer.from(JSON.stringify({ data: { name: 'chiyo' }, type: 2 }), 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(false);
	});

	it('refuses a signature carried onto another timestamp', () => {
		const signed = timestampAt();
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp: timestampAt(NOW_MS + 1000),
				signature: signBody(signed, BODY),
				rawBody: Buffer.from(BODY, 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(false);
	});

	it('refuses a replayed interaction whose timestamp has gone stale', () => {
		const stale = timestampAt(NOW_MS - 10 * 60 * 1000);
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp: stale,
				signature: signBody(stale, BODY),
				rawBody: Buffer.from(BODY, 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(false);
	});

	it('refuses a malformed public key or signature rather than throwing', () => {
		const timestamp = timestampAt();
		const signature = signBody(timestamp, BODY);
		for (const bad of ['', 'zz', PUBLIC_KEY.slice(0, 62)]) {
			expect(
				verifyInteractionSignature({
					publicKey: bad,
					timestamp,
					signature,
					rawBody: Buffer.from(BODY, 'utf8'),
					nowMs: NOW_MS
				})
			).toBe(false);
		}
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp,
				signature: 'nothex',
				rawBody: Buffer.from(BODY, 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(false);
	});

	it('refuses a timestamp that is not a number', () => {
		const timestamp = 'not-a-timestamp';
		expect(
			verifyInteractionSignature({
				publicKey: PUBLIC_KEY,
				timestamp,
				signature: signBody(timestamp, BODY),
				rawBody: Buffer.from(BODY, 'utf8'),
				nowMs: NOW_MS
			})
		).toBe(false);
	});
});

const SHEET: ArmySheet = {
	factionId: 'helian-league',
	factionName: 'Helian League',
	factionColor: '#FDF4E3',
	factionLogo: '/_app/immutable/assets/helian-abc123.png',
	format: 'standard',
	points: 61,
	pointCap: 85,
	lines: [
		{
			unitId: 'alpha',
			name: 'Alpha',
			copies: 2,
			pointsEach: 12,
			size: 'medium',
			upgrades: ['Additional Protection']
		},
		{
			unitId: 'bravo',
			name: 'Bravo',
			copies: 1,
			pointsEach: 17,
			size: 'huge',
			mount: 'Lupus',
			upgrades: []
		}
	],
	picks: []
};

const ORIGIN = 'https://oni-quest-advisor.fly.dev';
const CODE = 'afwh:2s:0_c-5_1d-i_19-11';

function cardOf(sheet: ArmySheet = SHEET, code: string = CODE) {
	const message = armyCard({ sheet, origin: ORIGIN, code });
	const embed = message.embeds?.[0];
	if (!embed) throw new Error('expected the card to carry an embed');
	return { message, embed };
}

describe('armyCard', () => {
	it('names the faction and stripes it with the faction colour', () => {
		const { embed } = cardOf();
		expect(embed.title).toBe('Helian League');
		expect(embed.color).toBe(0xfdf4e3);
	});

	it('absolutizes the logo so Discord can fetch it', () => {
		expect(cardOf().embed.thumbnail?.url).toBe(ORIGIN + SHEET.factionLogo);
	});

	it('reports the format, the total and the cap, then one line per pick', () => {
		const description = cardOf().embed.description ?? '';
		expect(description).toContain('**Standard** \u00b7 61/85 points');
		expect(description).toContain(
			'**2\u00d7 Alpha** \u00b7 12 pts each \u00b7 Additional Protection'
		);
		expect(description).toContain('**1\u00d7 Bravo** \u00b7 17 pts \u00b7 on Lupus');
	});

	it('says "each" only when there is more than one copy to divide the cost between', () => {
		const solo = {
			unitId: 'solo',
			name: 'Solo',
			copies: 1,
			pointsEach: 19,
			size: 'medium' as const,
			upgrades: [] as string[]
		};
		const one = cardOf({ ...SHEET, lines: [solo] }).embed.description ?? '';
		const many = cardOf({ ...SHEET, lines: [{ ...solo, copies: 3 }] }).embed.description ?? '';
		expect(one).toContain('**1\u00d7 Solo** \u00b7 19 pts');
		expect(one).not.toContain('pts each');
		expect(many).toContain('**3\u00d7 Solo** \u00b7 19 pts each');
	});

	it('puts a Roster equipment pool in its own field', () => {
		const { embed } = cardOf({
			...SHEET,
			format: 'roster',
			pointCap: 125,
			picks: [
				{ id: 'a', name: 'Additional Protection', qty: 2, pointsEach: 2 },
				{ id: 'b', name: 'Adept Shaper', qty: 1, pointsEach: 3 }
			]
		});
		expect(embed.fields).toEqual([
			{
				name: 'Equipment pool',
				value: '2\u00d7 Additional Protection\n1\u00d7 Adept Shaper',
				inline: false
			}
		]);
		expect(embed.description).toContain('**Roster**');
	});

	it('carries no equipment field for a Standard list', () => {
		expect(cardOf().embed.fields).toBeUndefined();
	});

	it('echoes the code fingerprint in the footer, so a stale list is diagnosable', () => {
		expect(cardOf().embed.footer?.text).toBe('Chiyo-Bot \u00b7 roster fwh');
	});

	it('links into the app with the code encoded', () => {
		const button = cardOf(SHEET, 'afwh:2s:weird code').message.components?.[0].components?.[0];
		expect(button?.label).toBe('Open in Army Builder');
		expect(button?.url).toBe(`${ORIGIN}/?army=afwh%3A2s%3Aweird%20code`);
		expect(button?.style).toBe(5);
	});

	it('omits the colour rather than send a wrong one', () => {
		expect(cardOf({ ...SHEET, factionColor: 'rebecca-purple' }).embed.color).toBeUndefined();
	});

	it('truncates whole lines and says the card is incomplete', () => {
		const many = Array.from({ length: 400 }, (_, index) => ({
			unitId: 'unit-' + index,
			name: 'A rather long unit name number ' + index,
			copies: 3,
			pointsEach: 12,
			size: 'medium' as const,
			upgrades: ['Additional Protection', 'Something Else Entirely']
		}));
		const { embed } = cardOf({ ...SHEET, lines: many });
		const description = embed.description ?? '';
		// Discord rejects a payload over the limit wholesale, so this must hold, not approximate.
		expect(description.length).toBeLessThanOrEqual(4096);
		expect(description).toMatch(/\u2026and \d+ more/);
		expect(description.split('\n').length).toBeLessThan(400);
	});

	it('says so when nothing in the list resolves', () => {
		expect(cardOf({ ...SHEET, lines: [] }).embed.description).toContain('no units');
	});
});

describe('postInteractionFollowUp', () => {
	it('posts the message to the interaction webhook, which the token alone authenticates', async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const message = { content: 'hello' };
		const result = await postInteractionFollowUp('app-1', 'token-1', message, (url, init) => {
			calls.push({ url, init });
			return Promise.resolve({ ok: true, status: 200 });
		});
		// Asserted before the outcome: a transport that never ran would also read as a failure.
		expect(calls).toHaveLength(1);
		expect(result).toEqual({ delivered: true, attempts: 1 });
		expect(calls[0].url).toBe('https://discord.com/api/v10/webhooks/app-1/token-1');
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(String(calls[0].init.body))).toEqual(message);
	});

	it('does not retry a payload Discord refused, and says which status', async () => {
		let called = 0;
		const result = await postInteractionFollowUp('app-1', 'token-1', {}, () => {
			called += 1;
			return Promise.resolve({ ok: false, status: 400 });
		});
		// Retrying the same bytes at a 400 would only be refused identically.
		expect(called).toBe(1);
		expect(result).toEqual({ delivered: false, reason: 'Discord answered 400', attempts: 1 });
	});

	it('retries a rate limit and a server-side failure once', async () => {
		for (const status of [429, 503]) {
			let called = 0;
			const result = await postInteractionFollowUp('app-1', 'token-1', {}, () => {
				called += 1;
				return Promise.resolve({ ok: false, status });
			});
			expect(called).toBe(2);
			expect(result).toEqual({
				delivered: false,
				reason: `Discord answered ${status}`,
				attempts: 2
			});
		}
	});

	it('retries a transport failure and reports the error it ended on', async () => {
		let called = 0;
		const result = await postInteractionFollowUp('app-1', 'token-1', {}, () => {
			called += 1;
			return Promise.reject(new Error('socket hang up'));
		});
		expect(called).toBe(2);
		expect(result).toEqual({ delivered: false, reason: 'socket hang up', attempts: 2 });
	});

	it('lands the card on the second try when the first fails - the staging cold-start case', async () => {
		let called = 0;
		const result = await postInteractionFollowUp('app-1', 'token-1', { content: 'card' }, () => {
			called += 1;
			return called === 1
				? Promise.reject(new Error('socket hang up'))
				: Promise.resolve({ ok: true, status: 200 });
		});
		expect(called).toBe(2);
		expect(result).toEqual({ delivered: true, attempts: 2 });
	});
});
