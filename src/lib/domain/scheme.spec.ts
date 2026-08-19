import { describe, expect, it } from 'vitest';
import {
	chooseScheme,
	copiesForFaction,
	drawCountForIntelligence,
	drawUniqueSchemes,
	getSchemePool,
	schemeVp,
	setSchemeChecked,
	type SchemeCard
} from './scheme';

function sequenceRng(values: number[]) {
	let index = 0;
	return () => values[index++];
}

const cardA: SchemeCard = {
	id: 'card-a',
	title: 'Card A',
	ruleText: '...',
	factionIds: ['common'],
	copies: 2,
	maxIncrements: 3,
	vpPerIncrement: 1
};
const cardB: SchemeCard = {
	id: 'card-b',
	title: 'Card B',
	ruleText: '...',
	factionIds: ['common'],
	copies: 1,
	maxIncrements: 1,
	vpPerIncrement: 3
};
const cardC: SchemeCard = {
	id: 'card-c',
	title: 'Card C',
	ruleText: '...',
	factionIds: ['helian-league'],
	copies: 1,
	maxIncrements: 1,
	vpPerIncrement: 3
};
const sharedCard: SchemeCard = {
	id: 'shared-card',
	title: 'Shared Card',
	ruleText: '...',
	factionIds: ['helian-league', 'empire-of-soga'],
	copies: { 'helian-league': 4, 'empire-of-soga': 2 },
	maxIncrements: 3,
	vpPerIncrement: 1
};
const martialValor: SchemeCard = {
	id: 'martial-valor',
	title: 'Martial Valor',
	ruleText: '...',
	factionIds: ['helian-league', 'empire-of-soga'],
	copies: 2,
	maxIncrements: 2,
	incrementVp: [2, 1]
};

describe('getSchemePool', () => {
	it("includes common Schemes and the given faction's Schemes, excluding other factions", () => {
		const otherFactionCard: SchemeCard = {
			...cardC,
			id: 'other',
			factionIds: ['some-other-faction']
		};
		const pool = getSchemePool([cardA, cardB, cardC, otherFactionCard], 'helian-league');

		expect(pool.map((card) => card.id)).toEqual(['card-a', 'card-b', 'card-c']);
	});

	it('includes cards shared between factions in each of their pools, and no others', () => {
		expect(getSchemePool([sharedCard], 'helian-league').map((card) => card.id)).toEqual([
			'shared-card'
		]);
		expect(getSchemePool([sharedCard], 'empire-of-soga').map((card) => card.id)).toEqual([
			'shared-card'
		]);
		expect(getSchemePool([sharedCard], 'some-other-faction')).toEqual([]);
	});
});

describe('copiesForFaction', () => {
	it('returns the uniform copy count for every faction', () => {
		expect(copiesForFaction(cardA, 'helian-league')).toBe(2);
		expect(copiesForFaction(cardA, 'empire-of-soga')).toBe(2);
	});

	it('returns per-faction overrides when a card has different copy counts per deck', () => {
		expect(copiesForFaction(sharedCard, 'helian-league')).toBe(4);
		expect(copiesForFaction(sharedCard, 'empire-of-soga')).toBe(2);
	});

	it('returns 0 for a faction without an override', () => {
		expect(copiesForFaction(sharedCard, 'some-other-faction')).toBe(0);
	});
});

describe('drawUniqueSchemes', () => {
	it('draws the requested number of unique Schemes, silently redrawing on a duplicate physical card', () => {
		// deck built from [cardA, cardA, cardB]; the sequence below hits cardA, then
		// cardA again (a duplicate, discarded), then cardB.
		const rng = sequenceRng([0, 0, 0]);

		const drawn = drawUniqueSchemes([cardA, cardB], 2, rng, 'helian-league');

		expect(drawn.map((card) => card.id)).toEqual(['card-a', 'card-b']);
	});

	it('stops once the deck runs out, even short of the requested count', () => {
		const rng = sequenceRng([0, 0]);

		const drawn = drawUniqueSchemes([cardB], 2, rng, 'helian-league');

		expect(drawn.map((card) => card.id)).toEqual(['card-b']);
	});

	it("builds the deck from the drawing faction's copy counts", () => {
		// Soga's deck holds 2 physical copies of the shared card; both draws hit it,
		// dedupe to one unique Scheme, and the deck runs out.
		const rng = sequenceRng([0, 0]);

		const drawn = drawUniqueSchemes([sharedCard], 2, rng, 'empire-of-soga');

		expect(drawn.map((card) => card.id)).toEqual(['shared-card']);
	});
});

describe('drawCountForIntelligence', () => {
	it('draws 2 at intelligence 13 or below', () => {
		expect(drawCountForIntelligence(0)).toBe(2);
		expect(drawCountForIntelligence(13)).toBe(2);
	});

	it('draws 3 at intelligence 14-15', () => {
		expect(drawCountForIntelligence(14)).toBe(3);
		expect(drawCountForIntelligence(15)).toBe(3);
	});

	it('draws 4 at intelligence 16 or above', () => {
		expect(drawCountForIntelligence(16)).toBe(4);
		expect(drawCountForIntelligence(99)).toBe(4);
	});
});

describe('schemeVp', () => {
	it('awards uniform VP per checked increment', () => {
		expect(schemeVp(cardA, 0)).toBe(0);
		expect(schemeVp(cardA, 2)).toBe(2);
		expect(schemeVp(cardB, 1)).toBe(3);
	});

	it('sums per-box values for cards with uneven increment VP (e.g. Martial Valor)', () => {
		expect(schemeVp(martialValor, 0)).toBe(0);
		expect(schemeVp(martialValor, 1)).toBe(2);
		expect(schemeVp(martialValor, 2)).toBe(3);
	});
});

describe('chooseScheme / setSchemeChecked', () => {
	it('starts a chosen Scheme at zero checked increments', () => {
		const chosen = chooseScheme('card-a', 'helian-league', 5);
		expect(chosen.checkedIncrements).toBe(0);
	});

	it("clamps checked increments to the Scheme's max", () => {
		const chosen = chooseScheme('card-a', 'helian-league', 5);
		expect(setSchemeChecked(chosen, 5, 3).checkedIncrements).toBe(3);
		expect(setSchemeChecked(chosen, -1, 3).checkedIncrements).toBe(0);
	});
});
