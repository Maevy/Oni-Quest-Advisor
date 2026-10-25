import { describe, expect, it } from 'vitest';
import {
	ARMY_FORMAT_POINTS,
	armyPoints,
	indexArmyRules,
	rosterPickPoints,
	unitsForFaction,
	type ArmyFactionConfig,
	type ArmyItemSpec,
	type ArmyRulesSpec,
	type ArmyStats,
	type ArmyUnitContent,
	type ArmyUpgradeSpec
} from './army';
import { encodeArmy, type ArmyCodeCatalog, type ArmyList } from './armyCode';
import { armySheet, type ArmySheet } from './armySheet';

const STATS: ArmyStats = {
	STA: 1,
	SPD: 2,
	OFF: 3,
	DEF: 4,
	ACC: 5,
	INT: 6,
	AG: 7,
	T: 8,
	ARM: 9,
	HP: 10,
	M: 11
};

const FACTIONS: ArmyFactionConfig[] = [
	{ id: 'helian-league', name: 'Helian League', color: '#FDF4E3', logo: 'helian.png' },
	{ id: 'sand-kingdoms', name: 'Sand Kingdoms', color: '#21888F', logo: 'sand.png' }
];

const UNITS: ArmyUnitContent = {
	factionUnits: {
		'helian-league': [
			{
				id: 'alpha',
				name: 'Alpha',
				points: 10,
				limit: 3,
				stats: STATS,
				size: 'medium',
				classes: ['warrior']
			},
			{
				id: 'bravo',
				name: 'Bravo',
				points: 12,
				limit: 2,
				stats: STATS,
				size: 'medium',
				classes: ['rider'],
				mount: { unitId: 'lupus', points: 5, size: 'huge' }
			}
		]
	},
	neutralUnits: [
		{
			id: 'nomad',
			name: 'Nomad',
			points: 8,
			limit: 3,
			stats: STATS,
			size: 'medium',
			classes: ['rogue']
		}
	],
	mounts: [
		{
			id: 'lupus',
			name: 'Lupus',
			points: 5,
			limit: 2,
			stats: STATS,
			size: 'huge',
			classes: ['mount']
		}
	],
	summons: []
};

const UPGRADES: ArmyUpgradeSpec[] = [
	{
		id: 'additional-protection',
		name: 'Additional Protection',
		cost: 2,
		description: [],
		effects: [{ kind: 'stat', changes: { ARM: 2 } }]
	},
	{
		id: 'adept-shaper-helian-league',
		name: 'Adept Shaper',
		cost: 3,
		factionId: 'helian-league',
		description: [],
		effects: [{ kind: 'spellcraftLevelUp' }]
	}
];

const SPELLCRAFTS: ArmyRulesSpec[] = [
	{ id: 'art-of-sorcery', name: 'Art of Sorcery' },
	{ id: 'wizardry', name: 'Wizardry' }
];

const ITEMS: ArmyItemSpec[] = [
	{ id: 'sword', name: 'Sword', category: 'weapon', effect: [], weight: 1 }
];

const CATALOG: ArmyCodeCatalog = {
	factions: FACTIONS,
	units: UNITS,
	upgrades: UPGRADES,
	spellcrafts: SPELLCRAFTS,
	items: ITEMS
};

/** Three identical copies, one mounted copy of a mountable unit, one plain neutral. */
const STANDARD_ARMY: ArmyList = {
	factionId: 'helian-league',
	format: 'standard',
	entries: [
		{ id: 'e1', unitId: 'alpha', upgrades: ['additional-protection'] },
		{ id: 'e2', unitId: 'alpha', upgrades: ['additional-protection'] },
		{ id: 'e3', unitId: 'bravo', mounted: true },
		{ id: 'e4', unitId: 'nomad' }
	]
};

const ROSTER_ARMY: ArmyList = {
	factionId: 'helian-league',
	format: 'roster',
	entries: [
		{ id: 'e1', unitId: 'alpha' },
		{ id: 'e2', unitId: 'bravo', mounted: true }
	],
	picks: [
		{ id: 'additional-protection', qty: 2 },
		{ id: 'adept-shaper-helian-league', qty: 1 }
	]
};

/** Encodes a list and resolves it, failing the test rather than the assertion when it will not. */
function sheetOf(list: ArmyList, catalog: ArmyCodeCatalog = CATALOG): ArmySheet {
	const result = armySheet(encodeArmy(list, catalog), catalog);
	if (!result.ok) throw new Error('expected the code to resolve, got ' + result.error);
	return result.sheet;
}

describe('armySheet', () => {
	it('resolves a code into the faction, the format and the cap', () => {
		const sheet = sheetOf(STANDARD_ARMY);
		expect(sheet.factionId).toBe('helian-league');
		expect(sheet.factionName).toBe('Helian League');
		expect(sheet.factionColor).toBe('#FDF4E3');
		expect(sheet.factionLogo).toBe('helian.png');
		expect(sheet.format).toBe('standard');
		expect(sheet.pointCap).toBe(ARMY_FORMAT_POINTS.standard);
	});

	it('collapses identical copies into one line carrying the count', () => {
		const sheet = sheetOf(STANDARD_ARMY);
		const alphas = sheet.lines.filter((line) => line.unitId === 'alpha');
		expect(alphas).toHaveLength(1);
		expect(alphas[0].copies).toBe(2);
		expect(alphas[0].name).toBe('Alpha');
		expect(alphas[0].upgrades).toEqual(['Additional Protection']);
		// 10 for the unit plus 2 for its upgrade.
		expect(alphas[0].pointsEach).toBe(12);
	});

	it('keeps a mounted copy out of an unmounted one, at the mount size', () => {
		const sheet = sheetOf({
			factionId: 'helian-league',
			format: 'standard',
			entries: [
				{ id: 'e1', unitId: 'bravo', mounted: true },
				{ id: 'e2', unitId: 'bravo' }
			]
		});
		expect(sheet.lines).toHaveLength(2);
		const mounted = sheet.lines.find((line) => line.mount !== undefined);
		expect(mounted?.copies).toBe(1);
		expect(mounted?.mount).toBe('Lupus');
		expect(mounted?.size).toBe('huge');
		expect(mounted?.pointsEach).toBe(17);
		const onFoot = sheet.lines.find((line) => line.mount === undefined);
		expect(onFoot?.size).toBe('medium');
		expect(onFoot?.pointsEach).toBe(12);
	});

	it('keeps two copies apart when the choice inside an upgrade differs', () => {
		const sheet = sheetOf({
			factionId: 'helian-league',
			format: 'standard',
			entries: [
				{
					id: 'e1',
					unitId: 'alpha',
					upgrades: ['adept-shaper-helian-league'],
					spellcraftChoices: { 'adept-shaper-helian-league': 'wizardry' }
				},
				{
					id: 'e2',
					unitId: 'alpha',
					upgrades: ['adept-shaper-helian-league'],
					spellcraftChoices: { 'adept-shaper-helian-league': 'art-of-sorcery' }
				}
			]
		});
		expect(sheet.lines.filter((line) => line.unitId === 'alpha')).toHaveLength(2);
		expect(sheet.lines.every((line) => line.copies === 1)).toBe(true);
	});

	it('counts upgrade order as the same pick', () => {
		const sheet = sheetOf({
			factionId: 'helian-league',
			format: 'standard',
			entries: [
				{
					id: 'e1',
					unitId: 'alpha',
					upgrades: ['adept-shaper-helian-league', 'additional-protection'],
					spellcraftChoices: { 'adept-shaper-helian-league': 'wizardry' }
				},
				{
					id: 'e2',
					unitId: 'alpha',
					upgrades: ['additional-protection', 'adept-shaper-helian-league'],
					spellcraftChoices: { 'adept-shaper-helian-league': 'wizardry' }
				}
			]
		});
		expect(sheet.lines).toHaveLength(1);
		expect(sheet.lines[0].copies).toBe(2);
	});

	it('reports the roster equipment pool separately and keeps the units bare', () => {
		const sheet = sheetOf(ROSTER_ARMY);
		expect(sheet.format).toBe('roster');
		expect(sheet.pointCap).toBe(ARMY_FORMAT_POINTS.roster);
		expect(sheet.picks).toEqual([
			{ id: 'additional-protection', name: 'Additional Protection', qty: 2, pointsEach: 2 },
			{ id: 'adept-shaper-helian-league', name: 'Adept Shaper', qty: 1, pointsEach: 3 }
		]);
		expect(sheet.lines.every((line) => line.upgrades.length === 0)).toBe(true);
	});

	it('carries no equipment pool for a standard list', () => {
		expect(sheetOf(STANDARD_ARMY).picks).toEqual([]);
	});

	it('totals exactly what the builder totals, cap included', () => {
		for (const list of [STANDARD_ARMY, ROSTER_ARMY]) {
			const sheet = sheetOf(list);
			const units = unitsForFaction(list.factionId, CATALOG.units);
			const upgradeIndex = indexArmyRules(CATALOG.upgrades);
			expect(sheet.points).toBe(
				armyPoints(list.entries, units, upgradeIndex) +
					rosterPickPoints(list.picks ?? [], upgradeIndex)
			);
		}
		// 10+2 twice, 12+5 mounted, 8 plain.
		expect(sheetOf(STANDARD_ARMY).points).toBe(24 + 17 + 8);
		// 10, 12+5, plus 2*2 and 3 of equipment.
		expect(sheetOf(ROSTER_ARMY).points).toBe(10 + 17 + 4 + 3);
	});

	it('fields the lines in the order the copies were fielded', () => {
		expect(sheetOf(STANDARD_ARMY).lines.map((line) => line.unitId)).toEqual([
			'alpha',
			'bravo',
			'nomad'
		]);
	});

	it('reports roster-mismatch for a code from different content', () => {
		const code = encodeArmy(STANDARD_ARMY, CATALOG);
		const shifted: ArmyCodeCatalog = {
			...CATALOG,
			units: {
				...UNITS,
				// A new neutral sorts first by id, moving every index after it.
				neutralUnits: [
					{
						id: 'aaa-intruder',
						name: 'Intruder',
						points: 1,
						limit: 1,
						stats: STATS,
						size: 'small',
						classes: []
					},
					...UNITS.neutralUnits
				]
			}
		};
		expect(armySheet(code, shifted)).toEqual({ ok: false, error: 'roster-mismatch' });
	});

	it('reports invalid for something that is not a code', () => {
		for (const candidate of [
			'',
			'nope',
			'a123',
			'b' + encodeArmy(STANDARD_ARMY, CATALOG).slice(1)
		]) {
			expect(armySheet(candidate, CATALOG)).toEqual({ ok: false, error: 'invalid' });
		}
	});
});
