import type { ArmyFactionId, ArmyUnitContent, ArmyUnitSpec } from '$lib/domain';

const unitModules = import.meta.glob('./content/units/*.json', { eager: true }) as Record<
	string,
	{ default: ArmyUnitSpec[] }
>;

/** Loads the per-faction unit files; neutral.json is the pool available to every faction. */
export function loadArmyUnits(): ArmyUnitContent {
	const factionUnits: ArmyUnitContent['factionUnits'] = {};
	let neutralUnits: ArmyUnitSpec[] = [];
	for (const [path, module] of Object.entries(unitModules)) {
		const key = path.split('/').pop()?.replace('.json', '') ?? '';
		if (key === 'neutral') {
			neutralUnits = module.default;
		} else {
			factionUnits[key as ArmyFactionId] = module.default;
		}
	}
	return { factionUnits, neutralUnits };
}
