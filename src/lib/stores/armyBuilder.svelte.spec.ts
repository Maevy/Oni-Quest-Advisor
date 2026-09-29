import { beforeAll, describe, expect, it } from 'vitest';
import { ARMY_FORMAT_POINTS, type ArmyFactionId } from '$lib/domain';
import { armyBuilderStore } from './armyBuilder.svelte';
import { contentStore } from './content.svelte';

beforeAll(async () => {
	await contentStore.loadArmy();
});

type Roster = {
	factionId: ArmyFactionId;
	/** A unit the roster holds twice, one copy of them mounted. */
	mountedUnitId: string;
	/** A unit the roster holds three times, none of them mounted. */
	plainUnitId: string;
	/** An upgrade the pool holds twice. */
	upgradeId: string;
	code: string;
};

/**
 * Builds a roster out of whatever the bundled content offers: two copies of a mountable unit with
 * the first one mounted, three copies of another, and two copies of one upgrade in the pool. The
 * copy counts are what the cut's budgets are asserted against, so they are fixed by design.
 */
function buildRoster(): Roster {
	for (const faction of contentStore.armyFactions) {
		armyBuilderStore.selectFaction(faction.id);
		const units = armyBuilderStore.units;
		const mounted = units.find((unit) => unit.mount !== undefined && unit.limit >= 2);
		const plain = units.find(
			(unit) => unit.id !== mounted?.id && unit.limit >= 3 && unit.mount === undefined
		);
		const pooled = armyBuilderStore.upgrades.find((upgrade) => (upgrade.limit ?? 3) >= 2);
		if (!mounted || !plain || !pooled) continue;

		armyBuilderStore.setFormat('roster');
		armyBuilderStore.addUnit(mounted.id);
		armyBuilderStore.addUnit(mounted.id);
		armyBuilderStore.toggleMount(armyBuilderStore.entries[0]!.id);
		if (armyBuilderStore.entries[0]?.mounted !== true) continue;
		armyBuilderStore.addUnit(plain.id);
		armyBuilderStore.addUnit(plain.id);
		armyBuilderStore.addUnit(plain.id);
		if (armyBuilderStore.entries.length !== 5) continue;
		armyBuilderStore.addRosterPick(pooled.id);
		armyBuilderStore.addRosterPick(pooled.id);

		const code = armyBuilderStore.exportArmyCode();
		if (code === null) continue;
		return {
			factionId: faction.id,
			mountedUnitId: mounted.id,
			plainUnitId: plain.id,
			upgradeId: pooled.id,
			code
		};
	}
	throw new Error('no bundled faction can supply the roster fixture');
}

/**
 * A roster that can field more than the Standard cap, for the over-cap refusal. No single unit
 * reaches 85 at its copy limit, so the most expensive ones are stacked until the total does.
 */
function buildOverCapRoster(): string {
	for (const faction of contentStore.armyFactions) {
		armyBuilderStore.selectFaction(faction.id);
		armyBuilderStore.setFormat('roster');
		const dearest = [...armyBuilderStore.units].sort((a, b) => b.points - a.points);
		for (const unit of dearest) {
			for (let copy = 0; copy < unit.limit; copy++) armyBuilderStore.addUnit(unit.id);
			if (armyBuilderStore.points > ARMY_FORMAT_POINTS.standard) break;
		}
		if (armyBuilderStore.points <= ARMY_FORMAT_POINTS.standard) continue;
		const code = armyBuilderStore.exportArmyCode();
		if (code !== null) return code;
	}
	throw new Error('no bundled faction can field more than the Standard cap on its own');
}

/** Opens a cut from the given roster, leaving the store on an empty Standard list. */
function openCut(roster: Roster): void {
	expect(armyBuilderStore.beginRosterCut(roster.code)).toBeNull();
}

describe('beginRosterCut', () => {
	it('turns the roster into a budget and starts an empty Standard list', () => {
		const roster = buildRoster();
		openCut(roster);
		expect(armyBuilderStore.factionId).toBe(roster.factionId);
		expect(armyBuilderStore.format).toBe('standard');
		expect(armyBuilderStore.limit).toBe(ARMY_FORMAT_POINTS.standard);
		expect(armyBuilderStore.entries).toEqual([]);
		expect(armyBuilderStore.rosterPicks).toEqual([]);
		expect(armyBuilderStore.constraint).not.toBeNull();
		expect(armyBuilderStore.startOnArmyPanel, 'the cut starts on the available units').toBe(false);
	});

	it('restricts both catalogs to what the roster held', () => {
		const roster = buildRoster();
		openCut(roster);
		const unitIds = armyBuilderStore.units.map((unit) => unit.id);
		expect(unitIds).toHaveLength(2);
		expect(unitIds).toContain(roster.mountedUnitId);
		expect(unitIds).toContain(roster.plainUnitId);
		expect(armyBuilderStore.upgrades.map((upgrade) => upgrade.id)).toEqual([roster.upgradeId]);
	});

	it('reports the budgets it derived', () => {
		const roster = buildRoster();
		openCut(roster);
		expect(armyBuilderStore.unitBudget(roster.mountedUnitId)).toBe(2);
		expect(armyBuilderStore.unitBudget(roster.plainUnitId)).toBe(3);
		expect(armyBuilderStore.poolRemaining).toEqual([{ id: roster.upgradeId, qty: 2 }]);
	});

	it('refuses a standard code, which has no pool to cut from', () => {
		const roster = buildRoster();
		armyBuilderStore.selectFaction(roster.factionId);
		armyBuilderStore.addUnit(roster.plainUnitId);
		const standard = armyBuilderStore.exportArmyCode();
		expect(standard).not.toBeNull();
		expect(armyBuilderStore.beginRosterCut(standard!)).toBe('invalid');
	});

	it('refuses a code from a different roster version', () => {
		expect(armyBuilderStore.beginRosterCut('a000:0s:0')).toBe('roster-mismatch');
	});
});

describe('cutting the list down', () => {
	it('stops at the roster’s copy count', () => {
		const roster = buildRoster();
		openCut(roster);
		for (let copy = 0; copy < 5; copy++) armyBuilderStore.addUnit(roster.mountedUnitId);
		expect(armyBuilderStore.entries).toHaveLength(2);
		expect(armyBuilderStore.unitBudget(roster.mountedUnitId)).toBe(0);
	});

	it('gives the copy budget back when a copy is removed', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		expect(armyBuilderStore.unitBudget(roster.mountedUnitId)).toBe(0);
		armyBuilderStore.removeUnit(roster.mountedUnitId);
		expect(armyBuilderStore.unitBudget(roster.mountedUnitId)).toBe(1);
	});

	it('lets a mounted copy be left on foot but never mounts an unmounted one', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		const [first, second] = armyBuilderStore.entries;

		armyBuilderStore.toggleMount(first!.id);
		expect(armyBuilderStore.entries[0]?.mounted).toBe(true);
		expect(armyBuilderStore.mountBlock(second!.id), 'the roster mounted one copy').toBe('roster');
		armyBuilderStore.toggleMount(second!.id);
		expect(armyBuilderStore.entries[1]?.mounted).not.toBe(true);

		armyBuilderStore.toggleMount(first!.id);
		expect(armyBuilderStore.mountBlock(second!.id), 'unmounting frees the budget').toBeNull();
		armyBuilderStore.toggleMount(second!.id);
		expect(armyBuilderStore.entries[1]?.mounted).toBe(true);
	});

	it('never blocks unmounting, in or out of a cut', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		armyBuilderStore.toggleMount(armyBuilderStore.entries[0]!.id);
		expect(armyBuilderStore.mountBlock(armyBuilderStore.entries[0]!.id)).toBeNull();
	});

	it('assigns pool upgrades copy by copy and stops when the pool runs out', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.addUnit(roster.plainUnitId);
		const ids = armyBuilderStore.entries.map((entry) => entry.id);

		armyBuilderStore.addUpgrade(ids[0]!, roster.upgradeId);
		armyBuilderStore.addUpgrade(ids[1]!, roster.upgradeId);
		expect(armyBuilderStore.entries[0]?.upgrades).toEqual([roster.upgradeId]);
		expect(armyBuilderStore.entries[1]?.upgrades).toEqual([roster.upgradeId]);
		expect(armyBuilderStore.poolRemaining).toEqual([]);

		armyBuilderStore.addUpgrade(ids[2]!, roster.upgradeId);
		expect(armyBuilderStore.entries[2]?.upgrades, 'the pool held two copies').toBeUndefined();
	});

	it('gives the pool budget back when an upgrade is removed', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.addUnit(roster.plainUnitId);
		const ids = armyBuilderStore.entries.map((entry) => entry.id);
		armyBuilderStore.addUpgrade(ids[0]!, roster.upgradeId);
		armyBuilderStore.addUpgrade(ids[1]!, roster.upgradeId);
		expect(armyBuilderStore.poolRemaining).toEqual([]);
		armyBuilderStore.removeUpgrade(ids[1]!, roster.upgradeId);
		expect(armyBuilderStore.poolRemaining).toEqual([{ id: roster.upgradeId, qty: 1 }]);
	});

	it('has no equipment pool of its own — the cut is a Standard list', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addRosterPick(roster.upgradeId);
		expect(armyBuilderStore.rosterPicks).toEqual([]);
	});

	it('ignores a format switch while constrained', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.setFormat('roster');
		expect(armyBuilderStore.format).toBe('standard');
		expect(armyBuilderStore.entries).toHaveLength(1);
	});
});

describe('acceptCut', () => {
	it('is null while the list is empty', () => {
		const roster = buildRoster();
		openCut(roster);
		expect(armyBuilderStore.acceptCut()).toBeNull();
	});

	it('hands back a Standard code that replays through an import', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.mountedUnitId);
		armyBuilderStore.toggleMount(armyBuilderStore.entries[0]!.id);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.addUpgrade(armyBuilderStore.entries[1]!.id, roster.upgradeId);

		const code = armyBuilderStore.acceptCut();
		expect(code).not.toBeNull();
		expect(armyBuilderStore.importArmy(code!)).toBeNull();
		expect(armyBuilderStore.format).toBe('standard');
		expect(armyBuilderStore.entries).toHaveLength(2);
		expect(armyBuilderStore.entries[0]?.mounted).toBe(true);
		expect(armyBuilderStore.entries[1]?.upgrades).toEqual([roster.upgradeId]);
		expect(armyBuilderStore.constraint, 'an import is not a cut').toBeNull();
	});

	it('is null outside a cut, so the free builder cannot accept one', () => {
		const roster = buildRoster();
		armyBuilderStore.selectFaction(roster.factionId);
		armyBuilderStore.addUnit(roster.plainUnitId);
		expect(armyBuilderStore.constraint).toBeNull();
		expect(armyBuilderStore.acceptCut()).toBeNull();
	});

	it('refuses a cut that is over the Standard cap', () => {
		armyBuilderStore.beginRosterCut(buildOverCapRoster());
		for (const unit of armyBuilderStore.units) {
			for (let copy = 0; copy < unit.limit; copy++) armyBuilderStore.addUnit(unit.id);
		}
		expect(armyBuilderStore.isOverLimit, 'the fixture roster must be able to overshoot').toBe(true);
		expect(armyBuilderStore.acceptCut()).toBeNull();
	});

	it('accepts again once the overshoot is removed', () => {
		armyBuilderStore.beginRosterCut(buildOverCapRoster());
		for (const unit of armyBuilderStore.units) {
			for (let copy = 0; copy < unit.limit; copy++) armyBuilderStore.addUnit(unit.id);
		}
		while (armyBuilderStore.isOverLimit && armyBuilderStore.entries.length > 0) {
			armyBuilderStore.removeEntry(
				armyBuilderStore.entries[armyBuilderStore.entries.length - 1]!.id
			);
		}
		expect(armyBuilderStore.isOverLimit).toBe(false);
		expect(armyBuilderStore.acceptCut()).not.toBeNull();
	});
});

describe('leaving a cut', () => {
	it('clears the budget and the list', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.addUnit(roster.plainUnitId);
		armyBuilderStore.leave();
		expect(armyBuilderStore.constraint).toBeNull();
		expect(armyBuilderStore.entries).toEqual([]);
		expect(armyBuilderStore.factionId).toBeNull();
	});

	it('picks a faction normally afterwards', () => {
		const roster = buildRoster();
		openCut(roster);
		armyBuilderStore.selectFaction(roster.factionId);
		expect(armyBuilderStore.constraint).toBeNull();
		expect(armyBuilderStore.units.length).toBeGreaterThan(0);
		expect(armyBuilderStore.unitBudget(armyBuilderStore.units[0]!.id)).toBeNull();
		expect(armyBuilderStore.mountBlock('missing')).toBeNull();
	});
});
