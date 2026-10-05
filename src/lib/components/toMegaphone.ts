import type { TournamentMessageView } from '$lib/domain';

/**
 * What a screen needs to render the tournament megaphone in its top bar: the announcements this
 * seat may read, how many of them are new, and how to say "seen". Null on a screen the tournament
 * does not reach — the megaphone is the one widget that follows a player *into* their match, so
 * every online screen takes one of these while the match belongs to a table.
 */
export type MegaphoneInbox = {
	messages: TournamentMessageView[];
	unread: number;
	onRead: () => void;
};
