import { describe, expect, it } from 'vitest';
import {
	addArmyUnit,
	affinityElements,
	armyCopyCounts,
	armyPoints,
	armyRulesTitle,
	classPopupFor,
	combatArtPopupFor,
	effectiveMountedStats,
	indexArmyRules,
	isOverArmyLimit,
	removeArmyCopy,
	removeArmyEntry,
	resolveArmyEntries,
	romanNumeral,
	rulesLinkPopup,
	skillPopupFor,
	spellCostDisplay,
	spellcraftPopupFor,
	substituteArmyTemplate,
	toggleArmyMount,
	traitPopupFor,
	unitsForFaction,
	type ArmyEntry,
	type ArmyRulesIndexes,
	type ArmyRulesSpec,
	type ArmySpellSpec,
	type ArmyStats,
	type ArmyUnitContent,
	type ArmyUnitSpec
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
				effectiveStats: STATS
			},
			{
				entryId: 'w2',
				unitId: 'warrior',
				name: 'Warrior',
				points: 25,
				mounted: false,
				effectiveStats: STATS
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
				effectiveStats: STATS
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
				}
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
		combatArts: { fencing: FENCING }
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

	it('shows the bare stat when the unit has no value for it', () => {
		expect(spellCostDisplay({ stat: 'M' }, { ...STATS, M: null })).toBe('M');
	});

	it('is undefined without a cost', () => {
		expect(spellCostDisplay(undefined, STATS)).toBeUndefined();
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
