import { json } from '@sveltejs/kit';
import { canSetLeader, setLeader, type SeatLeader } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { notifyGameChanged } from '$lib/server/sse';

/** A statistic as declared by the client: a finite number, or null when the model has none. */
function isStat(value: unknown): value is number | null {
	return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Assigns (or clears) this seat's Leader. The client declares the two statistics the initiative
 * roll will need, because the server loads no army catalogs and cannot compute them from a code;
 * only those two numbers are ever published, and only from Scheme selection on — which copy is the
 * Leader never leaves the seat's own view.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

	let leader: SeatLeader | null;
	if (payload.leader === null) {
		leader = null;
	} else {
		const record =
			typeof payload.leader === 'object' && payload.leader !== null
				? (payload.leader as Record<string, unknown>)
				: null;
		const entryId = record?.entryId;
		if (record === null || typeof entryId !== 'string' || entryId === '') {
			throw new ApiError(400, 'Invalid leader');
		}
		if (!isStat(record.m) || !isStat(record.int)) throw new ApiError(400, 'Invalid leader');
		leader = { entryId, m: record.m, int: record.int };
	}

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canSetLeader(game, seat)) {
			throw new ApiError(409, 'A Leader is chosen from the match list, during preparation');
		}
		return {
			next: setLeader(game, seat, leader),
			events: {
				type: 'leader-assigned',
				actor: seat,
				payload: { assigned: leader !== null }
			}
		};
	});
	notifyGameChanged(params.id, 'leader-assigned');
	return json({ ok: true });
});
