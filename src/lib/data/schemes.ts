import type { SchemeCard } from '$lib/domain';

const schemeModules = import.meta.glob('./content/schemes/*.json', { eager: true }) as Record<
	string,
	{ default: SchemeCard[] }
>;

export function loadSchemes(): SchemeCard[] {
	return Object.values(schemeModules).flatMap((module) => module.default);
}
