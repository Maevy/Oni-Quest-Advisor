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

const FACTIONS = {
	HELIAN_LEAGUE: 'helian-league',
	COALITION_OF_THENION: 'coalition-of-thenion',
	SAND_KINGDOMS: 'sand-kingdoms',
	EMPIRE_OF_SOGA: 'empire-of-soga',
	ONI_CLANS: 'oni-clans',
	GOBLIN_WARTRIBES: 'goblin-wartribes',
	ADVENTURERS_GUILD: 'adventurers-guild'
};

const buckets = Object.fromEntries([...Object.values(FACTIONS), 'neutral'].map((key) => [key, []]));
const skipped = [];

for (const entry of characters) {
	const attributes = entry.attributes;
	const codes = attributes.factions.data.map((faction) => faction.attributes.code);
	const unit = {
		id: attributes.code.toLowerCase().replace(/_/g, '-'),
		name: attributes.name,
		points: attributes.recruitment_cost,
		limit: attributes.limit
	};
	if (codes.includes('NEUTRAL')) {
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
