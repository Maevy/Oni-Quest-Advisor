import { json, type RequestHandler } from '@sveltejs/kit';
import { armySheet } from '$lib/domain';
import { getArmyCodeCatalog } from '$lib/server/content';
import {
	armyCard,
	INTERACTION_COMMAND,
	INTERACTION_PING,
	MESSAGES,
	postInteractionFollowUp,
	RESPONSE_DEFERRED,
	RESPONSE_MESSAGE,
	RESPONSE_PONG,
	verifyInteractionSignature,
	type DiscordMessage
} from '$lib/server/discord';

/**
 * Chiyo-Bot's whole surface: Discord posts signed interactions here. Public and unauthenticated
 * by design - the Ed25519 signature IS the authentication, which is why `hooks.server.ts` exempts
 * this path from the per-IP rate limiter (every interaction arrives from Discord's own IPs, so one
 * bucket would hold the whole bot's traffic).
 *
 * A command is answered with `{type:5}` immediately and the card follows on the interaction's own
 * webhook, so neither the first catalog load nor a cold machine can push the first response past
 * Discord's three seconds.
 */

/** The two of Discord's option types this command uses. */
const OPTION_SUB_COMMAND = 1;

/** Must match the definition `scripts/registerDiscordCommand.mjs` registers. */
const COMMAND_NAME = 'chiyo';
const SUBCOMMAND_ARMY = 'army';
const OPTION_CODE = 'code';

type CommandOption = {
	name: string;
	type: number;
	value?: unknown;
	options?: CommandOption[];
};

/** Only the parts of an interaction this handler reads. */
type Interaction = {
	type: number;
	id?: string;
	token?: string;
	data?: { name?: string; options?: CommandOption[] };
};

/** The `code` argument of the `army` subcommand, or null when the shape is not the registered one. */
function codeArgument(interaction: Interaction): string | null {
	if (interaction.data?.name !== COMMAND_NAME) return null;
	const subcommand = (interaction.data.options ?? []).find(
		(option) => option.type === OPTION_SUB_COMMAND && option.name === SUBCOMMAND_ARMY
	);
	const value = (subcommand?.options ?? []).find((option) => option.name === OPTION_CODE)?.value;
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * The card, or the message explaining why there is none. Never throws: this runs after the
 * response has gone out, so an escape would leave the player staring at "thinking" with nothing
 * logged to explain it.
 */
async function resolveCard(origin: string, code: string | null): Promise<DiscordMessage> {
	if (code === null) return { content: MESSAGES.notACode };
	try {
		const result = armySheet(code, await getArmyCodeCatalog());
		if (!result.ok) {
			// The distinction matters: only one of these two is the player's mistake.
			return {
				content: result.error === 'roster-mismatch' ? MESSAGES.rosterMismatch : MESSAGES.notACode
			};
		}
		return armyCard({ sheet: result.sheet, origin, code });
	} catch (error) {
		console.error('discord card failed', error);
		return { content: MESSAGES.failed };
	}
}

export const POST: RequestHandler = async ({ request, url }) => {
	const publicKey = process.env.DISCORD_PUBLIC_KEY ?? '';
	const applicationId = process.env.DISCORD_APPLICATION_ID ?? '';
	// The signature covers the bytes as they arrived, so the body is read once and parsed from
	// that same buffer rather than through request.json().
	const rawBody = new Uint8Array(await request.arrayBuffer());

	const verified = verifyInteractionSignature({
		publicKey,
		timestamp: request.headers.get('x-signature-timestamp') ?? '',
		signature: request.headers.get('x-signature-ed25519') ?? '',
		rawBody
	});
	if (!verified) return json({ error: 'Invalid request signature' }, { status: 401 });

	let interaction: Interaction;
	try {
		interaction = JSON.parse(new TextDecoder().decode(rawBody)) as Interaction;
	} catch {
		return json({ error: 'Malformed interaction' }, { status: 400 });
	}

	// Discord validates the endpoint URL with a live PING before it can be saved, so this branch
	// has to work on a deployed build with nothing else configured.
	if (interaction.type === INTERACTION_PING) return json({ type: RESPONSE_PONG });
	if (interaction.type !== INTERACTION_COMMAND || !interaction.id || !interaction.token) {
		return json({ type: RESPONSE_MESSAGE, data: { content: MESSAGES.unknownCommand } });
	}
	if (applicationId === '') {
		return json({ type: RESPONSE_MESSAGE, data: { content: MESSAGES.notConfigured } });
	}

	const { id, token } = interaction;
	const code = codeArgument(interaction);
	// This SvelteKit exposes no `waitUntil` on the event, so the follow-up outlives the response
	// as a floating promise - safe on adapter-node, where the process persists between requests
	// and the call resolves in well under the idle window Fly waits before auto-stopping. The
	// trailing catch is not decoration: an unhandled rejection can take the Node process down.
	void (async () => {
		const delivered = await postInteractionFollowUp(
			applicationId,
			token,
			await resolveCard(url.origin, code)
		);
		if (!delivered) console.error('discord follow-up was not accepted', { interaction: id });
	})().catch((error) => console.error('discord follow-up threw', error));
	return json({ type: RESPONSE_DEFERRED });
};
