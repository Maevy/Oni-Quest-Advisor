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
 * - faction availability from attributes.factions:
 *   - exactly one faction -> that faction's exclusive file
 *   - NEUTRAL-tagged (alone or combined) -> neutral.json, available to every faction
 *   - no factions (summoned/token creatures) -> skipped, listed below
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(join(root, 'data-import', 'units.json'), 'utf8'));
const characters = source.pageProps.characterList.data;

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

for (const entry of characters) {
	const attributes = entry.attributes;
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
	const unit = {
		id: attributes.code.toLowerCase().replace(/_/g, '-'),
		name: attributes.name,
		points: attributes.recruitment_cost,
		limit: attributes.limit,
		stats
	};
	if (isMount && Object.keys(statChanges).length > 0) {
		unit.statChanges = statChanges;
	}
	const mountCode = MOUNT_ASSIGNMENTS[attributes.code];
	if (mountCode) {
		const mountAttributes = characters.find(
			(candidate) => candidate.attributes.code === mountCode
		).attributes;
		unit.mount = {
			unitId: mountCode.toLowerCase().replace(/_/g, '-'),
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
if (skipped.length > 0) {
	console.log('skipped ' + skipped.length + ' units without factions (summons/tokens):');
	for (const entry of skipped) console.log(' - ' + entry);
}
