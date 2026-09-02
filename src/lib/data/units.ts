import type {
	ArmyFactionId,
	ArmyItemSpec,
	ArmyRulesSpec,
	ArmySpellSpec,
	ArmyStratagemSpec,
	ArmyUnitContent,
	ArmyUnitSpec,
	ArmyUpgradeSpec
} from '$lib/domain';

// Non-eager globs: the JSON/icon modules become separate chunks fetched when
// loadArmy*() is first called, keeping the army builder out of the initial JS.
const unitModules = import.meta.glob('./content/units/*.json') as Record<
	string,
	() => Promise<{ default: ArmyUnitSpec[] }>
>;

/** Centralized rules entries (classes/skills/traits/combat arts/spellcrafts). */
const rulesModules = import.meta.glob(
	'./content/units/{classes,skills,traits,combat-arts,spellcrafts}.json'
) as Record<string, () => Promise<{ default: ArmyRulesSpec[] }>>;

const spellModules = import.meta.glob('./content/units/spells.json') as Record<
	string,
	() => Promise<{ default: ArmySpellSpec[] }>
>;

const stratagemModules = import.meta.glob('./content/units/stratagems.json') as Record<
	string,
	() => Promise<{ default: ArmyStratagemSpec[] }>
>;

const itemModules = import.meta.glob('./content/units/items.json') as Record<
	string,
	() => Promise<{ default: ArmyItemSpec[] }>
>;

const upgradeModules = import.meta.glob('./content/units/upgrades.json') as Record<
	string,
	() => Promise<{ default: ArmyUpgradeSpec[] }>
>;

const upgradeIconModules = import.meta.glob('../assets/upgrades/*/*.jpg', {
	import: 'default'
}) as Record<string, () => Promise<string>>;

const iconModules = import.meta.glob('../assets/uniticons/*/*.jpg', {
	import: 'default'
}) as Record<string, () => Promise<string>>;

async function iconUrlByName(): Promise<Record<string, string>> {
	const loaded = await Promise.all(
		Object.entries(iconModules).map(async ([path, load]) => [path, await load()] as const)
	);
	/** Icons keyed by normalized file name (lowercase, alphanumeric only). */
	return Object.fromEntries(
		loaded.map(([path, url]) => [
			(path.split('/').pop() ?? '')
				.replace(/\.jpg$/, '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, ''),
			url
		])
	);
}

/** Units whose portrait is borrowed from another unit (no file of their own). */
const ICON_ALIASES: Record<string, string> = {
	'renegade-rasetsu': 'redrasetsu'
};

function iconFor(unit: ArmyUnitSpec, iconsByName: Record<string, string>): string | undefined {
	const key = ICON_ALIASES[unit.id] ?? unit.name.toLowerCase().replace(/[^a-z0-9]/g, '');
	return iconsByName[key];
}

function withIcons(units: ArmyUnitSpec[], iconsByName: Record<string, string>): ArmyUnitSpec[] {
	return units.map((unit) => {
		const icon = iconFor(unit, iconsByName);
		return icon ? { ...unit, icon } : unit;
	});
}

/** Loads the per-faction unit files; neutral.json is the pool available to every faction. */
export async function loadArmyUnits(): Promise<ArmyUnitContent> {
	const iconsByName = await iconUrlByName();
	const entries = await Promise.all(
		Object.entries(unitModules).map(async ([path, load]) => [path, await load()] as const)
	);
	const factionUnits: ArmyUnitContent['factionUnits'] = {};
	let neutralUnits: ArmyUnitSpec[] = [];
	let mounts: ArmyUnitSpec[] = [];
	for (const [path, module] of entries) {
		const key = path.split('/').pop()?.replace('.json', '') ?? '';
		if (
			key === 'classes' ||
			key === 'skills' ||
			key === 'traits' ||
			key === 'combat-arts' ||
			key === 'spellcrafts' ||
			key === 'spells' ||
			key === 'stratagems' ||
			key === 'items' ||
			key === 'upgrades'
		) {
			continue;
		}
		if (key === 'neutral') {
			neutralUnits = withIcons(module.default, iconsByName);
		} else if (key === 'mounts') {
			mounts = withIcons(module.default, iconsByName);
		} else {
			factionUnits[key as ArmyFactionId] = withIcons(module.default, iconsByName);
		}
	}
	return { factionUnits, neutralUnits, mounts };
}

async function rulesFile(fileName: string): Promise<ArmyRulesSpec[]> {
	const entry = Object.entries(rulesModules).find(([path]) =>
		path.endsWith('/' + fileName + '.json')
	);
	if (!entry) return [];
	return (await entry[1]()).default;
}

/** Loads the centralized class list referenced by unit `classes` ids. */
export function loadArmyClasses(): Promise<ArmyRulesSpec[]> {
	return rulesFile('classes');
}

/** Loads the centralized skill list referenced by unit `skills` refs. */
export function loadArmySkills(): Promise<ArmyRulesSpec[]> {
	return rulesFile('skills');
}

/** Loads the centralized trait list referenced by unit `traits` refs. */
export function loadArmyTraits(): Promise<ArmyRulesSpec[]> {
	return rulesFile('traits');
}

/** Loads the centralized combat-art list referenced by unit `combatArts` refs. */
export function loadArmyCombatArts(): Promise<ArmyRulesSpec[]> {
	return rulesFile('combat-arts');
}

/** Loads the centralized spellcraft list referenced by unit `spellcrafts` refs. */
export function loadArmySpellcrafts(): Promise<ArmyRulesSpec[]> {
	return rulesFile('spellcrafts');
}

/** Loads the spell catalog the spellcraft popups filter from. */
export async function loadArmySpells(): Promise<ArmySpellSpec[]> {
	const load = Object.values(spellModules)[0];
	return load ? (await load()).default : [];
}

/** Loads the stratagem catalog referenced by unit `stratagems` ids. */
export async function loadArmyStratagems(): Promise<ArmyStratagemSpec[]> {
	const load = Object.values(stratagemModules)[0];
	return load ? (await load()).default : [];
}

/** Loads the item catalog referenced by unit inventory slots. */
export async function loadArmyItems(): Promise<ArmyItemSpec[]> {
	const load = Object.values(itemModules)[0];
	return load ? (await load()).default : [];
}

async function upgradeIconUrlByName(): Promise<Record<string, string>> {
	const loaded = await Promise.all(
		Object.entries(upgradeIconModules).map(async ([path, load]) => [path, await load()] as const)
	);
	/** Upgrade icons keyed by normalized file name (lowercase, alphanumeric only). */
	return Object.fromEntries(
		loaded.map(([path, url]) => [
			(path.split('/').pop() ?? '')
				.replace(/\.jpg$/, '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, ''),
			url
		])
	);
}

/**
 * Upgrades whose image file does not match the upgrade name (typo'd file
 * names, and the second Seasoned Combatant which shares the first's name).
 */
const UPGRADE_ICON_ALIASES: Record<string, string> = {
	'arcane-tome-sand-kingdoms': 'arcancetome',
	'conjured-retinue-sand-kingdoms': 'conjuredretniue',
	'expeditionary-tactics-surge-order-helian-league': 'expedtionarytacticssurgeorder',
	'gift-of-longevity-helian-league': 'giftlongevity',
	'glyphscribe-reduce-weight-helian-league': 'gpyhscribereduceweight',
	'imported-crossbow': 'importedcrossbox',
	'journeyman-adventurer': 'journeymandadventurer',
	'king-of-the-battlefield': 'kingofthebattlefiedl',
	'seasoned-combatant-helian-league': 'seasonedcombatanthelian'
};

function upgradeIconFor(
	upgrade: ArmyUpgradeSpec,
	iconsByName: Record<string, string>
): string | undefined {
	const key =
		UPGRADE_ICON_ALIASES[upgrade.id] ?? upgrade.name.toLowerCase().replace(/[^a-z0-9]/g, '');
	return iconsByName[key];
}

/** Loads the upgrade catalog picked onto units (standard) or into the roster. */
export async function loadArmyUpgrades(): Promise<ArmyUpgradeSpec[]> {
	const load = Object.values(upgradeModules)[0];
	if (!load) return [];
	const upgrades = (await load()).default;
	const iconsByName = await upgradeIconUrlByName();
	return upgrades.map((upgrade) => {
		const icon = upgradeIconFor(upgrade, iconsByName);
		return icon ? { ...upgrade, icon } : upgrade;
	});
}
