import type { GuildhallCatalog, Json } from '$lib/domain/guildhallExport';

/**
 * Server-only access to the generated Guildhall artifact (`guildhall/catalog.json`, written by
 * `scripts/importUnits.mjs`). These are Freecompany's verbatim Strapi objects, which is what their
 * builder stores and therefore what an export has to carry — our own reduced content cannot produce
 * it, because the importer deliberately strips the descriptions, image metadata and per-stat row ids
 * that their format needs back.
 *
 * Two consequences of its size (~590 KB) shape this module:
 *
 * - It lives under `lib/server`, where SvelteKit makes a client-side import a build error. That is a
 *   harder guarantee than a convention, and it is the only thing standing between half a megabyte of
 *   someone else's rules prose and a phone on a data connection.
 * - It is loaded lazily behind a memoized promise, the way `getArmyCodeCatalog()` does, so booting
 *   the server does not parse it and an online game never pays for a feature it does not use.
 *
 * The artifact also carries `traitGroups`, which this loader does not yet index: granted traits are
 * the one part of their format still refused rather than guessed at, pending a ground-truth export of
 * a model that gained a trait it was not born with. The data is generated now so that wiring it up
 * needs no re-import.
 */

/** One `{id, attributes}` Strapi wrapper, as the producer dump nests every catalog row. */
type ProducerRecord = { id: number; attributes: Record<string, unknown> };

type GuildhallArtifact = {
	characters: ProducerRecord[];
	upgrades: ProducerRecord[];
	items: ProducerRecord[];
	factions: ProducerRecord[];
	elements: ProducerRecord[];
	traitGroups: ProducerRecord[];
};

let catalog: GuildhallCatalog | null = null;
let loading: Promise<GuildhallCatalog> | null = null;

function indexById(records: ProducerRecord[]): Record<number, Json> {
	const indexed: Record<number, Json> = {};
	for (const record of records) indexed[record.id] = record as unknown as Json;
	return indexed;
}

/**
 * Elements are keyed by the name our content uses, not by id: `ArmyTraitRef.dynamicElements` holds
 * `titleCase(code)`, so 'ELDER' is looked up as 'Elder'. This has to match `scripts/importUnits.mjs`
 * and `domain/guildhallExport.ts`, or an inherited element stops being recognised as inherited and
 * comes back in the wrong shape.
 */
function indexElementsByTitleCasedCode(records: ProducerRecord[]): Record<string, Json> {
	const indexed: Record<string, Json> = {};
	for (const record of records) {
		const code = record.attributes?.code;
		if (typeof code !== 'string') continue;
		indexed[code.charAt(0).toUpperCase() + code.slice(1).toLowerCase()] = record as unknown as Json;
	}
	return indexed;
}

/** The Guildhall catalog, parsed once per process and shared thereafter. */
export function getGuildhallCatalog(): Promise<GuildhallCatalog> {
	if (catalog) return Promise.resolve(catalog);
	loading ??= (async () => {
		const artifact = (await import('./guildhall/catalog.json'))
			.default as unknown as GuildhallArtifact;
		catalog = {
			characters: indexById(artifact.characters),
			upgrades: indexById(artifact.upgrades),
			items: indexById(artifact.items),
			factions: indexById(artifact.factions),
			elements: indexElementsByTitleCasedCode(artifact.elements)
		};
		return catalog;
	})();
	return loading;
}
