import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';
import type { ArmySheet, ArmySheetLine, ArmySheetPick } from '$lib/domain';

/**
 * Discord's side of Chiyo-Bot: signature verification, the card an army sheet becomes, and every
 * string the bot says to a player. No dependencies - Node's `crypto` verifies Ed25519 and global
 * `fetch` talks to Discord, which is the same reason `domain/pdf.ts` and `domain/qr.ts` are
 * hand-rolled here.
 *
 * The strings below are functional placeholders. They are community-facing voice and belong to the
 * maintainer: rewrite them here and nowhere else, so the wording stays in one place.
 */

/** Interaction types Discord sends. */
export const INTERACTION_PING = 1;
export const INTERACTION_COMMAND = 2;

/** Interaction response types. 5 defers, buying unlimited time for the follow-up call. */
export const RESPONSE_PONG = 1;
export const RESPONSE_MESSAGE = 4;
export const RESPONSE_DEFERRED = 5;

/** Discord's hard embed limits; a payload over one is rejected whole, not clipped by Discord. */
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_VALUE_MAX = 1024;
/** Left free in the description so the "and N more" line always fits. */
const TRUNCATION_RESERVE = 64;

/**
 * How far a signature's timestamp may drift from now. Discord signs `timestamp + body`, and
 * refusing stale ones is what stops a captured interaction being replayed to make the bot answer
 * again. Generous enough that NTP skew between Fly and Discord cannot cause a false refusal.
 */
const MAX_TIMESTAMP_SKEW_SECONDS = 60;

export const MESSAGES = {
	notConfigured: 'Chiyo-Bot is not configured on this server yet.',
	notACode:
		'That does not look like an army code. Copy one from the Army Builder and paste the whole thing.',
	rosterMismatch:
		'That list was built against an older roster, so its code no longer resolves. Export it again in the app and paste the new code.',
	failed:
		'I could not read that list. Try once more, and tell the maintainer if it keeps happening.',
	unknownCommand: 'I only know how to read an army code so far.'
};

export type DiscordEmbedField = { name: string; value: string; inline?: boolean };

export type DiscordEmbed = {
	title?: string;
	description?: string;
	color?: number;
	thumbnail?: { url: string };
	fields?: DiscordEmbedField[];
	footer?: { text: string };
};

/** A row of components; type 2 style 5 is a link button, the only kind that leaves Discord. */
export type DiscordComponent = {
	type: number;
	style?: number;
	label?: string;
	url?: string;
	components?: DiscordComponent[];
};

export type DiscordMessage = {
	content?: string;
	embeds?: DiscordEmbed[];
	components?: DiscordComponent[];
};

/**
 * The DER SPKI wrapper Node needs around a raw Ed25519 public key. Discord publishes the key as
 * 32 bare bytes and `createPublicKey` takes no raw format, so the standard prefix is prepended.
 */
const ED25519_SPKI_PREFIX = '302a300506032b6570032100';

function ed25519PublicKey(hex: string): KeyObject | null {
	if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
	try {
		return createPublicKey({
			key: Buffer.from(ED25519_SPKI_PREFIX + hex, 'hex'),
			format: 'der',
			type: 'spki'
		});
	} catch {
		return null;
	}
}

export type InteractionSignature = {
	/** The application's public key, hex, as the developer portal shows it. */
	publicKey: string;
	/** The `x-signature-timestamp` header, verbatim. */
	timestamp: string;
	/** The `x-signature-ed25519` header, verbatim. */
	signature: string;
	/** The request body exactly as it arrived. */
	rawBody: Uint8Array;
	/** Injectable so the staleness rule is testable without waiting. */
	nowMs?: number;
};

/**
 * Verifies that an interaction really came from Discord, which is this endpoint's only
 * authentication - it is public and unauthenticated by design, and the rate limiter is switched
 * off for it in `hooks.server.ts` on the strength of this check.
 *
 * The body must be the bytes as received: Discord signs `timestamp + rawBody`, so JSON parsed and
 * re-serialized will not verify, however equivalent it looks.
 */
export function verifyInteractionSignature(signed: InteractionSignature): boolean {
	const key = ed25519PublicKey(signed.publicKey);
	if (!key) return false;
	if (!/^[0-9a-f]{128}$/i.test(signed.signature)) return false;

	const seconds = Number(signed.timestamp);
	if (!Number.isFinite(seconds)) return false;
	const nowSeconds = (signed.nowMs ?? Date.now()) / 1000;
	if (Math.abs(nowSeconds - seconds) > MAX_TIMESTAMP_SKEW_SECONDS) return false;

	try {
		return verifySignature(
			null,
			Buffer.concat([Buffer.from(signed.timestamp, 'utf8'), Buffer.from(signed.rawBody)]),
			key,
			Buffer.from(signed.signature, 'hex')
		);
	} catch {
		return false;
	}
}

/** One line of the card: how many of what, at what cost, on what, carrying what. */
function unitLine(line: ArmySheetLine): string {
	const parts = [`**${line.copies}\u00d7 ${line.name}**`, `${line.pointsEach} pts each`];
	if (line.mount) parts.push(`on ${line.mount}`);
	if (line.upgrades.length > 0) parts.push(line.upgrades.join(', '));
	return parts.join(' \u00b7 ');
}

/**
 * The units as description lines, stopping whole before the budget rather than clipping mid-line.
 * Everything past the break is counted into one closing line, so the card always says it is
 * incomplete instead of looking like the full list.
 */
function describeUnits(lines: ArmySheetLine[], budget: number): string {
	const kept: string[] = [];
	let used = 0;
	let shown = 0;
	for (const line of lines) {
		const text = unitLine(line);
		if (used + text.length + 1 + TRUNCATION_RESERVE > budget) break;
		kept.push(text);
		used += text.length + 1;
		shown += 1;
	}
	if (shown === 0) return '_This list has no units the current content knows._';
	if (shown < lines.length) {
		kept.push(`\u2026and ${lines.length - shown} more \u2014 open the list to see them`);
	}
	return kept.join('\n');
}

/** The Roster equipment pool, whole entries only, under the field's own limit. */
function describePicks(picks: ArmySheetPick[]): string {
	const kept: string[] = [];
	let used = 0;
	for (const pick of picks) {
		const text = `${pick.qty}\u00d7 ${pick.name}`;
		if (used + text.length + 1 + TRUNCATION_RESERVE > EMBED_FIELD_VALUE_MAX) break;
		kept.push(text);
		used += text.length + 1;
	}
	if (kept.length < picks.length) {
		kept.push(`\u2026and ${picks.length - kept.length} more`);
	}
	return kept.join('\n');
}

/** `#21888F` as the integer Discord wants; null rather than a wrong colour on anything odd. */
function embedColor(hex: string): number | null {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
	return Number.parseInt(hex.slice(1), 16);
}

export type ArmyCardRequest = {
	sheet: ArmySheet;
	/** The app's own origin, so the logo and the button are absolute URLs Discord can fetch. */
	origin: string;
	/** The code as pasted, echoed into the deep link. */
	code: string;
};

/**
 * The card itself: one embed plus the button into the app. The faction supplies both the colour
 * stripe and the thumbnail from content that already exists, so two lists in one thread are
 * distinguishable without any palette of our own.
 */
export function armyCard({ sheet, origin, code }: ArmyCardRequest): DiscordMessage {
	const format = sheet.format === 'standard' ? 'Standard' : 'Roster';
	const header = `**${format}** \u00b7 ${sheet.points}/${sheet.pointCap} points`;
	const color = embedColor(sheet.factionColor);
	// The code's own fingerprint characters, so a stale list is diagnosable from the card alone.
	const fingerprint = code.trim().toLowerCase().slice(1, 4);
	return {
		embeds: [
			{
				title: sheet.factionName,
				// The header is measured rather than estimated, so the units get exactly what is
				// left of the limit and the total cannot drift over it.
				description: `${header}\n\n${describeUnits(
					sheet.lines,
					EMBED_DESCRIPTION_MAX - header.length - 2
				)}`,
				...(color === null ? {} : { color }),
				thumbnail: { url: origin + sheet.factionLogo },
				...(sheet.picks.length === 0
					? {}
					: {
							fields: [{ name: 'Equipment pool', value: describePicks(sheet.picks), inline: false }]
						}),
				footer: { text: `Chiyo-Bot \u00b7 roster ${fingerprint}` }
			}
		],
		components: [
			{
				type: 1,
				components: [
					{
						type: 2,
						style: 5,
						label: 'Open in Army Builder',
						url: `${origin}/?army=${encodeURIComponent(code.trim())}`
					}
				]
			}
		]
	};
}

/** Discord's answer to a webhook post; `status` is what separates its refusals from a call that never landed. */
export type DiscordTransport = (
	url: string,
	init: RequestInit
) => Promise<{ ok: boolean; status?: number }>;

/** How the card's delivery ended, and how many times it was tried. */
export type FollowUpResult =
	{ delivered: true; attempts: number } | { delivered: false; reason: string; attempts: number };

const FOLLOW_UP_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One delivery attempt: either it landed, or it says why and whether another try could help. */
type FollowUpAttempt =
	{ delivered: true } | { delivered: false; reason: string; retryable: boolean };

async function attemptFollowUp(
	webhook: string,
	init: RequestInit,
	transport: DiscordTransport
): Promise<FollowUpAttempt> {
	try {
		const response = await transport(webhook, init);
		if (response.ok) return { delivered: true };
		const status = response.status ?? 0;
		// A rate limit or a server-side failure is Discord's problem and worth another try; any
		// other 4xx means our payload is wrong and the same bytes are refused identically.
		return {
			delivered: false,
			reason: `Discord answered ${status}`,
			retryable: status === 429 || status >= 500
		};
	} catch (error) {
		return {
			delivered: false,
			reason: error instanceof Error ? error.message : String(error),
			retryable: true
		};
	}
}

/**
 * Posts the card to the interaction's own webhook. The interaction token in the URL is the
 * credential, so the bot token is not needed at runtime - it is used once, by the command
 * registration script.
 *
 * A failure here leaves the player staring at "thinking" forever, which is the worst outcome the
 * bot can produce - and one observed on staging, where the first command after a cold start
 * deferred correctly and the card never landed. That failure was undiagnosable, because delivery
 * returned a bare boolean and threw away both Discord's status and the transport error. So the
 * result carries the reason, and anything transient is tried once more.
 *
 * A 4xx other than 429 is deliberately not retried: Discord refused the payload itself, and the
 * same bytes are refused identically a moment later.
 *
 * The transport is a parameter rather than the global `fetch` so the delivery path is testable
 * without mutating globals: a spec passes its own and asserts the webhook URL, the headers and the
 * body that would have been sent.
 */

export async function postInteractionFollowUp(
	applicationId: string,
	interactionToken: string,
	message: DiscordMessage,
	transport: DiscordTransport = fetch
): Promise<FollowUpResult> {
	const webhook = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
	const init: RequestInit = {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(message)
	};

	// Every path returns, so the loop cannot run past FOLLOW_UP_ATTEMPTS.
	for (let attempt = 1; ; attempt += 1) {
		if (attempt > 1) await delay(RETRY_DELAY_MS);
		const outcome = await attemptFollowUp(webhook, init, transport);
		if (outcome.delivered) return { delivered: true, attempts: attempt };
		if (!outcome.retryable || attempt >= FOLLOW_UP_ATTEMPTS) {
			return { delivered: false, reason: outcome.reason, attempts: attempt };
		}
	}
}
