import { describe, expect, it } from 'vitest';
import {
	availableSummons,
	canSummon,
	DEATHWEAVING_FAN_ITEM_ID,
	NECROMANCY_BASE_TIER_CAP,
	summonableUnits
} from './summoning';
import type { ArmyStats, ArmyTraitRef, ArmyUnitContent, ArmyUnitSpec } from './army';

const STATS: ArmyStats = {
	STA: 2,
	SPD: 4,
	OFF: 10,
	DEF: 10,
	ACC: 8,
	INT: 8,
	AG: 6,
	T: 15,
	ARM: 5,
	HP: 3,
	M: 20
};

type Fixture = Partial<ArmyUnitSpec> & { id: string; name: string };

function unit(fixture: Fixture): ArmyUnitSpec {
	return { points: 0, limit: 0, stats: STATS, size: 'medium', classes: ['creature'], ...fixture };
}

/** The Affinity trait carrying the elements a caster can call through. */
function affinity(...elements: string[]): ArmyTraitRef[] {
	return [{ id: 'affinity--element', level: 1, dynamicElements: elements }];
}

function conjuration(level: number) {
	return [{ id: 'art-of-conjuration', level }];
}

function necromancy(level: number) {
	return [{ id: 'necromancy', level }];
}

// The nine creatures, mirroring the content: five Conjuration tokens and four Undead.
const gargoyle = unit({
	id: 'gargoyle-tier-i',
	name: 'Gargoyle, Tier I',
	size: 'small',
	summon: { tier: 1, source: { kind: 'conjuration', element: 'earth' } }
});
const golem = unit({
	id: 'golem-tier-ii',
	name: 'Golem, Tier II',
	size: 'huge',
	summon: { tier: 2, source: { kind: 'conjuration', element: 'earth' } }
});
const earthElemental = unit({
	id: 'earth-elemental-tier-iii',
	name: 'Earth Elemental, Tier III',
	size: 'gigantic',
	summon: { tier: 3, source: { kind: 'conjuration', element: 'earth' } }
});
const waterElemental = unit({
	id: 'water-elemental-tier-iii',
	name: 'Water Elemental, Tier III',
	size: 'gigantic',
	summon: { tier: 3, source: { kind: 'conjuration', element: 'water' } }
});
const colossus = unit({
	id: 'colossus-tier-iv',
	name: 'Colossus, Tier IV',
	size: 'colossal',
	summon: { tier: 4, source: { kind: 'conjuration', element: 'earth' } }
});
const bonewalker = unit({
	id: 'bonewalker',
	name: 'Bonewalker, Tier I',
	points: 10,
	limit: 10,
	traits: [{ id: 'undead', level: 1 }],
	summon: { tier: 1, source: { kind: 'necromancy' } }
});
const vengefulSpirit = unit({
	id: 'vengeful-spirit',
	name: 'Vengeful Spirit, Tier I',
	traits: [{ id: 'undead', level: 1 }],
	summon: { tier: 1, source: { kind: 'necromancy' } }
});
const forgottenHero = unit({
	id: 'forgotten-hero',
	name: 'Forgotten Hero, Tier II',
	traits: [{ id: 'undead', level: 1 }],
	summon: { tier: 2, source: { kind: 'necromancy' } }
});
const riftspawn = unit({
	id: 'blighted-riftspawn',
	name: 'Blighted Riftspawn, Tier V',
	size: 'epic',
	traits: [{ id: 'undead', level: 2 }],
	summon: { tier: 5, source: { kind: 'necromancy' } }
});

const TOKENS = [gargoyle, golem, earthElemental, waterElemental, colossus, riftspawn];
const UNDEAD = [bonewalker, vengefulSpirit, forgottenHero];

// The Undead sit in their faction's file (they are recruitable too); the faction-less tokens
// sit in the summons bucket. summonableUnits() has to reach across both.
const CONTENT: ArmyUnitContent = {
	factionUnits: { 'oni-clans': [...UNDEAD, unit({ id: 'oni-marauder', name: 'Oni Marauder' })] },
	neutralUnits: [unit({ id: 'hired-blade', name: 'Hired Blade' })],
	mounts: [unit({ id: 'lupus', name: 'Lupus Rex' })],
	summons: TOKENS
};

const POOL = summonableUnits(CONTENT);

// Vizier of Conjurations: Art of Conjuration IV, Affinity Elder + Earth.
const vizier = unit({
	id: 'vizier-of-conjurations',
	name: 'Vizier of Conjurations',
	spellcrafts: conjuration(4),
	traits: affinity('Elder', 'Earth')
});
// The same model after an upgrade granted or replaced an Affinity with Water.
const vizierWithWater = unit({
	...vizier,
	id: 'vizier-water',
	traits: affinity('Elder', 'Earth', 'Water')
});
const apprenticeConjurer = unit({
	id: 'apprentice',
	name: 'Apprentice Conjurer',
	spellcrafts: conjuration(2),
	traits: affinity('Earth')
});
const affinitylessConjurer = unit({
	id: 'affinityless',
	name: 'Affinityless Conjurer',
	spellcrafts: conjuration(4)
});
// Chiyohime: Necromancy V and the Deathweaving Fan in her inventory.
const chiyohime = unit({
	id: 'chiyohime',
	name: 'Chiyohime',
	spellcrafts: necromancy(5),
	inventory: [{ id: DEATHWEAVING_FAN_ITEM_ID, qty: 1 }]
});
// Na'ra: Necromancy III, no fan - a different faction from the Undead she raises.
const nara = unit({
	id: 'nara',
	name: "Na'ra, Veil Watcher",
	spellcrafts: necromancy(3),
	inventory: [{ id: 'chimera-claws', qty: 1 }]
});
const soldier = unit({ id: 'soldier', name: 'Soldier' });

function ids(summons: ReturnType<typeof availableSummons>): string[] {
	return summons.map((summon) => summon.unit.id);
}

describe('summonableUnits', () => {
	it('reaches the Undead in a faction file and the tokens in the summons bucket', () => {
		const found = POOL.map((creature) => creature.id);
		for (const undead of UNDEAD) expect(found).toContain(undead.id);
		for (const token of TOKENS) expect(found).toContain(token.id);
		expect(POOL).toHaveLength(9);
	});

	it('orders by tier then name, the order a picker reads in', () => {
		expect(POOL.map((creature) => creature.id)).toEqual([
			'bonewalker',
			'gargoyle-tier-i',
			'vengeful-spirit',
			'forgotten-hero',
			'golem-tier-ii',
			'earth-elemental-tier-iii',
			'water-elemental-tier-iii',
			'colossus-tier-iv',
			'blighted-riftspawn'
		]);
	});

	it('leaves out every unit that is not summonable', () => {
		const found = POOL.map((creature) => creature.id);
		expect(found).not.toContain('oni-marauder');
		expect(found).not.toContain('hired-blade');
		expect(found).not.toContain('lupus');
	});
});

describe('Conjuration', () => {
	it('gives an Earth-affinity conjurer every Earth creature its level reaches', () => {
		expect(ids(availableSummons(vizier, POOL))).toEqual([
			'gargoyle-tier-i',
			'golem-tier-ii',
			'earth-elemental-tier-iii',
			'colossus-tier-iv'
		]);
	});

	it('withholds a creature whose element the caster lacks', () => {
		// The Water Elemental is level 3, well inside Conjuration IV - only the Affinity bars it.
		expect(canSummon(vizier, waterElemental)).toBe(false);
		expect(canSummon(vizierWithWater, waterElemental)).toBe(true);
		expect(ids(availableSummons(vizierWithWater, POOL))).toContain('water-elemental-tier-iii');
	});

	it('gates on the spellcraft level reaching the creature tier', () => {
		expect(ids(availableSummons(apprenticeConjurer, POOL))).toEqual([
			'gargoyle-tier-i',
			'golem-tier-ii'
		]);
		expect(canSummon(apprenticeConjurer, earthElemental)).toBe(false);
		expect(canSummon(apprenticeConjurer, colossus)).toBe(false);
	});

	it('needs an Affinity at all, not just the spellcraft', () => {
		expect(availableSummons(affinitylessConjurer, POOL)).toEqual([]);
	});

	it('never reaches an Undead creature', () => {
		for (const undead of UNDEAD) expect(canSummon(vizier, undead)).toBe(false);
	});
});

describe('Necromancy', () => {
	it('raises Tier I and II Undead unaided', () => {
		expect(ids(availableSummons(nara, POOL))).toEqual([
			'bonewalker',
			'vengeful-spirit',
			'forgotten-hero'
		]);
	});

	it('is faction-agnostic: a Sand Kingdoms necromancer raises Oni Clans Undead', () => {
		// Na'ra is Sand Kingdoms, the three Undead are Oni Clans units.
		expect(canSummon(nara, bonewalker)).toBe(true);
	});

	it('lifts the tier cap for the Deathweaving Fan', () => {
		expect(NECROMANCY_BASE_TIER_CAP).toBe(2);
		expect(canSummon(nara, riftspawn)).toBe(false);
		expect(canSummon(chiyohime, riftspawn)).toBe(true);
		expect(ids(availableSummons(chiyohime, POOL))).toEqual([
			'bonewalker',
			'vengeful-spirit',
			'forgotten-hero',
			'blighted-riftspawn'
		]);
	});

	it('is element-blind: no Affinity is needed to raise the dead', () => {
		expect(affinityElementsOf(nara)).toEqual([]);
		expect(availableSummons(nara, POOL).length).toBeGreaterThan(0);
	});

	it('never reaches a Conjuration creature', () => {
		for (const token of TOKENS.filter(
			(creature) => creature.summon?.source.kind === 'conjuration'
		)) {
			expect(canSummon(chiyohime, token)).toBe(false);
		}
	});
});

describe('canSummon', () => {
	it('is false for a model with neither spellcraft', () => {
		expect(availableSummons(soldier, POOL)).toEqual([]);
	});

	it('is false for a unit that is not summonable, so callers need no pre-check', () => {
		expect(canSummon(chiyohime, soldier)).toBe(false);
		expect(canSummon(chiyohime, unit({ id: 'lupus', name: 'Lupus Rex' }))).toBe(false);
	});
});

/** The Affinity elements a fixture carries, read back the way the rule reads them. */
function affinityElementsOf(model: ArmyUnitSpec): string[] {
	return (model.traits ?? [])
		.filter((trait) => trait.id === 'affinity--element')
		.flatMap((trait) => trait.dynamicElements ?? [])
		.map((element) => element.toLowerCase());
}
