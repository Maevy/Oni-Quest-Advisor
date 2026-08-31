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

function kebab(code) {
	return code.toLowerCase().replace(/_/g, '-');
}

function normalize(text) {
	return (text ?? '').replace(/\s*\n\s*/g, ' ').trim();
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
	return code.charAt(0) + code.slice(1).toLowerCase();
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
if (skipped.length > 0) {
	console.log('skipped ' + skipped.length + ' units without factions (summons/tokens):');
	for (const entry of skipped) console.log(' - ' + entry);
}
