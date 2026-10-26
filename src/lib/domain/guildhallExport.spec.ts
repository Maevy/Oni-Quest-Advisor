import { describe, expect, it } from 'vitest';
import type { ArmyItemSpec, ArmyRosterRow, ArmyStats, ArmyUnitSpec, ArmyUpgradeSpec } from './army';
import {
	buildGuildhallArmy,
	GUILDHALL_ROSTER_CAP,
	GUILDHALL_STANDARD_CAP,
	GUILDHALL_STRUCTURE_VERSION,
	type GuildhallCatalog,
	type GuildhallExportInput,
	type Json
} from './guildhallExport';

const STAT_KEYS = ['STA', 'SPD', 'OFF', 'DEF', 'ACC', 'INT', 'AG', 'T', 'ARM', 'HP', 'M'] as const;

function stats(overrides: Partial<ArmyStats> = {}): ArmyStats {
	const base = {
		STA: 2,
		SPD: 6,
		OFF: 16,
		DEF: 13,
		ACC: 11,
		INT: 11,
		AG: 14,
		T: 12,
		ARM: 3,
		HP: 2,
		M: 12
	} as ArmyStats;
	return { ...base, ...overrides };
}

function unit(overrides: Partial<ArmyUnitSpec> = {}): ArmyUnitSpec {
	return {
		id: 'test-knight',
		producerId: 84,
		name: 'Test Knight',
		points: 23,
		limit: 1,
		stats: stats(),
		size: 'medium',
		classes: ['warrior'],
		...overrides
	} as ArmyUnitSpec;
}

function upgrade(overrides: Partial<ArmyUpgradeSpec> = {}): ArmyUpgradeSpec {
	return {
		id: 'devotion-anras-coalition-of-thenion',
		producerId: 28,
		name: 'Devotion: Anras',
		cost: 2,
		description: [],
		effects: [{ kind: 'stat', changes: { DEF: 1 } }],
		...overrides
	} as ArmyUpgradeSpec;
}

function item(overrides: Partial<ArmyItemSpec> = {}): ArmyItemSpec {
	return {
		id: 'mastercrafted-sword',
		producerId: 94,
		name: 'Mastercrafted Sword',
		category: 'weapon',
		effect: [],
		...overrides
	} as ArmyItemSpec;
}

function row(overrides: Partial<ArmyRosterRow> = {}): ArmyRosterRow {
	const baseUnit = unit();
	return {
		entryId: 'e1',
		unitId: baseUnit.id,
		name: baseUnit.name,
		points: baseUnit.points,
		mounted: false,
		effectiveStats: baseUnit.stats,
		effectiveSize: baseUnit.size,
		upgradedUnit: baseUnit,
		upgrades: [],
		itemOverrides: {},
		...overrides
	} as ArmyRosterRow;
}

/**
 * A producer character in their shape. Only the leaves the export touches need to be realistic;
 * the rest stands in for the description and image bulk we copy through untouched.
 */
function producerCharacter(overrides: Record<string, Json> = {}): Json {
	const statline: Record<string, Json> = { id: 84 };
	STAT_KEYS.forEach((key, index) => {
		statline[key] = { id: 600 + index, prefix: null, value: 1 };
	});
	return {
		id: 84,
		attributes: {
			name: 'Test Knight',
			code: 'TEST_KNIGHT',
			recruitment_cost: 23,
			// Stands in for the ~20KB of description and image metadata we must not disturb.
			bulk: 'verbatim-producer-payload',
			attributes: statline,
			size_info: { id: 84, size: 'Medium' },
			mount_character: { data: null },
			spellcrafts: [],
			traits: [],
			inventory: { id: 84, space: 4, items: [] },
			appliedArmyCharacterUpgrades: [],
			...overrides
		}
	} as Json;
}

function producerUpgrade(): Json {
	return {
		id: 28,
		attributes: { name: 'Devotion: Anras', code: 'DEVOTION_ANRAS', cost: 2 }
	} as Json;
}

function catalog(overrides: Partial<GuildhallCatalog> = {}): GuildhallCatalog {
	return {
		characters: { 84: producerCharacter(), 53: producerCharacter() },
		upgrades: { 28: producerUpgrade() },
		items: {
			94: { id: 94, attributes: { name: 'Mastercrafted Sword', code: 'MASTERCRAFTED_SWORD' } }
		},
		factions: {
			10: { id: 10, attributes: { name: 'Coalition of Thenion', code: 'COALITION_OF_THENION' } }
		},
		elements: {
			// Both entries mirror the producer's elementList, which nests every spell of the element.
			// `Elder` deliberately carries a `name` the base character's innate Elder does not, so an
			// assertion can tell which source an emitted element came from: inherited elements must
			// arrive without it, granted ones with the whole catalog object.
			Fire: { id: 3, attributes: { code: 'FIRE', name: 'Fire', spells: { data: [{ id: 44 }] } } },
			Elder: { id: 1, attributes: { code: 'ELDER', name: 'Elder' } }
		},
		...overrides
	};
}

function build(overrides: Partial<GuildhallExportInput> = {}) {
	const input: GuildhallExportInput = {
		rows: [row()],
		format: 'standard',
		catalog: catalog(),
		itemIndex: { 'mastercrafted-sword': item() },
		upgradeIndex: { 'devotion-anras-coalition-of-thenion': upgrade() },
		options: { armyName: 'Test Army', armyId: 1789401602244, factionProducerId: 10 },
		...overrides
	};
	const result = buildGuildhallArmy(input);
	if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.error)}`);
	return result.document as Record<string, Json>;
}

const charactersOf = (doc: Record<string, Json>) => doc.armyCharacterList as Record<string, Json>[];
const attrsOf = (entry: Record<string, Json>) => entry.attributes as Record<string, Json>;
const statValue = (entry: Record<string, Json>, key: string) => {
	const statline = attrsOf(entry).attributes as Record<string, Json>;
	return (statline[key] as Record<string, Json>).value;
};

describe('buildGuildhallArmy - document shell', () => {
	it('emits their top-level shape with the caps, version and injected identity', () => {
		const doc = build();
		expect(doc.armyName).toBe('Test Army');
		expect(doc.armyId).toBe(1789401602244);
		expect(doc.armyPts).toBe(GUILDHALL_STANDARD_CAP);
		expect(doc.rosterPts).toBe(GUILDHALL_ROSTER_CAP);
		expect(doc.config).toEqual({ meta: { structureVersion: GUILDHALL_STRUCTURE_VERSION } });
		expect(doc.faction).toEqual({
			id: 10,
			attributes: { name: 'Coalition of Thenion', code: 'COALITION_OF_THENION' }
		});
		expect(doc.bonuses).toEqual({ upgradesCostDecreaseValue: 0 });
	});

	it('maps our standard format onto their NORMAL mode with an empty roster', () => {
		const doc = build({ format: 'standard' });
		expect(doc.mode).toBe('NORMAL');
		expect(doc.roster).toEqual({ characterList: [], upgradeList: [] });
		expect(charactersOf(doc)).toHaveLength(1);
	});

	it('maps our roster format onto TOURNAMENT with an empty armyCharacterList', () => {
		const doc = build({
			format: 'roster',
			options: {
				armyName: 'Roster',
				armyId: 1,
				factionProducerId: 10,
				rosterUpgradeIds: ['devotion-anras-coalition-of-thenion']
			}
		});
		expect(doc.mode).toBe('TOURNAMENT');
		expect(doc.armyCharacterList).toEqual([]);
		const roster = doc.roster as Record<string, Json>;
		expect(roster.characterList).toHaveLength(1);
		expect(roster.upgradeList).toEqual([producerUpgrade()]);
	});

	it('repeats a roster upgrade once per copy rather than aggregating it', () => {
		const doc = build({
			format: 'roster',
			options: {
				armyName: 'Roster',
				armyId: 1,
				factionProducerId: 10,
				rosterUpgradeIds: [
					'devotion-anras-coalition-of-thenion',
					'devotion-anras-coalition-of-thenion'
				]
			}
		});
		const roster = doc.roster as Record<string, Json>;
		expect(roster.upgradeList).toEqual([producerUpgrade(), producerUpgrade()]);
	});
});

describe('buildGuildhallArmy - copies and mounts', () => {
	it('writes one array entry per copy, since copies duplicate where upgrades aggregate', () => {
		const doc = build({ rows: [row({ entryId: 'e1' }), row({ entryId: 'e2' })] });
		expect(charactersOf(doc)).toHaveLength(2);
	});

	it('emits a mounted copy as rider then mount, as two unlinked entries', () => {
		const mount = unit({ id: 'lupus-rex', producerId: 53, name: 'Lupus Rex' });
		const doc = build({
			rows: [
				row({
					mounted: true,
					mount,
					// The rider's own stats, deliberately not the combined effectiveStats.
					upgradedUnit: unit(),
					effectiveStats: stats({ SPD: 9 })
				})
			]
		});
		const entries = charactersOf(doc);
		expect(entries).toHaveLength(2);
		expect((entries[0].attributes as Record<string, Json>).code).toBe('TEST_KNIGHT');
		expect((attrsOf(entries[1]) as Record<string, Json>).code).toBe('TEST_KNIGHT');
		// Neither entry carries the mount's contribution: their app combines them at display time,
		// so writing effectiveStats here would double-count the mount.
		expect(statValue(entries[0], 'SPD')).toBe(6);
	});

	// The default fixture's mount already carries appliedArmyCharacterUpgrades, which is why the
	// rest of this suite missed it: the real Lupus Rex object has no such key, and only a round-trip
	// against Freecompany's own export showed that theirs adds `[]` to every standard-format
	// character, mounts included.
	const bareMount = () => {
		const mount = producerCharacter({ code: 'LUPUS_REX' }) as { attributes: Record<string, Json> };
		delete mount.attributes.appliedArmyCharacterUpgrades;
		return mount as unknown as Json;
	};
	const mountedRow = () => [
		row({ mounted: true, mount: unit({ id: 'lupus-rex', producerId: 53 }), upgradedUnit: unit() })
	];

	it('gives a mount entry the empty upgrade key their standard exports carry', () => {
		const doc = build({
			catalog: catalog({ characters: { 84: producerCharacter(), 53: bareMount() } }),
			rows: mountedRow()
		});
		const mountEntry = charactersOf(doc)[1];
		expect(attrsOf(mountEntry).code).toBe('LUPUS_REX');
		expect(attrsOf(mountEntry).appliedArmyCharacterUpgrades).toEqual([]);
	});

	it('omits that key on a mount entry in roster format, like every other roster unit', () => {
		const doc = build({
			format: 'roster',
			catalog: catalog({ characters: { 84: producerCharacter(), 53: bareMount() } }),
			rows: mountedRow()
		});
		const roster = doc.roster as Record<string, Json>;
		const entries = roster.characterList as Record<string, Json>[];
		expect(entries).toHaveLength(2);
		expect(Object.keys(attrsOf(entries[1]))).not.toContain('appliedArmyCharacterUpgrades');
	});
});

describe('buildGuildhallArmy - patching the verbatim producer object', () => {
	it('copies untouched fields through and changes only the stat values', () => {
		const doc = build({
			rows: [row({ upgradedUnit: unit({ stats: stats({ DEF: 9 }) }) })]
		});
		const entry = charactersOf(doc)[0];
		const attrs = attrsOf(entry);
		expect(attrs.bulk).toBe('verbatim-producer-payload');
		expect(attrs.code).toBe('TEST_KNIGHT');
		expect(attrs.mount_character).toEqual({ data: null });
		expect(statValue(entry, 'DEF')).toBe(9);
		// The per-stat producer row id survives; only `value` is ours.
		const statline = attrs.attributes as Record<string, Json>;
		expect((statline.DEF as Record<string, Json>).id).toBe(603);
		expect(statValue(entry, 'STA')).toBe(2);
	});

	it('bumps a spellcraft level without refreshing the stale name__ cache', () => {
		const withSpellcraft = producerCharacter({
			spellcrafts: [
				{
					id: 20,
					level: 3,
					name__: 'Art of Sorcery, lvl 3',
					spell_group: { data: { id: 16, attributes: { code: 'ART_OF_SORCERY' } } }
				}
			]
		});
		const doc = build({
			catalog: catalog({ characters: { 84: withSpellcraft, 53: producerCharacter() } }),
			rows: [
				row({
					upgradedUnit: unit({ spellcrafts: [{ id: 'art-of-sorcery', level: 4 }] })
				})
			]
		});
		const spellcrafts = attrsOf(charactersOf(doc)[0]).spellcrafts as Record<string, Json>[];
		expect(spellcrafts[0].level).toBe(4);
		expect(spellcrafts[0].name__).toBe('Art of Sorcery, lvl 3');
		expect(spellcrafts[0].id).toBe(20);
	});

	/** A character carrying one Affinity (Element) trait whose innate element is Elder. */
	const affinityCharacter = () =>
		producerCharacter({
			traits: [
				{
					id: 245,
					dynamic_value: null,
					name__: null,
					// The innate element as the character object carries it: no `spells`.
					dynamic_elements: { data: [{ id: 1, attributes: { code: 'ELDER' } }] },
					trait: {
						data: {
							id: 31,
							attributes: {
								level: 1,
								trait_group: { data: { id: 20, attributes: { code: 'AFFINITY__ELEMENT' } } }
							}
						}
					}
				}
			]
		});

	const affinityRows = (dynamicElements: string[]) => [
		row({
			upgradedUnit: unit({
				// Note the double hyphen: their code is AFFINITY__ELEMENT, and kebab() maps each
				// underscore to one hyphen, so collapsing repeats would miss it.
				traits: [{ id: 'affinity--element', level: 2, dynamicElements }]
			})
		})
	];

	it('keeps an inherited element verbatim and takes only a granted one from the catalog', () => {
		const doc = build({
			catalog: catalog({ characters: { 84: affinityCharacter(), 53: producerCharacter() } }),
			rows: affinityRows(['Elder', 'Fire'])
		});
		const traits = attrsOf(charactersOf(doc)[0]).traits as Record<string, Json>[];
		expect(traits[0].id).toBe(245);
		// Elder came with the model, so it is the base object untouched and has no `spells`. Fire was
		// granted, so it is the catalog element with `spells` intact - that is how their own builder
		// writes it. Academy Expeditioner after Elemental Lineage is [ELDER bare, WATER with 20].
		expect(traits[0].dynamic_elements).toEqual({
			data: [
				{ id: 1, attributes: { code: 'ELDER' } },
				{ id: 3, attributes: { code: 'FIRE', name: 'Fire', spells: { data: [{ id: 44 }] } } }
			]
		});
		const traitData = (traits[0].trait as Record<string, Json>).data as Record<string, Json>;
		expect((traitData.attributes as Record<string, Json>).level).toBe(2);
	});

	it('drops a replaced element and writes the new one from the catalog', () => {
		const doc = build({
			catalog: catalog({ characters: { 84: affinityCharacter(), 53: producerCharacter() } }),
			rows: affinityRows(['Fire'])
		});
		const traits = attrsOf(charactersOf(doc)[0]).traits as Record<string, Json>[];
		// Mana Catalyst replaces rather than appends, so the inherited Elder is gone and Earth-or-here
		// Fire arrives full size from elementList.
		expect(traits[0].dynamic_elements).toEqual({
			data: [{ id: 3, attributes: { code: 'FIRE', name: 'Fire', spells: { data: [{ id: 44 }] } } }]
		});
	});

	it('keeps an existing inventory row id and patches its QTY', () => {
		const withItem = producerCharacter({
			inventory: {
				id: 84,
				space: 4,
				items: [
					{
						id: 129,
						QTY: 1,
						name__: 'Mastercrafted Sword, QTY 1',
						item: { data: { id: 94, attributes: { code: 'MASTERCRAFTED_SWORD' } } }
					}
				]
			}
		});
		const doc = build({
			catalog: catalog({ characters: { 84: withItem, 53: producerCharacter() } }),
			rows: [
				row({
					upgradedUnit: unit({
						inventorySpace: 4,
						inventory: [{ id: 'mastercrafted-sword', qty: 2 }]
					})
				})
			]
		});
		const inventory = attrsOf(charactersOf(doc)[0]).inventory as Record<string, Json>;
		const items = inventory.items as Record<string, Json>[];
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe(129);
		expect(items[0].QTY).toBe(2);
		expect(items[0].name__).toBe('Mastercrafted Sword, QTY 1');
	});

	it('writes an upgrade-granted item bare, with no join-row id', () => {
		const doc = build({
			rows: [
				row({
					upgradedUnit: unit({ inventory: [{ id: 'mastercrafted-sword', qty: 1 }] })
				})
			]
		});
		const inventory = attrsOf(charactersOf(doc)[0]).inventory as Record<string, Json>;
		const items = inventory.items as Record<string, Json>[];
		expect(items).toEqual([
			{
				item: {
					data: { id: 94, attributes: { name: 'Mastercrafted Sword', code: 'MASTERCRAFTED_SWORD' } }
				},
				QTY: 1
			}
		]);
		expect(items[0].id).toBeUndefined();
		expect(items[0].name__).toBeUndefined();
	});
});

describe('buildGuildhallArmy - upgrades', () => {
	it('aggregates repeated upgrades into one entry with a QTY, and omits the outer id', () => {
		const picked = [upgrade(), upgrade()];
		const doc = build({ rows: [row({ upgrades: picked })] });
		const applied = attrsOf(charactersOf(doc)[0]).appliedArmyCharacterUpgrades as Record<
			string,
			Json
		>[];
		expect(applied).toEqual([{ upgrade: producerUpgrade(), QTY: 2 }]);
		expect(Object.keys(applied[0])).toEqual(['upgrade', 'QTY']);
	});

	it('writes an empty array when nothing is picked, matching their standard-format exports', () => {
		const doc = build();
		expect(attrsOf(charactersOf(doc)[0]).appliedArmyCharacterUpgrades).toEqual([]);
	});

	it('omits the key entirely for roster units rather than writing an empty array', () => {
		const doc = build({ format: 'roster', rows: [row({ upgrades: [upgrade()] })] });
		const roster = doc.roster as Record<string, Json>;
		const entry = (roster.characterList as Record<string, Json>[])[0];
		expect(Object.keys(attrsOf(entry))).not.toContain('appliedArmyCharacterUpgrades');
	});

	it('sets the army-wide cost-reduction bonus when a Devotion: Paimon is picked', () => {
		const paimon = upgrade({
			id: 'devotion-paimon-coalition-of-thenion',
			producerId: 28,
			effects: [{ kind: 'costReduction', amount: 1 }]
		});
		const doc = build({ rows: [row({ upgrades: [paimon] })] });
		expect(doc.bonuses).toEqual({ upgradesCostDecreaseValue: 1 });
	});
});

describe('buildGuildhallArmy - refusing rather than guessing', () => {
	it('refuses a unit whose producer row is not in the catalog', () => {
		const result = buildGuildhallArmy({
			rows: [row({ upgradedUnit: unit({ producerId: 999 }) })],
			format: 'standard',
			catalog: catalog(),
			itemIndex: {},
			upgradeIndex: {},
			options: { armyName: 'x', armyId: 1, factionProducerId: 10 }
		});
		expect(result).toEqual({ ok: false, error: { kind: 'unknown-unit', unitId: 'test-knight' } });
	});

	it('refuses a unit with no producer id at all', () => {
		const result = buildGuildhallArmy({
			rows: [row({ upgradedUnit: unit({ producerId: undefined }) })],
			format: 'standard',
			catalog: catalog(),
			itemIndex: {},
			upgradeIndex: {},
			options: { armyName: 'x', armyId: 1, factionProducerId: 10 }
		});
		expect(result).toEqual({ ok: false, error: { kind: 'unknown-unit', unitId: 'test-knight' } });
	});

	it('refuses an unknown faction rather than emitting a null one', () => {
		const result = buildGuildhallArmy({
			rows: [row()],
			format: 'standard',
			catalog: catalog(),
			itemIndex: {},
			upgradeIndex: {},
			options: { armyName: 'x', armyId: 1, factionProducerId: 404 }
		});
		expect(result).toEqual({ ok: false, error: { kind: 'missing-faction' } });
	});

	it('refuses a trait the base model does not have, since emitting it needs their trait catalog', () => {
		const result = buildGuildhallArmy({
			rows: [row({ upgradedUnit: unit({ traits: [{ id: 'granted-trait', level: 1 }] }) })],
			format: 'standard',
			catalog: catalog(),
			itemIndex: {},
			upgradeIndex: {},
			options: { armyName: 'x', armyId: 1, factionProducerId: 10 }
		});
		expect(result).toEqual({
			ok: false,
			error: { kind: 'granted-trait', traitId: 'granted-trait' }
		});
	});

	it('refuses an inventory item it cannot resolve to a producer row', () => {
		const result = buildGuildhallArmy({
			rows: [row({ upgradedUnit: unit({ inventory: [{ id: 'missing-item', qty: 1 }] }) })],
			format: 'standard',
			catalog: catalog(),
			itemIndex: { 'missing-item': item({ id: 'missing-item', producerId: 777 }) },
			upgradeIndex: {},
			options: { armyName: 'x', armyId: 1, factionProducerId: 10 }
		});
		expect(result).toEqual({ ok: false, error: { kind: 'unknown-item', itemId: 'missing-item' } });
	});

	it('does not mutate the catalog it was handed', () => {
		const shared = catalog();
		const before = JSON.stringify(shared);
		build({
			catalog: shared,
			rows: [row({ upgradedUnit: unit({ stats: stats({ DEF: 99 }) }), upgrades: [upgrade()] })]
		});
		expect(JSON.stringify(shared)).toBe(before);
	});
});
