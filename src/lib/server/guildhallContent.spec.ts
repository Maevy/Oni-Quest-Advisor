import { describe, expect, it } from 'vitest';
import { getGuildhallCatalog } from './guildhallContent';

/**
 * Reads the generated artifact for real, so this doubles as the canary that `guildhall/catalog.json`
 * is present and loadable - a missing or truncated artifact would otherwise surface only when a
 * player asks for an export. Counts are deliberately not pinned: they legitimately change whenever
 * the producer dump is re-imported.
 */
describe('getGuildhallCatalog', () => {
	it('indexes every section by the producer row id', async () => {
		const catalog = await getGuildhallCatalog();

		expect(Object.keys(catalog.characters).length).toBeGreaterThan(0);
		expect(Object.keys(catalog.upgrades).length).toBeGreaterThan(0);
		expect(Object.keys(catalog.items).length).toBeGreaterThan(0);

		// Factions are keyed by *our* id, not their row id: a decoded army carries nothing else, so
		// this is what lets the export route address the catalog directly.
		const faction = catalog.factions['coalition-of-thenion'] as {
			attributes: { code: string; name: string };
		};
		expect(faction.attributes.code).toBe('COALITION_OF_THENION');
		expect(faction.attributes.name).toBe('Coalition of Thenion');

		// Character 84 is BLADEBRETHREN_ELITE in both the producer dump and Freecompany's own export,
		// which is the mapping the whole export rests on.
		const bladebrethren = catalog.characters[84] as {
			id: number;
			attributes: { code: string; name: string };
		};
		expect(bladebrethren.attributes.code).toBe('BLADEBRETHREN_ELITE');
		expect(bladebrethren.attributes.name).toBe('Bladebrethren Elite');
	});

	it('carries the verbatim producer object, not a reduced form', async () => {
		const catalog = await getGuildhallCatalog();
		const character = catalog.characters[84] as { attributes: Record<string, unknown> };

		// The export copies these through untouched, so the bulk our own importer strips has to
		// survive here: nested rule text, image metadata and the per-stat row ids.
		expect(character.attributes.skills).toBeTruthy();
		expect(character.attributes.image).toBeTruthy();
		const statline = character.attributes.attributes as Record<
			string,
			{ id: number; value: number | null }
		>;
		expect(typeof statline.STA.id).toBe('number');
		expect(statline.STA.value).toBe(2);
	});

	it('keys elements by the title-cased code our content uses, keeping their spells', async () => {
		const catalog = await getGuildhallCatalog();

		// ArmyTraitRef.dynamicElements holds 'Elder', not 11 or 'ELDER', so the lookup has to match.
		const elder = catalog.elements.Elder as { attributes: Record<string, unknown> };
		expect(elder.attributes.code).toBe('ELDER');
		// An element an upgrade grants is written full size, `spells` included; an inherited one is
		// reused bare from the character. Dropping these would corrupt every granted Affinity.
		expect(elder.attributes.spells).toBeTruthy();
		expect(catalog.elements.Fire).toBeTruthy();
	});

	it('keys trait groups by our trait id, carrying their per-level entries', async () => {
		const catalog = await getGuildhallCatalog();

		// A trait an upgrade grants is assembled from the group's per-level entries, so the loader has
		// to expose them keyed the way `ArmyTraitRef.id` is spelled - kebab of their code, which for
		// AFFINITY__ELEMENT means a double hyphen.
		const poison = catalog.traitGroups.poison as {
			attributes: {
				code: string;
				traits: { data: { id: number; attributes: { level: number } }[] };
			};
		};
		expect(poison.attributes.code).toBe('POISON');
		expect(poison.attributes.traits.data.length).toBeGreaterThan(0);
		expect(poison.attributes.traits.data[0].attributes.level).toBe(1);
	});

	it('memoizes, so the artifact is parsed once per process', async () => {
		const first = await getGuildhallCatalog();
		const second = await getGuildhallCatalog();
		expect(second).toBe(first);
	});
});
