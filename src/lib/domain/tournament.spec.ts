import { describe, expect, it } from 'vitest';
import {
	MAX_TOURNAMENT_PLAYERS,
	MIN_TOURNAMENT_PLAYERS,
	TOURNAMENT_PLAYER_STEP,
	addTournamentMission,
	canContinueTournamentSetup,
	canCreateTournament,
	checkExternalLink,
	clampTournamentPlayers,
	createEmptyTournamentDraft,
	defaultTableName,
	removeTournamentMission,
	setTournamentOrganizerArmy,
	setTournamentOrganizerPlays,
	setTournamentTableName,
	stepTournamentPlayers,
	syncTournamentTables,
	tableCountFor,
	type TournamentDraft
} from './tournament';
import type { PickedArmy } from './savedArmy';

const army: PickedArmy = { name: 'Oni Clans', factionId: 'oni-clans', code: 'A1' };

describe('createEmptyTournamentDraft', () => {
	it('starts at the smallest legal field with nobody named and both options off', () => {
		expect(createEmptyTournamentDraft()).toEqual({
			name: '',
			externalLink: '',
			organizerName: '',
			organizerPlays: false,
			organizerArmy: null,
			participantCount: MIN_TOURNAMENT_PLAYERS,
			manualPairing: false,
			missionIds: [],
			tableNames: ['Table 1', 'Table 2']
		});
	});

	it('starts on an even count, since an odd field cannot be paired', () => {
		expect(MIN_TOURNAMENT_PLAYERS % 2).toBe(0);
		expect(MAX_TOURNAMENT_PLAYERS % 2).toBe(0);
		expect(TOURNAMENT_PLAYER_STEP).toBe(2);
	});
});

describe('clampTournamentPlayers', () => {
	it('keeps a legal even count', () => {
		expect(clampTournamentPlayers(4)).toBe(4);
		expect(clampTournamentPlayers(14)).toBe(14);
		expect(clampTournamentPlayers(MAX_TOURNAMENT_PLAYERS)).toBe(MAX_TOURNAMENT_PLAYERS);
	});

	it('raises anything below the minimum to it', () => {
		expect(clampTournamentPlayers(0)).toBe(MIN_TOURNAMENT_PLAYERS);
		expect(clampTournamentPlayers(3)).toBe(MIN_TOURNAMENT_PLAYERS);
		expect(clampTournamentPlayers(-12)).toBe(MIN_TOURNAMENT_PLAYERS);
	});

	it('caps anything above the maximum', () => {
		expect(clampTournamentPlayers(33)).toBe(MAX_TOURNAMENT_PLAYERS);
		expect(clampTournamentPlayers(500)).toBe(MAX_TOURNAMENT_PLAYERS);
	});

	it('snaps an odd count up so the field stays pairable', () => {
		expect(clampTournamentPlayers(5)).toBe(6);
		expect(clampTournamentPlayers(7)).toBe(8);
		expect(clampTournamentPlayers(31)).toBe(MAX_TOURNAMENT_PLAYERS);
	});

	it('rounds a fractional count before snapping it', () => {
		expect(clampTournamentPlayers(8.4)).toBe(8);
		expect(clampTournamentPlayers(8.6)).toBe(10);
	});

	it('falls back to the minimum for a count that is not a finite number', () => {
		expect(clampTournamentPlayers(NaN)).toBe(MIN_TOURNAMENT_PLAYERS);
		expect(clampTournamentPlayers(Infinity)).toBe(MIN_TOURNAMENT_PLAYERS);
		expect(clampTournamentPlayers(-Infinity)).toBe(MIN_TOURNAMENT_PLAYERS);
	});
});

describe('stepTournamentPlayers', () => {
	it('moves in whole pairs', () => {
		expect(stepTournamentPlayers(4, 1)).toBe(6);
		expect(stepTournamentPlayers(6, -1)).toBe(4);
		expect(stepTournamentPlayers(10, 3)).toBe(16);
	});

	it('stops at the minimum instead of going under it', () => {
		expect(stepTournamentPlayers(MIN_TOURNAMENT_PLAYERS, -1)).toBe(MIN_TOURNAMENT_PLAYERS);
		expect(stepTournamentPlayers(MIN_TOURNAMENT_PLAYERS, -10)).toBe(MIN_TOURNAMENT_PLAYERS);
	});

	it('stops at the maximum instead of going over it', () => {
		expect(stepTournamentPlayers(MAX_TOURNAMENT_PLAYERS, 1)).toBe(MAX_TOURNAMENT_PLAYERS);
		expect(stepTournamentPlayers(30, 5)).toBe(MAX_TOURNAMENT_PLAYERS);
	});

	it('can walk the whole legal field one pair at a time', () => {
		let count = MIN_TOURNAMENT_PLAYERS;
		const visited: number[] = [count];
		while (count < MAX_TOURNAMENT_PLAYERS) {
			count = stepTournamentPlayers(count, 1);
			visited.push(count);
		}

		expect(visited).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);
		expect(visited.every((value) => value % 2 === 0)).toBe(true);
	});
});

describe('canContinueTournamentSetup', () => {
	const named = {
		...createEmptyTournamentDraft(),
		name: 'Eldfall Cup',
		organizerName: 'Marta'
	};

	it('allows the wizard to advance once both names are given', () => {
		expect(canContinueTournamentSetup(named)).toBe(true);
	});

	it('does not care about the options or the field size', () => {
		expect(
			canContinueTournamentSetup({
				...named,
				organizerPlays: true,
				manualPairing: true,
				participantCount: MAX_TOURNAMENT_PLAYERS
			})
		).toBe(true);
	});

	it('blocks on an empty draft', () => {
		expect(canContinueTournamentSetup(createEmptyTournamentDraft())).toBe(false);
	});

	it.each([
		['no tournament name', { ...named, name: '' }],
		['no organizer name', { ...named, organizerName: '' }],
		['neither name', { ...named, name: '', organizerName: '' }]
	])('blocks when there is %s', (_label, draft) => {
		expect(canContinueTournamentSetup(draft)).toBe(false);
	});

	it('treats a whitespace-only name as missing', () => {
		expect(canContinueTournamentSetup({ ...named, name: '   ' })).toBe(false);
		expect(canContinueTournamentSetup({ ...named, organizerName: ' \t ' })).toBe(false);
	});

	it('does not care about a usable external link, or about having none at all', () => {
		expect(canContinueTournamentSetup({ ...named, externalLink: '' })).toBe(true);
		expect(canContinueTournamentSetup({ ...named, externalLink: 'tabletop.events/eldfall' })).toBe(
			true
		);
	});

	it('blocks while the external link is not a usable address', () => {
		expect(canContinueTournamentSetup({ ...named, externalLink: 'not a link' })).toBe(false);
	});
});

describe('checkExternalLink', () => {
	it('accepts an empty link as "none"', () => {
		expect(checkExternalLink('')).toEqual({ ok: true, url: null });
		expect(checkExternalLink('   ')).toEqual({ ok: true, url: null });
	});

	it('keeps a full http(s) address, normalized', () => {
		expect(checkExternalLink('https://tabletop.events/eldfall-cup')).toEqual({
			ok: true,
			url: 'https://tabletop.events/eldfall-cup'
		});
		expect(checkExternalLink('http://t3.example.com/x')).toEqual({
			ok: true,
			url: 'http://t3.example.com/x'
		});
	});

	it('adds the scheme to a bare address', () => {
		expect(checkExternalLink('tabletop.events/tournaments/eldfall-cup')).toEqual({
			ok: true,
			url: 'https://tabletop.events/tournaments/eldfall-cup'
		});
		expect(checkExternalLink('localhost:5173')).toEqual({
			ok: true,
			url: 'https://localhost:5173/'
		});
		// A port on a bare host must not be mistaken for a scheme of its own.
		expect(checkExternalLink('example.com:8080/x')).toEqual({
			ok: true,
			url: 'https://example.com:8080/x'
		});
	});

	it('trims surrounding whitespace', () => {
		expect(checkExternalLink('  https://x.io/a  ')).toEqual({ ok: true, url: 'https://x.io/a' });
	});

	it.each([
		['plain words', 'not a link'],
		['spaces inside the address', 'https://not a link'],
		['a non-http scheme', 'ftp://files.example.com/cup'],
		['a script scheme', 'javascript:alert(1)'],
		['a scheme with no host', 'https://']
	])('rejects %s', (_label, raw) => {
		expect(checkExternalLink(raw)).toEqual({ ok: false });
	});
});

describe('the organizer seat', () => {
	it('attaches and drops the organizer army', () => {
		let draft = setTournamentOrganizerArmy(createEmptyTournamentDraft(), army);
		expect(draft.organizerArmy).toEqual(army);

		draft = setTournamentOrganizerArmy(draft, null);
		expect(draft.organizerArmy).toBeNull();
	});

	it('keeps the picked army while the seat is held', () => {
		let draft = setTournamentOrganizerArmy(createEmptyTournamentDraft(), army);
		draft = setTournamentOrganizerPlays(draft, true);
		expect(draft.organizerArmy).toEqual(army);
		expect(draft.organizerPlays).toBe(true);
	});

	it('drops the picked army when the seat is given up', () => {
		// A seat the organizer no longer holds has no army to bring; keeping it would show a
		// list for a player who is not playing.
		let draft = setTournamentOrganizerPlays(createEmptyTournamentDraft(), true);
		draft = setTournamentOrganizerArmy(draft, army);
		draft = setTournamentOrganizerPlays(draft, false);

		expect(draft.organizerPlays).toBe(false);
		expect(draft.organizerArmy).toBeNull();
	});

	it('does not resurrect an army dropped by giving up the seat', () => {
		let draft = setTournamentOrganizerPlays(createEmptyTournamentDraft(), true);
		draft = setTournamentOrganizerArmy(draft, army);
		draft = setTournamentOrganizerPlays(draft, false);
		draft = setTournamentOrganizerPlays(draft, true);

		expect(draft.organizerArmy).toBeNull();
	});

	it('leaves the rest of the draft alone', () => {
		const base: TournamentDraft = {
			...createEmptyTournamentDraft(),
			name: 'Eldfall Cup',
			participantCount: 12
		};
		const played = setTournamentOrganizerPlays(base, true);

		expect(played.name).toBe('Eldfall Cup');
		expect(played.participantCount).toBe(12);
	});
});

describe('tables', () => {
	it('seats the whole field at once: one table per pair', () => {
		expect(tableCountFor(4)).toBe(2);
		expect(tableCountFor(8)).toBe(4);
		expect(tableCountFor(MAX_TOURNAMENT_PLAYERS)).toBe(16);
	});

	it('names tables Table 1, Table 2, …', () => {
		expect(defaultTableName(0)).toBe('Table 1');
		expect(defaultTableName(3)).toBe('Table 4');
	});

	it('grows the table list with default names when the field grows', () => {
		const grown = syncTournamentTables({ ...createEmptyTournamentDraft(), participantCount: 8 });

		expect(grown.tableNames).toEqual(['Table 1', 'Table 2', 'Table 3', 'Table 4']);
	});

	it('keeps custom names with their table number when the field grows', () => {
		let draft = setTournamentTableName(createEmptyTournamentDraft(), 1, 'City Table');
		draft = syncTournamentTables({ ...draft, participantCount: 6 });

		expect(draft.tableNames).toEqual(['Table 1', 'City Table', 'Table 3']);
	});

	it('drops surplus names when the field shrinks', () => {
		let draft = syncTournamentTables({ ...createEmptyTournamentDraft(), participantCount: 8 });
		draft = setTournamentTableName(draft, 3, 'Back Room');
		draft = syncTournamentTables({ ...draft, participantCount: 4 });

		expect(draft.tableNames).toEqual(['Table 1', 'Table 2']);
	});

	it('changes nothing when the count already matches', () => {
		const draft = createEmptyTournamentDraft();

		expect(syncTournamentTables(draft)).toBe(draft);
	});

	it('renames one table and leaves the others', () => {
		const draft = setTournamentTableName(createEmptyTournamentDraft(), 0, 'City Table');

		expect(draft.tableNames).toEqual(['City Table', 'Table 2']);
	});

	it('ignores a rename outside the table range', () => {
		const draft = createEmptyTournamentDraft();

		expect(setTournamentTableName(draft, 5, 'Nope')).toBe(draft);
		expect(setTournamentTableName(draft, -1, 'Nope')).toBe(draft);
	});
});

describe('the mission list', () => {
	it('appends missions in the order they are added', () => {
		let draft = addTournamentMission(createEmptyTournamentDraft(), 'treasure-hunt');
		draft = addTournamentMission(draft, 'quarter-war');

		expect(draft.missionIds).toEqual(['treasure-hunt', 'quarter-war']);
	});

	it('plays a mission once per tournament', () => {
		const draft = addTournamentMission(createEmptyTournamentDraft(), 'treasure-hunt');
		const again = addTournamentMission(draft, 'treasure-hunt');

		expect(again.missionIds).toEqual(['treasure-hunt']);
		expect(again).toBe(draft);
	});

	it('removes a mission and leaves the rest in order', () => {
		let draft = addTournamentMission(createEmptyTournamentDraft(), 'treasure-hunt');
		draft = addTournamentMission(draft, 'quarter-war');
		draft = removeTournamentMission(draft, 'treasure-hunt');

		expect(draft.missionIds).toEqual(['quarter-war']);
	});

	it('ignores removing a mission that is not on the list', () => {
		expect(removeTournamentMission(createEmptyTournamentDraft(), 'nope').missionIds).toEqual([]);
	});
});

describe('canCreateTournament', () => {
	it('needs at least one mission', () => {
		expect(canCreateTournament(createEmptyTournamentDraft())).toBe(false);
		expect(
			canCreateTournament(addTournamentMission(createEmptyTournamentDraft(), 'treasure-hunt'))
		).toBe(true);
	});

	it('falls back to blocked when the last mission is removed', () => {
		const draft = removeTournamentMission(
			addTournamentMission(createEmptyTournamentDraft(), 'treasure-hunt'),
			'treasure-hunt'
		);

		expect(canCreateTournament(draft)).toBe(false);
	});
});
