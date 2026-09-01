import type {
	ArmyEntry,
	ArmyFactionConfig,
	ArmyFactionId,
	ArmyFormat,
	ArmyItemSpec,
	ArmyRulesSpec,
	ArmyUnitContent,
	ArmyUnitSpec,
	ArmyUpgradeChoice,
	ArmyUpgradeSpec
} from './army';

/**
 * Share codes for army lists. A code indexes every piece (faction, units,
 * upgrades, selections) into the sorted content catalogs, so codes stay
 * short (tens of characters, not JWT-sized). A roster fingerprint derived
 * from the catalogs themselves guards the indexes: codes built on a
 * different roster fail loudly instead of decoding into the wrong units.
 *
 * Layout: `A<fp3>:<faction36><s|t>:<entries>` — entries joined by `_`,
 * one entry = `<unit36>[*][-<upgrade36>[=<choice>]...]`, a choice being a
 * spellcraft index, an option index or an option index plus an item/element
 * index, interpreted through the upgrade's effects.
 */

/** The serialized army: faction, format and every copy with its picks. */
export type ArmyList = {
	factionId: ArmyFactionId;
	format: ArmyFormat;
	entries: ArmyEntry[];
};

/** The catalogs a code indexes into; both sides derive the fingerprint from them. */
export type ArmyCodeCatalog = {
	factions: ArmyFactionConfig[];
	units: ArmyUnitContent;
	upgrades: ArmyUpgradeSpec[];
	spellcrafts: ArmyRulesSpec[];
	items: ArmyItemSpec[];
};

export type ArmyCodeDecodeError = 'invalid' | 'roster-mismatch';

export type ArmyCodeDecodeResult =
	{ ok: true; list: ArmyList } | { ok: false; error: ArmyCodeDecodeError };

/** Code layout version, the first character of every code. */
const CODE_VERSION = 'a';

/** Elements an Affinity replacement can name, indexed in the code. */
const CODE_ELEMENTS = ['elder', 'air', 'earth', 'divine', 'fire', 'profane', 'water'];

/** Every recruitable unit across all factions plus the neutral pool, by id. */
function codeUnitPool(units: ArmyUnitContent): ArmyUnitSpec[] {
	const all = [...Object.values(units.factionUnits).flat(), ...units.neutralUnits];
	return [...all].sort((a, b) => a.id.localeCompare(b.id));
}

function byId<T extends { id: string }>(specs: T[]): T[] {
	return [...specs].sort((a, b) => a.id.localeCompare(b.id));
}

/** FNV-1a 32-bit; deterministic and dependency-free. */
function fnv1a(text: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

/** One upgrade effect rendered for the fingerprint: kind plus option order. */
function effectKey(effect: ArmyUpgradeSpec['effects'][number]): string {
	if (effect.kind === 'choice') {
		return 'choice:' + effect.options.map((option) => option.id).join('+');
	}
	return effect.kind;
}

/**
 * Short roster fingerprint (3 base36 chars): equal whenever the indexed
 * catalogs are equal, changed by any unit/upgrade/spellcraft/item edit
 * that would shift an index.
 */
function catalogFingerprint(catalog: ArmyCodeCatalog): string {
	const input = [
		catalog.factions.map((faction) => faction.id).join(','),
		codeUnitPool(catalog.units)
			.map((unit) => unit.id + (unit.mount ? '>' + unit.mount.unitId : ''))
			.join(','),
		byId(catalog.upgrades)
			.map((upgrade) => upgrade.id + '|' + upgrade.effects.map(effectKey).join(';'))
			.join(','),
		byId(catalog.spellcrafts)
			.map((entry) => entry.id)
			.join(','),
		byId(catalog.items)
			.map((item) => item.id)
			.join(','),
		CODE_ELEMENTS.join(',')
	].join('#');
	return (fnv1a(input) % 46656).toString(36).padStart(3, '0');
}

function to36(value: number): string {
	return value.toString(36);
}

function from36(token: string): number | null {
	if (!/^[0-9a-z]+$/.test(token)) return null;
	return Number.parseInt(token, 36);
}

function indexOfById<T extends { id: string }>(specs: T[], id: string): number {
	return specs.findIndex((spec) => spec.id === id);
}

/** The code part selecting an upgrade's spellcraft/option/item/element. */
function encodeSelection(
	entry: ArmyEntry,
	upgrade: ArmyUpgradeSpec,
	spellcrafts: ArmyRulesSpec[],
	items: ArmyItemSpec[]
): string {
	const levelUp = upgrade.effects.some((effect) => effect.kind === 'spellcraftLevelUp');
	const choice = upgrade.effects.find(
		(effect): effect is Extract<ArmyUpgradeSpec['effects'][number], { kind: 'choice' }> =>
			effect.kind === 'choice'
	);
	if (levelUp) {
		const chosen = entry.spellcraftChoices?.[upgrade.id];
		const index = chosen === undefined ? -1 : indexOfById(spellcrafts, chosen);
		if (index === -1) throw new Error('Missing spellcraft choice for ' + upgrade.id);
		return '=' + to36(index);
	}
	if (choice) {
		const picked = entry.upgradeChoices?.[upgrade.id];
		const optionIndex = picked
			? choice.options.findIndex((option) => option.id === picked.option)
			: -1;
		if (picked === undefined || optionIndex === -1) {
			throw new Error('Missing option choice for ' + upgrade.id);
		}
		const option = choice.options[optionIndex];
		let token = '=' + to36(optionIndex);
		if (option.inscribeItem) {
			const itemIndex = picked.itemId ? indexOfById(items, picked.itemId) : -1;
			if (itemIndex === -1) throw new Error('Missing inscribed item for ' + upgrade.id);
			token += ',' + to36(itemIndex);
		} else if (option.replaceAffinity) {
			const elementIndex = picked.removedElement
				? CODE_ELEMENTS.indexOf(picked.removedElement.toLowerCase())
				: -1;
			if (elementIndex === -1) {
				throw new Error('Missing replaced element for ' + upgrade.id);
			}
			token += ',' + to36(elementIndex);
		}
		return token;
	}
	return '';
}

/** Encodes an army list as a compact share code for the current roster. */
export function encodeArmy(list: ArmyList, catalog: ArmyCodeCatalog): string {
	const factionIndex = catalog.factions.findIndex((faction) => faction.id === list.factionId);
	if (factionIndex === -1) throw new Error('Unknown faction: ' + list.factionId);
	const units = codeUnitPool(catalog.units);
	const upgrades = byId(catalog.upgrades);
	const spellcrafts = byId(catalog.spellcrafts);
	const items = byId(catalog.items);
	const entryTokens = list.entries.map((entry) => {
		const unitIndex = indexOfById(units, entry.unitId);
		if (unitIndex === -1) throw new Error('Unknown unit: ' + entry.unitId);
		let token = to36(unitIndex) + (entry.mounted === true ? '*' : '');
		for (const upgradeId of entry.upgrades ?? []) {
			const upgradeIndex = indexOfById(upgrades, upgradeId);
			if (upgradeIndex === -1) throw new Error('Unknown upgrade: ' + upgradeId);
			token +=
				'-' +
				to36(upgradeIndex) +
				encodeSelection(entry, upgrades[upgradeIndex], spellcrafts, items);
		}
		return token;
	});
	const formatChar = list.format === 'standard' ? 's' : 't';
	return (
		CODE_VERSION +
		catalogFingerprint(catalog) +
		':' +
		to36(factionIndex) +
		formatChar +
		':' +
		entryTokens.join('_')
	);
}

/** Decodes one entry token; null when malformed or out of range. */
function decodeEntry(
	token: string,
	position: number,
	units: ArmyUnitSpec[],
	upgrades: ArmyUpgradeSpec[],
	spellcrafts: ArmyRulesSpec[],
	items: ArmyItemSpec[]
): ArmyEntry | null {
	const parts = token.split('-');
	const unitPart = parts[0];
	if (!unitPart) return null;
	const mounted = unitPart.endsWith('*');
	const unitToken = mounted ? unitPart.slice(0, -1) : unitPart;
	if (mounted && unitToken.includes('*')) return null;
	const unitIndex = from36(unitToken);
	if (unitIndex === null || unitIndex >= units.length) return null;
	const entry: ArmyEntry = {
		id: 'imported-' + (position + 1),
		unitId: units[unitIndex].id
	};
	if (mounted) entry.mounted = true;
	if (parts.length === 1) return entry;
	const upgradeIds: string[] = [];
	const spellcraftChoices: Record<string, string> = {};
	const upgradeChoices: Record<string, ArmyUpgradeChoice> = {};
	for (const upgradeToken of parts.slice(1)) {
		const segments = upgradeToken.split('=');
		if (segments.length > 2) return null;
		const [indexToken, choicePart] = segments;
		const upgradeIndex = from36(indexToken);
		if (upgradeIndex === null || upgradeIndex >= upgrades.length) return null;
		const upgrade = upgrades[upgradeIndex];
		upgradeIds.push(upgrade.id);
		const levelUp = upgrade.effects.some((effect) => effect.kind === 'spellcraftLevelUp');
		const choice = upgrade.effects.find(
			(effect): effect is Extract<ArmyUpgradeSpec['effects'][number], { kind: 'choice' }> =>
				effect.kind === 'choice'
		);
		if (levelUp && choice) return null;
		if (levelUp) {
			if (choicePart === undefined || choicePart.includes(',')) return null;
			const groupIndex = from36(choicePart);
			if (groupIndex === null || groupIndex >= spellcrafts.length) return null;
			spellcraftChoices[upgrade.id] = spellcrafts[groupIndex].id;
		} else if (choice) {
			if (choicePart === undefined) return null;
			const bits = choicePart.split(',');
			const optionIndex = from36(bits[0]);
			if (optionIndex === null || optionIndex >= choice.options.length) return null;
			const option = choice.options[optionIndex];
			if (option.inscribeItem) {
				if (bits.length !== 2) return null;
				const itemIndex = from36(bits[1]);
				if (itemIndex === null || itemIndex >= items.length) return null;
				upgradeChoices[upgrade.id] = { option: option.id, itemId: items[itemIndex].id };
			} else if (option.replaceAffinity) {
				if (bits.length !== 2) return null;
				const elementIndex = from36(bits[1]);
				if (elementIndex === null || elementIndex >= CODE_ELEMENTS.length) return null;
				upgradeChoices[upgrade.id] = {
					option: option.id,
					removedElement: CODE_ELEMENTS[elementIndex]
				};
			} else {
				if (bits.length !== 1) return null;
				upgradeChoices[upgrade.id] = { option: option.id };
			}
		} else if (choicePart !== undefined) {
			return null;
		}
	}
	if (upgradeIds.length > 0) entry.upgrades = upgradeIds;
	if (Object.keys(spellcraftChoices).length > 0) entry.spellcraftChoices = spellcraftChoices;
	if (Object.keys(upgradeChoices).length > 0) entry.upgradeChoices = upgradeChoices;
	return entry;
}

/**
 * Decodes a share code against the current roster: the list on success,
 * 'roster-mismatch' when the fingerprint differs, 'invalid' otherwise.
 */
export function decodeArmy(code: string, catalog: ArmyCodeCatalog): ArmyCodeDecodeResult {
	const invalid: ArmyCodeDecodeResult = { ok: false, error: 'invalid' };
	const normalized = code.trim().toLowerCase();
	if (normalized.length < 6 || normalized[0] !== CODE_VERSION) return invalid;
	if (normalized.slice(1, 4) !== catalogFingerprint(catalog)) {
		return { ok: false, error: 'roster-mismatch' };
	}
	if (normalized[4] !== ':') return invalid;
	const separator = normalized.indexOf(':', 5);
	if (separator === -1) return invalid;
	const head = normalized.slice(5, separator);
	const entriesToken = normalized.slice(separator + 1);
	if (head.length < 2 || entriesToken === '') return invalid;
	const formatChar = head[head.length - 1];
	if (formatChar !== 's' && formatChar !== 't') return invalid;
	const factionIndex = from36(head.slice(0, -1));
	if (factionIndex === null || factionIndex >= catalog.factions.length) return invalid;
	const units = codeUnitPool(catalog.units);
	const upgrades = byId(catalog.upgrades);
	const spellcrafts = byId(catalog.spellcrafts);
	const items = byId(catalog.items);
	const entries: ArmyEntry[] = [];
	for (const [position, token] of entriesToken.split('_').entries()) {
		const entry = decodeEntry(token, position, units, upgrades, spellcrafts, items);
		if (!entry) return invalid;
		entries.push(entry);
	}
	return {
		ok: true,
		list: {
			factionId: catalog.factions[factionIndex].id,
			format: formatChar === 's' ? 'standard' : 'tournament',
			entries
		}
	};
}
