import { describe, expect, it } from 'vitest';
import {
	chooseScheme,
	drawCountForIntelligence,
	drawUniqueSchemes,
	getSchemePool,
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
	factionId: 'common',
	copies: 2,
	maxIncrements: 3,
	vpPerIncrement: 1
};
const cardB: SchemeCard = {
	id: 'card-b',
	title: 'Card B',
	ruleText: '...',
	factionId: 'common',
	copies: 1,
	maxIncrements: 1,
	vpPerIncrement: 3
};
const cardC: SchemeCard = {
	id: 'card-c',
	title: 'Card C',
	ruleText: '...',
	factionId: 'helian-league',
	copies: 1,
	maxIncrements: 1,
	vpPerIncrement: 3
};

describe('getSchemePool', () => {
	it("includes common Schemes and the given faction's Schemes, excluding other factions", () => {
		const otherFactionCard: SchemeCard = { ...cardC, id: 'other', factionId: 'some-other-faction' };
		const pool = getSchemePool([cardA, cardB, cardC, otherFactionCard], 'helian-league');

		expect(pool.map((card) => card.id)).toEqual(['card-a', 'card-b', 'card-c']);
	});
});

describe('drawUniqueSchemes', () => {
	it('draws the requested number of unique Schemes, silently redrawing on a duplicate physical card', () => {
		// deck built from [cardA, cardA, cardB]; the sequence below hits cardA, then
		// cardA again (a duplicate, discarded), then cardB.
		const rng = sequenceRng([0, 0, 0]);

		const drawn = drawUniqueSchemes([cardA, cardB], 2, rng);

		expect(drawn.map((card) => card.id)).toEqual(['card-a', 'card-b']);
	});

	it('stops once the deck runs out, even short of the requested count', () => {
		const rng = sequenceRng([0, 0]);

		const drawn = drawUniqueSchemes([cardB], 2, rng);

		expect(drawn.map((card) => card.id)).toEqual(['card-b']);
	});
});

describe('drawCountForIntelligence', () => {
	it('draws 1 at intelligence 13 or below', () => {
		expect(drawCountForIntelligence(0)).toBe(1);
		expect(drawCountForIntelligence(13)).toBe(1);
	});

	it('draws 2 at intelligence 14-15', () => {
		expect(drawCountForIntelligence(14)).toBe(2);
		expect(drawCountForIntelligence(15)).toBe(2);
	});

	it('draws 3 at intelligence 16 or above', () => {
		expect(drawCountForIntelligence(16)).toBe(3);
		expect(drawCountForIntelligence(99)).toBe(3);
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
