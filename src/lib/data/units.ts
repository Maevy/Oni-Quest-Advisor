import type { ArmyFactionId, ArmyUnitContent, ArmyUnitSpec } from '$lib/domain';

const unitModules = import.meta.glob('./content/units/*.json', { eager: true }) as Record<
	string,
	{ default: ArmyUnitSpec[] }
>;

const iconModules = import.meta.glob('../assets/uniticons/*/*.jpg', {
	eager: true,
	import: 'default'
}) as Record<string, string>;

/** Icons keyed by normalized file name (lowercase, alphanumeric only). */
const iconsByName: Record<string, string> = Object.fromEntries(
	Object.entries(iconModules).map(([path, url]) => [
		(path.split('/').pop() ?? '')
			.replace(/\.jpg$/, '')
			.toLowerCase()
			.replace(/[^a-z0-9]/g, ''),
		url
	])
);

/** Units whose portrait is borrowed from another unit (no file of their own). */
const ICON_ALIASES: Record<string, string> = {
	'renegade-rasetsu': 'redrasetsu'
};

function iconFor(unit: ArmyUnitSpec): string | undefined {
	const key = ICON_ALIASES[unit.id] ?? unit.name.toLowerCase().replace(/[^a-z0-9]/g, '');
	return iconsByName[key];
}

function withIcons(units: ArmyUnitSpec[]): ArmyUnitSpec[] {
	return units.map((unit) => {
		const icon = iconFor(unit);
		return icon ? { ...unit, icon } : unit;
	});
}

/** Loads the per-faction unit files; neutral.json is the pool available to every faction. */
export function loadArmyUnits(): ArmyUnitContent {
	const factionUnits: ArmyUnitContent['factionUnits'] = {};
	let neutralUnits: ArmyUnitSpec[] = [];
	let mounts: ArmyUnitSpec[] = [];
	for (const [path, module] of Object.entries(unitModules)) {
		const key = path.split('/').pop()?.replace('.json', '') ?? '';
		if (key === 'neutral') {
			neutralUnits = withIcons(module.default);
		} else if (key === 'mounts') {
			mounts = withIcons(module.default);
		} else {
			factionUnits[key as ArmyFactionId] = withIcons(module.default);
		}
	}
	return { factionUnits, neutralUnits, mounts };
}
