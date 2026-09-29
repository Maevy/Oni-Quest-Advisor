import { describe, expect, it } from 'vitest';
import { MAX_ROUND, MIN_ROUND } from './progress';
import type { PickedArmy } from './savedArmy';
import {
	acceptJoin,
	advanceToScoring,
	bothCombatReady,
	bothLeadersAssigned,
	bothReady,
	bothSchemesRevealed,
	canChooseSeatScheme,
	canDrawSchemes,
	canEditSetup,
	canLeaveArmies,
	canLeavePrep,
	canRequestJoin,
	canScoreSeatScheme,
	canSetCombatArmy,
	canSetLeader,
	canStartGame,
	canStartRounds,
	canToggleReady,
	chooseSeatScheme,
	clearSeatScheme,
	closeGame,
	createOnlineGame,
	denyJoin,
	finishGame,
	isRosterRevealed,
	isLeaderStatsRevealed,
	leaveArmies,
	leavePrep,
	MAX_NICKNAME_LENGTH,
	normalizeNickname,
	requestJoin,
	seatForTokenHash,
	setCombatArmy,
	setLeader,
	setSeatDrawnSchemes,
	setSeatObjectiveChecked,
	setSeatSchemeChecked,
	snapshotAndProceed,
	startGame,
	startRounds,
	toggleReady,
	toggleRevealIntent,
	toPublicSeat,
	viewForSeat,
	type OnlineGameState,
	type SeatLeader,
	type SeatReveal
} from './online';

const CREATED_AT = '2026-08-20T18:00:00.000Z';

const NO_REVEAL: SeatReveal = { roster: false, leaderStats: false };
const ROSTER_ONLY: SeatReveal = { roster: true, leaderStats: false };

const ALICE_ARMY: PickedArmy = {
	name: 'Alice Standard',
	factionId: 'helian-league',
	code: 'aaaaa:0s:0',
	format: 'standard'
};

const BOB_ARMY: PickedArmy = {
	name: 'Bob Roster',
	factionId: 'sand-kingdoms',
	code: 'aaaaa:2r:0:0.1',
	format: 'roster'
};

/** The Standard list Bob cuts his roster down to; stands in for the borrowed builder's output. */
const BOB_CUT: PickedArmy = {
	name: 'Bob Roster',
	factionId: 'sand-kingdoms',
	code: 'aaaaa:2s:0',
	format: 'standard'
};

const ALICE_LEADER: SeatLeader = { entryId: 'imported-1', m: 6, int: 14 };
const BOB_LEADER: SeatLeader = { entryId: 'imported-1', m: 5, int: 12 };

/** A fresh lobby — the mission and the leader's army arrive with the creation. */
function newGame(): OnlineGameState {
	return createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT, {
		season: 'Season 2',
		missionId: 'obelisk-strike',
		army: ALICE_ARMY
	});
}

function lobbyWithBothPlayers(): OnlineGameState {
	let state = newGame();
	state = requestJoin(state, 'bob', 'hash-b', BOB_ARMY);
	state = acceptJoin(state);
	return state;
}

/** Both seats pressed Ready, which is what Start Game asks for. */
function readyUp(state: OnlineGameState): OnlineGameState {
	return toggleReady(toggleReady(state, 'player1'), 'player2');
}

/** Start Game opens the army reveal, with Bob's roster not cut down yet. */
function atRevealStart(): OnlineGameState {
	return startGame(readyUp(lobbyWithBothPlayers()));
}

/** The preparation step, with Bob's roster not cut down yet. */
function atPrepStart(): OnlineGameState {
	return leaveArmies(atRevealStart());
}

/**
 * Preparation with both seats combat-ready and both Leaders named: Alice registered Standard,
 * Bob has cut his roster. The Leaders' INTs are what `leavePrep` seeds the drafts with.
 */
function inPrep(): OnlineGameState {
	let state = setCombatArmy(atPrepStart(), 'player2', BOB_CUT);
	state = setLeader(state, 'player1', ALICE_LEADER);
	state = setLeader(state, 'player2', BOB_LEADER);
	return state;
}

/** Preparation → Scheme setup, which seeds each seat's faction and intelligence. */
function inSetup(): OnlineGameState {
	return leavePrep(inPrep());
}

function draftAndChooseScheme(
	state: OnlineGameState,
	seat: 'player1' | 'player2'
): OnlineGameState {
	let next = setSeatDrawnSchemes(state, seat, ['head-hunt', 'stand-your-ground']);
	next = chooseSeatScheme(next, seat, 'head-hunt');
	return next;
}

/** Round 1's Reveal phase, with both Schemes chosen. */
function roundsBegun(): OnlineGameState {
	let state = inSetup();
	state = draftAndChooseScheme(state, 'player1');
	state = draftAndChooseScheme(state, 'player2');
	return startRounds(state);
}

function activeScoringGame(): OnlineGameState {
	return advanceToScoring(roundsBegun());
}

/** Both players set their reveal intent, so scoring starts with both schemes revealed. */
function revealedScoringGame(): OnlineGameState {
	let state = roundsBegun();
	state = toggleRevealIntent(state, 'player1');
	state = toggleRevealIntent(state, 'player2');
	return advanceToScoring(state);
}

describe('normalizeNickname', () => {
	it('trims and accepts a valid nickname', () => {
		expect(normalizeNickname('  johnDoe  ')).toBe('johnDoe');
	});

	it('rejects empty and over-long nicknames', () => {
		expect(normalizeNickname('')).toBeNull();
		expect(normalizeNickname('   ')).toBeNull();
		expect(normalizeNickname('x'.repeat(MAX_NICKNAME_LENGTH + 1))).toBeNull();
		expect(normalizeNickname('x'.repeat(MAX_NICKNAME_LENGTH))).toBe(
			'x'.repeat(MAX_NICKNAME_LENGTH)
		);
	});
});

describe('createOnlineGame', () => {
	it('creates a lobby with the leader on seat player1', () => {
		const state = newGame();
		expect(state.id).toBe('K3FQZ2');
		expect(state.status).toBe('lobby');
		expect(state.player1.nickname).toBe('alice');
		expect(state.player1.tokenHash).toBe('hash-a');
		expect(state.player2).toBeNull();
		expect(state.pendingJoin).toBeNull();
		expect(state.currentRound).toBe(MIN_ROUND);
		expect(state.phase).toBe('reveal');
		expect(state.winner).toBeNull();
	});

	it('is created already set up: the mission and the leader army are fixed', () => {
		const state = newGame();
		expect(state.season).toBe('Season 2');
		expect(state.missionId).toBe('obelisk-strike');
		expect(state.player1.army).toEqual(ALICE_ARMY);
	});
});

describe('join flow', () => {
	it('records a join request and answers canRequestJoin', () => {
		const state = newGame();
		expect(canRequestJoin(state)).toBe(true);
		const requested = requestJoin(state, 'bob', 'hash-b', BOB_ARMY);
		expect(requested.pendingJoin).toEqual({
			nickname: 'bob',
			tokenHash: 'hash-b',
			army: BOB_ARMY
		});
		expect(canRequestJoin(requested)).toBe(false);
	});

	it('ignores a second request while one is pending', () => {
		let state = newGame();
		state = requestJoin(state, 'bob', 'hash-b', BOB_ARMY);
		state = requestJoin(state, 'mallory', 'hash-m', BOB_ARMY);
		expect(state.pendingJoin?.nickname).toBe('bob');
	});

	it('accept fills seat player2 with the pending nickname, token hash and army', () => {
		let state = newGame();
		state = requestJoin(state, 'bob', 'hash-b', BOB_ARMY);
		state = acceptJoin(state);
		expect(state.player2?.nickname).toBe('bob');
		expect(state.player2?.tokenHash).toBe('hash-b');
		expect(state.player2?.army).toEqual(BOB_ARMY);
		expect(state.pendingJoin).toBeNull();
	});

	it('accept without a pending request is a no-op', () => {
		const state = newGame();
		expect(acceptJoin(state)).toBe(state);
	});

	it('deny clears the pending request', () => {
		let state = newGame();
		state = requestJoin(state, 'bob', 'hash-b', BOB_ARMY);
		state = denyJoin(state);
		expect(state.pendingJoin).toBeNull();
		expect(canRequestJoin(state)).toBe(true);
	});
});

describe('seatForTokenHash', () => {
	it('maps token hashes to seats and rejects unknown hashes', () => {
		const state = lobbyWithBothPlayers();
		expect(seatForTokenHash(state, 'hash-a')).toBe('player1');
		expect(seatForTokenHash(state, 'hash-b')).toBe('player2');
		expect(seatForTokenHash(state, 'hash-x')).toBeNull();
	});
});

describe('scheme setup', () => {
	it('takes the faction from the combat army rather than from a choice', () => {
		const state = inSetup();
		expect(state.player1.progress.schemeDraft.factionId).toBe('helian-league');
		expect(
			state.player2?.progress.schemeDraft.factionId,
			'the joiner cut a Sand Kingdoms list'
		).toBe('sand-kingdoms');
	});

	it('takes the intelligence from the Leader rather than from an input', () => {
		const state = inSetup();
		expect(state.player1.progress.schemeDraft.intelligence).toBe(ALICE_LEADER.int);
		expect(state.player2?.progress.schemeDraft.intelligence).toBe(BOB_LEADER.int);
	});

	it('maps a monster army faction onto the shared Monster Factions deck', () => {
		const oni: PickedArmy = { ...BOB_CUT, factionId: 'oni-clans' };
		let state = setCombatArmy(atPrepStart(), 'player2', oni);
		state = setLeader(state, 'player1', ALICE_LEADER);
		state = setLeader(state, 'player2', BOB_LEADER);
		state = leavePrep(state);
		expect(state.player2?.progress.schemeDraft.factionId).toBe('monster-factions');
	});

	it('choosing a scheme requires a drawn hand', () => {
		let state = inSetup();
		state = chooseSeatScheme(state, 'player1', 'head-hunt');
		expect(state.player1.progress.scheme, 'no drawn hand yet').toBeNull();
		state = setSeatDrawnSchemes(state, 'player1', ['head-hunt', 'stand-your-ground']);
		state = chooseSeatScheme(state, 'player1', 'head-hunt');
		expect(state.player1.progress.scheme).toEqual({
			schemeId: 'head-hunt',
			factionId: 'helian-league',
			intelligence: 14,
			checkedIncrements: 0
		});
	});

	it('rejects choosing a card that is not in the drawn hand', () => {
		let state = inSetup();
		state = setSeatDrawnSchemes(state, 'player1', ['head-hunt']);
		expect(canChooseSeatScheme(state, 'player1', 'martial-valor')).toBe(false);
		state = chooseSeatScheme(state, 'player1', 'martial-valor');
		expect(state.player1.progress.scheme).toBeNull();
		expect(canChooseSeatScheme(state, 'player1', 'head-hunt')).toBe(true);
	});

	it('choosing a scheme discards the drawn hand', () => {
		const state = draftAndChooseScheme(inSetup(), 'player1');
		expect(state.player1.drawnSchemeIds).toEqual([]);
	});

	it('stores drawn scheme ids per seat', () => {
		const state = setSeatDrawnSchemes(inSetup(), 'player1', ['head-hunt', 'stand-your-ground']);
		expect(state.player1.drawnSchemeIds).toEqual(['head-hunt', 'stand-your-ground']);
		expect(state.player2?.drawnSchemeIds).toEqual([]);
	});

	it('clearing a scheme keeps the draft', () => {
		let state = draftAndChooseScheme(inSetup(), 'player1');
		state = clearSeatScheme(state, 'player1');
		expect(state.player1.progress.scheme).toBeNull();
		expect(state.player1.progress.schemeDraft).toEqual({
			factionId: 'helian-league',
			intelligence: 14
		});
	});

	it('is locked in the lobby, where neither the army nor the Leader has fixed a draft yet', () => {
		const state = lobbyWithBothPlayers();
		expect(state.player1.progress.schemeDraft).toEqual({ factionId: null, intelligence: null });
		expect(canDrawSchemes(state, 'player1')).toBe(false);
	});

	it('is locked during preparation and again once the rounds have begun', () => {
		const prep = inPrep();
		expect(canEditSetup(prep)).toBe(false);
		expect(setSeatDrawnSchemes(prep, 'player1', ['head-hunt'])).toBe(prep);

		let state = roundsBegun();
		expect(state.player1.progress.schemeDraft.intelligence).toBe(ALICE_LEADER.int);
		state = clearSeatScheme(state, 'player2');
		expect(state.player2?.progress.scheme).not.toBeNull();
	});
});

describe('readiness', () => {
	it('starts false on both seats', () => {
		const state = lobbyWithBothPlayers();
		expect(state.player1.ready).toBe(false);
		expect(state.player2?.ready).toBe(false);
		expect(bothReady(state)).toBe(false);
	});

	it('toggles per seat, so one seat cannot ready the other', () => {
		let state = lobbyWithBothPlayers();
		state = toggleReady(state, 'player1');
		expect(state.player1.ready).toBe(true);
		expect(state.player2?.ready, 'seat 2 is untouched').toBe(false);
		expect(bothReady(state)).toBe(false);
		state = toggleReady(state, 'player2');
		expect(bothReady(state)).toBe(true);
		state = toggleReady(state, 'player2');
		expect(bothReady(state), 'ready is a toggle, not a latch').toBe(false);
	});

	it('is a lobby-only signal', () => {
		expect(canToggleReady(lobbyWithBothPlayers(), 'player2')).toBe(true);
		const prep = atPrepStart();
		expect(prep.status).toBe('active');
		expect(canToggleReady(prep, 'player1')).toBe(false);
		expect(toggleReady(prep, 'player1')).toBe(prep);
	});

	it('cannot be toggled for an empty seat', () => {
		const state = newGame();
		expect(canToggleReady(state, 'player2')).toBe(false);
		expect(toggleReady(state, 'player2')).toBe(state);
	});

	it('survives into the public seat view', () => {
		let state = lobbyWithBothPlayers();
		expect(toPublicSeat(state.player2!, NO_REVEAL).ready).toBe(false);
		state = toggleReady(state, 'player2');
		expect(toPublicSeat(state.player2!, NO_REVEAL).ready).toBe(true);
	});
});

describe('startGame', () => {
	it('requires a mission and both seats ready, and opens preparation', () => {
		let state = lobbyWithBothPlayers();
		expect(canStartGame(state)).toBe(false);
		state = toggleReady(state, 'player1');
		expect(canStartGame(state), 'one seat ready is not enough').toBe(false);
		state = toggleReady(state, 'player2');
		expect(canStartGame(state)).toBe(true);
		state = startGame(state);
		expect(state.status).toBe('active');
		expect(state.currentRound).toBe(MIN_ROUND);
		expect(state.phase, 'Start Game opens the army reveal, not round 1').toBe('armies');
	});

	it('no longer asks for Schemes, which are chosen after preparation', () => {
		const state = readyUp(lobbyWithBothPlayers());
		expect(state.player1.progress.scheme).toBeNull();
		expect(state.player2?.progress.scheme).toBeNull();
		expect(canStartGame(state)).toBe(true);
	});
});

describe('the army reveal', () => {
	it('keeps the rosters shut in the lobby and opens them once the game runs', () => {
		const lobby = lobbyWithBothPlayers();
		expect(isRosterRevealed(lobby)).toBe(false);
		expect(toPublicSeat(lobby.player2!, NO_REVEAL).rosterCode).toBeNull();
		const reveal = atRevealStart();
		expect(reveal.phase).toBe('armies');
		expect(isRosterRevealed(reveal)).toBe(true);
	});

	it('publishes a roster code once revealed, and never a Standard list', () => {
		const reveal = atRevealStart();
		expect(toPublicSeat(reveal.player2!, ROSTER_ONLY).rosterCode).toBe(BOB_ARMY.code);
		expect(
			toPublicSeat(reveal.player1, ROSTER_ONLY).rosterCode,
			'a Standard registration is the match list'
		).toBeNull();
	});

	it('stays revealed after the game ends', () => {
		const finished = finishGame(activeScoringGame(), { player1: 1, player2: 0 });
		expect(isRosterRevealed(finished)).toBe(true);
	});

	it('leaves the reveal only forward', () => {
		const reveal = atRevealStart();
		expect(canLeaveArmies(reveal)).toBe(true);
		expect(leaveArmies(reveal).phase).toBe('prep');
		expect(canLeaveArmies(inPrep()), 'there is no way back').toBe(false);
		expect(leaveArmies(lobbyWithBothPlayers())).toEqual(lobbyWithBothPlayers());
	});
});

describe('preparation', () => {
	it('a Standard registration is its own combat army from the start', () => {
		const state = lobbyWithBothPlayers();
		expect(state.player1.combatArmy).toEqual(ALICE_ARMY);
		expect(toPublicSeat(state.player1, NO_REVEAL).combatReady).toBe(true);
	});

	it('a Roster registration has none until it is cut down', () => {
		const state = lobbyWithBothPlayers();
		expect(state.player2?.combatArmy).toBeNull();
		expect(bothCombatReady(state)).toBe(false);
		expect(toPublicSeat(state.player2!, NO_REVEAL).combatReady).toBe(false);
	});

	it('only the seat that brought a Roster may set a combat army', () => {
		const prep = atPrepStart();
		expect(canSetCombatArmy(prep, 'player1'), 'player1 registered Standard').toBe(false);
		expect(canSetCombatArmy(prep, 'player2')).toBe(true);
		expect(setCombatArmy(prep, 'player1', BOB_CUT)).toBe(prep);
	});

	it('is the only phase a combat army may be set in', () => {
		expect(canSetCombatArmy(lobbyWithBothPlayers(), 'player2'), 'still a lobby').toBe(false);
		expect(canSetCombatArmy(inSetup(), 'player2'), 'already past preparation').toBe(false);
	});

	it('accepts a re-cut, so the list stays editable until the table moves on', () => {
		const recut: PickedArmy = { ...BOB_CUT, code: 'aaaaa:2s:1' };
		let state = setCombatArmy(atPrepStart(), 'player2', BOB_CUT);
		state = setCombatArmy(state, 'player2', recut);
		expect(state.player2?.combatArmy?.code).toBe('aaaaa:2s:1');
	});

	it('leaves preparation only once both seats are combat-ready and led', () => {
		const stuck = atPrepStart();
		expect(canLeavePrep(stuck)).toBe(false);
		expect(leavePrep(stuck)).toBe(stuck);
		const noLeader = setCombatArmy(atPrepStart(), 'player2', BOB_CUT);
		expect(bothLeadersAssigned(noLeader), 'combat-ready is not enough').toBe(false);
		expect(canLeavePrep(noLeader)).toBe(false);
		expect(leavePrep(noLeader)).toBe(noLeader);
		expect(canLeavePrep(inPrep())).toBe(true);
		expect(leavePrep(inPrep()).phase).toBe('setup');
	});
});

describe('the Leader', () => {
	it('may be any copy of the combat army, and only during preparation', () => {
		const prep = inPrep();
		expect(canSetLeader(prep, 'player1')).toBe(true);
		expect(canSetLeader(prep, 'player2')).toBe(true);
		expect(canSetLeader(lobbyWithBothPlayers(), 'player1'), 'still a lobby').toBe(false);
		expect(canSetLeader(inSetup(), 'player1'), 'the cut is final by then').toBe(false);
	});

	it('cannot be chosen before there is a match list to choose from', () => {
		expect(canSetLeader(atPrepStart(), 'player2'), 'Bob has not cut yet').toBe(false);
	});

	it('stores the declared statistics and keeps the entry id private', () => {
		const state = setLeader(inPrep(), 'player1', { entryId: 'imported-1', m: 10, int: 8 });
		expect(state.player1.leader).toEqual({ entryId: 'imported-1', m: 10, int: 8 });
		const view = viewForSeat(state, 'player2');
		expect(JSON.stringify(view!.opponent), 'the identity never travels').not.toContain(
			'imported-1'
		);
		expect(
			view!.opponent!.leaderStats,
			'and the stats are not published during preparation'
		).toBeNull();
	});

	it('publishes M and INT from Scheme selection on, and nothing before', () => {
		const prep = setLeader(inPrep(), 'player1', { entryId: 'imported-1', m: 10, int: 8 });
		expect(isLeaderStatsRevealed(prep)).toBe(false);
		expect(toPublicSeat(prep.player1, ROSTER_ONLY).leaderStats).toBeNull();
		const setup = leavePrep(prep);
		expect(isLeaderStatsRevealed(setup)).toBe(true);
		expect(toPublicSeat(setup.player1, { roster: true, leaderStats: true }).leaderStats).toEqual({
			m: 10,
			int: 8
		});
	});

	it('is cleared when the match list is re-cut', () => {
		let state = setLeader(inPrep(), 'player2', { entryId: 'imported-1', m: 9, int: 7 });
		expect(state.player2?.leader).not.toBeNull();
		state = setCombatArmy(state, 'player2', { ...BOB_CUT, code: 'aaaaa:2s:9' });
		expect(state.player2?.leader, 'the old copy ids would dangle').toBeNull();
	});

	it('can be un-assigned', () => {
		let state = setLeader(inPrep(), 'player1', { entryId: 'imported-1', m: 10, int: 8 });
		state = setLeader(state, 'player1', null);
		expect(state.player1.leader).toBeNull();
	});
});

describe('startRounds', () => {
	it('needs both Schemes, and opens round 1 in the reveal phase', () => {
		let state = inSetup();
		expect(canStartRounds(state)).toBe(false);
		state = draftAndChooseScheme(state, 'player1');
		expect(canStartRounds(state), 'one Scheme is not enough').toBe(false);
		state = draftAndChooseScheme(state, 'player2');
		expect(canStartRounds(state)).toBe(true);
		state = startRounds(state);
		expect(state.phase).toBe('reveal');
		expect(state.currentRound).toBe(MIN_ROUND);
	});

	it('is not available outside the setup phase', () => {
		expect(canStartRounds(inPrep())).toBe(false);
		expect(canStartRounds(roundsBegun())).toBe(false);
		expect(startRounds(inPrep())).toEqual(inPrep());
	});
});

describe('reveal intent and advanceToScoring', () => {
	it('toggles intent only during the reveal phase and only with a scheme', () => {
		const setup = draftAndChooseScheme(inSetup(), 'player1');
		expect(toggleRevealIntent(setup, 'player1'), 'setup is not the reveal phase').toBe(setup);
		const state = roundsBegun();
		expect(toggleRevealIntent(state, 'player1').player1.revealIntent).toBe(true);
		expect(
			toggleRevealIntent(toggleRevealIntent(state, 'player1'), 'player1').player1.revealIntent
		).toBe(false);
	});

	it('advanceToScoring commits intents permanently and clears them', () => {
		let state = toggleRevealIntent(roundsBegun(), 'player1');
		state = advanceToScoring(state);
		expect(state.phase).toBe('scoring');
		expect(state.player1.progress.schemeRevealed).toBe(true);
		expect(state.player1.revealIntent).toBe(false);
		expect(state.player2?.progress.schemeRevealed).toBe(false);
	});
});

describe('scoring phase actions', () => {
	it('objectives are only editable during scoring and clamp to bounds', () => {
		let state = roundsBegun();
		expect(
			setSeatObjectiveChecked(state, 'player1', 'obj', 1, 1),
			'reveal phase freezes objectives'
		).toBe(state);
		state = advanceToScoring(state);
		state = setSeatObjectiveChecked(state, 'player1', 'obj', 1, 1);
		expect(state.player1.progress.checkedObjectiveCounts.obj).toBe(1);
		expect(state.player2?.progress.checkedObjectiveCounts.obj).toBeUndefined();
		state = setSeatObjectiveChecked(state, 'player1', 'obj', 5, 2);
		expect(state.player1.progress.checkedObjectiveCounts.obj).toBe(2);
	});

	it('scheme boxes are only editable by the owner during scoring', () => {
		let state = revealedScoringGame();
		state = setSeatSchemeChecked(state, 'player1', 2, 3);
		expect(state.player1.progress.scheme?.checkedIncrements).toBe(2);
		expect(state.player2?.progress.scheme?.checkedIncrements).toBe(0);
	});

	it('hidden schemes cannot be scored — boxes unlock only once revealed', () => {
		let state = activeScoringGame();
		expect(canScoreSeatScheme(state, 'player1')).toBe(false);
		state = setSeatSchemeChecked(state, 'player1', 2, 3);
		expect(state.player1.progress.scheme?.checkedIncrements, 'hidden scheme stays at 0').toBe(0);
		state = {
			...state,
			player1: { ...state.player1, progress: { ...state.player1.progress, schemeRevealed: true } }
		};
		expect(canScoreSeatScheme(state, 'player1')).toBe(true);
		state = setSeatSchemeChecked(state, 'player1', 2, 3);
		expect(state.player1.progress.scheme?.checkedIncrements).toBe(2);
	});
});

describe('snapshotAndProceed', () => {
	it('snapshots the round, advances, and enters the reveal phase', () => {
		let state = activeScoringGame();
		state = snapshotAndProceed(state, { player1: 3, player2: 1 });
		expect(state.roundSnapshots[1]).toEqual({ player1: 3, player2: 1 });
		expect(state.currentRound).toBe(2);
		expect(state.phase).toBe('reveal');
	});

	it('skips the reveal phase when both schemes are already revealed', () => {
		let state = activeScoringGame();
		state = {
			...state,
			player1: { ...state.player1, progress: { ...state.player1.progress, schemeRevealed: true } },
			player2: state.player2
				? { ...state.player2, progress: { ...state.player2.progress, schemeRevealed: true } }
				: null
		};
		expect(bothSchemesRevealed(state)).toBe(true);
		state = snapshotAndProceed(state, { player1: 0, player2: 0 });
		expect(state.currentRound).toBe(2);
		expect(state.phase).toBe('scoring');
	});

	it('does not proceed past the last round', () => {
		let state = activeScoringGame();
		state = { ...state, currentRound: MAX_ROUND };
		expect(snapshotAndProceed(state, { player1: 1, player2: 1 })).toBe(state);
	});
});

describe('finishGame', () => {
	it('snapshots round 5, auto-reveals, computes the winner and finishes', () => {
		let state = activeScoringGame();
		state = { ...state, currentRound: MAX_ROUND };
		state = finishGame(state, { player1: 7, player2: 4 });
		expect(state.status).toBe('finished');
		expect(state.winner).toBe('player1');
		expect(state.roundSnapshots[MAX_ROUND]).toEqual({ player1: 7, player2: 4 });
		expect(state.player1.progress.schemeRevealed).toBe(true);
		expect(state.player2?.progress.schemeRevealed).toBe(true);
		expect(state.resultSummary).toEqual({
			winner: 'player1',
			finalVp: { player1: 7, player2: 4 },
			roundsPlayed: MAX_ROUND,
			season: 'Season 2',
			missionId: 'obelisk-strike',
			// Each seat's Scheme faction is the one its combat army belongs to.
			factions: { player1: 'helian-league', player2: 'sand-kingdoms' }
		});
	});

	it('reports a draw on equal VP', () => {
		let state = activeScoringGame();
		state = { ...state, currentRound: MAX_ROUND };
		state = finishGame(state, { player1: 5, player2: 5 });
		expect(state.winner).toBe('draw');
	});

	it('refuses to finish outside round 5 scoring', () => {
		const state = activeScoringGame();
		expect(finishGame(state, { player1: 1, player2: 0 })).toBe(state);
	});
});

describe('closeGame', () => {
	it('closes lobby and active games but never overrides finished', () => {
		const lobby = newGame();
		expect(closeGame(lobby).status).toBe('closed');
		expect(closeGame(activeScoringGame()).status).toBe('closed');
		let finished = activeScoringGame();
		finished = { ...finished, currentRound: MAX_ROUND };
		finished = finishGame(finished, { player1: 1, player2: 0 });
		expect(closeGame(finished).status).toBe('finished');
	});
});

describe('visibility', () => {
	it('toPublicSeat hides an unrevealed scheme but shows the faction', () => {
		const state = draftAndChooseScheme(inSetup(), 'player2');
		const view = toPublicSeat(state.player2!, ROSTER_ONLY);
		expect(view.nickname).toBe('bob');
		expect(view.factionId).toBe('sand-kingdoms');
		expect(view.hasScheme).toBe(true);
		expect(view.schemeRevealed).toBe(false);
		expect(view.revealedScheme).toBeNull();
	});

	it('toPublicSeat shows the army identity but never its code', () => {
		const view = toPublicSeat(lobbyWithBothPlayers().player2!, NO_REVEAL);
		expect(view.army).toEqual({
			name: 'Bob Roster',
			factionId: 'sand-kingdoms',
			format: 'roster'
		});
		expect(view.rosterCode, 'the lobby is before the reveal').toBeNull();
		expect(JSON.stringify(view)).not.toContain(BOB_ARMY.code);
	});

	it('toPublicSeat exposes the scheme once revealed', () => {
		let state = toggleRevealIntent(roundsBegun(), 'player1');
		state = advanceToScoring(state);
		const view = toPublicSeat(state.player1, ROSTER_ONLY);
		expect(view.schemeRevealed).toBe(true);
		expect(view.revealedScheme?.schemeId).toBe('head-hunt');
	});

	it('viewForSeat gives the seat its own secrets and a filtered opponent', () => {
		let state = draftAndChooseScheme(inSetup(), 'player1');
		state = draftAndChooseScheme(state, 'player2');
		const view = viewForSeat(state, 'player1');
		expect(view).not.toBeNull();
		expect(view!.seat).toBe('player1');
		expect(view!.self.progress.scheme?.schemeId).toBe('head-hunt');
		expect(view!.self.army).toEqual(ALICE_ARMY);
		expect(view!.opponent?.revealedScheme).toBeNull();
		expect(view!.opponent?.factionId).toBe('sand-kingdoms');
		expect(view!.opponent?.army.name).toBe('Bob Roster');
		expect(view!.opponent?.rosterCode, 'the roster is public once the game is running').toBe(
			BOB_ARMY.code
		);
	});

	it('viewForSeat keeps the cut match list with its owner', () => {
		const state = inPrep();
		const bob = viewForSeat(state, 'player2');
		const alice = viewForSeat(state, 'player1');
		expect(bob?.self.combatArmy?.code).toBe(BOB_CUT.code);
		expect(alice?.opponent?.combatReady).toBe(true);
		expect(JSON.stringify(alice?.opponent)).not.toContain(BOB_CUT.code);
	});

	it('viewForSeat returns null for an empty seat', () => {
		const state = newGame();
		expect(viewForSeat(state, 'player2')).toBeNull();
	});

	it('viewForSeat exposes the result summary once the game is finished', () => {
		let state = activeScoringGame();
		state = { ...state, currentRound: MAX_ROUND };
		state = finishGame(state, { player1: 7, player2: 4 });
		const view = viewForSeat(state, 'player2');
		expect(view?.resultSummary?.winner).toBe('player1');
		expect(view?.resultSummary?.finalVp).toEqual({ player1: 7, player2: 4 });
	});
});
