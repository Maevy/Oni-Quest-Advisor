import { describe, expect, it } from 'vitest';
import type {
	ArmyEntry,
	ArmyFactionConfig,
	ArmyItemSpec,
	ArmyRulesSpec,
	ArmyStats,
	ArmyUnitContent,
	ArmyUpgradeSpec
} from './army';
import { decodeArmy, encodeArmy, type ArmyCodeCatalog, type ArmyList } from './armyCode';

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
	{ id: 'helian-league', name: 'Helian League', color: '#1', logo: 'h' },
	{ id: 'sand-kingdoms', name: 'Sand Kingdoms', color: '#2', logo: 's' }
];

const UNITS: ArmyUnitContent = {
	factionUnits: {
		'helian-league': [
			{ id: 'alpha', name: 'Alpha', points: 10, limit: 2, stats: STATS, classes: ['warrior'] },
			{
				id: 'bravo',
				name: 'Bravo',
				points: 12,
				limit: 1,
				stats: STATS,
				classes: ['rider'],
				mount: { unitId: 'lupus', points: 5 }
			}
		],
		'sand-kingdoms': [
			{
				id: 'caster',
				name: 'Caster',
				points: 15,
				limit: 2,
				stats: STATS,
				classes: ['mage'],
				traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Elder'] }]
			},
			{
				id: 'guardian',
				name: 'Guardian',
				points: 20,
				limit: 1,
				stats: STATS,
				classes: ['warrior'],
				mount: { unitId: 'lupus', points: 5 }
			}
		]
	},
	neutralUnits: [
		{ id: 'nomad', name: 'Nomad', points: 8, limit: 3, stats: STATS, classes: ['rogue'] }
	],
	mounts: [{ id: 'lupus', name: 'Lupus', points: 5, limit: 2, stats: STATS, classes: ['mount'] }]
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
	},
	{
		id: 'elemental-lineage-sand-kingdoms',
		name: 'Elemental Lineage',
		cost: 4,
		factionId: 'sand-kingdoms',
		description: [],
		effects: [
			{
				kind: 'choice',
				options: [
					{
						id: 'affinity-fire',
						label: 'Affinity (Fire)',
						grantTrait: { traitId: 'affinity--element', dynamicElements: ['Fire'] }
					},
					{
						id: 'affinity-earth',
						label: 'Affinity (Earth)',
						grantTrait: { traitId: 'affinity--element', dynamicElements: ['Earth'] }
					}
				]
			}
		]
	},
	{
		id: 'glyphscribe-reduce-weight-helian-league',
		name: 'Glyphscribe: Reduce Weight',
		cost: 2,
		factionId: 'helian-league',
		description: [],
		effects: [
			{
				kind: 'choice',
				options: [
					{ id: 'inscribed-item', label: 'Inscribed Item', inscribeItem: { except: [] } },
					{ id: 'inscribed-armor', label: 'Inscribed Armor', statChanges: { AG: 1 } }
				]
			}
		]
	},
	{
		id: 'mana-catalyst-sand-kingdoms',
		name: 'Mana Catalyst',
		cost: 1,
		factionId: 'sand-kingdoms',
		description: [],
		effects: [
			{
				kind: 'choice',
				options: [
					{ id: 'fire', label: 'Fire', replaceAffinity: { element: 'Fire' } },
					{ id: 'water', label: 'Water', replaceAffinity: { element: 'Water' } }
				]
			}
		]
	}
];

const SPELLCRAFTS: ArmyRulesSpec[] = [
	{ id: 'art-of-sorcery', name: 'Art of Sorcery' },
	{ id: 'wizardry', name: 'Wizardry' }
];

const ITEMS: ArmyItemSpec[] = [
	{ id: 'casting-amplifier', name: 'Casting Amplifier', category: 'accessory', effect: [] },
	{ id: 'sword', name: 'Sword', category: 'weapon', effect: [], weight: 1 }
];

const CATALOG: ArmyCodeCatalog = {
	factions: FACTIONS,
	units: UNITS,
	upgrades: UPGRADES,
	spellcrafts: SPELLCRAFTS,
	items: ITEMS
};

const SAND_ARMY: ArmyList = {
	factionId: 'sand-kingdoms',
	format: 'standard',
	entries: [
		{
			id: 'e1',
			unitId: 'caster',
			upgrades: ['mana-catalyst-sand-kingdoms'],
			upgradeChoices: {
				'mana-catalyst-sand-kingdoms': { option: 'fire', removedElement: 'elder' }
			}
		},
		{
			id: 'e2',
			unitId: 'caster',
			upgrades: ['elemental-lineage-sand-kingdoms'],
			upgradeChoices: { 'elemental-lineage-sand-kingdoms': { option: 'affinity-fire' } }
		},
		{ id: 'e3', unitId: 'guardian', mounted: true, upgrades: ['additional-protection'] },
		{ id: 'e4', unitId: 'nomad' }
	]
};

const HELIAN_ARMY: ArmyList = {
	factionId: 'helian-league',
	format: 'tournament',
	entries: [
		{
			id: 'e1',
			unitId: 'alpha',
			upgrades: ['adept-shaper-helian-league'],
			spellcraftChoices: { 'adept-shaper-helian-league': 'wizardry' }
		},
		{
			id: 'e2',
			unitId: 'bravo',
			mounted: true,
			upgrades: ['glyphscribe-reduce-weight-helian-league'],
			upgradeChoices: {
				'glyphscribe-reduce-weight-helian-league': {
					option: 'inscribed-item',
					itemId: 'sword'
				}
			}
		}
	]
};

/** The decoded shape a round trip must reproduce, ignoring generated entry ids. */
function semantic(entries: ArmyEntry[]) {
	return entries.map((entry) => ({
		unitId: entry.unitId,
		mounted: entry.mounted === true,
		upgrades: entry.upgrades ?? [],
		spellcraftChoices: entry.spellcraftChoices ?? {},
		upgradeChoices: entry.upgradeChoices ?? {}
	}));
}

/** Everything up to and including the second colon (version, fingerprint, faction, format). */
function codeHead(code: string): string {
	return code.slice(0, code.indexOf(':', 5) + 1);
}

describe('encodeArmy', () => {
	it('produces a short, versioned code with the roster fingerprint', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		expect(code).toMatch(/^a[0-9a-z]{3}:[0-9a-z]+s:/);
		expect(code.length).toBeLessThan(120);
	});

	it('encodes deterministically', () => {
		expect(encodeArmy(SAND_ARMY, CATALOG)).toBe(encodeArmy(SAND_ARMY, CATALOG));
	});

	it('marks the tournament format', () => {
		expect(encodeArmy(HELIAN_ARMY, CATALOG)).toMatch(/^a[0-9a-z]{3}:[0-9a-z]+t:/);
	});
});

describe('decodeArmy', () => {
	it('round-trips an army with replacements, grants, mounts and plain entries', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		const decoded = decodeArmy(code, CATALOG);
		if (!decoded.ok) throw new Error('expected the code to decode');
		expect(decoded.list.factionId).toBe('sand-kingdoms');
		expect(decoded.list.format).toBe('standard');
		expect(semantic(decoded.list.entries)).toEqual(semantic(SAND_ARMY.entries));
	});

	it('round-trips spellcraft choices, inscribed items and the format', () => {
		const decoded = decodeArmy(encodeArmy(HELIAN_ARMY, CATALOG), CATALOG);
		if (!decoded.ok) throw new Error('expected the code to decode');
		expect(decoded.list.factionId).toBe('helian-league');
		expect(decoded.list.format).toBe('tournament');
		expect(semantic(decoded.list.entries)).toEqual(semantic(HELIAN_ARMY.entries));
	});

	it('assigns stable imported entry ids in code order', () => {
		const decoded = decodeArmy(encodeArmy(SAND_ARMY, CATALOG), CATALOG);
		if (!decoded.ok) throw new Error('expected the code to decode');
		expect(decoded.list.entries.map((entry) => entry.id)).toEqual([
			'imported-1',
			'imported-2',
			'imported-3',
			'imported-4'
		]);
	});

	it('ignores surrounding whitespace and uppercased pastes', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		const decoded = decodeArmy('  ' + code.toUpperCase() + '\n', CATALOG);
		expect(decoded.ok).toBe(true);
	});

	it('rejects empty and malformed codes', () => {
		for (const candidate of ['', 'garbage', 'b1abc:0s:1', 'a1ab', 'zzzzzzzzzz']) {
			expect(decodeArmy(candidate, CATALOG)).toEqual({ ok: false, error: 'invalid' });
		}
	});

	it('rejects codes from a different roster instead of decoding wrong units', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		const changed: ArmyCodeCatalog = {
			...CATALOG,
			units: {
				...UNITS,
				neutralUnits: [
					...UNITS.neutralUnits,
					{ id: 'aaa-new-unit', name: 'New', points: 5, limit: 1, stats: STATS, classes: [] }
				]
			}
		};
		expect(decodeArmy(code, changed)).toEqual({ ok: false, error: 'roster-mismatch' });
	});

	it('rejects an out-of-range unit index', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		expect(decodeArmy(codeHead(code) + 'zz', CATALOG)).toEqual({
			ok: false,
			error: 'invalid'
		});
	});

	it('rejects an empty entry list', () => {
		const code = encodeArmy(SAND_ARMY, CATALOG);
		expect(decodeArmy(codeHead(code), CATALOG)).toEqual({ ok: false, error: 'invalid' });
	});

	it('rejects structurally broken entry and upgrade tokens', () => {
		const head = codeHead(encodeArmy(SAND_ARMY, CATALOG));
		// Upgrade pool by index: 0 additional-protection (plain), 1 adept-shaper
		// (level-up), 2 elemental-lineage (grant options), 3 glyphscribe
		// (inscribe/armor options), 4 mana-catalyst (replace options).
		for (const entries of [
			'0-0=', // choice marker without a choice value
			'0-0=1=2', // two choice markers
			'0-0x=0', // upgrade index is not base36
			'0-0=0', // plain upgrade given a choice
			'0-1', // level-up upgrade missing its spellcraft choice
			'0-3=9', // option index out of range
			'0-3=0', // inscribe option missing its item
			'0-3=0,9', // inscribed item index out of range
			'0-2=0,1', // grant option given an extra detail
			'0-4=0,9', // replaced element index out of range
			'0**', // double mount marker
			'1*-*' // mount marker inside the upgrade list
		]) {
			expect(decodeArmy(head + entries, CATALOG)).toEqual({ ok: false, error: 'invalid' });
		}
	});
});
