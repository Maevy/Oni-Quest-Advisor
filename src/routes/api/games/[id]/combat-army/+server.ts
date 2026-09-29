import { json } from '@sveltejs/kit';
import { canSetCombatArmy, setCombatArmy } from '$lib/domain';
import { ApiError, api, bearerToken } from '$lib/server/http';
import { mutateAsSeat } from '$lib/server/gameRepository';
import { parsePickedArmy } from '$lib/server/payload';
import { notifyGameChanged } from '$lib/server/sse';

/**
 * Registers the Standard list a seat will field, cut down from the Roster army it registered
 * with. The server cannot check the point total — it has no army catalogs loaded — so the 85-point
 * cap is the client's Accept gate; what it does check is that the result is a Standard list at
 * all, and that the seat is one that had something to cut.
 */
export const POST = api(async ({ params, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	const army = parsePickedArmy(payload.army);
	if (!army) throw new ApiError(400, 'Invalid army');
	if (army.format !== 'standard') {
		throw new ApiError(400, 'A combat army is a Standard list');
	}

	await mutateAsSeat(params.id, bearerToken(request), (game, seat) => {
		if (!canSetCombatArmy(game, seat)) {
			throw new ApiError(409, 'Only a Roster army is cut down, and only during preparation');
		}
		return {
			next: setCombatArmy(game, seat, army),
			events: { type: 'combat-army-set', actor: seat, payload: { name: army.name } }
		};
	});
	notifyGameChanged(params.id, 'combat-army-set');
	return json({ ok: true });
});
