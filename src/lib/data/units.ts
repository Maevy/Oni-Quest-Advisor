import type {
	ArmyFactionId,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	ArmyUnitContent,
	ArmyUnitSpec
} from '$lib/domain';

const unitModules = import.meta.glob('./content/units/*.json', { eager: true }) as Record<
	string,
	{ default: ArmyUnitSpec[] }
>;

/** Centralized rules entries (classes/skills/traits/combat arts/spellcrafts). */
const rulesModules = import.meta.glob(
	'./content/units/{classes,skills,traits,combat-arts,spellcrafts}.json',
	{ eager: true }
) as Record<string, { default: ArmyRulesSpec[] }>;

const spellModules = import.meta.glob('./content/units/spells.json', { eager: true }) as Record<
	string,
	{ default: ArmySpellSpec[] }
>;

const stratagemModules = import.meta.glob('./content/units/stratagems.json', {
	eager: true
}) as Record<string, { default: ArmyStratagemSpec[] }>;

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
		if (
			key === 'classes' ||
			key === 'skills' ||
			key === 'traits' ||
			key === 'combat-arts' ||
			key === 'spellcrafts' ||
			key === 'spells' ||
			key === 'stratagems'
		) {
			continue;
		}
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

function rulesFile(fileName: string): ArmyRulesSpec[] {
	const module = Object.entries(rulesModules).find(([path]) =>
		path.endsWith('/' + fileName + '.json')
	)?.[1];
	return module?.default ?? [];
}

/** Loads the centralized class list referenced by unit `classes` ids. */
export function loadArmyClasses(): ArmyRulesSpec[] {
	return rulesFile('classes');
}

/** Loads the centralized skill list referenced by unit `skills` refs. */
export function loadArmySkills(): ArmyRulesSpec[] {
	return rulesFile('skills');
}

/** Loads the centralized trait list referenced by unit `traits` refs. */
export function loadArmyTraits(): ArmyRulesSpec[] {
	return rulesFile('traits');
}

/** Loads the centralized combat-art list referenced by unit `combatArts` refs. */
export function loadArmyCombatArts(): ArmyRulesSpec[] {
	return rulesFile('combat-arts');
}

/** Loads the centralized spellcraft list referenced by unit `spellcrafts` refs. */
export function loadArmySpellcrafts(): ArmyRulesSpec[] {
	return rulesFile('spellcrafts');
}

/** Loads the spell catalog the spellcraft popups filter from. */
export function loadArmySpells(): ArmySpellSpec[] {
	return Object.values(spellModules)[0]?.default ?? [];
}

/** Loads the stratagem catalog referenced by unit `stratagems` ids. */
export function loadArmyStratagems(): ArmyStratagemSpec[] {
	return Object.values(stratagemModules)[0]?.default ?? [];
}
