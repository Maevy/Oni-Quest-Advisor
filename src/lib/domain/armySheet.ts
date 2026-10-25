import {
	ARMY_FORMAT_POINTS,
	armyPoints,
	indexArmyRules,
	resolveArmyEntries,
	rosterPickPoints,
	unitsForFaction,
	type ArmyEntry,
	type ArmyFactionId,
	type ArmyFormat,
	type ArmyRosterRow,
	type ArmyUnitSize
} from './army';
import { decodeArmy, type ArmyCodeCatalog, type ArmyCodeDecodeError } from './armyCode';

/**
 * A shared army list flattened into one presentation-free sheet: what anything outside the app
 * reads when it has to show somebody else's list — the Discord card today, an unfurling route or
 * an image renderer later. It resolves a code through exactly the path the app's own Army view
 * takes, so a sheet can never contradict the screen it stands in for.
 */

/** One distinct pick, with every identical copy of it collapsed into a count. */
export type ArmySheetLine = {
	unitId: string;
	name: string;
	/** How many copies of this exact pick the list fields. */
	copies: number;
	/** One copy's cost, its mount and picked upgrades included. */
	pointsEach: number;
	/** The size a copy counts as — the mount's while mounted. */
	size: ArmyUnitSize;
	/** The mount's name, when these copies are mounted. */
	mount?: string;
	/** Picked upgrade names, in the order the group's first copy carries them. */
	upgrades: string[];
};

/** One entry of a Roster list's shared equipment pool. */
export type ArmySheetPick = {
	id: string;
	name: string;
	qty: number;
	pointsEach: number;
};

/** A whole army list, resolved and ready to be shown. */
export type ArmySheet = {
	factionId: ArmyFactionId;
	factionName: string;
	/** The faction's own accent, a hex colour. */
	factionColor: string;
	factionLogo: string;
	format: ArmyFormat;
	/** The list's total — the same sum the builder's counter shows. */
	points: number;
	pointCap: number;
	lines: ArmySheetLine[];
	/** Empty for a Standard list, whose upgrades sit on the copies themselves. */
	picks: ArmySheetPick[];
};

export type ArmySheetResult =
	{ ok: true; sheet: ArmySheet } | { ok: false; error: ArmyCodeDecodeError };

/**
 * What makes two copies the same pick: the unit, whether they are mounted, and every upgrade
 * together with the choice made inside it. Keyed on the entry rather than on the resolved row,
 * because the row no longer carries which spellcraft or option was picked — two copies leveling
 * up different spellcrafts must not collapse into one line and lose one of them.
 */
function lineKey(entry: ArmyEntry): string {
	const spellcrafts = Object.entries(entry.spellcraftChoices ?? {})
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([upgradeId, groupId]) => upgradeId + '>' + groupId)
		.join(',');
	const choices = Object.entries(entry.upgradeChoices ?? {})
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([upgradeId, choice]) =>
			[upgradeId, choice.option, choice.itemId ?? '', choice.removedElement ?? ''].join('~')
		)
		.join(',');
	return [
		entry.unitId,
		entry.mounted === true ? 'mounted' : '',
		[...(entry.upgrades ?? [])].sort().join('+'),
		spellcrafts,
		choices
	].join('|');
}

/** One line per distinct pick, in the order the copies were first fielded. */
function collapse(rows: ArmyRosterRow[], entries: ArmyEntry[]): ArmySheetLine[] {
	const keyByEntryId = new Map(entries.map((entry) => [entry.id, lineKey(entry)]));
	const lines = new Map<string, ArmySheetLine>();
	for (const row of rows) {
		const key = keyByEntryId.get(row.entryId) ?? row.unitId;
		const existing = lines.get(key);
		if (existing) {
			existing.copies += 1;
			continue;
		}
		lines.set(key, {
			unitId: row.unitId,
			name: row.name,
			copies: 1,
			pointsEach: row.points,
			size: row.effectiveSize,
			...(row.mounted && row.mount ? { mount: row.mount.name } : {}),
			upgrades: row.upgrades.map((upgrade) => upgrade.name)
		});
	}
	return [...lines.values()];
}

/**
 * Resolves a share code into its sheet. The errors are `decodeArmy`'s: **roster-mismatch** when
 * the code was built against different content — every re-import invalidates the codes in
 * circulation — and **invalid** when it is not a code at all. Callers owe the player a message
 * that distinguishes the two, because only one of them is the player's mistake.
 */
export function armySheet(code: string, catalog: ArmyCodeCatalog): ArmySheetResult {
	const decoded = decodeArmy(code, catalog);
	if (!decoded.ok) return decoded;
	const { factionId, format, entries } = decoded.list;
	const faction = catalog.factions.find((candidate) => candidate.id === factionId);
	// A code whose faction index decodes but resolves to nothing is content drift, not a typo.
	if (!faction) return { ok: false, error: 'invalid' };
	const units = unitsForFaction(factionId, catalog.units);
	const upgradeIndex = indexArmyRules(catalog.upgrades);
	const picks = decoded.list.picks ?? [];
	return {
		ok: true,
		sheet: {
			factionId,
			factionName: faction.name,
			factionColor: faction.color,
			factionLogo: faction.logo,
			format,
			points: armyPoints(entries, units, upgradeIndex) + rosterPickPoints(picks, upgradeIndex),
			pointCap: ARMY_FORMAT_POINTS[format],
			lines: collapse(
				resolveArmyEntries(
					entries,
					units,
					catalog.units.mounts,
					upgradeIndex,
					indexArmyRules(catalog.items)
				),
				entries
			),
			picks: picks.map((pick) => ({
				id: pick.id,
				name: upgradeIndex[pick.id]?.name ?? pick.id,
				qty: pick.qty,
				pointsEach: upgradeIndex[pick.id]?.cost ?? 0
			}))
		}
	};
}
