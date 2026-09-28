import type { ArmyFactionId, PickedArmy, TournamentOccupant } from '$lib/domain';

const MAX_ARMY_NAME_LENGTH = 60;
const MAX_FACTION_ID_LENGTH = 40;
/** A 125-point roster code is the longest payload the join carries; beyond this it is not one. */
const MAX_ARMY_CODE_LENGTH = 4000;

/**
 * Parses an army snapshot out of a request body. The server stores what the client registered
 * and shows name and faction in the lobby; the code itself is only ever echoed back to its
 * owner, so a malformed one hurts nobody but its bearer.
 */
export function parsePickedArmy(value: unknown): PickedArmy | null {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	const { name, factionId, code } = record;
	if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_ARMY_NAME_LENGTH) {
		return null;
	}
	if (
		typeof factionId !== 'string' ||
		factionId.trim() === '' ||
		factionId.length > MAX_FACTION_ID_LENGTH
	) {
		return null;
	}
	if (typeof code !== 'string' || code === '' || code.length > MAX_ARMY_CODE_LENGTH) return null;
	return { name, factionId: factionId as ArmyFactionId, code };
}

/** Reads a string list out of a request body, rejecting anything else entirely. */
export function parseStringArray(value: unknown, maxLength: number): string[] | null {
	if (!Array.isArray(value)) return null;
	const entries: string[] = [];
	for (const entry of value) {
		if (typeof entry !== 'string' || entry.length > maxLength) return null;
		entries.push(entry);
	}
	return entries;
}

/**
 * Parses a table occupant out of a request body: a seat index or the BYE. The wire shape is the
 * one the view already hands the client, so an assignment round-trips without translation.
 */
export function parseTournamentOccupant(value: unknown): TournamentOccupant | null {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	if (record.kind === 'bye') return { kind: 'bye' };
	if (record.kind !== 'seat') return null;
	const seatIndex = record.seatIndex;
	if (typeof seatIndex !== 'number' || !Number.isInteger(seatIndex) || seatIndex < 0) return null;
	return { kind: 'seat', seatIndex };
}

/**
 * Parses an assignment target: a table index, or null for the pool of unassigned occupants.
 * Undefined means the field was not a valid target at all.
 */
export function parseTableIndex(value: unknown): number | null | undefined {
	if (value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined;
	return value;
}
