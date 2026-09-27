import { json } from '@sveltejs/kit';
import { peekTournament } from '$lib/domain';
import { api, requireTournament } from '$lib/server/http';

/**
 * What the join page shows before anyone joins: name, organizer and how full the field is.
 * Unauthenticated by design — the code in the link is the only credential a visitor needs.
 */
export const GET = api(async ({ params }) => {
	return json(peekTournament(await requireTournament(params.id)));
});
