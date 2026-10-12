import {
	settleVitalityStates,
	UNIT_STATUS_LABELS,
	type UnitStatus,
	type UnitVitality
} from './army';
import {
	vitalityAfterDamage,
	vitalityAfterHeal,
	vitalityAfterStagger,
	vitalityAfterStamina,
	vitalityAfterStatuses,
	vitalityAfterStun
} from './vitalityFlow';
import type { PlayerKey } from './twoPlayer';

/**
 * One flower-dialog commit, as the backend's append log carries it. The kinds are exactly the
 * dialogs' live actions - Assign Damage, Assign Healing, Assign/Remove Status, Deal Stagger,
 * Deal Stun and Activation Management's net step; Assign/Remove Buff and Trade Item are inert
 * and never reach the log. This is the record the battle report will later fold for its KPIs,
 * so it carries every number a statistic could want: who acted, on whom, in which round, and
 * by how much.
 */
export type VitalityAction =
	| { kind: 'damage'; amount: number }
	| { kind: 'heal'; amount: number }
	| { kind: 'statuses'; statuses: UnitStatus[]; added: UnitStatus[]; removed: UnitStatus[] }
	| { kind: 'stagger' }
	| { kind: 'stun' }
	| { kind: 'stamina'; delta: number };

/**
 * One historized interaction. `seq`, `round`, `actor` and `at` are server-stamped at mutation
 * time - the round a hit belongs to is server truth, not the committing device's. The model
 * identities and names are client-declared, because the server loads no army catalogs: the same
 * ruling the Leader's M and INT already rest on.
 */
export type HistoryAction = {
	kind: 'action';
	seq: number;
	round: number;
	actor: PlayerKey;
	at: string;
	targetSeat: PlayerKey;
	targetEntryId: string;
	targetName: string;
	/** Numbers the copy inside its seat when the unit name is not unique there; else null. */
	targetCopy: number | null;
	/** The model on the actor's seat that acted, on cross-model commits; null on self commits. */
	originEntryId: string | null;
	originName: string | null;
	action: VitalityAction;
	/** The seq of the revert that walked this action back; null while it stands. */
	undoneBy: number | null;
};

/**
 * An undo, as an append-only compensation: the log keeps telling the truth about what happened
 * at the table, including the mis-tap, and a fold simply skips the pair. Rewriting or deleting
 * the action row would silently corrupt every KPI derived from the log.
 */
export type HistoryRevert = {
	kind: 'revert';
	seq: number;
	round: number;
	actor: PlayerKey;
	at: string;
	revertOf: number;
};

export type HistoryEntry = HistoryAction | HistoryRevert;

/** What one copy starts with: the fold replays the log against these, so it needs the bases. */
export type VitalityBase = { hp: number; sta: number | null; undead: boolean };
export type VitalityBases = Record<PlayerKey, Record<string, VitalityBase>>;

export type HistoryFold = {
	/** The vitality maps the standing log produces, per seat and entry id. */
	vitality: Record<PlayerKey, Record<string, UnitVitality>>;
	/** Per action seq, the sentences the log reads as: the commit first, forced States after. */
	sentences: Record<number, string[]>;
};

/**
 * The order the log narrates the zero-Life contract's States in: the fall, then the posture,
 * then the death. Stored status lists keep the catalog order (`toggleUnitStatus` sorts them),
 * which puts Crouched before Incapacitated - fine for a ring, wrong for a sentence. These three
 * are also the only States no player picked, so they are the only ones that get a line of their
 * own; everything else on the copy is named by the commit that put it there.
 */
const STATE_NARRATIVE: UnitStatus[] = ['incapacitated', 'crouched', 'dead'];

function stateLabel(status: UnitStatus): string {
	return UNIT_STATUS_LABELS[status];
}

function copySuffix(name: string, copy: number | null): string {
	return copy === null ? name : `${name} ${copy}`;
}

/**
 * Replays the log into the vitality maps both boards render. Reverted actions and the reverts
 * themselves contribute nothing; every commit runs through `settleVitalityStates`, so the
 * zero-Life contract holds for a replayed log exactly as it holds for a live commit. An action
 * against an entry the bases do not know is skipped rather than guessed at.
 */
export function foldHistory(entries: HistoryEntry[], bases: VitalityBases): HistoryFold {
	const reverted = new Set<number>();
	for (const entry of entries) if (entry.kind === 'revert') reverted.add(entry.revertOf);

	const vitality: Record<PlayerKey, Record<string, UnitVitality>> = {
		player1: {},
		player2: {}
	};
	const sentences: Record<number, string[]> = {};

	for (const entry of entries) {
		if (entry.kind !== 'action') continue;
		const primary = primaryLines(entry);
		// A reverted action still reads in the list - the log keeps the mis-tap - but it never
		// touched the board, so it keeps its commit line and gets no forced-State lines, which
		// describe a state it never changed.
		if (reverted.has(entry.seq)) {
			sentences[entry.seq] = primary;
			continue;
		}
		const base = bases[entry.targetSeat]?.[entry.targetEntryId];
		// An entry the bases do not know - a board that never published, a report opened on a
		// device that lacks one half - still narrates its commit; only the vitality and the
		// forced-State lines need the base stats.
		if (!base) {
			sentences[entry.seq] = primary;
			continue;
		}
		const before = vitality[entry.targetSeat][entry.targetEntryId];
		const previousHp = before?.hp ?? base.hp;
		let next: UnitVitality;
		switch (entry.action.kind) {
			case 'damage':
				next = vitalityAfterDamage(before, base.hp, base.sta, entry.action.amount);
				break;
			case 'heal':
				next = vitalityAfterHeal(before, base.hp, base.sta, entry.action.amount);
				break;
			case 'stagger':
				next = vitalityAfterStagger(before, base.hp, base.sta);
				break;
			case 'stun':
				next = vitalityAfterStun(before, base.hp, base.sta);
				break;
			case 'stamina':
				next = vitalityAfterStamina(before, base.hp, base.sta, entry.action.delta);
				break;
			case 'statuses':
				next = vitalityAfterStatuses(before, base.hp, base.sta, entry.action.statuses);
				break;
		}
		const settled = settleVitalityStates(next, previousHp, base.undead);
		vitality[entry.targetSeat][entry.targetEntryId] = settled;
		sentences[entry.seq] = [...primary, ...stateLines(entry, before ?? null, settled)];
	}
	return { vitality, sentences };
}

/**
 * The commit's own line. A cross-model action names the model that acted; a self action leaves
 * the seat out, because on the actor's own device the hit has no origin on the board - it
 * arrived from across the table.
 */
function primaryLines(entry: HistoryAction): string[] {
	const target = copySuffix(entry.targetName, entry.targetCopy);
	const who = entry.originName ?? null;
	const lines: string[] = [];

	switch (entry.action.kind) {
		case 'damage':
			lines.push(
				who === null
					? `${target} takes ${entry.action.amount} damage`
					: `${who} has dealt ${entry.action.amount} damage to ${target}`
			);
			break;
		case 'heal':
			lines.push(
				who === null
					? `${target} recovers ${entry.action.amount} Life`
					: `${who} has restored ${entry.action.amount} Life to ${target}`
			);
			break;
		case 'stagger':
			lines.push(
				who === null
					? `${target} spends one activation`
					: `${who} staggers ${target} - one activation spent`
			);
			break;
		case 'stun':
			lines.push(
				who === null
					? `${target} spends every activation`
					: `${who} stuns ${target} - every activation spent`
			);
			break;
		case 'stamina': {
			const delta = entry.action.delta;
			const points = Math.abs(delta);
			lines.push(
				delta > 0
					? `${target} regains ${points} activation${points === 1 ? '' : 's'}`
					: `${target} spends ${points} activation${points === 1 ? '' : 's'}`
			);
			break;
		}
		case 'statuses': {
			for (const status of entry.action.added)
				lines.push(
					who === null
						? `${target} receives ${stateLabel(status)}`
						: `${who} assigns ${stateLabel(status)} to ${target}`
				);
			for (const status of entry.action.removed)
				lines.push(
					who === null
						? `${target} sheds ${stateLabel(status)}`
						: `${who} removes ${stateLabel(status)} from ${target}`
				);
			if (lines.length === 0) lines.push(`${target}'s States are confirmed unchanged`);
			break;
		}
	}
	return lines;
}

/**
 * What the zero-Life contract adds on top of a commit: the fall, the death, the standing back
 * up. No player picked these States, so they get a line of their own - and an undone action gets
 * none of them, since it never changed the state they describe.
 */
function stateLines(
	entry: HistoryAction,
	before: UnitVitality | null,
	after: UnitVitality
): string[] {
	const target = copySuffix(entry.targetName, entry.targetCopy);
	const lines: string[] = [];
	const beforeStates = before?.statuses ?? [];
	const afterStates = after.statuses ?? [];
	const forced = STATE_NARRATIVE.filter(
		(status) => afterStates.includes(status) && !beforeStates.includes(status)
	);
	for (const status of forced)
		lines.push(
			status === 'dead' ? `${target} is Dead` : `${target} receives ${stateLabel(status)}`
		);
	// Incapacitated and Dead lift only on a rise - settleVitalityStates drops them there and
	// nowhere else - so a kill, which trades Incapacitated for Dead at zero Life, must not read
	// as the model standing up. Crouched is forced on at zero Life but never lifted by a rise,
	// so it gets no line of its own.
	const rose = before !== null && after.hp > before.hp;
	if (rose) {
		for (const status of STATE_NARRATIVE) {
			if (!beforeStates.includes(status) || afterStates.includes(status)) continue;
			if (status === 'incapacitated') lines.push(`${target} stands back up`);
			if (status === 'dead') lines.push(`${target} returns to play`);
		}
	}
	return lines;
}

/**
 * The action the Undo button reverts: the log's last entry, when it is a standing action of the
 * caller's own. An opponent's last action is not yours to walk back, an already-undone one is
 * gone, and a revert on top of the log means the last thing that happened was an undo - there
 * is nothing left to undo until a new action lands.
 */
export function undoableAction(entries: HistoryEntry[], seat: PlayerKey): HistoryAction | null {
	const last = entries[entries.length - 1];
	if (!last || last.kind !== 'action') return null;
	if (last.undoneBy !== null) return null;
	return last.actor === seat ? last : null;
}

/** Bounds the server enforces on a declared commit; the client's word, but a bounded one. */
export const HISTORY_NAME_MAX = 48;
export const HISTORY_AMOUNT_MAX = 99;

function isPlayerKey(value: unknown): value is PlayerKey {
	return value === 'player1' || value === 'player2';
}

function isStatus(value: unknown): value is UnitStatus {
	return typeof value === 'string' && value in UNIT_STATUS_LABELS;
}

/**
 * The commit payload the API accepts, parsed and bounded. Returns null on anything malformed -
 * names, entry ids, amounts and States are all client-declared, so none of them enters the log
 * unvalidated.
 */
export type VitalityCommitInput = {
	targetSeat: PlayerKey;
	targetEntryId: string;
	targetName: string;
	targetCopy: number | null;
	originEntryId: string | null;
	originName: string | null;
	action: VitalityAction;
};

export function parseVitalityCommit(raw: unknown): VitalityCommitInput | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const body = raw as Record<string, unknown>;
	if (!isPlayerKey(body.targetSeat)) return null;
	if (typeof body.targetEntryId !== 'string' || body.targetEntryId.length === 0) return null;
	if (typeof body.targetName !== 'string' || body.targetName.length > HISTORY_NAME_MAX) return null;
	const targetCopy = body.targetCopy;
	if (targetCopy !== null && typeof targetCopy !== 'number') return null;
	const originEntryId = body.originEntryId;
	if (originEntryId !== null && typeof originEntryId !== 'string') return null;
	const originName = body.originName;
	if (originName !== null && typeof originName !== 'string') return null;
	if (originName !== null && originName.length > HISTORY_NAME_MAX) return null;

	const action = body.action;
	if (typeof action !== 'object' || action === null) return null;
	const act = action as Record<string, unknown>;
	switch (act.kind) {
		case 'damage':
		case 'heal': {
			const amount = act.amount;
			if (
				typeof amount !== 'number' ||
				!Number.isInteger(amount) ||
				amount < 1 ||
				amount > HISTORY_AMOUNT_MAX
			)
				return null;
			return { ...commitIdentity(body), action: { kind: act.kind, amount } };
		}
		case 'stagger':
		case 'stun':
			return { ...commitIdentity(body), action: { kind: act.kind } };
		case 'stamina': {
			const delta = act.delta;
			if (
				typeof delta !== 'number' ||
				!Number.isInteger(delta) ||
				delta === 0 ||
				Math.abs(delta) > HISTORY_AMOUNT_MAX
			)
				return null;
			return { ...commitIdentity(body), action: { kind: 'stamina', delta } };
		}
		case 'statuses': {
			if (!Array.isArray(act.statuses) || !Array.isArray(act.added) || !Array.isArray(act.removed))
				return null;
			if (
				!act.statuses.every(isStatus) ||
				!act.added.every(isStatus) ||
				!act.removed.every(isStatus)
			)
				return null;
			if (act.statuses.length > 14 || act.added.length > 14 || act.removed.length > 14) return null;
			return {
				...commitIdentity(body),
				action: {
					kind: 'statuses',
					statuses: act.statuses as UnitStatus[],
					added: act.added as UnitStatus[],
					removed: act.removed as UnitStatus[]
				}
			};
		}
		default:
			return null;
	}
}

function commitIdentity(body: Record<string, unknown>): Omit<VitalityCommitInput, 'action'> {
	return {
		targetSeat: body.targetSeat as PlayerKey,
		targetEntryId: body.targetEntryId as string,
		targetName: body.targetName as string,
		targetCopy: (body.targetCopy ?? null) as number | null,
		originEntryId: (body.originEntryId ?? null) as string | null,
		originName: (body.originName ?? null) as string | null
	};
}

/** One row of the backend's append log, in the shape the repository reads it. */
export type HistoryRow = {
	seq: number;
	type: string;
	actor: string | null;
	payload: unknown;
	createdAt: string;
};

/** The two event types the log carries for the flower board. */
export const HISTORY_EVENT_COMMIT = 'vitality-committed';
export const HISTORY_EVENT_REVERT = 'vitality-reverted';

/**
 * The append log's rows as history entries. A row whose payload no longer parses - a bound that
 * tightened, a hand-edited database - is skipped rather than letting one bad row break the whole
 * board; the log is the source of truth, but a readable board beats a strict one. `undoneBy` is
 * joined in from the revert rows, since the action row itself is never rewritten.
 */
export function historyFromRows(rows: HistoryRow[]): HistoryEntry[] {
	const entries: HistoryEntry[] = [];
	for (const row of rows) {
		if (row.actor !== 'player1' && row.actor !== 'player2') continue;
		if (typeof row.payload !== 'object' || row.payload === null) continue;
		const payload = row.payload as Record<string, unknown>;
		const round = payload.round;
		if (typeof round !== 'number' || !Number.isInteger(round)) continue;
		if (row.type === HISTORY_EVENT_COMMIT) {
			const commit = parseVitalityCommit(payload);
			if (!commit) continue;
			entries.push({
				kind: 'action',
				seq: row.seq,
				round,
				actor: row.actor,
				at: row.createdAt,
				...commit,
				undoneBy: null
			});
		} else if (row.type === HISTORY_EVENT_REVERT) {
			const revertOf = payload.revertOf;
			if (typeof revertOf !== 'number' || !Number.isInteger(revertOf)) continue;
			entries.push({
				kind: 'revert',
				seq: row.seq,
				round,
				actor: row.actor,
				at: row.createdAt,
				revertOf
			});
		}
	}
	const revertOf = new Map<number, number>();
	for (const entry of entries) if (entry.kind === 'revert') revertOf.set(entry.revertOf, entry.seq);
	for (const entry of entries)
		if (entry.kind === 'action') entry.undoneBy = revertOf.get(entry.seq) ?? null;
	return entries;
}
