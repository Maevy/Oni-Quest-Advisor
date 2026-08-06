import type { Rng } from './random';

/** `factionId` value used by Schemes every faction shares, instead of one specific faction. */
export const COMMON_FACTION_ID = 'common';

export type SchemeCard = {
	id: string;
	title: string;
	ruleText: string;
	factionId: string;
	/** How many physical copies of this card are in the deck. */
	copies: number;
	/** Number of checkboxes the card gets once chosen. */
	maxIncrements: number;
	/** VP awarded per checked increment (a flat-VP scheme is `maxIncrements: 1`). */
	vpPerIncrement: number;
};

export type ChosenScheme = {
	schemeId: string;
	factionId: string;
	intelligence: number;
	checkedIncrements: number;
};

/**
 * Intelligence 13 or below draws 1 Scheme (no real choice — it's taken as-is);
 * 14–15 draws 2; 16 or above draws 3.
 */
export function drawCountForIntelligence(intelligence: number): number {
	if (intelligence >= 16) return 3;
	if (intelligence >= 14) return 2;
	return 1;
}

export function getSchemePool(schemes: SchemeCard[], factionId: string): SchemeCard[] {
	return schemes.filter(
		(scheme) => scheme.factionId === factionId || scheme.factionId === COMMON_FACTION_ID
	);
}

/**
 * Draws `count` *unique* Schemes from a deck where each card contributes `copies`
 * physical entries. Drawing a duplicate of an already-drawn Scheme is discarded and
 * redrawn, transparently to the caller.
 */
export function drawUniqueSchemes(pool: SchemeCard[], count: number, rng: Rng): SchemeCard[] {
	const deck = pool.flatMap((card) => Array(card.copies).fill(card));
	const drawn: SchemeCard[] = [];
	const drawnIds = new Set<string>();

	while (drawn.length < count && deck.length > 0) {
		const index = Math.floor(rng() * deck.length);
		const [card] = deck.splice(index, 1);
		if (!drawnIds.has(card.id)) {
			drawnIds.add(card.id);
			drawn.push(card);
		}
	}

	return drawn;
}

export function chooseScheme(
	schemeId: string,
	factionId: string,
	intelligence: number
): ChosenScheme {
	return { schemeId, factionId, intelligence, checkedIncrements: 0 };
}

export function setSchemeChecked(
	scheme: ChosenScheme,
	checkedIncrements: number,
	maxIncrements: number
): ChosenScheme {
	const clamped = Math.max(0, Math.min(checkedIncrements, maxIncrements));
	return { ...scheme, checkedIncrements: clamped };
}
