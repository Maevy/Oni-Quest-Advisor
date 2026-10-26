import { indexArmyRules, resolveArmyEntries, unitsForFaction } from '$lib/domain/army';
import { decodeArmy } from '$lib/domain/armyCode';
import { buildGuildhallArmy, type GuildhallExportError } from '$lib/domain/guildhallExport';
import { getArmyCodeCatalog } from '$lib/server/content';
import { getGuildhallCatalog } from '$lib/server/guildhallContent';
import { api, ApiError } from '$lib/server/http';

/**
 * Serves an army code as a file Freecompany's Guildhall builder can import.
 *
 * This exists because their builder cannot be deep-linked: six static routes, saved armies in browser
 * localStorage, and import only by file drop. A URL cannot write another origin's localStorage, so
 * the second button on the Chiyo-Bot card hands the player a file to drop instead of a list to load.
 *
 * The code is a query parameter rather than a path segment on purpose. Codes are base36 but carry
 * `:`, `_`, `-`, `.` and `*` (the mount marker) as separators; those are legal pchar per RFC 3986,
 * but `*` in a path segment is exactly what proxies and CDNs handle inconsistently, and this URL is
 * clicked from a Discord button rather than typed.
 *
 * Unauthenticated by design - a share code is already public the moment it is pasted into a channel,
 * and this endpoint reveals nothing the code itself does not. It resolves through the same
 * `decodeArmy` -> `resolveArmyEntries` path as the card and the app's own Army view, so an exported
 * file cannot disagree with the list the player was shown.
 */

/** Player-facing wording for a refusal. The kinds are the domain's; only the prose lives here. */
function messageFor(error: GuildhallExportError): string {
	switch (error.kind) {
		case 'unknown-unit':
		case 'unknown-mount':
		case 'unknown-upgrade':
		case 'unknown-item':
		case 'unknown-element':
		case 'unknown-trait':
		case 'missing-faction':
		case 'malformed-catalog':
			// Content drift rather than a player mistake: the code decoded against our catalog, so
			// the gap is between our catalog and the Guildhall artifact. Says which thing is missing
			// because that is what makes it actionable for whoever reads the log.
			return `That list could not be exported - '${JSON.stringify(error)}' has no Guildhall counterpart.`;
	}
}

/** A safe ASCII download name; their own exports are plain .json the player re-uploads by hand. */
function filenameFor(factionId: string, format: string): string {
	const safe = `${factionId}-${format}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
	return `oni-quest-${safe}.json`;
}

export const GET = api(async ({ request }) => {
	const url = new URL(request.url);
	const code = url.searchParams.get('code')?.trim();
	if (!code) throw new ApiError(400, 'Missing army code');

	const [catalog, guildhall] = await Promise.all([getArmyCodeCatalog(), getGuildhallCatalog()]);

	const decoded = decodeArmy(code, catalog);
	if (!decoded.ok) {
		// The same split the card makes: only one of these is the player's mistake.
		throw new ApiError(
			decoded.error === 'roster-mismatch' ? 409 : 400,
			decoded.error === 'roster-mismatch'
				? 'That list was built against an older roster, so its code no longer resolves. Export it again in the app.'
				: 'That is not a valid army code.'
		);
	}

	const { factionId, format, entries, picks } = decoded.list;
	const faction = catalog.factions.find((candidate) => candidate.id === factionId);
	// A code whose faction index decodes but resolves to nothing is content drift, not a typo.
	if (!faction) throw new ApiError(400, 'That is not a valid army code.');

	const upgradeIndex = indexArmyRules(catalog.upgrades);
	const itemIndex = indexArmyRules(catalog.items);
	const rows = resolveArmyEntries(
		entries,
		unitsForFaction(factionId, catalog.units),
		catalog.units.mounts,
		upgradeIndex,
		itemIndex
	);

	const formatLabel = format === 'roster' ? 'Roster' : 'Standard';
	const result = buildGuildhallArmy({
		rows,
		format,
		catalog: guildhall,
		itemIndex,
		upgradeIndex,
		options: {
			armyName: `${faction.name} \u00b7 ${formatLabel} \u00b7 via Oni Quest Advisor`,
			// Their own builder stamps Date.now() here; it is a local key, not a server id, so any
			// fresh number is correct. Injected at the edge because the domain reads no clock.
			armyId: Date.now(),
			factionId,
			// The roster pool is one entry per copy in their format, not a count.
			rosterUpgradeIds:
				format === 'roster'
					? (picks ?? []).flatMap((pick) => Array.from({ length: pick.qty }, () => pick.id))
					: []
		}
	});

	if (!result.ok) throw new ApiError(422, messageFor(result.error));

	return new Response(JSON.stringify(result.document), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${filenameFor(factionId, format)}"`,
			// armyId differs per request, so there is nothing worth caching.
			'cache-control': 'no-store'
		}
	});
});
