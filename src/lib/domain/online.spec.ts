import { describe, expect, it } from 'vitest';
import { MAX_ROUND, MIN_ROUND } from './progress';
import {
	acceptJoin,
	advanceToScoring,
	bothSchemesRevealed,
	canChooseSeatScheme,
	canDrawSchemes,
	canRequestJoin,
	canSelectMission,
	canStartGame,
	chooseSeatScheme,
	clearSeatScheme,
	closeGame,
	createOnlineGame,
	denyJoin,
	finishGame,
	MAX_NICKNAME_LENGTH,
	normalizeNickname,
	requestJoin,
	seatForTokenHash,
	selectMission,
	setSeatDrawnSchemes,
	setSeatDraft,
	setSeatObjectiveChecked,
	setSeatSchemeChecked,
	snapshotAndProceed,
	startGame,
	toggleRevealIntent,
	toPublicSeat,
	viewForSeat,
	type OnlineGameState
} from './online';

const CREATED_AT = '2026-08-20T18:00:00.000Z';

function lobbyWithBothPlayers(): OnlineGameState {
	let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
	state = requestJoin(state, 'bob', 'hash-b');
	state = acceptJoin(state);
	state = selectMission(state, 'Season 2', 'obelisk-strike');
	return state;
}

function draftAndChooseScheme(
	state: OnlineGameState,
	seat: 'player1' | 'player2'
): OnlineGameState {
	let next = setSeatDraft(state, seat, { factionId: 'helian-league', intelligence: 14 });
	next = setSeatDrawnSchemes(next, seat, ['head-hunt', 'stand-your-ground']);
	next = chooseSeatScheme(next, seat, 'head-hunt');
	return next;
}

function activeScoringGame(): OnlineGameState {
	let state = lobbyWithBothPlayers();
	state = draftAndChooseScheme(state, 'player1');
	state = draftAndChooseScheme(state, 'player2');
	state = startGame(state);
	state = advanceToScoring(state);
	return state;
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
		const state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
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
});

describe('join flow', () => {
	it('records a join request and answers canRequestJoin', () => {
		const state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		expect(canRequestJoin(state)).toBe(true);
		const requested = requestJoin(state, 'bob', 'hash-b');
		expect(requested.pendingJoin).toEqual({ nickname: 'bob', tokenHash: 'hash-b' });
		expect(canRequestJoin(requested)).toBe(false);
	});

	it('ignores a second request while one is pending', () => {
		let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		state = requestJoin(state, 'bob', 'hash-b');
		state = requestJoin(state, 'mallory', 'hash-m');
		expect(state.pendingJoin?.nickname).toBe('bob');
	});

	it('accept fills seat player2 with the pending nickname and token hash', () => {
		let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		state = requestJoin(state, 'bob', 'hash-b');
		state = acceptJoin(state);
		expect(state.player2?.nickname).toBe('bob');
		expect(state.player2?.tokenHash).toBe('hash-b');
		expect(state.pendingJoin).toBeNull();
	});

	it('accept without a pending request is a no-op', () => {
		const state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		expect(acceptJoin(state)).toBe(state);
	});

	it('deny clears the pending request', () => {
		let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		state = requestJoin(state, 'bob', 'hash-b');
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

describe('selectMission', () => {
	it('requires player 2 to have joined', () => {
		let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		expect(canSelectMission(state)).toBe(false);
		expect(selectMission(state, 'Season 2', 'm1')).toBe(state);
		state = requestJoin(state, 'bob', 'hash-b');
		state = acceptJoin(state);
		expect(canSelectMission(state)).toBe(true);
		state = selectMission(state, 'Season 2', 'm1');
		expect(state.season).toBe('Season 2');
		expect(state.missionId).toBe('m1');
	});
});

describe('scheme setup', () => {
	it('choosing a scheme requires a complete draft and a drawn hand', () => {
		let state = lobbyWithBothPlayers();
		state = chooseSeatScheme(state, 'player1', 'head-hunt');
		expect(state.player1.progress.scheme).toBeNull();
		state = setSeatDraft(state, 'player1', { factionId: 'helian-league' });
		state = chooseSeatScheme(state, 'player1', 'head-hunt');
		expect(state.player1.progress.scheme).toBeNull();
		state = setSeatDraft(state, 'player1', { intelligence: 14 });
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
		let state = lobbyWithBothPlayers();
		state = setSeatDraft(state, 'player1', { factionId: 'helian-league', intelligence: 14 });
		state = setSeatDrawnSchemes(state, 'player1', ['head-hunt']);
		expect(canChooseSeatScheme(state, 'player1', 'martial-valor')).toBe(false);
		state = chooseSeatScheme(state, 'player1', 'martial-valor');
		expect(state.player1.progress.scheme).toBeNull();
		expect(canChooseSeatScheme(state, 'player1', 'head-hunt')).toBe(true);
	});

	it('choosing a scheme discards the drawn hand', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		expect(state.player1.drawnSchemeIds).toEqual([]);
	});

	it('stores drawn scheme ids per seat', () => {
		let state = lobbyWithBothPlayers();
		state = setSeatDrawnSchemes(state, 'player1', ['head-hunt', 'stand-your-ground']);
		expect(state.player1.drawnSchemeIds).toEqual(['head-hunt', 'stand-your-ground']);
		expect(state.player2?.drawnSchemeIds).toEqual([]);
	});

	it('clearing a scheme keeps the draft', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = clearSeatScheme(state, 'player1');
		expect(state.player1.progress.scheme).toBeNull();
		expect(state.player1.progress.schemeDraft).toEqual({
			factionId: 'helian-league',
			intelligence: 14
		});
	});

	it('setup edits are locked until player 2 has joined', () => {
		let state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		state = setSeatDraft(state, 'player1', { factionId: 'helian-league' });
		expect(state.player1.progress.schemeDraft.factionId).toBeNull();
		expect(canDrawSchemes(state, 'player1')).toBe(false);
	});

	it('setup edits are locked once the game has started', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		state = startGame(state);
		state = setSeatDraft(state, 'player1', { intelligence: 16 });
		expect(state.player1.progress.schemeDraft.intelligence).toBe(14);
		state = clearSeatScheme(state, 'player2');
		expect(state.player2?.progress.scheme).not.toBeNull();
	});
});

describe('startGame', () => {
	it('requires a mission and both schemes', () => {
		let state = lobbyWithBothPlayers();
		expect(canStartGame(state)).toBe(false);
		state = draftAndChooseScheme(state, 'player1');
		expect(canStartGame(state)).toBe(false);
		state = draftAndChooseScheme(state, 'player2');
		expect(canStartGame(state)).toBe(true);
		state = startGame(state);
		expect(state.status).toBe('active');
		expect(state.currentRound).toBe(MIN_ROUND);
		expect(state.phase).toBe('reveal');
	});
});

describe('reveal intent and advanceToScoring', () => {
	it('toggles intent only during the reveal phase and only with a scheme', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		expect(toggleRevealIntent(state, 'player1'), 'lobby is not reveal phase').toBe(state);
		state = startGame(state);
		expect(toggleRevealIntent(state, 'player1').player1.revealIntent).toBe(true);
		expect(
			toggleRevealIntent(toggleRevealIntent(state, 'player1'), 'player1').player1.revealIntent
		).toBe(false);
	});

	it('advanceToScoring commits intents permanently and clears them', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		state = startGame(state);
		state = toggleRevealIntent(state, 'player1');
		state = advanceToScoring(state);
		expect(state.phase).toBe('scoring');
		expect(state.player1.progress.schemeRevealed).toBe(true);
		expect(state.player1.revealIntent).toBe(false);
		expect(state.player2?.progress.schemeRevealed).toBe(false);
	});
});

describe('scoring phase actions', () => {
	it('objectives are only editable during scoring and clamp to bounds', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		state = startGame(state);
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
		let state = activeScoringGame();
		state = setSeatSchemeChecked(state, 'player1', 2, 3);
		expect(state.player1.progress.scheme?.checkedIncrements).toBe(2);
		expect(state.player2?.progress.scheme?.checkedIncrements).toBe(0);
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
		const lobby = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
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
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player2');
		const view = toPublicSeat(state.player2!);
		expect(view.nickname).toBe('bob');
		expect(view.factionId).toBe('helian-league');
		expect(view.hasScheme).toBe(true);
		expect(view.schemeRevealed).toBe(false);
		expect(view.revealedScheme).toBeNull();
	});

	it('toPublicSeat exposes the scheme once revealed', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		state = startGame(state);
		state = toggleRevealIntent(state, 'player1');
		state = advanceToScoring(state);
		const view = toPublicSeat(state.player1);
		expect(view.schemeRevealed).toBe(true);
		expect(view.revealedScheme?.schemeId).toBe('head-hunt');
	});

	it('viewForSeat gives the seat its own secrets and a filtered opponent', () => {
		let state = lobbyWithBothPlayers();
		state = draftAndChooseScheme(state, 'player1');
		state = draftAndChooseScheme(state, 'player2');
		const view = viewForSeat(state, 'player1');
		expect(view).not.toBeNull();
		expect(view!.seat).toBe('player1');
		expect(view!.self.progress.scheme?.schemeId).toBe('head-hunt');
		expect(view!.opponent?.revealedScheme).toBeNull();
		expect(view!.opponent?.factionId).toBe('helian-league');
	});

	it('viewForSeat returns null for an empty seat', () => {
		const state = createOnlineGame('K3FQZ2', 'alice', 'hash-a', CREATED_AT);
		expect(viewForSeat(state, 'player2')).toBeNull();
	});
});
