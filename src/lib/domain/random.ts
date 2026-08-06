export type Rng = () => number;

export function pickRandom<T>(items: T[], rng: Rng): T {
	if (items.length === 0) {
		throw new Error('Cannot pick from an empty list');
	}
	return items[Math.floor(rng() * items.length)];
}
