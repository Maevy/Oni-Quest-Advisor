import type { SavedArmy } from '$lib/domain';

const STORAGE_KEY = 'oni-quest-advisor:saved-armies';

export function loadSavedArmies(): SavedArmy[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as SavedArmy[]) : [];
	} catch {
		return [];
	}
}

/** Newest first: the new save goes to the front of the stored list. */
export function addSavedArmy(army: SavedArmy): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify([army, ...loadSavedArmies()]));
}

export function removeSavedArmy(armyId: string): void {
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify(loadSavedArmies().filter((army) => army.id !== armyId))
	);
}
