/**
 * Imports the producer's unit export into our per-faction content files.
 *
 * Workflow: drop their latest export into data-import/units.json, run
 * `node scripts/importUnits.mjs`, review the diff, commit.
 *
 * Mapping (v1):
 * - id     <- attributes.code, kebab-cased
 * - name   <- attributes.name
 * - points <- attributes.recruitment_cost
 * - limit  <- attributes.limit (max copies per army)
 * - stats  <- attributes.attributes.<KEY>.value (null when the model has none).
 *   For mounts, values with a '+' prefix or negative values move into statChanges
 *   (additive bonuses/maluses); the remaining values are stat overrides.
 * - mount  <- MOUNT_ASSIGNMENTS below (rider -> mount; the producer dump leaves
 *   mount_character empty, so this pairing is our game-rule knowledge). Mount units
 *   (MOUNT_CODES) are written to mounts.json instead of the recruitable roster.
 * - classes <- classList, written to classes.json; each unit keeps only the class ids.
 * - skills  <- skillGroupList, written to skills.json; units keep { id, level }.
 * - traits  <- traitGroupList, written to traits.json (template texts with
 *   (X)/(Element) placeholders for the parameterized groups); units keep
 *   { id, level } plus their dynamic value/elements, which fill the
 *   placeholders at display time.
 * - combatArts <- combatArtGroupList, written to combat-arts.json; units keep
 *   { id, level }, the level being the highest one the unit has access to.
 * - spellcrafts <- spellGroupList, written to spellcrafts.json (group id +
 *   name); the groups' spells go to spells.json with element/level/effect and
 *   the parsed PW/type/RCH/STK columns. Units keep { id, level } refs; access
 *   at display time is group + level + the unit's Affinity elements.
 * - stratagems <- strategmList, written to stratagems.json (name, type and
 *   effect; ids are slugified names because a third of the entries has no
 *   code). Character references are matched by name - only 20 of 63 units
 *   carry stratagems, so units keep plain id arrays (empty ones omitted).
 * - items <- itemList, written to items.json: PW becomes a toughness stat
 *   (T is a statline key, with modifiers, or a fixed value), RCH becomes
 *   structured range brackets (+ an AoE template and a raw-text fallback for
 *   oddities like the Sealing Javelins' reach), STK mirrors the spell column,
 *   effect keeps its rich links. Characters carry inventorySpace plus
 *   inventory slots ({ id, qty }); the QTY lives on the slot, everything
 *   else on the item. The Imported Casting Amplifier upgrade grants an item
 *   that is missing from the producer catalog, so a synthetic copy is added.
 * - upgrades <- upgradeList, written to upgrades.json: cost, per-army limit,
 *   faction (neutral when absent), rich-text description, a class requirement
 *   parsed from 'Only a ...' descriptions and curated mechanical effects
 *   (UPGRADE_EFFECTS) - choices and conditional rules stay in the text.
 *   Ids are kebab(code), suffixed with the faction id because
 *   Seasoned Combatant exists twice (Helian and Soga).
 * Skill/trait/combat-art entries carry the catalog's rule text per level in a
 * `levels` map (groups without per-level entries fall back to `description`).
 * Rules texts (class/skill/trait) are stored as segments; cross-references like
 * `(Knockdown)[trait.KNOCKDOWN]` become link segments, mid-sentence line breaks
 * are normalized to spaces. The catalogs are written in full - they also hold
 * the condition traits (Knockdown, Bleeding, ...) that rules texts link to.
 * - faction availability from attributes.factions:
 *   - exactly one faction -> that faction's exclusive file
 *   - NEUTRAL-tagged (alone or combined) -> neutral.json, available to every faction
 *   - no factions (summoned/token creatures) -> skipped, listed below
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dump = JSON.parse(readFileSync(join(root, 'data-import', 'units.json'), 'utf8'));
const pageProps = dump.pageProps;
const characters = pageProps.characterList.data;

const STAT_KEYS = ['STA', 'SPD', 'OFF', 'DEF', 'ACC', 'INT', 'AG', 'T', 'ARM', 'HP', 'M'];

const FACTIONS = {
	HELIAN_LEAGUE: 'helian-league',
	COALITION_OF_THENION: 'coalition-of-thenion',
	SAND_KINGDOMS: 'sand-kingdoms',
	EMPIRE_OF_SOGA: 'empire-of-soga',
	ONI_CLANS: 'oni-clans',
	GOBLIN_WARTRIBES: 'goblin-wartribes',
	ADVENTURERS_GUILD: 'adventurers-guild'
};

const buckets = Object.fromEntries(
	[...Object.values(FACTIONS), 'neutral', 'mounts'].map((key) => [key, []])
);
const skipped = [];

/** Mount units: never recruitable standalone, they belong under a rider. */
const MOUNT_CODES = new Set(['LUPUS_REX']);

/** Rider code -> mount code; mount cost is the mount's own recruitment_cost. */
const MOUNT_ASSIGNMENTS = { SLAYER_DRAGON: 'LUPUS_REX' };

/** Units that can never receive upgrades (rulebook exception list). */
const UPGRADE_LOCKED_CODES = new Set([
	'TOMOE',
	'KOGETSU',
	'SEIGEN',
	'THAROS',
	'ANARI',
	'NARA',
	'CHIYOHIME',
	'CHANRE'
]);

/**
 * The mechanical effects an upgrade applies, curated per upgrade code. Only
 * well-defined effects are automated (stat boosts, trait/skill/class/combat
 * art grants, item grants, primary weapon replacement, pouch, stratagems);
 * choices and conditional rules stay in the description for the player.
 * 'spellcraftLevelUp' carries no automatic change - the player picks which
 * spellcraft advances - but it feeds the max-level warning in the picker.
 */
const UPGRADE_EFFECTS = {
	// Helian League
	ADEPT_SHAPER: [{ kind: 'spellcraftLevelUp' }],
	GLYPHSCRIBE_REDUCE_WEIGHT: [],
	SEASONED_COMBATANT: [{ kind: 'trait', traitId: 'fearless', level: 1 }],
	COMPANION_OF_HAIRON: [],
	TACTICAL_EXPERTISE: [{ kind: 'trait', traitId: 'tactician', level: 1 }],
	GIFT_OF_LONGEVITY: [{ kind: 'stat', changes: { INT: 1 } }],
	EXPEDITIONARY_TACTICS_DOUBLE_TIME: [],
	GLYPHSCRIBE_HYPERIAS_PROVIDENCE: [],
	EXPEDITIONARY_TACTICS_SURGE_ORDER: [],
	// Empire of Soga
	BUJUTSU_EXPERTISE: [
		{ kind: 'class', classId: 'armsmaster' },
		{ kind: 'combatArt', artId: 'fencing', level: 1 }
	],
	KASSEN_BUKI_KANABOU_TSUKAI: [{ kind: 'replacePrimaryWeapon', itemId: 'heavy-bludgeon' }],
	KASSEN_BUKI_DAIKYUU_TSUKAI: [{ kind: 'replacePrimaryWeapon', itemId: 'war-bow' }],
	KASSEN_BUKI_YARI_TSUKAI: [{ kind: 'replacePrimaryWeapon', itemId: 'lance' }],
	LUCKY_CHARM: [],
	TRAVELING_DUELIST: [{ kind: 'trait', traitId: 'duelist', level: 1 }],
	KYUJUTSU_EXPERTISE: [
		{ kind: 'class', classId: 'marksman' },
		{ kind: 'combatArt', artId: 'archery', level: 1 }
	],
	KASSEN_BUKI_NAGAMAKI_TSUKAI: [{ kind: 'replacePrimaryWeapon', itemId: 'longhilted-sword' }],
	// Coalition of Thenion
	DEVOTION_ANRAS: [
		{
			kind: 'stat',
			changes: { DEF: 1 },
			insteadIfTrait: { traitId: 'duelist', changes: { DEF: 2 } }
		}
	],
	CLIMBING_EXPERTISE: [{ kind: 'skill', skillId: 'climbing', level: 1 }],
	MUFFLED_MOVEMENT: [{ kind: 'skill', skillId: 'stealth', level: 1 }],
	CONCEALED_APPROACH: [],
	FANGS_OF_TIAMAT: [{ kind: 'item', itemId: 'war-darts' }],
	DEVOTION_TIAMAT: [
		{
			kind: 'stat',
			changes: { T: 1 },
			extraIfClasses: { classIds: ['warrior', 'rogue'], changes: { OFF: 1 } }
		}
	],
	POISONED_WEAPONS: [{ kind: 'trait', traitId: 'poison', level: 1 }],
	DEVOTION_PAIMON: [
		{ kind: 'stat', changes: { INT: 1 } },
		{ kind: 'costReduction', amount: 1 }
	],
	// Sand Kingdoms
	MANA_CATALYST: [],
	ELEMENTAL_LINEAGE: [],
	FLYING_CARPET: [{ kind: 'item', itemId: 'flying-carpet' }],
	PERSONAL_GUARD: [],
	ARCANE_TOME: [{ kind: 'spellcraftLevelUp' }],
	CASTING_AMPLIFIER: [{ kind: 'item', itemId: 'casting-amplifier' }],
	CONJURED_RETINUE: [],
	// Neutral
	ADDITIONAL_PROTECTION: [{ kind: 'stat', changes: { ARM: 2, AG: -2 } }],
	POUCH: [{ kind: 'pouch' }],
	IMPORTED_CROSSBOW: [{ kind: 'item', itemId: 'crossbow' }],
	UTILITY_TOOL: [{ kind: 'item', itemId: 'dagger' }],
	IMPORTED_CASTING_AMPLIFIER: [{ kind: 'item', itemId: 'imported-casting-amplifier' }],
	KING_OF_THE_BATTLEFIELD: [{ kind: 'item', itemId: 'spear' }],
	CAMARADERIE: [],
	SMOKESCREEN: [{ kind: 'item', itemId: 'haze-bomb' }],
	FIRST_AID: [],
	JOURNEYMAN_ADVENTURER: [
		{ kind: 'trait', traitId: 'resourceful', level: 2 },
		{ kind: 'trait', traitId: 'survival--x-environment', level: 1, dynamicValue: 'Difficult' }
	],
	EXPEDITION_LEADER: [{ kind: 'stratagem', stratagemIds: ['advance', 'back-to-back'] }],
	// Raid Leader's stratagems are not in the producer catalog - text only.
	RAID_LEADER: []
};

/**
 * Requirements live in the description: 'Only a (Warrior)[class.WARRIOR] can
 * receive ...' (needs the class) and 'Cannot be assigned to a model with the
 * (Demon)[trait.DEMON] Trait' (forbidden trait). Parses both patterns.
 */
function parseUpgradeRequirement(description) {
	const classMatch = description.match(/^Only a (?:model of the )?\([^)]*\)\[class\.([A-Z_]+)\]/i);
	const forbiddenMatches = [
		...description.matchAll(
			/\bCannot be assigned to a model with the \([^)]*\)\[trait\.([A-Z_]+)/gi
		)
	];
	const requirement = {};
	if (classMatch) requirement.classes = [kebab(classMatch[1])];
	if (forbiddenMatches.length > 0) {
		requirement.notTraits = [...new Set(forbiddenMatches.map((match) => kebab(match[1])))];
	}
	return Object.keys(requirement).length > 0 ? requirement : undefined;
}

function kebab(code) {
	return code.toLowerCase().replace(/_/g, '-');
}

/** Id from a display name (spells have no code): lowercase, words to dashes. */
function slug(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function normalize(text) {
	return (text ?? '')
		.replace(/\s*\n\s*/g, ' ')
		.replace(/ {2,}/g, ' ')
		.trim();
}

/** Rich-text segments; `(Knockdown)[trait.KNOCKDOWN]` becomes a link segment. */
function richText(text) {
	const normalized = normalize(text);
	const segments = [];
	let last = 0;
	const linkPattern = /\(([^()]*)\)\[([A-Za-z_-]+)\.([A-Z0-9_]+)(?:\.\d+)?\]/g;
	for (const match of normalized.matchAll(linkPattern)) {
		if (match.index > last) segments.push({ text: normalized.slice(last, match.index) });
		segments.push({
			text: match[1],
			link: { type: match[2].toLowerCase(), id: kebab(match[3]) }
		});
		last = match.index + match[0].length;
	}
	if (last < normalized.length) segments.push({ text: normalized.slice(last) });
	return segments;
}

/** One entry per class from the producer's class catalog. */
function buildClassEntries() {
	return pageProps.classList.data
		.map((wrapper) => {
			const classAttributes = wrapper.attributes;
			return {
				id: kebab(classAttributes.code),
				name: classAttributes.name,
				description: richText(classAttributes.description)
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * One entry per group from a skill/trait/combat-art catalog: the catalog's
 * rule text for every level that has one. Groups without per-level entries
 * fall back to the group description.
 */
function buildCatalogEntries(list, levelKey) {
	const entries = [];
	for (const wrapper of list) {
		const group = wrapper.attributes;
		const levels = {};
		for (const levelEntry of group[levelKey]?.data ?? []) {
			const text = levelEntry.attributes.description;
			if (text) levels[levelEntry.attributes.level] = richText(text);
		}
		const entry = { id: kebab(group.code), name: group.name };
		if (Object.keys(levels).length > 0) entry.levels = levels;
		else entry.description = richText(group.description);
		entries.push(entry);
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));
	return entries;
}

function titleCase(code) {
	return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

/**
 * Parses a PW/STK cell: fixed text ('8', '-', 'x', '5 in Active, ...') or a
 * character stat with an optional modifier ('Int', 'Int -3', 'Int+2', 'STA',
 * and the item toughness column 'T', which is a statline key itself).
 */
function parseCost(raw) {
	if (raw === null || raw === undefined) return undefined;
	const trimmed = String(raw).trim();
	if (trimmed === '') return undefined;
	if (/^\d+$/.test(trimmed)) return { fixed: trimmed };
	const statMatch = trimmed.match(/^([A-Za-z]+)\s*(?:([+-])\s*(\d+))?$/);
	if (statMatch && STAT_KEYS.includes(statMatch[1].toUpperCase())) {
		const cost = { stat: statMatch[1].toUpperCase() };
		if (statMatch[2]) cost.modifier = (statMatch[2] === '-' ? -1 : 1) * Number(statMatch[3]);
		return cost;
	}
	return { fixed: trimmed };
}

/**
 * Parses an item RCH cell into structured range brackets: `0-20'': 0` or the
 * multi-line `0-24: 0\n25-48: -6` variants become { range, modifier } pairs
 * (inches sign normalized), `AOE: Spray L` templates and leftover raw text
 * (the Sealing Javelins' reach `T`) are kept separately.
 */
function parseReach(raw) {
	if (raw === null || raw === undefined) return undefined;
	const text = String(raw).trim();
	if (text === '' || text === '-') return undefined;
	const reach = { brackets: [] };
	for (const line of text.split('\n')) {
		let rest = line;
		const aoeMatch = rest.match(/\bAOE\s*:\s*(.+)$/i);
		if (aoeMatch) {
			reach.aoe = normalize(aoeMatch[1]);
			rest = rest.slice(0, aoeMatch.index).replace(/[,;\s]+$/, '');
		}
		rest = rest.trim();
		if (!rest) continue;
		const bracket = rest.match(/^(\d+)\s*[-–]\s*(\d+)\s*[’'"“”]*\s*:\s*([+-]?\d+)$/);
		if (bracket) {
			reach.brackets.push({
				range: bracket[1] + '-' + bracket[2] + '"',
				modifier: Number(bracket[3])
			});
			continue;
		}
		if (/^\d+$/.test(rest)) {
			reach.brackets.push({ range: rest, modifier: 0 });
			continue;
		}
		reach.text = reach.text ? reach.text + ', ' + rest : rest;
	}
	if (reach.brackets.length === 0 && !reach.aoe && !reach.text) return undefined;
	return reach;
}

/** Display type of a spell: categories comma-separated, pipe, attack mode. */
function spellType(spell) {
	const categories = (spell.category_info ?? []).map((info) => titleCase(info.category));
	categories.sort((a, b) => (a === 'Spell' ? -1 : b === 'Spell' ? 1 : a.localeCompare(b)));
	const mode = spell.attack_mode?.mode;
	const modeText =
		mode === 'MELEE_AND_RANGED'
			? 'Melee & Ranged'
			: mode
				? titleCase(mode.toLowerCase())
				: undefined;
	const parts = [];
	if (categories.length > 0) parts.push(categories.join(', '));
	if (modeText) parts.push(modeText);
	return parts.length > 0 ? parts.join(' | ') : undefined;
}

for (const character of characters) {
	const attributes = character.attributes;
	const codes = attributes.factions.data.map((faction) => faction.attributes.code);
	const isMount = MOUNT_CODES.has(attributes.code);
	const stats = {};
	const statChanges = {};
	for (const key of STAT_KEYS) {
		const stat = attributes.attributes[key];
		const value = stat.value ?? null;
		const isChange = stat.prefix === '+' || (typeof value === 'number' && value < 0);
		if (isMount && isChange) {
			stats[key] = null;
			if (value !== null) statChanges[key] = value;
		} else {
			stats[key] = value;
		}
	}
	const skillRefs = (attributes.skills?.data ?? [])
		.map((wrapper) => wrapper.attributes)
		.filter((skillAttributes) => skillAttributes?.skill_group?.data?.attributes)
		.map((skillAttributes) => ({
			id: kebab(skillAttributes.skill_group.data.attributes.code),
			level: skillAttributes.level
		}))
		.sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
	const combatArtRefs = (attributes.combat_arts?.data ?? [])
		.map((wrapper) => wrapper.attributes)
		.filter((artAttributes) => artAttributes?.combat_art_group?.data?.attributes)
		.map((artAttributes) => ({
			id: kebab(artAttributes.combat_art_group.data.attributes.code),
			level: artAttributes.level
		}))
		.sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
	const spellcraftRefs = (attributes.spellcrafts ?? [])
		.filter((craft) => craft.spell_group?.data?.attributes)
		.map((craft) => ({
			id: kebab(craft.spell_group.data.attributes.code),
			level: craft.level
		}))
		.sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
	const stratagemIds = [
		...new Set(
			(attributes.stratagems?.data ?? [])
				.map((wrapper) => wrapper.attributes)
				.filter((stratagem) => stratagem?.name)
				.map((stratagem) => slug(stratagem.name))
		)
	].sort();
	const inventoryRows = (attributes.inventory?.items ?? []).filter(
		(row) => row.item?.data?.attributes?.code
	);
	const traitRefs = [];
	for (const traitEntry of attributes.traits ?? []) {
		const traitAttributes = traitEntry.trait?.data?.attributes;
		const group = traitAttributes?.trait_group?.data?.attributes;
		if (!traitAttributes || !group) continue;
		const ref = { id: kebab(group.code), level: traitAttributes.level };
		if (traitEntry.dynamic_value) ref.dynamicValue = traitEntry.dynamic_value;
		const elements = (traitEntry.dynamic_elements?.data ?? []).map((element) =>
			titleCase(element.attributes.code)
		);
		if (elements.length > 0) ref.dynamicElements = elements;
		traitRefs.push(ref);
	}
	traitRefs.sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
	const unit = {
		id: kebab(attributes.code),
		name: attributes.name,
		points: attributes.recruitment_cost,
		limit: attributes.limit,
		classes: (attributes.classes?.data ?? []).map((classEntry) =>
			kebab(classEntry.attributes.code)
		),
		stats
	};
	if (skillRefs.length > 0) unit.skills = skillRefs;
	if (traitRefs.length > 0) unit.traits = traitRefs;
	if (combatArtRefs.length > 0) unit.combatArts = combatArtRefs;
	if (spellcraftRefs.length > 0) unit.spellcrafts = spellcraftRefs;
	if (stratagemIds.length > 0) unit.stratagems = stratagemIds;
	if (inventoryRows.length > 0) {
		if (typeof attributes.inventory.space === 'number') {
			unit.inventorySpace = attributes.inventory.space;
		}
		unit.inventory = inventoryRows.map((row) => ({
			id: kebab(row.item.data.attributes.code),
			qty: row.QTY ?? 1
		}));
	}
	if (UPGRADE_LOCKED_CODES.has(attributes.code)) {
		unit.upgradesLocked = true;
	}
	if (isMount && Object.keys(statChanges).length > 0) {
		unit.statChanges = statChanges;
	}
	const mountCode = MOUNT_ASSIGNMENTS[attributes.code];
	if (mountCode) {
		const mountAttributes = characters.find(
			(candidate) => candidate.attributes.code === mountCode
		).attributes;
		unit.mount = {
			unitId: kebab(mountCode),
			points: mountAttributes.recruitment_cost
		};
	}
	if (MOUNT_CODES.has(attributes.code)) {
		buckets.mounts.push(unit);
	} else if (codes.includes('NEUTRAL')) {
		buckets.neutral.push(unit);
	} else if (codes.length === 1 && FACTIONS[codes[0]]) {
		buckets[FACTIONS[codes[0]]].push(unit);
	} else {
		skipped.push(attributes.code + ' (' + (codes.join(', ') || 'no factions') + ')');
	}
}

const outDir = join(root, 'src', 'lib', 'data', 'content', 'units');
mkdirSync(outDir, { recursive: true });
for (const [key, units] of Object.entries(buckets)) {
	units.sort((a, b) => a.name.localeCompare(b.name));
	writeFileSync(join(outDir, key + '.json'), JSON.stringify(units, null, '\t') + '\n');
	console.log(key + ': ' + units.length + ' units');
}
const classes = buildClassEntries();
writeFileSync(join(outDir, 'classes.json'), JSON.stringify(classes, null, '\t') + '\n');
console.log('classes: ' + classes.length + ' classes');
const skills = buildCatalogEntries(pageProps.skillGroupList.data, 'skills');
writeFileSync(join(outDir, 'skills.json'), JSON.stringify(skills, null, '\t') + '\n');
console.log('skills: ' + skills.length + ' skills');
const traits = buildCatalogEntries(pageProps.traitGroupList.data, 'traits');
writeFileSync(join(outDir, 'traits.json'), JSON.stringify(traits, null, '\t') + '\n');
console.log('traits: ' + traits.length + ' traits');
const combatArts = buildCatalogEntries(pageProps.combatArtGroupList.data, 'combat_arts');
writeFileSync(join(outDir, 'combat-arts.json'), JSON.stringify(combatArts, null, '\t') + '\n');
console.log('combat arts: ' + combatArts.length + ' combat arts');
const spellcrafts = pageProps.spellGroupList.data
	.map((wrapper) => ({ id: kebab(wrapper.attributes.code), name: wrapper.attributes.name }))
	.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'spellcrafts.json'), JSON.stringify(spellcrafts, null, '\t') + '\n');
console.log('spellcrafts: ' + spellcrafts.length + ' spellcrafts');
const spells = [];
for (const group of pageProps.spellGroupList.data) {
	for (const wrapper of group.attributes.spells?.data ?? []) {
		const spell = wrapper.attributes;
		const entry = {
			id: slug(spell.name),
			name: spell.name,
			group: kebab(group.attributes.code),
			element: (spell.element?.data?.attributes?.code ?? '').toLowerCase(),
			level: spell.level,
			effect: richText(spell.effect)
		};
		const pw = parseCost(spell.PW);
		if (pw) entry.pw = pw;
		const type = spellType(spell);
		if (type) entry.type = type;
		const rch = normalize(spell.RCH);
		if (rch) entry.rch = rch;
		const stk = parseCost(spell.STK);
		if (stk) entry.stk = stk;
		spells.push(entry);
	}
}
// The same spell name can sit in two groups (Flare, Inferno, ...): keep ids
// unique by appending the group where the name alone collides.
const idCounts = new Map();
for (const spell of spells) idCounts.set(spell.id, (idCounts.get(spell.id) ?? 0) + 1);
for (const spell of spells) {
	if (idCounts.get(spell.id) > 1) spell.id = spell.id + '-' + spell.group;
}
spells.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'spells.json'), JSON.stringify(spells, null, '\t') + '\n');
console.log('spells: ' + spells.length + ' spells');
const stratagems = pageProps.strategmList.data
	.map((wrapper) => {
		const stratagem = wrapper.attributes;
		return {
			id: slug(stratagem.name),
			name: normalize(stratagem.name),
			type: stratagem.type.toLowerCase(),
			effect: richText(stratagem.effect)
		};
	})
	.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'stratagems.json'), JSON.stringify(stratagems, null, '\t') + '\n');
console.log('stratagems: ' + stratagems.length + ' stratagems');
const items = pageProps.itemList.data.map((wrapper) => {
	const item = wrapper.attributes;
	const entry = {
		id: kebab(item.code),
		name: normalize(item.name),
		category: item.category.toLowerCase()
	};
	if (item.attack_mode?.mode) entry.mode = kebab(item.attack_mode.mode);
	const toughness = parseCost(item.PW);
	if (toughness && toughness.fixed !== '-') entry.toughness = toughness;
	const reach = parseReach(item.RCH);
	if (reach) entry.reach = reach;
	const stk = parseCost(item.STK);
	if (stk && stk.fixed !== '-') entry.stk = stk;
	entry.effect =
		item.effect && item.effect.trim() !== '' && item.effect.trim() !== '/'
			? richText(item.effect)
			: [];
	if (item.WGT !== null && item.WGT !== undefined) entry.weight = item.WGT;
	return entry;
});
// The Imported Casting Amplifier upgrade hands out an item that is not part of
// the producer catalog; it mirrors the catalog's Casting Amplifier shape.
items.push({
	id: 'imported-casting-amplifier',
	name: 'Imported Casting Amplifier',
	category: 'accessory',
	mode: 'melee',
	effect: richText("The upgraded model's Spells have +4 RCH."),
	weight: 0
});
items.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'items.json'), JSON.stringify(items, null, '\t') + '\n');
console.log('items: ' + items.length + ' items');
const upgrades = pageProps.upgradeList.data
	.map((wrapper) => {
		const upgrade = wrapper.attributes;
		const factionCode = upgrade.faction?.data?.attributes?.code;
		const factionId = factionCode ? FACTIONS[factionCode] : undefined;
		const entry = {
			id: kebab(upgrade.code) + (factionId ? '-' + factionId : ''),
			name: normalize(upgrade.name),
			cost: upgrade.cost,
			factionId
		};
		if (upgrade.limit !== null && upgrade.limit !== undefined) entry.limit = upgrade.limit;
		const requirement = parseUpgradeRequirement(upgrade.description);
		if (requirement) entry.requirement = requirement;
		entry.description = richText(upgrade.description);
		entry.effects = UPGRADE_EFFECTS[upgrade.code] ?? [];
		return entry;
	})
	.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'upgrades.json'), JSON.stringify(upgrades, null, '\t') + '\n');
console.log('upgrades: ' + upgrades.length + ' upgrades');
const unmapped = pageProps.upgradeList.data
	.map((wrapper) => wrapper.attributes.code)
	.filter((code) => !(code in UPGRADE_EFFECTS));
if (unmapped.length > 0) {
	console.log('WARNING: upgrades without curated effects: ' + unmapped.join(', '));
}
if (skipped.length > 0) {
	console.log('skipped ' + skipped.length + ' units without factions (summons/tokens):');
	for (const entry of skipped) console.log(' - ' + entry);
}
