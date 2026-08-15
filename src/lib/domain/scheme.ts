import type { Rng } from './random';

/** `factionIds` value for Schemes that belong to every faction's deck. */
export const COMMON_FACTION_ID = 'common';

type SchemeVpModel =
	| {
			/** VP awarded per checked increment (a flat-VP scheme is `maxIncrements: 1`). */
			vpPerIncrement: number;
			incrementVp?: never;
	  }
	| {
			/** Per-box VP values, checked left-to-right (e.g. Martial Valor: 2 VP, then 1 VP). */
			incrementVp: number[];
			vpPerIncrement?: never;
	  };

export type SchemeCard = {
	id: string;
	title: string;
	ruleText: string;
	/** Factions whose deck contains this card; `COMMON_FACTION_ID` means every faction's deck. */
	factionIds: string[];
	/**
	 * Physical copies in a deck — a single number for every faction that has the card,
	 * or per-faction overrides keyed by faction id (e.g. Virtuous Commander: 4 Helian, 2 Soga).
	 */
	copies: number | Record<string, number>;
	/** Number of checkboxes the card gets once chosen. */
	maxIncrements: number;
} & SchemeVpModel;

export type ChosenScheme = {
	schemeId: string;
	factionId: string;
	intelligence: number;
	checkedIncrements: number;
};

/** Physical copies of a card in the given faction's deck. */
export function copiesForFaction(card: SchemeCard, factionId: string): number {
	if (typeof card.copies === 'number') return card.copies;
	return card.copies[factionId] ?? 0;
}

/** VP earned by the checked boxes — uniform per box, or the card's per-box values when defined. */
export function schemeVp(card: SchemeCard, checkedIncrements: number): number {
	if (card.incrementVp) {
		return card.incrementVp.slice(0, checkedIncrements).reduce((sum, vp) => sum + vp, 0);
	}
	return checkedIncrements * card.vpPerIncrement;
}

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
		(scheme) =>
			scheme.factionIds.includes(factionId) || scheme.factionIds.includes(COMMON_FACTION_ID)
	);
}

/**
 * Draws `count` *unique* Schemes from the given faction's deck, where each card
 * contributes its faction-specific number of physical entries. Drawing a duplicate
 * of an already-drawn Scheme is discarded and redrawn, transparently to the caller.
 */
export function drawUniqueSchemes(
	pool: SchemeCard[],
	count: number,
	rng: Rng,
	factionId: string
): SchemeCard[] {
	const deck = pool.flatMap((card) => Array(copiesForFaction(card, factionId)).fill(card));
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
