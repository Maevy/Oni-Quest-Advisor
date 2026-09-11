import type { ResultObjectiveDef } from './mission';
import { MAX_ROUND, MIN_ROUND } from './progress';

/** One round row of a grouped Results card. `objective` is null when nothing scores that round. */
export type ObjectiveRoundRow = {
	round: number;
	objective: ResultObjectiveDef | null;
};

/**
 * A Results entry as laid out for display: either a plain objective, or the card that groups
 * several per-round objectives under one heading.
 */
export type ResultsEntry =
	| { kind: 'objective'; objective: ResultObjectiveDef }
	| { kind: 'roundGroup'; group: string; text: string; vp: number; rows: ObjectiveRoundRow[] };

/**
 * Lays Results out for display. Entries sharing a `group` collapse into one card carrying a row for
 * every round (MIN_ROUND..MAX_ROUND), so the round colors line up across missions and rounds that
 * score nothing — round 1 under a ceasefire, or the rounds Magic Stones skips — render as locked
 * rows. Ungrouped entries pass through in mission order; a card takes its first member's position.
 */
export function groupResults(results: ResultObjectiveDef[]): ResultsEntry[] {
	const membersByGroup = new Map<string, ResultObjectiveDef[]>();
	for (const objective of results) {
		if (!objective.group) continue;
		const members = membersByGroup.get(objective.group);
		if (members) {
			members.push(objective);
		} else {
			membersByGroup.set(objective.group, [objective]);
		}
	}

	const entries: ResultsEntry[] = [];
	const emittedGroups = new Set<string>();
	for (const objective of results) {
		const group = objective.group;
		if (!group) {
			entries.push({ kind: 'objective', objective });
			continue;
		}
		if (emittedGroups.has(group)) continue;
		emittedGroups.add(group);

		const members = membersByGroup.get(group) ?? [];
		const byRound = new Map(members.map((member) => [member.round ?? 0, member]));
		entries.push({
			kind: 'roundGroup',
			group,
			text: members[0].text,
			vp: members[0].vp,
			rows: Array.from({ length: MAX_ROUND - MIN_ROUND + 1 }, (_unused, index) => {
				const round = MIN_ROUND + index;
				return { round, objective: byRound.get(round) ?? null };
			})
		});
	}
	return entries;
}
