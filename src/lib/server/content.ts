import { loadArmyFactions } from '$lib/data/armyFactions';
import { loadFactions } from '$lib/data/factions';
import { loadMissions } from '$lib/data/missions';
import {
	loadArmyItems,
	loadArmySpellcrafts,
	loadArmyUnits,
	loadArmyUpgrades
} from '$lib/data/units';
import { loadSchemes } from '$lib/data/schemes';
import type { ArmyCodeCatalog, Faction, Mission, SchemeCard } from '$lib/domain';

/**
 * Server-side access to the bundled static content. Loaded through the same
 * `lib/data` loaders the client uses (bundled at build time, no I/O).
 */
let missions: Mission[] | null = null;
let factions: Faction[] | null = null;
let schemes: SchemeCard[] | null = null;
let armyCatalog: ArmyCodeCatalog | null = null;
let armyCatalogLoading: Promise<ArmyCodeCatalog> | null = null;

export function getMissions(): Mission[] {
	if (!missions) missions = loadMissions();
	return missions;
}

export function getFactions(): Faction[] {
	if (!factions) factions = loadFactions();
	return factions;
}

export function getSchemes(): SchemeCard[] {
	if (!schemes) schemes = loadSchemes();
	return schemes;
}

export function findMission(missionId: string): Mission | undefined {
	return getMissions().find((mission) => mission.id === missionId);
}

/**
 * The catalogs an army code indexes into — the server's one reason to load army content, so a
 * share code pasted into Discord can be resolved here instead of trusting a second copy of the
 * content somewhere else. Online games still never decode a code: a seat declares its Leader's
 * M and INT because the game flow must not depend on this being loaded.
 *
 * The loaders are async (non-eager globs, kept out of the client's initial JS), so the catalog is
 * assembled once and memoized behind the promise, the way `contentStore.loadArmy()` does it. It
 * hashes to the same roster fingerprint as the client's: the fingerprint reads ids and upgrade
 * effect kinds only, and these are the same modules the client loads.
 */
export function getArmyCodeCatalog(): Promise<ArmyCodeCatalog> {
	if (armyCatalog) return Promise.resolve(armyCatalog);
	armyCatalogLoading ??= (async () => {
		const [units, upgrades, spellcrafts, items] = await Promise.all([
			loadArmyUnits(),
			loadArmyUpgrades(),
			loadArmySpellcrafts(),
			loadArmyItems()
		]);
		armyCatalog = { factions: loadArmyFactions(), units, upgrades, spellcrafts, items };
		return armyCatalog;
	})();
	return armyCatalogLoading;
}
