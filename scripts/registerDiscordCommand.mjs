/**
 * Registers Chiyo-Bot's slash commands with Discord.
 *
 * Workflow: set the environment below and run `node scripts/registerDiscordCommand.mjs`. Re-run it
 * whenever the definition changes - Discord keeps whatever was PUT last, and a command that was
 * never registered simply does not appear in the picker.
 *
 *   DISCORD_BOT_TOKEN=...        the bot token, from the portal's Bot tab. Never committed.
 *   DISCORD_APPLICATION_ID=...   the application id, from General Information.
 *   DISCORD_GUILD_ID=...         optional: register on one server instead of globally.
 *
 * Set DISCORD_GUILD_ID while developing. A guild command is available immediately, whereas a
 * global one can take up to an hour to propagate, which makes it useless inside a test loop.
 *
 * The bot token is used here and nowhere else: at runtime the follow-up call is authenticated by
 * the interaction token Discord hands over, so the deployed app never needs it.
 *
 * These names must match the dispatch constants in
 * `src/routes/api/discord/interactions/+server.ts` (COMMAND_NAME, SUBCOMMAND_ARMY, OPTION_CODE).
 * This script is plain JS and cannot import them; a drift shows up as the bot answering "I only
 * know how to read an army code so far" to its own registered command.
 */

const DISCORD_API = 'https://discord.com/api/v10';

/** The two of Discord's application-command option types this definition uses. */
const OPTION_SUB_COMMAND = 1;
const OPTION_STRING = 3;

const COMMANDS = [
	{
		name: 'chiyo',
		description: 'Chiyo-Bot reads an Oni Quest army list',
		options: [
			{
				type: OPTION_SUB_COMMAND,
				name: 'army',
				description: 'Show the army list an army code stands for',
				options: [
					{
						type: OPTION_STRING,
						name: 'code',
						description: 'The army code, copied from the app',
						required: true
					}
				]
			}
		]
	}
];

async function main() {
	const token = process.env.DISCORD_BOT_TOKEN;
	const applicationId = process.env.DISCORD_APPLICATION_ID;
	const guildId = process.env.DISCORD_GUILD_ID;
	if (!token || !applicationId) {
		console.error('DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are both required.');
		process.exit(1);
	}

	const scope = guildId ? `guilds/${guildId}/commands` : 'commands';
	const response = await fetch(`${DISCORD_API}/applications/${applicationId}/${scope}`, {
		method: 'PUT',
		headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(COMMANDS)
	});
	const body = await response.text();
	if (!response.ok) {
		console.error(`Registration failed (${response.status}): ${body}`);
		process.exit(1);
	}
	console.log(
		`Registered ${COMMANDS.length} command ${guildId ? `on guild ${guildId}` : 'globally'}: /chiyo army code:<code>`
	);
}

await main();
