import { describe, expect, it } from 'vitest';
import type { ArmyTextSegment, ArmyUnitSpec } from '$lib/domain';
import { loadArmyUnits } from './units';

const content = await loadArmyUnits();

/** Every unit the importer writes, across all four buckets. */
const allUnits: ArmyUnitSpec[] = [
	...Object.values(content.factionUnits).flatMap((units) => units ?? []),
	...content.neutralUnits,
	...content.mounts,
	...content.summons
];

/**
 * The models carrying a rule of their own - the producer's `abilities_additional_info`, which
 * is neither a Skill, a Trait nor a Stratagem. Pinned as a set because the diff is the point:
 * a producer dump that adds or drops one should fail here and be reviewed, not slip through.
 */
const SPECIAL_RULE_IDS = [
	'bladebrethren-elite',
	'blighted-riftspawn',
	'blue-rasetsu',
	'bonewalker',
	'chiyohime',
	'djinnborn-marzban',
	'flameweaver-noble',
	'goblin-warchief',
	'kogetsu',
	'paladin-of-the-order',
	'renegade-rasetsu',
	'tomoe',
	'troll-prowler',
	'water-elemental-tier-iii'
];

/** The three whose field holds two distinct rules rather than one rule in two sentences. */
const MULTI_PARAGRAPH_IDS = ['chiyohime', 'djinnborn-marzban', 'goblin-warchief'];

const withRules = allUnits.filter((unit) => unit.specialRules !== undefined);
const byId = (id: string) => withRules.find((unit) => unit.id === id);
const text = (paragraph: ArmyTextSegment[]) => paragraph.map((segment) => segment.text).join('');

describe('special rules content', () => {
	it('stamps exactly the models the producer gives a rule of their own', () => {
		expect(withRules.map((unit) => unit.id).sort()).toEqual([...SPECIAL_RULE_IDS].sort());
	});

	it('keeps every paragraph a non-empty run of text', () => {
		// The importer drops blank blocks, so an empty paragraph here means a rule was
		// half-imported rather than absent - and the card would render an empty box.
		for (const unit of withRules) {
			expect(unit.specialRules?.length, unit.id).toBeGreaterThan(0);
			for (const paragraph of unit.specialRules ?? []) {
				expect(paragraph.length, unit.id).toBeGreaterThan(0);
				expect(text(paragraph).trim(), unit.id).not.toBe('');
			}
		}
	});

	it('keeps a model with two distinct rules as two paragraphs', () => {
		// Collapsing them into one run of text is the regression this guards: `normalize`
		// folds line breaks, so the Goblin Warchief's Fearless aura and its Tribe rule would
		// read as one sentence about neither.
		for (const id of MULTI_PARAGRAPH_IDS) {
			expect(byId(id)?.specialRules?.length, id).toBe(2);
		}
		expect(
			withRules
				.filter((unit) => (unit.specialRules?.length ?? 0) > 1)
				.map((unit) => unit.id)
				.sort()
		).toEqual([...MULTI_PARAGRAPH_IDS].sort());
	});

	it('carries the Reaction rule that prompted the panel', () => {
		const rule = text(byId('bladebrethren-elite')?.specialRules?.[0] ?? []);
		expect(rule).toContain('Melee Attack as a Reaction');
		expect(rule).toContain('regain the AP spent on this Reaction');
	});

	it('gives the Goblin Warchief its Tribes ruling, not just its aura', () => {
		const paragraphs = (byId('goblin-warchief')?.specialRules ?? []).map(text);
		expect(paragraphs.some((rule) => rule.includes('Fearless'))).toBe(true);
		expect(paragraphs.some((rule) => rule.includes('called Tribes'))).toBe(true);
	});
});
