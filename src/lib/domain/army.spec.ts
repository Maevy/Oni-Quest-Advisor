import { describe, expect, it } from 'vitest';
import {
	addArmyUnit,
	affinityElements,
	armyCopyCounts,
	armyPoints,
	armyRulesTitle,
	armyUpgradeCostReduction,
	addEntryUpgrade,
	classPopupFor,
	combatArtPopupFor,
	effectiveMountedStats,
	entryUpgradeBlock,
	indexArmyRules,
	inscribableItems,
	inscribedItem,
	inventorySpaceUsed,
	isInscribableItem,
	isOverArmyLimit,
	itemTypeDisplay,
	rangeBracketDisplay,
	reachBoxLines,
	removeArmyCopy,
	removeArmyEntry,
	removeEntryUpgrade,
	resolveArmyEntries,
	romanNumeral,
	rulesLinkPopup,
	skillPopupFor,
	spellCostDisplay,
	spellcraftLevelCap,
	spellcraftPopupFor,
	stratagemsFor,
	substituteArmyTemplate,
	toggleArmyMount,
	traitPopupFor,
	upgradedArmyUnit,
	upgradeCostInArmy,
	upgradeItemOverrides,
	upgradeOptionUsable,
	upgradeSlotsFor,
	upgradesForFaction,
	unitsForFaction,
	type ArmyEntry,
	type ArmyItemSpec,
	type ArmyRulesIndexes,
	type ArmyRulesSpec,
	type ArmySpellSpec,
	type ArmyStats,
	type ArmyStratagemSpec,
	type ArmyUnitContent,
	type ArmyUnitSpec,
	type ArmyUpgradeSpec
} from './army';

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

const UNITS: ArmyUnitSpec[] = [
	{ id: 'warrior', name: 'Warrior', points: 25, limit: 3, stats: STATS, classes: ['warrior'] },
	{ id: 'mage', name: 'Mage', points: 25, limit: 1, stats: STATS, classes: ['mage'] },
	{ id: 'archer', name: 'Archer', points: 20, limit: 2, stats: STATS, classes: ['ranger'] },
	{
		id: 'dragoon',
		name: 'Slayer Dragoon',
		points: 17,
		limit: 2,
		stats: STATS,
		classes: ['assassin', 'rider'],
		mount: { unitId: 'lupus-rex', points: 5 }
	}
];

const MOUNTS: ArmyUnitSpec[] = [
	{
		id: 'lupus-rex',
		name: 'Lupus Rex',
		points: 5,
		limit: 2,
		stats: {
			STA: null,
			SPD: 9,
			OFF: null,
			DEF: null,
			ACC: null,
			INT: null,
			AG: null,
			T: null,
			ARM: null,
			HP: null,
			M: null
		},
		classes: ['mount'],
		statChanges: { DEF: 3, T: 2, ARM: -2, HP: 1 }
	}
];

const DRAGOON = UNITS.find((unit) => unit.id === 'dragoon') ?? UNITS[0];

describe('addArmyUnit', () => {
	it('adds the first copy as a new entry', () => {
		expect(addArmyUnit([], 'warrior', UNITS, 'w1')).toEqual([{ id: 'w1', unitId: 'warrior' }]);
	});

	it('adds every further copy as its own entry', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(addArmyUnit(entries, 'warrior', UNITS, 'w2')).toEqual([
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		]);
	});

	it('leaves other entries untouched and does not mutate the input', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		const next = addArmyUnit(entries, 'mage', UNITS, 'm1');
		expect(next).toEqual([
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'm1', unitId: 'mage' }
		]);
		expect(entries).toEqual([{ id: 'w1', unitId: 'warrior' }]);
	});

	it('stops adding once the unit limit is reached across entries', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' },
			{ id: 'w3', unitId: 'warrior' }
		];
		expect(addArmyUnit(entries, 'warrior', UNITS, 'w4')).toBe(entries);
		expect(addArmyUnit([{ id: 'm1', unitId: 'mage' }], 'mage', UNITS, 'm2')).toEqual([
			{ id: 'm1', unitId: 'mage' }
		]);
	});

	it('adds units without roster info, since no limit applies', () => {
		expect(addArmyUnit([], 'ghost', UNITS, 'g1')).toEqual([{ id: 'g1', unitId: 'ghost' }]);
	});
});

describe('removeArmyEntry', () => {
	it('removes the entry with the given id', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(removeArmyEntry(entries, 'w1')).toEqual([{ id: 'w2', unitId: 'warrior' }]);
	});

	it('is a no-op for an unknown entry id', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(removeArmyEntry(entries, 'ghost')).toBe(entries);
	});
});

describe('removeArmyCopy', () => {
	it('removes the most recently added copy of the unit', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', mounted: true },
			{ id: 'm1', unitId: 'mage' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(removeArmyCopy(entries, 'warrior')).toEqual([
			{ id: 'w1', unitId: 'warrior', mounted: true },
			{ id: 'm1', unitId: 'mage' }
		]);
	});

	it('is a no-op for an unknown unit', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(removeArmyCopy(entries, 'warrior')).toBe(entries);
	});
});

describe('resolveArmyEntries', () => {
	it('returns one row per copy', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(resolveArmyEntries(entries, UNITS, MOUNTS)).toEqual([
			{
				entryId: 'w1',
				unitId: 'warrior',
				name: 'Warrior',
				points: 25,
				mounted: false,
				effectiveStats: STATS,
				upgradedUnit: UNITS[0],
				upgrades: [],
				itemOverrides: {}
			},
			{
				entryId: 'w2',
				unitId: 'warrior',
				name: 'Warrior',
				points: 25,
				mounted: false,
				effectiveStats: STATS,
				upgradedUnit: UNITS[0],
				upgrades: [],
				itemOverrides: {}
			}
		]);
	});

	it('skips entries whose unit no longer exists', () => {
		expect(resolveArmyEntries([{ id: 'g1', unitId: 'ghost' }], UNITS, MOUNTS)).toEqual([]);
	});

	it('carries the optional icon through for display', () => {
		const units: ArmyUnitSpec[] = [
			{
				id: 'oni',
				name: 'Oni',
				points: 5,
				limit: 1,
				stats: STATS,
				classes: ['creature'],
				icon: 'oni.jpg'
			}
		];
		expect(resolveArmyEntries([{ id: 'o1', unitId: 'oni' }], units, [])).toEqual([
			{
				entryId: 'o1',
				unitId: 'oni',
				name: 'Oni',
				points: 5,
				icon: 'oni.jpg',
				mounted: false,
				effectiveStats: STATS,
				upgradedUnit: units[0],
				upgrades: [],
				itemOverrides: {}
			}
		]);
	});

	it('marks a copy as mounted and adds the mount cost and stats', () => {
		expect(
			resolveArmyEntries([{ id: 'd1', unitId: 'dragoon', mounted: true }], UNITS, MOUNTS)
		).toEqual([
			{
				entryId: 'd1',
				unitId: 'dragoon',
				name: 'Slayer Dragoon',
				points: 22,
				mounted: true,
				mount: MOUNTS[0],
				effectiveStats: {
					STA: 1,
					SPD: 9,
					OFF: 3,
					DEF: 7,
					ACC: 5,
					INT: 6,
					AG: 7,
					T: 10,
					ARM: 7,
					HP: 11,
					M: 11
				},
				upgradedUnit: DRAGOON,
				upgrades: [],
				itemOverrides: {}
			}
		]);
	});
});

describe('armyPoints', () => {
	it('is zero for an empty army', () => {
		expect(armyPoints([], UNITS)).toBe(0);
	});

	it('sums every copy of every selected unit', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'w2', unitId: 'warrior' },
			{ id: 'w3', unitId: 'warrior' },
			{ id: 'a1', unitId: 'archer' },
			{ id: 'a2', unitId: 'archer' }
		];
		expect(armyPoints(entries, UNITS)).toBe(115);
	});

	it('adds the mount cost per mounted copy only', () => {
		const entries: ArmyEntry[] = [
			{ id: 'd1', unitId: 'dragoon', mounted: true },
			{ id: 'd2', unitId: 'dragoon' }
		];
		expect(armyPoints(entries, UNITS)).toBe(39);
	});
});

describe('armyCopyCounts', () => {
	it('counts copies per unit id', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior' },
			{ id: 'm1', unitId: 'mage' },
			{ id: 'w2', unitId: 'warrior' }
		];
		expect(armyCopyCounts(entries)).toEqual({ warrior: 2, mage: 1 });
	});

	it('returns an empty record for an empty army', () => {
		expect(armyCopyCounts([])).toEqual({});
	});
});

describe('isOverArmyLimit', () => {
	it('allows exactly the standard cap but not more', () => {
		expect(isOverArmyLimit(85, 'standard')).toBe(false);
		expect(isOverArmyLimit(86, 'standard')).toBe(true);
	});

	it('allows exactly the tournament cap but not more', () => {
		expect(isOverArmyLimit(125, 'tournament')).toBe(false);
		expect(isOverArmyLimit(126, 'tournament')).toBe(true);
	});
});

describe('unitsForFaction', () => {
	const CONTENT: ArmyUnitContent = {
		factionUnits: {
			'helian-league': [
				{
					id: 'legionnaire',
					name: 'Legionnaire',
					points: 12,
					limit: 1,
					stats: STATS,
					classes: ['soldier']
				}
			],
			'oni-clans': [
				{
					id: 'lesser-oni',
					name: 'Lesser Oni',
					points: 8,
					limit: 2,
					stats: STATS,
					classes: ['creature']
				}
			]
		},
		neutralUnits: [
			{
				id: 'hired-blade',
				name: 'Hired Blade',
				points: 17,
				limit: 3,
				stats: STATS,
				classes: ['soldier']
			}
		],
		mounts: MOUNTS
	};

	it('combines the faction exclusives with the neutral pool', () => {
		expect(unitsForFaction('helian-league', CONTENT)).toEqual([
			{
				id: 'legionnaire',
				name: 'Legionnaire',
				points: 12,
				limit: 1,
				stats: STATS,
				classes: ['soldier']
			},
			{
				id: 'hired-blade',
				name: 'Hired Blade',
				points: 17,
				limit: 3,
				stats: STATS,
				classes: ['soldier']
			}
		]);
	});

	it('falls back to the neutral pool for factions without exclusives', () => {
		expect(unitsForFaction('adventurers-guild', CONTENT)).toEqual([
			{
				id: 'hired-blade',
				name: 'Hired Blade',
				points: 17,
				limit: 3,
				stats: STATS,
				classes: ['soldier']
			}
		]);
	});

	it('withholds the neutral pool from monster factions', () => {
		expect(unitsForFaction('oni-clans', CONTENT)).toEqual([
			{
				id: 'lesser-oni',
				name: 'Lesser Oni',
				points: 8,
				limit: 2,
				stats: STATS,
				classes: ['creature']
			}
		]);
		expect(unitsForFaction('goblin-wartribes', CONTENT)).toEqual([]);
	});
});

const RESISTANCE: ArmyRulesSpec = {
	id: 'resistance--x',
	name: 'Resistance (X)',
	levels: {
		1: [
			{ text: 'Power of a Hit dealt to this model by an Attack with the ' },
			{ text: '(X)' },
			{ text: ' Type or Trait is halved.' }
		],
		2: [
			{
				text: 'Hits and related Effects dealt to this model by an Attack with the (X) Type or Trait are negated.'
			}
		]
	}
};

const CHARM: ArmyRulesSpec = {
	id: 'charm',
	name: 'Charm',
	levels: {
		1: [
			{ text: 'The target becomes ' },
			{ text: 'Confused', link: { type: 'trait', id: 'confused' } },
			{ text: '.' }
		],
		2: [{ text: 'On a failed roll, the target must also perform Walk towards the user.' }]
	}
};

const DASH: ArmyRulesSpec = {
	id: 'dash',
	name: 'Dash',
	levels: { 1: [{ text: 'This model may perform a Dash move.' }] }
};

const FENCING: ArmyRulesSpec = {
	id: 'fencing',
	name: 'Fencing',
	levels: {
		1: [{ text: 'Fencing level one.' }],
		2: [{ text: 'Fencing level two.' }],
		3: [{ text: 'Fencing level three.' }],
		4: [{ text: 'Fencing level four.' }]
	}
};

const WIZARD: ArmyRulesSpec = {
	id: 'wizard',
	name: 'WIZARD',
	description: [
		{ text: 'When casting a Spell of the Elder Element, a Wizard may reroll up to 1 failed roll.' }
	]
};

describe('indexArmyRules', () => {
	it('indexes rules entries by id', () => {
		expect(indexArmyRules([WIZARD, CHARM])).toEqual({ wizard: WIZARD, charm: CHARM });
	});

	it('returns an empty record for an empty list', () => {
		expect(indexArmyRules([])).toEqual({});
	});
});

describe('romanNumeral', () => {
	it('converts the levels the game prints', () => {
		expect([1, 2, 3, 4, 5].map(romanNumeral)).toEqual(['I', 'II', 'III', 'IV', 'V']);
	});
});

describe('armyRulesTitle', () => {
	it('leaves unleveled entries without a suffix', () => {
		expect(armyRulesTitle('WIZARD')).toBe('WIZARD');
	});

	it('adds a roman level suffix for leveled entries, including level 1', () => {
		expect(armyRulesTitle('Charm', 1)).toBe('Charm I');
		expect(armyRulesTitle('Fencing', 3)).toBe('Fencing III');
	});
});

describe('classPopupFor', () => {
	it('wraps the description in a single available section', () => {
		expect(classPopupFor(WIZARD)).toEqual({
			title: 'WIZARD',
			sections: [{ available: true, text: WIZARD.description }]
		});
	});

	it('is null for a missing entry', () => {
		expect(classPopupFor(undefined)).toBeNull();
	});
});

describe('substituteArmyTemplate', () => {
	it('replaces (X) and bare X with the value, dropping the parens in rules text', () => {
		expect(substituteArmyTemplate('an Attack with the (X) Type', 'Spell', false)).toBe(
			'an Attack with the Spell Type'
		);
		expect(substituteArmyTemplate('not affected by the X Environment.', 'Scorching', false)).toBe(
			'not affected by the Scorching Environment.'
		);
	});

	it('keeps the parens for display names', () => {
		expect(substituteArmyTemplate('Resistance (X)', 'Poison', true)).toBe('Resistance (Poison)');
	});

	it('replaces (Element) with the element name', () => {
		expect(substituteArmyTemplate('can cast (Element) Spells', 'Elder', false)).toBe(
			'can cast Elder Spells'
		);
		expect(substituteArmyTemplate('Affinity (Element)', 'Elder', true)).toBe('Affinity (Elder)');
	});

	it('leaves the text untouched without a value', () => {
		expect(substituteArmyTemplate('Resistance (X)', undefined, false)).toBe('Resistance (X)');
	});
});

describe('skillPopupFor', () => {
	it('lists every level, available up to the unit level and greyed out beyond', () => {
		expect(skillPopupFor(CHARM, { id: 'charm', level: 1 })).toEqual({
			title: 'Charm I',
			sections: [
				{ level: 1, available: true, text: CHARM.levels?.[1] },
				{ level: 2, available: false, text: CHARM.levels?.[2] }
			]
		});
		expect(skillPopupFor(CHARM, { id: 'charm', level: 2 })).toEqual({
			title: 'Charm II',
			sections: [
				{ level: 1, available: true, text: CHARM.levels?.[1] },
				{ level: 2, available: true, text: CHARM.levels?.[2] }
			]
		});
	});

	it('renders a single-level entry as one available section', () => {
		expect(skillPopupFor(DASH, { id: 'dash', level: 1 })).toEqual({
			title: 'Dash I',
			sections: [{ level: 1, available: true, text: DASH.levels?.[1] }]
		});
	});

	it('falls back to the description for level-less entries', () => {
		expect(skillPopupFor(WIZARD, { id: 'wizard', level: 1 })).toEqual({
			title: 'WIZARD I',
			sections: [{ available: true, text: WIZARD.description }]
		});
	});

	it('is null for a missing entry', () => {
		expect(skillPopupFor(undefined, { id: 'ghost', level: 1 })).toBeNull();
	});
});

describe('combatArtPopupFor', () => {
	it('greys out the levels above the unit access level', () => {
		expect(combatArtPopupFor(FENCING, { id: 'fencing', level: 3 })).toEqual({
			title: 'Fencing III',
			sections: [
				{ level: 1, available: true, text: FENCING.levels?.[1] },
				{ level: 2, available: true, text: FENCING.levels?.[2] },
				{ level: 3, available: true, text: FENCING.levels?.[3] },
				{ level: 4, available: false, text: FENCING.levels?.[4] }
			]
		});
	});

	it('is null for a missing entry', () => {
		expect(combatArtPopupFor(undefined, { id: 'ghost', level: 1 })).toBeNull();
	});
});

describe('traitPopupFor', () => {
	it('fills the dynamic value into the title and every level section', () => {
		expect(
			traitPopupFor(RESISTANCE, { id: 'resistance--x', level: 1, dynamicValue: 'Spell' })
		).toEqual({
			title: 'Resistance (Spell) I',
			sections: [
				{
					level: 1,
					available: true,
					text: [
						{ text: 'Power of a Hit dealt to this model by an Attack with the ' },
						{ text: 'Spell' },
						{ text: ' Type or Trait is halved.' }
					]
				},
				{
					level: 2,
					available: false,
					text: [
						{
							text: 'Hits and related Effects dealt to this model by an Attack with the Spell Type or Trait are negated.'
						}
					]
				}
			]
		});
	});

	it('falls back to the dynamic elements as the value', () => {
		const affinity: ArmyRulesSpec = {
			id: 'affinity--element',
			name: 'Affinity (Element)',
			levels: { 1: [{ text: 'A model with this Trait can cast (Element) Spells.' }] }
		};
		expect(
			traitPopupFor(affinity, { id: 'affinity--element', level: 1, dynamicElements: ['Elder'] })
		).toEqual({
			title: 'Affinity (Elder) I',
			sections: [
				{
					level: 1,
					available: true,
					text: [{ text: 'A model with this Trait can cast Elder Spells.' }]
				}
			]
		});
	});

	it('keeps the template without any dynamic value', () => {
		expect(traitPopupFor(RESISTANCE, { id: 'resistance--x', level: 2 })).toEqual({
			title: 'Resistance (X) II',
			sections: [
				{ level: 1, available: true, text: RESISTANCE.levels?.[1] },
				{ level: 2, available: true, text: RESISTANCE.levels?.[2] }
			]
		});
	});

	it('is null for a missing entry', () => {
		expect(traitPopupFor(undefined, { id: 'ghost', level: 1 })).toBeNull();
	});
});

describe('rulesLinkPopup', () => {
	const INDEXES: ArmyRulesIndexes = {
		classes: { wizard: WIZARD },
		skills: { charm: CHARM },
		traits: {},
		combatArts: { fencing: FENCING },
		spellcrafts: {}
	};

	it('resolves class links to a single section and leveled links to all levels', () => {
		expect(rulesLinkPopup(INDEXES, { type: 'class', id: 'wizard' })).toEqual({
			title: 'WIZARD',
			sections: [{ available: true, text: WIZARD.description }]
		});
		expect(rulesLinkPopup(INDEXES, { type: 'combat-art', id: 'fencing' })).toEqual({
			title: 'Fencing',
			sections: [
				{ level: 1, available: true, text: FENCING.levels?.[1] },
				{ level: 2, available: true, text: FENCING.levels?.[2] },
				{ level: 3, available: true, text: FENCING.levels?.[3] },
				{ level: 4, available: true, text: FENCING.levels?.[4] }
			]
		});
	});

	it('is null for unknown targets', () => {
		expect(rulesLinkPopup(INDEXES, { type: 'trait', id: 'ghost' })).toBeNull();
		expect(rulesLinkPopup(INDEXES, { type: 'spellcraft', id: 'armamancy' })).toBeNull();
	});
});

const ART_OF_SORCERY: ArmyRulesSpec = { id: 'art-of-sorcery', name: 'Art of Sorcery' };

const SPELLS: ArmySpellSpec[] = [
	{
		id: 'flare',
		name: 'Flare',
		group: 'art-of-sorcery',
		element: 'fire',
		level: 2,
		effect: [{ text: 'The target suffers a burning Hit.' }],
		pw: { stat: 'INT', modifier: -3 },
		type: 'Spell, Sorcery | Ranged',
		rch: '16',
		stk: { stat: 'STA' }
	},
	{
		id: 'ignite',
		name: 'Ignite',
		group: 'art-of-sorcery',
		element: 'fire',
		level: 1,
		effect: [{ text: 'The target catches fire.' }],
		pw: { fixed: '8' },
		type: 'Spell, Sorcery | Ranged',
		rch: '10',
		stk: { fixed: '1' }
	},
	{
		id: 'arcane-bolt',
		name: 'Arcane Bolt',
		group: 'art-of-sorcery',
		element: 'elder',
		level: 1,
		effect: [
			{ text: 'Critical: ' },
			{ text: 'Knockdown', link: { type: 'trait', id: 'knockdown' } }
		]
	},
	{
		id: 'magic-missile',
		name: 'Magic Missile',
		group: 'wizardry',
		element: 'elder',
		level: 1,
		effect: [{ text: 'A bolt of force.' }]
	}
];

const FLAMESHAPER: ArmyUnitSpec = {
	id: 'flameshaper',
	name: 'Flameshaper',
	points: 20,
	limit: 1,
	stats: { ...STATS, STA: 2, INT: 12 },
	classes: ['sorcerer'],
	traits: [
		{ id: 'affinity--element', level: 1, dynamicElements: ['Fire'] },
		{ id: 'demon', level: 1 }
	]
};

describe('affinityElements', () => {
	it('collects the elements of the affinity trait refs, lowercased', () => {
		expect(affinityElements(FLAMESHAPER)).toEqual(['fire']);
	});

	it('merges several affinity refs and dynamic values, skipping any', () => {
		const unit: ArmyUnitSpec = {
			...FLAMESHAPER,
			traits: [
				{ id: 'affinity--element', level: 1, dynamicElements: ['Elder', 'Fire'] },
				{ id: 'affinity--element', level: 1, dynamicValue: 'Divine' },
				{ id: 'affinity--element', level: 1, dynamicValue: 'Any' }
			]
		};
		expect(affinityElements(unit).sort()).toEqual(['divine', 'elder', 'fire']);
	});

	it('is empty without affinity traits', () => {
		expect(affinityElements({ ...FLAMESHAPER, traits: [] })).toEqual([]);
	});
});

describe('spellCostDisplay', () => {
	it('returns fixed values as they are', () => {
		expect(spellCostDisplay({ fixed: '8' }, STATS)).toBe('8');
		expect(spellCostDisplay({ fixed: '-' }, STATS)).toBe('-');
	});

	it('resolves a stat against the unit with its value in brackets', () => {
		expect(spellCostDisplay({ stat: 'STA' }, { ...STATS, STA: 2 })).toBe('STA (2)');
		expect(spellCostDisplay({ stat: 'INT' }, { ...STATS, INT: 12 })).toBe('INT (12)');
	});

	it('adds the modifier behind the resolved stat', () => {
		expect(spellCostDisplay({ stat: 'INT', modifier: -3 }, { ...STATS, INT: 12 })).toBe(
			'INT (12) -3'
		);
		expect(spellCostDisplay({ stat: 'INT', modifier: 2 }, { ...STATS, INT: 12 })).toBe(
			'INT (12) +2'
		);
	});

	it('resolves the item toughness column T like any statline key', () => {
		expect(spellCostDisplay({ stat: 'T' }, STATS)).toBe('T (8)');
		expect(spellCostDisplay({ stat: 'T', modifier: 2 }, STATS)).toBe('T (8) +2');
		expect(spellCostDisplay({ fixed: 'QTY' }, STATS)).toBe('QTY');
	});

	it('shows the bare stat when the unit has no value for it', () => {
		expect(spellCostDisplay({ stat: 'M' }, { ...STATS, M: null })).toBe('M');
	});

	it('is undefined without a cost', () => {
		expect(spellCostDisplay(undefined, STATS)).toBeUndefined();
	});
});

describe('rangeBracketDisplay', () => {
	it('shows a range bracket with its modifier', () => {
		expect(rangeBracketDisplay({ range: '0-20"', modifier: 0 })).toBe('0-20": 0');
		expect(rangeBracketDisplay({ range: '25-48"', modifier: -6 })).toBe('25-48": -6');
		expect(rangeBracketDisplay({ range: '0-24"', modifier: 3 })).toBe('0-24": +3');
	});

	it('shows a plain reach without a modifier', () => {
		expect(rangeBracketDisplay({ range: '0', modifier: 0 })).toBe('0');
		expect(rangeBracketDisplay({ range: '2', modifier: 0 })).toBe('2');
	});
});

describe('reachBoxLines', () => {
	it('lists the brackets, the AoE template and raw text in order', () => {
		expect(
			reachBoxLines({
				brackets: [
					{ range: '0-20"', modifier: 0 },
					{ range: '21-40"', modifier: -6 }
				]
			})
		).toEqual(['0-20": 0', '21-40": -6']);
		expect(reachBoxLines({ brackets: [], aoe: 'Spray L' })).toEqual(['AoE: Spray L']);
		expect(reachBoxLines({ brackets: [], text: 'T' })).toEqual(['T']);
		expect(reachBoxLines({ brackets: [], aoe: 'Circular S', text: 'T' })).toEqual([
			'AoE: Circular S',
			'T'
		]);
	});

	it('is a dash without reach', () => {
		expect(reachBoxLines(undefined)).toEqual(['–']);
		expect(reachBoxLines({ brackets: [] })).toEqual(['–']);
	});
});

describe('itemTypeDisplay', () => {
	it('combines mode and category, keeping "and" lowercase', () => {
		expect(itemTypeDisplay('weapon', 'natural-and-melee')).toBe('Natural and Melee, Weapon');
		expect(itemTypeDisplay('weapon', 'melee-and-ranged')).toBe('Melee and Ranged, Weapon');
		expect(itemTypeDisplay('weapon', 'ranged')).toBe('Ranged, Weapon');
	});

	it('falls back to the category alone without a mode', () => {
		expect(itemTypeDisplay('accessory')).toBe('Accessory');
		expect(itemTypeDisplay('consumable')).toBe('Consumable');
	});
});

describe('inventorySpaceUsed', () => {
	const ITEMS: Record<string, ArmyItemSpec> = {
		sword: { id: 'sword', name: 'Sword', category: 'weapon', effect: [], weight: 1 },
		'great-shield': {
			id: 'great-shield',
			name: 'Great Shield',
			category: 'shield',
			effect: [],
			weight: 3
		},
		amulet: { id: 'amulet', name: 'Amulet', category: 'accessory', effect: [] }
	};

	it('sums each copy of an item with its weight', () => {
		expect(
			inventorySpaceUsed(
				[
					{ id: 'sword', qty: 1 },
					{ id: 'great-shield', qty: 2 }
				],
				ITEMS
			)
		).toBe(7);
	});

	it('counts weightless items and unknown ids as zero', () => {
		expect(inventorySpaceUsed([{ id: 'amulet', qty: 3 }], ITEMS)).toBe(0);
		expect(inventorySpaceUsed([{ id: 'ghost', qty: 1 }], ITEMS)).toBe(0);
	});

	it('is zero for an empty inventory', () => {
		expect(inventorySpaceUsed([], ITEMS)).toBe(0);
	});
});

describe('spellcraftPopupFor', () => {
	it('lists the spells of the group up to the spellcraft level in the affinity elements', () => {
		const popup = spellcraftPopupFor(
			ART_OF_SORCERY,
			{ id: 'art-of-sorcery', level: 2 },
			FLAMESHAPER,
			FLAMESHAPER.stats,
			SPELLS
		);
		expect(popup?.title).toBe('Art of Sorcery II');
		expect(popup?.sections).toEqual([]);
		expect(popup?.spells?.map((row) => row.name)).toEqual(['Ignite', 'Flare']);
	});

	it('hides spells above the spellcraft level and outside the affinity', () => {
		const popup = spellcraftPopupFor(
			ART_OF_SORCERY,
			{ id: 'art-of-sorcery', level: 1 },
			FLAMESHAPER,
			FLAMESHAPER.stats,
			SPELLS
		);
		expect(popup?.spells?.map((row) => row.name)).toEqual(['Ignite']);
	});

	it('sorts Elder before the other elements, then level, then name', () => {
		const elderMage: ArmyUnitSpec = {
			...FLAMESHAPER,
			traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Elder', 'Fire'] }]
		};
		const popup = spellcraftPopupFor(
			ART_OF_SORCERY,
			{ id: 'art-of-sorcery', level: 2 },
			elderMage,
			FLAMESHAPER.stats,
			SPELLS
		);
		expect(popup?.spells?.map((row) => row.name)).toEqual(['Arcane Bolt', 'Ignite', 'Flare']);
		expect(popup?.spells?.map((row) => row.elementName)).toEqual(['Elder', 'Fire', 'Fire']);
	});

	it('resolves pw and stk against the unit stats in the rows', () => {
		const popup = spellcraftPopupFor(
			ART_OF_SORCERY,
			{ id: 'art-of-sorcery', level: 2 },
			FLAMESHAPER,
			FLAMESHAPER.stats,
			SPELLS
		);
		const flare = popup?.spells?.find((row) => row.name === 'Flare');
		expect(flare).toMatchObject({
			pw: 'INT (12) -3',
			stk: 'STA (2)',
			type: 'Spell, Sorcery | Ranged',
			rch: '16'
		});
	});

	it('is null for a missing entry', () => {
		expect(
			spellcraftPopupFor(undefined, { id: 'ghost', level: 1 }, FLAMESHAPER, STATS, SPELLS)
		).toBeNull();
	});
});

const STRATAGEM_INDEX: Record<string, ArmyStratagemSpec> = {
	'rally-troops-helian': {
		id: 'rally-troops-helian',
		name: 'Rally Troops (Helian)',
		type: 'authority',
		effect: [{ text: 'A model shakes off Fatigue.' }]
	},
	backstab: {
		id: 'backstab',
		name: 'Backstab',
		type: 'subterfuge',
		effect: [{ text: 'The target suffers a Hit.' }]
	},
	aetherkin: {
		id: 'aetherkin',
		name: 'Aetherkin',
		type: 'tribe',
		effect: [{ text: 'Models have Resistance I (Spell).' }]
	},
	'active-support': {
		id: 'active-support',
		name: 'Active Support',
		type: 'authority',
		effect: [{ text: 'Up to two models may become enchanted.' }]
	}
};

describe('stratagemsFor', () => {
	it('resolves the ids and sorts by type order, then name', () => {
		const stratagems = stratagemsFor(
			['aetherkin', 'backstab', 'rally-troops-helian', 'active-support'],
			STRATAGEM_INDEX
		);
		expect(stratagems.map((entry) => entry.name)).toEqual([
			'Active Support',
			'Rally Troops (Helian)',
			'Backstab',
			'Aetherkin'
		]);
	});

	it('skips ids missing from the index', () => {
		const stratagems = stratagemsFor(['ghost', 'backstab'], STRATAGEM_INDEX);
		expect(stratagems.map((entry) => entry.id)).toEqual(['backstab']);
	});

	it('is empty for empty ids or when nothing resolves', () => {
		expect(stratagemsFor([], STRATAGEM_INDEX)).toEqual([]);
		expect(stratagemsFor(['ghost'], STRATAGEM_INDEX)).toEqual([]);
	});
});

describe('toggleArmyMount', () => {
	it('flips the mount state of a single copy only', () => {
		const entries: ArmyEntry[] = [
			{ id: 'd1', unitId: 'dragoon' },
			{ id: 'd2', unitId: 'dragoon' }
		];
		const toggled = toggleArmyMount(entries, 'd1', UNITS);
		expect(toggled).toEqual([
			{ id: 'd1', unitId: 'dragoon', mounted: true },
			{ id: 'd2', unitId: 'dragoon' }
		]);
		expect(toggleArmyMount(toggled, 'd1', UNITS)).toEqual([
			{ id: 'd1', unitId: 'dragoon', mounted: false },
			{ id: 'd2', unitId: 'dragoon' }
		]);
	});

	it('ignores copies of units without a mount option', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(toggleArmyMount(entries, 'w1', UNITS)).toBe(entries);
	});

	it('ignores unknown entries', () => {
		const entries: ArmyEntry[] = [{ id: 'd1', unitId: 'dragoon' }];
		expect(toggleArmyMount(entries, 'ghost', UNITS)).toBe(entries);
	});
});

describe('effectiveMountedStats', () => {
	it('overrides rider stats with non-null mount stats', () => {
		expect(effectiveMountedStats(DRAGOON, MOUNTS[0]).SPD).toBe(9);
		expect(effectiveMountedStats(DRAGOON, MOUNTS[0]).STA).toBe(1);
	});

	it('adds statChanges on top of the rider stats', () => {
		const stats = effectiveMountedStats(DRAGOON, MOUNTS[0]);
		expect(stats.DEF).toBe(7);
		expect(stats.T).toBe(10);
		expect(stats.ARM).toBe(7);
		expect(stats.HP).toBe(11);
	});
});

const UPGRADES: ArmyUpgradeSpec[] = [
	{
		id: 'gift-of-longevity-helian-league',
		name: 'Gift of Longevity',
		cost: 1,
		limit: 2,
		factionId: 'helian-league',
		description: [],
		effects: [{ kind: 'stat', changes: { INT: 1 } }]
	},
	{
		id: 'seasoned-combatant-helian-league',
		name: 'Seasoned Combatant',
		cost: 2,
		factionId: 'helian-league',
		description: [],
		effects: [{ kind: 'trait', traitId: 'fearless', level: 1 }]
	},
	{
		id: 'seasoned-combatant-empire-of-soga',
		name: 'Seasoned Combatant',
		cost: 2,
		factionId: 'empire-of-soga',
		description: [],
		effects: [{ kind: 'trait', traitId: 'fearless', level: 1 }]
	},
	{
		id: 'pouch',
		name: 'Pouch',
		cost: 1,
		description: [],
		effects: [{ kind: 'pouch' }]
	},
	{
		id: 'imported-crossbow',
		name: 'Imported Crossbow',
		cost: 5,
		limit: 1,
		description: [],
		effects: [{ kind: 'item', itemId: 'crossbow' }]
	},
	{
		id: 'kassen-buki-yari-tsukai-empire-of-soga',
		name: 'Kassen Buki: Yari-tsukai',
		cost: 2,
		factionId: 'empire-of-soga',
		description: [],
		requirement: { classes: ['warrior'] },
		effects: [{ kind: 'replacePrimaryWeapon', itemId: 'lance' }]
	},
	{
		id: 'journeyman-adventurer',
		name: 'Journeyman Adventurer',
		cost: 3,
		description: [],
		effects: [{ kind: 'trait', traitId: 'resourceful', level: 2 }]
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

const UPGRADE_INDEX = indexArmyRules(UPGRADES);

const UPGRADE_ITEMS: Record<string, ArmyItemSpec> = {
	sword: { id: 'sword', name: 'Sword', category: 'weapon', effect: [], weight: 1 },
	lance: { id: 'lance', name: 'Lance', category: 'weapon', effect: [], weight: 2 },
	crossbow: { id: 'crossbow', name: 'Crossbow', category: 'weapon', effect: [], weight: 2 },
	amulet: { id: 'amulet', name: 'Amulet', category: 'accessory', effect: [] }
};

describe('upgradesForFaction', () => {
	it('gives a main faction the neutral pool plus its own exclusives', () => {
		expect(upgradesForFaction('helian-league', UPGRADES).map((upgrade) => upgrade.id)).toEqual([
			'gift-of-longevity-helian-league',
			'seasoned-combatant-helian-league',
			'pouch',
			'imported-crossbow',
			'journeyman-adventurer',
			'adept-shaper-helian-league'
		]);
	});

	it('gives monster factions and the guild the neutral pool only', () => {
		expect(upgradesForFaction('oni-clans', UPGRADES).map((upgrade) => upgrade.id)).toEqual([
			'pouch',
			'imported-crossbow',
			'journeyman-adventurer'
		]);
		expect(upgradesForFaction('adventurers-guild', UPGRADES)).toEqual(
			upgradesForFaction('oni-clans', UPGRADES)
		);
	});
});

describe('upgradedArmyUnit', () => {
	it('is the unit itself without upgrades', () => {
		expect(upgradedArmyUnit(UNITS[0], [], UPGRADE_ITEMS)).toBe(UNITS[0]);
	});

	it('applies stat boosts, trait grants and item grants', () => {
		const upgraded = upgradedArmyUnit(UNITS[0], [UPGRADES[0], UPGRADES[4]], UPGRADE_ITEMS);
		expect(upgraded.stats.INT).toBe(7);
		expect(upgraded.inventory).toEqual([{ id: 'crossbow', qty: 1 }]);
	});

	it('replaces the primary weapon - the first weapon in the inventory', () => {
		const unit: ArmyUnitSpec = {
			...UNITS[0],
			inventory: [
				{ id: 'amulet', qty: 1 },
				{ id: 'sword', qty: 1 }
			]
		};
		const upgraded = upgradedArmyUnit(unit, [UPGRADES[5]], UPGRADE_ITEMS);
		expect(upgraded.inventory).toEqual([
			{ id: 'amulet', qty: 1 },
			{ id: 'lance', qty: 1 }
		]);
	});

	it('adds the replacement weapon when the unit carries none', () => {
		const upgraded = upgradedArmyUnit(UNITS[0], [UPGRADES[5]], UPGRADE_ITEMS);
		expect(upgraded.inventory).toEqual([{ id: 'lance', qty: 1 }]);
	});

	it('grants pouch space and bumps an existing trait one level', () => {
		const unit: ArmyUnitSpec = {
			...UNITS[0],
			inventorySpace: 3,
			traits: [{ id: 'fearless', level: 1 }]
		};
		const upgraded = upgradedArmyUnit(unit, [UPGRADES[3], UPGRADES[1]], UPGRADE_ITEMS);
		expect(upgraded.inventorySpace).toBe(5);
		expect(upgraded.traits).toEqual([{ id: 'fearless', level: 2 }]);
	});

	it('replaces the stat change when the insteadIfTrait condition holds', () => {
		const devotion: ArmyUpgradeSpec = {
			id: 'devotion-anras',
			name: 'Devotion: Anras',
			cost: 3,
			description: [],
			effects: [
				{
					kind: 'stat',
					changes: { DEF: 1 },
					insteadIfTrait: { traitId: 'duelist', changes: { DEF: 2 } }
				}
			]
		};
		expect(upgradedArmyUnit(UNITS[0], [devotion], UPGRADE_ITEMS).stats.DEF).toBe(5);
		const duelist: ArmyUnitSpec = { ...UNITS[0], traits: [{ id: 'duelist', level: 1 }] };
		expect(upgradedArmyUnit(duelist, [devotion], UPGRADE_ITEMS).stats.DEF).toBe(6);
	});

	it('adds the extra stat change when the extraIfClasses condition holds', () => {
		const devotion: ArmyUpgradeSpec = {
			id: 'devotion-tiamat',
			name: 'Devotion: Tiamat',
			cost: 3,
			description: [],
			effects: [
				{
					kind: 'stat',
					changes: { T: 1 },
					extraIfClasses: { classIds: ['warrior', 'rogue'], changes: { OFF: 1 } }
				}
			]
		};
		const warrior = upgradedArmyUnit(UNITS[0], [devotion], UPGRADE_ITEMS);
		expect(warrior.stats.T).toBe(9);
		expect(warrior.stats.OFF).toBe(4);
		const mage = upgradedArmyUnit(UNITS[1], [devotion], UPGRADE_ITEMS);
		expect(mage.stats.T).toBe(9);
		expect(mage.stats.OFF).toBe(3);
	});
});

describe('upgradeSlotsFor', () => {
	it('is one base slot', () => {
		expect(upgradeSlotsFor(UNITS[0], [])).toBe(1);
	});

	it('adds one slot per resourceful level of the upgraded unit', () => {
		const unit: ArmyUnitSpec = { ...UNITS[0], traits: [{ id: 'resourceful', level: 2 }] };
		expect(upgradeSlotsFor(unit, [])).toBe(3);
	});

	it('adds one slot per picked pouch', () => {
		expect(upgradeSlotsFor(UNITS[0], [UPGRADES[3], UPGRADES[3]])).toBe(3);
	});

	it('is zero for units that can never receive upgrades', () => {
		expect(upgradeSlotsFor({ ...UNITS[0], upgradesLocked: true }, [])).toBe(0);
	});
});

const BLOCK_RULES: ArmyRulesIndexes = {
	classes: {},
	skills: {},
	traits: { fearless: { id: 'fearless', name: 'Fearless', levels: { 1: [] } } },
	combatArts: {},
	spellcrafts: {
		'art-of-sorcery': { id: 'art-of-sorcery', name: 'Art of Sorcery', levels: { 1: [], 2: [] } }
	}
};

describe('entryUpgradeBlock', () => {
	it('is null when the upgrade can be picked', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(
			entryUpgradeBlock(entries, 'w1', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)
		).toBeNull();
	});

	it('blocks an upgrade the entry already owns', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[0].id] }];
		expect(entryUpgradeBlock(entries, 'w1', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'owned'
		);
	});

	it('blocks every upgrade for units that can never receive them', () => {
		const units: ArmyUnitSpec[] = [{ ...UNITS[0], upgradesLocked: true }];
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(entryUpgradeBlock(entries, 'w1', UPGRADES[3], units, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'locked'
		);
	});

	it('blocks once every slot is used', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[4].id] }];
		expect(entryUpgradeBlock(entries, 'w1', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'slots'
		);
	});

	it('counts a resourceful grant from a picked upgrade as extra slots', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[6].id, UPGRADES[3].id] }
		];
		expect(
			entryUpgradeBlock(entries, 'w1', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)
		).toBeNull();
	});

	it('blocks when the per-army limit is reached across entries', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: ['gift-of-longevity-helian-league'] },
			{ id: 'w2', unitId: 'warrior', upgrades: ['gift-of-longevity-helian-league'] },
			{ id: 'w3', unitId: 'warrior' }
		];
		expect(entryUpgradeBlock(entries, 'w3', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'limit'
		);
	});

	it('blocks units missing the class requirement', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(entryUpgradeBlock(entries, 'm1', UPGRADES[5], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'requirement'
		);
		expect(
			entryUpgradeBlock(
				[{ id: 'w1', unitId: 'warrior' }],
				'w1',
				UPGRADES[5],
				UNITS,
				UPGRADE_INDEX,
				BLOCK_RULES
			)
		).toBeNull();
	});

	it('blocks units carrying a forbidden trait', () => {
		const forbidden: ArmyUpgradeSpec = {
			id: 'devotion-anras',
			name: 'Devotion: Anras',
			cost: 3,
			description: [],
			requirement: { notTraits: ['demon'] },
			effects: [{ kind: 'stat', changes: { DEF: 1 } }]
		};
		const index = indexArmyRules([forbidden]);
		const demon: ArmyUnitSpec[] = [{ ...UNITS[0], traits: [{ id: 'demon', level: 1 }] }];
		expect(
			entryUpgradeBlock(
				[{ id: 'w1', unitId: 'warrior' }],
				'w1',
				forbidden,
				demon,
				index,
				BLOCK_RULES
			)
		).toBe('requirement');
		expect(
			entryUpgradeBlock(
				[{ id: 'w1', unitId: 'warrior' }],
				'w1',
				forbidden,
				UNITS,
				index,
				BLOCK_RULES
			)
		).toBeNull();
	});

	it('blocks level-ups when the unit already sits at the maximum level', () => {
		const maxed: ArmyEntry[] = [
			{
				id: 'w1',
				unitId: 'warrior',
				upgrades: []
			}
		];
		const units: ArmyUnitSpec[] = [
			{ ...UNITS[0], traits: [{ id: 'fearless', level: 1 }] },
			{
				...UNITS[1],
				traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Fire'] }],
				spellcrafts: [{ id: 'art-of-sorcery', level: 2 }]
			}
		];
		expect(entryUpgradeBlock(maxed, 'w1', UPGRADES[1], units, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'max-level'
		);
		// Art of Sorcery caps at level 2 in SPELLS (the highest fire spell).
		const casterEntries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(
			entryUpgradeBlock(casterEntries, 'm1', UPGRADES[7], units, UPGRADE_INDEX, BLOCK_RULES, SPELLS)
		).toBe('max-level');
	});

	it('allows a spellcraft level-up while a group level above the unit exists', () => {
		const units: ArmyUnitSpec[] = [
			{
				...UNITS[1],
				traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Fire'] }],
				spellcrafts: [{ id: 'art-of-sorcery', level: 1 }]
			}
		];
		expect(
			entryUpgradeBlock(
				[{ id: 'm1', unitId: 'mage' }],
				'm1',
				UPGRADES[7],
				units,
				UPGRADE_INDEX,
				BLOCK_RULES,
				SPELLS
			)
		).toBeNull();
	});

	it('blocks a spellcraft level-up when no affinity grants access to the group', () => {
		const units: ArmyUnitSpec[] = [
			{ ...UNITS[1], spellcrafts: [{ id: 'art-of-sorcery', level: 1 }] }
		];
		expect(
			entryUpgradeBlock(
				[{ id: 'm1', unitId: 'mage' }],
				'm1',
				UPGRADES[7],
				units,
				UPGRADE_INDEX,
				BLOCK_RULES,
				SPELLS
			)
		).toBe('max-level');
	});

	it('blocks a spellcraft level-up for units without spellcrafts', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(entryUpgradeBlock(entries, 'w1', UPGRADES[7], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			'max-level'
		);
	});
});

describe('spellcraftLevelCap', () => {
	it('is the highest spell level of the group in the affinity elements', () => {
		expect(spellcraftLevelCap('art-of-sorcery', FLAMESHAPER, SPELLS)).toBe(2);
	});

	it('ignores spells of other elements and groups', () => {
		const unit: ArmyUnitSpec = {
			...FLAMESHAPER,
			traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Elder'] }]
		};
		expect(spellcraftLevelCap('art-of-sorcery', unit, SPELLS)).toBe(1);
		expect(spellcraftLevelCap('wizardry', FLAMESHAPER, SPELLS)).toBe(0);
	});
});

describe('spellcraft level-up choices', () => {
	const ADEPT = UPGRADES[7];
	const CASTER_INDEX = UPGRADE_INDEX;
	const twoSchoolSpells: ArmySpellSpec[] = [
		...SPELLS,
		{
			id: 'force-lance',
			name: 'Force Lance',
			group: 'wizardry',
			element: 'elder',
			level: 2,
			effect: [{ text: 'A stronger bolt.' }]
		}
	];
	const casterUnit: ArmyUnitSpec = {
		...UNITS[1],
		traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Fire', 'Elder'] }],
		spellcrafts: [
			{ id: 'art-of-sorcery', level: 1 },
			{ id: 'wizardry', level: 1 }
		]
	};

	it('picks the only upgradable spellcraft automatically', () => {
		const units: ArmyUnitSpec[] = [
			{
				...UNITS[1],
				traits: [{ id: 'affinity--element', level: 1, dynamicElements: ['Fire'] }],
				spellcrafts: [{ id: 'art-of-sorcery', level: 1 }]
			}
		];
		expect(
			addEntryUpgrade(
				[{ id: 'm1', unitId: 'mage' }],
				'm1',
				ADEPT,
				units,
				CASTER_INDEX,
				BLOCK_RULES,
				SPELLS
			)
		).toEqual([
			{
				id: 'm1',
				unitId: 'mage',
				upgrades: [ADEPT.id],
				spellcraftChoices: { [ADEPT.id]: 'art-of-sorcery' }
			}
		]);
	});

	it('requires a valid choice when several spellcrafts can advance', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		const units: ArmyUnitSpec[] = [casterUnit];
		expect(
			addEntryUpgrade(entries, 'm1', ADEPT, units, CASTER_INDEX, BLOCK_RULES, twoSchoolSpells)
		).toBe(entries);
		expect(
			addEntryUpgrade(
				entries,
				'm1',
				ADEPT,
				units,
				CASTER_INDEX,
				BLOCK_RULES,
				twoSchoolSpells,
				{},
				{
					spellcraftId: 'ghost'
				}
			)
		).toBe(entries);
		expect(
			addEntryUpgrade(
				entries,
				'm1',
				ADEPT,
				units,
				CASTER_INDEX,
				BLOCK_RULES,
				twoSchoolSpells,
				{},
				{
					spellcraftId: 'wizardry'
				}
			)
		).toEqual([
			{
				id: 'm1',
				unitId: 'mage',
				upgrades: [ADEPT.id],
				spellcraftChoices: { [ADEPT.id]: 'wizardry' }
			}
		]);
	});

	it('raises the chosen spellcraft one level on the upgraded unit', () => {
		const upgraded = upgradedArmyUnit(casterUnit, [ADEPT], UPGRADE_ITEMS, {
			[ADEPT.id]: 'wizardry'
		});
		expect(upgraded.spellcrafts).toEqual([
			{ id: 'art-of-sorcery', level: 1 },
			{ id: 'wizardry', level: 2 }
		]);
	});

	it('drops the choice when the upgrade is removed', () => {
		const entries: ArmyEntry[] = [
			{
				id: 'm1',
				unitId: 'mage',
				upgrades: [ADEPT.id],
				spellcraftChoices: { [ADEPT.id]: 'wizardry' }
			}
		];
		expect(removeEntryUpgrade(entries, 'm1', ADEPT.id)).toEqual([
			{ id: 'm1', unitId: 'mage', upgrades: [] }
		]);
	});

	it('shows the raised level in the roster row', () => {
		const entries: ArmyEntry[] = [
			{
				id: 'm1',
				unitId: 'mage',
				upgrades: [ADEPT.id],
				spellcraftChoices: { [ADEPT.id]: 'wizardry' }
			}
		];
		const rows = resolveArmyEntries(entries, [casterUnit], MOUNTS, CASTER_INDEX, UPGRADE_ITEMS);
		expect(rows[0].upgradedUnit.spellcrafts).toEqual([
			{ id: 'art-of-sorcery', level: 1 },
			{ id: 'wizardry', level: 2 }
		]);
	});
});

const GLYPH: ArmyUpgradeSpec = {
	id: 'glyphscribe-reduce-weight-helian-league',
	name: 'Glyphscribe: Reduce Weight',
	cost: 2,
	factionId: 'helian-league',
	description: [],
	effects: [
		{
			kind: 'choice',
			options: [
				{
					id: 'inscribed-item',
					label: 'Inscribed Item',
					inscribeItem: { except: ['casting-amplifier'] }
				},
				{
					id: 'inscribed-armor',
					label: 'Inscribed Armor',
					statChanges: { AG: 1, SPD: 1 },
					inventorySpace: 1
				}
			]
		}
	]
};
const GLYPH_INDEX = indexArmyRules([GLYPH]);
const GLYPH_ITEMS: Record<string, ArmyItemSpec> = {
	sword: {
		id: 'sword',
		name: 'Sword',
		category: 'weapon',
		effect: [],
		weight: 1,
		stk: { stat: 'STA' }
	},
	'great-shield': {
		id: 'great-shield',
		name: 'Great Shield',
		category: 'shield',
		effect: [],
		weight: 3,
		stk: { fixed: '1' }
	},
	'casting-amplifier': {
		id: 'casting-amplifier',
		name: 'Casting Amplifier',
		category: 'accessory',
		mode: 'melee',
		effect: [],
		weight: 0
	},
	'haze-bomb': {
		id: 'haze-bomb',
		name: 'Haze Bomb',
		category: 'consumable',
		effect: [],
		weight: 1
	}
};
const GLYPH_UNIT: ArmyUnitSpec = {
	...UNITS[0],
	inventorySpace: 3,
	inventory: [
		{ id: 'sword', qty: 1 },
		{ id: 'casting-amplifier', qty: 1 },
		{ id: 'haze-bomb', qty: 1 }
	]
};

describe('choice upgrades (Glyphscribe: Reduce Weight)', () => {
	it('inscribes an item: Strike +1 and weight -1', () => {
		expect(inscribedItem(GLYPH_ITEMS.sword)).toEqual({
			...GLYPH_ITEMS.sword,
			weight: 0,
			stk: { stat: 'STA', modifier: 1 }
		});
		expect(inscribedItem(GLYPH_ITEMS['great-shield'])).toEqual({
			...GLYPH_ITEMS['great-shield'],
			weight: 2,
			stk: { fixed: '2' }
		});
	});

	it('never reduces the weight below zero', () => {
		const light: ArmyItemSpec = { ...GLYPH_ITEMS.sword, weight: 0 };
		expect(inscribedItem(light).weight).toBe(0);
	});

	it('only accepts weapons and shields with weight, excluding the listed items', () => {
		expect(isInscribableItem(GLYPH_ITEMS.sword, ['casting-amplifier'])).toBe(true);
		expect(isInscribableItem(GLYPH_ITEMS['haze-bomb'], ['casting-amplifier'])).toBe(false);
		expect(isInscribableItem(GLYPH_ITEMS['casting-amplifier'], ['casting-amplifier'])).toBe(false);
		expect(isInscribableItem(undefined, ['casting-amplifier'])).toBe(false);
		expect(
			inscribableItems(GLYPH_UNIT, GLYPH_ITEMS, ['casting-amplifier']).map((item) => item.id)
		).toEqual(['sword']);
	});

	it('marks the inscribe option unusable without an inscribable item', () => {
		const inscribe = GLYPH.effects[0];
		if (inscribe.kind !== 'choice') throw new Error('expected a choice effect');
		expect(upgradeOptionUsable(inscribe.options[0], GLYPH_UNIT, GLYPH_ITEMS)).toBe(true);
		expect(upgradeOptionUsable(inscribe.options[1], GLYPH_UNIT, GLYPH_ITEMS)).toBe(true);
		const bare: ArmyUnitSpec = { ...UNITS[0], inventory: [{ id: 'haze-bomb', qty: 1 }] };
		expect(upgradeOptionUsable(inscribe.options[0], bare, GLYPH_ITEMS)).toBe(false);
	});

	it('requires an option and validates the inscribed item when adding', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		const units: ArmyUnitSpec[] = [GLYPH_UNIT];
		expect(addEntryUpgrade(entries, 'w1', GLYPH, units, GLYPH_INDEX, BLOCK_RULES)).toBe(entries);
		expect(
			addEntryUpgrade(entries, 'w1', GLYPH, units, GLYPH_INDEX, BLOCK_RULES, [], GLYPH_ITEMS, {
				optionId: 'inscribed-item'
			})
		).toBe(entries);
		expect(
			addEntryUpgrade(entries, 'w1', GLYPH, units, GLYPH_INDEX, BLOCK_RULES, [], GLYPH_ITEMS, {
				optionId: 'inscribed-item',
				itemId: 'casting-amplifier'
			})
		).toBe(entries);
		expect(
			addEntryUpgrade(entries, 'w1', GLYPH, units, GLYPH_INDEX, BLOCK_RULES, [], GLYPH_ITEMS, {
				optionId: 'inscribed-item',
				itemId: 'sword'
			})
		).toEqual([
			{
				id: 'w1',
				unitId: 'warrior',
				upgrades: [GLYPH.id],
				upgradeChoices: { [GLYPH.id]: { option: 'inscribed-item', itemId: 'sword' } }
			}
		]);
		expect(
			addEntryUpgrade(entries, 'w1', GLYPH, units, GLYPH_INDEX, BLOCK_RULES, [], GLYPH_ITEMS, {
				optionId: 'inscribed-armor'
			})
		).toEqual([
			{
				id: 'w1',
				unitId: 'warrior',
				upgrades: [GLYPH.id],
				upgradeChoices: { [GLYPH.id]: { option: 'inscribed-armor' } }
			}
		]);
	});

	it('applies the armor option stats and space, and the inscribed item as an override', () => {
		const armorUnit = upgradedArmyUnit(
			GLYPH_UNIT,
			[GLYPH],
			GLYPH_ITEMS,
			{},
			{ [GLYPH.id]: { option: 'inscribed-armor' } }
		);
		expect(armorUnit.stats.AG).toBe((GLYPH_UNIT.stats.AG ?? 0) + 1);
		expect(armorUnit.stats.SPD).toBe((GLYPH_UNIT.stats.SPD ?? 0) + 1);
		expect(armorUnit.inventorySpace).toBe(4);
		const itemUnit = upgradedArmyUnit(
			GLYPH_UNIT,
			[GLYPH],
			GLYPH_ITEMS,
			{},
			{ [GLYPH.id]: { option: 'inscribed-item', itemId: 'sword' } }
		);
		expect(itemUnit.stats).toEqual(GLYPH_UNIT.stats);
		const overrides = upgradeItemOverrides(
			[GLYPH],
			{ [GLYPH.id]: { option: 'inscribed-item', itemId: 'sword' } },
			GLYPH_ITEMS
		);
		expect(overrides.sword).toEqual({
			...GLYPH_ITEMS.sword,
			weight: 0,
			stk: { stat: 'STA', modifier: 1 }
		});
	});

	it('carries the item overrides into the roster row and drops the choice on removal', () => {
		const entries: ArmyEntry[] = [
			{
				id: 'w1',
				unitId: 'warrior',
				upgrades: [GLYPH.id],
				upgradeChoices: { [GLYPH.id]: { option: 'inscribed-item', itemId: 'sword' } }
			}
		];
		const rows = resolveArmyEntries(entries, [GLYPH_UNIT], MOUNTS, GLYPH_INDEX, GLYPH_ITEMS);
		expect(rows[0].itemOverrides.sword.weight).toBe(0);
		expect(rows[0].itemOverrides.sword.stk).toEqual({ stat: 'STA', modifier: 1 });
		expect(removeEntryUpgrade(entries, 'w1', GLYPH.id)).toEqual([
			{ id: 'w1', unitId: 'warrior', upgrades: [] }
		]);
	});
});

describe('addEntryUpgrade/removeEntryUpgrade', () => {
	it('adds the upgrade id to the entry when allowed', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior' }];
		expect(addEntryUpgrade(entries, 'w1', UPGRADES[0], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toEqual([
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[0].id] }
		]);
	});

	it('refuses blocked upgrades without touching the entries', () => {
		const entries: ArmyEntry[] = [{ id: 'm1', unitId: 'mage' }];
		expect(addEntryUpgrade(entries, 'm1', UPGRADES[5], UNITS, UPGRADE_INDEX, BLOCK_RULES)).toBe(
			entries
		);
	});

	it('removes the upgrade from the entry', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[0].id, UPGRADES[3].id] }
		];
		expect(removeEntryUpgrade(entries, 'w1', UPGRADES[0].id)).toEqual([
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[3].id] }
		]);
		expect(removeEntryUpgrade(entries, 'ghost', UPGRADES[0].id)).toEqual(entries);
	});
});

describe('armyPoints with upgrades', () => {
	it('adds the costs of every picked upgrade', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[0].id, UPGRADES[4].id] }
		];
		expect(armyPoints(entries, UNITS, UPGRADE_INDEX)).toBe(25 + 1 + 5);
	});

	it('ignores unknown upgrade ids', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior', upgrades: ['ghost'] }];
		expect(armyPoints(entries, UNITS, UPGRADE_INDEX)).toBe(25);
	});
});

describe('resolveArmyEntries with upgrades', () => {
	it('carries the upgraded unit, the resolved upgrades and their cost', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [UPGRADES[0].id, UPGRADES[4].id] }
		];
		const rows = resolveArmyEntries(entries, UNITS, MOUNTS, UPGRADE_INDEX, UPGRADE_ITEMS);
		expect(rows[0].points).toBe(31);
		expect(rows[0].upgrades.map((upgrade) => upgrade.id)).toEqual([UPGRADES[0].id, UPGRADES[4].id]);
		expect(rows[0].upgradedUnit.stats.INT).toBe(7);
		expect(rows[0].upgradedUnit.inventory).toEqual([{ id: 'crossbow', qty: 1 }]);
		expect(rows[0].effectiveStats.INT).toBe(7);
	});
});

const PAIMON: ArmyUpgradeSpec = {
	id: 'devotion-paimon',
	name: 'Devotion: Paimon',
	cost: 3,
	description: [],
	effects: [
		{ kind: 'stat', changes: { INT: 1 } },
		{ kind: 'costReduction', amount: 1 }
	]
};
const CHEAP: ArmyUpgradeSpec = {
	id: 'pouch-cheap',
	name: 'Pouch',
	cost: 1,
	description: [],
	effects: [{ kind: 'pouch' }]
};
const COST_INDEX = indexArmyRules([PAIMON, CHEAP, UPGRADES[4]]);

describe('upgrade cost reduction', () => {
	it('is zero without a cost-reducing upgrade in the army', () => {
		expect(armyUpgradeCostReduction([{ id: 'w1', unitId: 'warrior' }], COST_INDEX)).toBe(0);
	});

	it('sums the amounts of every picked cost-reducing upgrade', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [PAIMON.id] },
			{ id: 'w2', unitId: 'warrior', upgrades: [PAIMON.id] }
		];
		expect(armyUpgradeCostReduction(entries, COST_INDEX)).toBe(2);
	});

	it('reduces other upgrades by the amount, to a minimum of 1', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior', upgrades: [PAIMON.id] }];
		expect(upgradeCostInArmy(UPGRADES[4], entries, COST_INDEX)).toBe(4);
		expect(upgradeCostInArmy(CHEAP, entries, COST_INDEX)).toBe(1);
	});

	it('never discounts the provider itself', () => {
		const entries: ArmyEntry[] = [{ id: 'w1', unitId: 'warrior', upgrades: [PAIMON.id] }];
		expect(upgradeCostInArmy(PAIMON, entries, COST_INDEX)).toBe(3);
	});

	it('flows into armyPoints and roster row points', () => {
		const entries: ArmyEntry[] = [
			{ id: 'w1', unitId: 'warrior', upgrades: [PAIMON.id] },
			{ id: 'w2', unitId: 'warrior', upgrades: [UPGRADES[4].id] }
		];
		expect(armyPoints(entries, UNITS, COST_INDEX)).toBe(25 + 25 + 3 + 4);
		const rows = resolveArmyEntries(entries, UNITS, MOUNTS, COST_INDEX, UPGRADE_ITEMS);
		expect(rows[1].points).toBe(25 + 4);
	});
});
