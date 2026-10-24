import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { summonableUnits, unitsForFaction, type ArmyUnitSpec } from '$lib/domain';
import { loadArmyFactions } from './armyFactions';
import { loadArmySpells, loadArmyUnits } from './units';

const content = await loadArmyUnits();
const spells = await loadArmySpells();
const factions = loadArmyFactions();

/** The six faction-less tokens the importer routes to summons.json. */
const TOKEN_IDS = [
	'gargoyle-tier-i',
	'golem-tier-ii',
	'earth-elemental-tier-iii',
	'water-elemental-tier-iii',
	'colossus-tier-iv',
	'blighted-riftspawn'
];

/** The three Undead that are summoned *or* recruited, living in their faction's file. */
const UNDEAD_IDS = ['bonewalker', 'vengeful-spirit', 'forgotten-hero'];

const summonables = summonableUnits(content);

/** The creature's name without its ", Tier N" suffix. */
const baseName = (unit: ArmyUnitSpec) => unit.name.split(',')[0].trim();

/** The icon resolver's key: the unit name, lowercased, alphanumeric only. */
const iconKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const iconFiles = new Set(
	readdirSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'uniticons'), {
		recursive: true,
		withFileTypes: true
	})
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
		.map((entry) => iconKey(entry.name.replace(/\.jpg$/i, '')))
);

describe('summon content', () => {
	it('loads the six faction-less tokens into the summons bucket', () => {
		expect(content.summons.map((unit) => unit.id).sort()).toEqual([...TOKEN_IDS].sort());
	});

	it('keeps every token out of the recruitable pool', () => {
		// A token in factionUnits or neutralUnits would be buyable *and* would shift every
		// army-code unit index, invalidating every saved army.
		for (const faction of factions) {
			const pool = unitsForFaction(faction.id, content).map((unit) => unit.id);
			for (const id of TOKEN_IDS) expect(pool, `${faction.id} recruits ${id}`).not.toContain(id);
		}
		for (const id of TOKEN_IDS) {
			expect(content.neutralUnits.map((unit) => unit.id)).not.toContain(id);
		}
	});

	it('prices a token at nothing: it is called, never bought', () => {
		for (const token of content.summons) {
			expect(token.points, token.id).toBe(0);
			expect(token.limit, token.id).toBe(0);
		}
	});

	it('finds all nine summonable creatures across both files', () => {
		expect(summonables.map((unit) => unit.id).sort()).toEqual([...TOKEN_IDS, ...UNDEAD_IDS].sort());
	});

	it('leaves the three Undead recruitable as well as summonable', () => {
		const oniClans = unitsForFaction('oni-clans', content).map((unit) => unit.id);
		for (const id of UNDEAD_IDS) expect(oniClans, id).toContain(id);
	});

	it('has a portrait file for every summonable creature', () => {
		// A misnamed icon fails silently at runtime - the flower just renders without one.
		for (const unit of summonables) {
			expect(iconFiles.has(iconKey(unit.name)), `no icon for "${unit.name}"`).toBe(true);
		}
	});
});

describe('conjuration summons match the spell catalog', () => {
	const conjurations = summonables.filter((unit) => unit.summon?.source.kind === 'conjuration');

	it('has five of them', () => {
		expect(conjurations.map((unit) => unit.id).sort()).toEqual(
			[...TOKEN_IDS].filter((id) => id !== 'blighted-riftspawn').sort()
		);
	});

	it('levels each summon spell exactly at its creature tier, in the creature element', () => {
		// The eligibility gate reads tier and element off the creature, so a producer dump
		// that moved a spell's level or element would gate silently wrong.
		for (const unit of conjurations) {
			const source = unit.summon?.source;
			if (source?.kind !== 'conjuration') continue;
			const spell = spells.find(
				(candidate) =>
					candidate.group === 'art-of-conjuration' &&
					candidate.name.trim() === `Summon ${baseName(unit)}`
			);
			expect(spell, `no summon spell for ${unit.id}`).toBeDefined();
			expect(spell?.element, unit.id).toBe(source.element);
			expect(spell?.level, unit.id).toBe(unit.summon?.tier);
		}
	});

	it('carries no creature for the phased-out Imp', () => {
		expect(spells.map((spell) => spell.id)).toContain('summon-imp');
		expect(summonables.some((unit) => /imp/i.test(unit.id))).toBe(false);
		expect(
			summonables.some(
				(unit) =>
					unit.summon?.source.kind === 'conjuration' && unit.summon.source.element === 'elder'
			)
		).toBe(false);
	});
});

describe('necromancy summons', () => {
	const undead = summonables.filter((unit) => unit.summon?.source.kind === 'necromancy');

	it('has four of them, every one carrying the Undead trait', () => {
		expect(undead).toHaveLength(4);
		for (const unit of undead) {
			expect(
				(unit.traits ?? []).map((trait) => trait.id),
				unit.id
			).toContain('undead');
		}
	});

	it('tiers them I, I, II and V, the V being the Riftspawn only the fan reaches', () => {
		const tiers = undead.map((unit) => [unit.id, unit.summon?.tier]);
		expect(tiers).toContainEqual(['bonewalker', 1]);
		expect(tiers).toContainEqual(['vengeful-spirit', 1]);
		expect(tiers).toContainEqual(['forgotten-hero', 2]);
		expect(tiers).toContainEqual(['blighted-riftspawn', 5]);
	});
});
