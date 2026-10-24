<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		armyCopyCounts,
		battleFlowersFor,
		battleReportRounds,
		battleReportStats,
		battleReportUnits,
		buildBattleReportPdf,
		calculateTwoPlayerVP,
		foldHistory,
		getMissionsForSeason,
		getScoreableResults,
		getSeasons,
		groupResults,
		groupSavedArmies,
		indexArmyRules,
		pickedArmyFormat,
		resolveArmyEntries,
		savedArmyFormat,
		seatPublishedRoster,
		summonableUnits,
		tournamentReportMatches,
		tournamentReportStats,
		tournamentTableLine,
		buildTournamentReportPdf,
		undoableAction,
		vitalityAfterDamage,
		vitalityAfterHeal,
		vitalityAfterStagger,
		vitalityAfterStamina,
		vitalityAfterStatuses,
		vitalityAfterStun,
		type ArmyFormat,
		type ArmyRosterRow,
		type ArmyView,
		type BattleReportInput,
		type BattleReportPlayer,
		type Mission,
		type OpenGame,
		type PickedArmy,
		type PlayerKey,
		type SavedArmy,
		type TournamentReportInput,
		type VitalityBases,
		type VitalityCommitInput,
		type VitalityTarget
	} from '$lib/domain';
	import { downloadPdf } from '$lib/data/reportDownload';
	import {
		armyBuilderStore,
		contentStore,
		missionProgressStore,
		navigationStore,
		onlineGameStore,
		tournamentEventStore,
		tournamentStore,
		twoPlayerProgressStore
	} from '$lib/stores';
	import GameModeSelect from '$lib/components/GameModeSelect.svelte';
	import ArmyBuilderView from '$lib/components/ArmyBuilderView.svelte';
	import ArmyFactionSelect from '$lib/components/ArmyFactionSelect.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadArmyDialog from '$lib/components/LoadArmyDialog.svelte';
	import SaveArmyDialog from '$lib/components/SaveArmyDialog.svelte';
	import SeasonSelect from '$lib/components/SeasonSelect.svelte';
	import MissionSelect from '$lib/components/MissionSelect.svelte';
	import MissionBriefing from '$lib/components/MissionBriefing.svelte';
	import MissionDetail from '$lib/components/MissionDetail.svelte';
	import MissionDetailTwoPlayer from '$lib/components/MissionDetailTwoPlayer.svelte';
	import OnlineCreate from '$lib/components/OnlineCreate.svelte';
	import OnlineTracker from '$lib/components/OnlineTracker.svelte';
	import OnlineIntroNotice from '$lib/components/OnlineIntroNotice.svelte';
	import OnlineJoin from '$lib/components/OnlineJoin.svelte';
	import OnlineLobby from '$lib/components/OnlineLobby.svelte';
	import OnlineArmyPrep from '$lib/components/OnlineArmyPrep.svelte';
	import OnlineArmyReveal from '$lib/components/OnlineArmyReveal.svelte';
	import OnlineSchemeSelect from '$lib/components/OnlineSchemeSelect.svelte';
	import OnlineStats from '$lib/components/OnlineStats.svelte';
	import PickArmyDialog from '$lib/components/PickArmyDialog.svelte';
	import TournamentSetup from '$lib/components/TournamentSetup.svelte';
	import TournamentLobby from '$lib/components/TournamentLobby.svelte';
	import TournamentJoin from '$lib/components/TournamentJoin.svelte';
	import TournamentRoundPrep from '$lib/components/TournamentRoundPrep.svelte';
	import TournamentResults from '$lib/components/TournamentResults.svelte';
	import TournamentUnavailable from '$lib/components/TournamentUnavailable.svelte';
	import type { BriefingArmy } from '$lib/components/briefingArmy';
	import type { MegaphoneInbox } from '$lib/components/toMegaphone';

	contentStore.load();

	/** A local game left open by a previous visit, awaiting the resume-or-abandon choice. */
	let resumableGame = $state<{ game: OpenGame; mission: Mission } | null>(null);
	/** A tournament seat held by this device, awaiting the same choice. */
	let resumableTournament = $state(false);
	/** The lobby's own ← asked whether to abandon; same dialog, same server call. */
	let abandoningFromLobby = $state(false);
	let abandoningTournament = $state(false);

	// Resume an online seat from a previous visit if any, then a tournament seat, and only
	// then offer the open local game.
	onMount(() => {
		void onlineGameStore.resumeSession().then(async (resumed) => {
			if (resumed) {
				navigationStore.enterOnlineGame();
				// A table's match is a detour from an event this device still holds a seat in.
				// Resuming that too — silently, with no prompt, because the player is already
				// where they belong — is what keeps the organizer's megaphone reaching them and
				// gives the match's exits a tournament to go back to.
				if (onlineGameStore.view?.tournament) await tournamentEventStore.resumeSession();
				return;
			}
			void tournamentEventStore.resumeSession().then((resumedTournament) => {
				if (resumedTournament) {
					// Not straight into the lobby: the player chooses to return, and abandoning
					// has server-side consequences they should see spelled out first.
					resumableTournament = true;
					return;
				}
				resumableGame = navigationStore.findResumableGame();
			});
		});
	});

	/** The screens a live tournament shows, which its status switches between. */
	function onTournamentScreen(): boolean {
		return (
			navigationStore.screen === 'tournament-lobby' ||
			navigationStore.screen === 'tournament-round' ||
			navigationStore.screen === 'tournament-results'
		);
	}

	/** Where an event's status puts a device that is following it — never a click. */
	function followTournamentStatus(): void {
		const status = tournamentEventStore.view?.status;
		if (status === 'active') navigationStore.enterTournamentRound();
		else if (status === 'concluded') navigationStore.enterTournamentResults();
		else navigationStore.enterTournamentLobby();
	}

	/** A cancelled tournament has no screen left — go home and let the menu say what happened. */
	$effect(() => {
		if (tournamentEventStore.notice && onTournamentScreen()) {
			resumableTournament = false;
			abandoningFromLobby = false;
			navigationStore.leaveTournamentLobby();
		}
	});

	/**
	 * The event's status decides which screen a device shows: the organizer starting it moves
	 * every participant to the round, and concluding it moves them to the final standing, over the
	 * change notification. Only followed while a tournament screen is up, so a device that walked
	 * away to the menu — or into its match — is never yanked back.
	 */
	$effect(() => {
		const status = tournamentEventStore.view?.status;
		if (!status || !onTournamentScreen()) return;
		followTournamentStatus();
	});

	let showTournamentAbandon = $derived(resumableTournament || abandoningFromLobby);
	let tournamentConcluded = $derived(tournamentEventStore.view?.status === 'concluded');
	let tournamentAbandonText = $derived.by(() => {
		const name = tournamentEventStore.tournamentName;
		const what = name ? `"${name}"` : 'this tournament';
		// Nothing is given up any more: the event is over, and its results stay on the server for
		// the report window whether this device keeps its seat or not.
		if (tournamentConcluded) {
			return `${what} has concluded. Leaving clears it from this device.`;
		}
		return tournamentEventStore.isOrganizer
			? `You are the organizer of ${what}. Abandoning it cancels the tournament and deletes it for everyone.`
			: `You are participating in ${what}. Abandoning it gives up your seat.`;
	});
	let tournamentAbandonLabel = $derived(tournamentConcluded ? 'Leave' : 'Abandon');

	/** The prompt's safe branch — back onto the screen the event is on, which resynchronizes. */
	function returnToTournament(): void {
		resumableTournament = false;
		abandoningFromLobby = false;
		// Without a view (the resume fetch failed) the lobby's retry panel is the honest landing
		// spot; the status effect above moves on from there once a view arrives.
		followTournamentStatus();
	}

	/**
	 * The prompt's destructive branch, and the only way out of a tournament: a player frees their
	 * seat, the organizer cancels the event. A failed call keeps the dialog open with the reason,
	 * because leaving silently would strand a seat nobody can take.
	 */
	async function abandonTournament(): Promise<void> {
		abandoningTournament = true;
		const abandoned = await tournamentEventStore.abandon();
		abandoningTournament = false;
		if (!abandoned) return;
		resumableTournament = false;
		abandoningFromLobby = false;
		navigationStore.leaveTournamentLobby();
	}

	function resumeOpenGame(): void {
		if (resumableGame) navigationStore.resumeOpenGame(resumableGame.game, resumableGame.mission);
		resumableGame = null;
	}

	/**
	 * The organizer's megaphone, as the header widget takes it: this seat's inbox and the count
	 * that makes it glow. Null for the organizer, who sends rather than reads, and null for a
	 * device with no seat — which is what keeps it off every screen that is not part of an event.
	 */
	let megaphone = $derived.by((): MegaphoneInbox | null => {
		const view = tournamentEventStore.view;
		if (!view || view.role === 'organizer') return null;
		return {
			messages: view.messages,
			unread: view.unreadMessages,
			onRead: () => void tournamentEventStore.readMessages()
		};
	});

	/**
	 * The same inbox, but only while this device sits in a match a tournament owns. A free online
	 * game has no organizer shouting at it, and showing an event's messages inside an unrelated
	 * match would be the app talking to the wrong room.
	 */
	let tableMegaphone = $derived(onlineGameStore.view?.tournament ? megaphone : null);

	/**
	 * A player sits down at their table's match. The server hands back an ordinary online seat —
	 * the first of the two to press creates the game, the second joins the same one — so from here
	 * the match is an ordinary online game and this device follows the ordinary online flow.
	 */
	async function enterTableGame(tableIndex: number): Promise<void> {
		const gameId = tournamentEventStore.view?.round?.tables[tableIndex]?.match.gameId ?? null;
		// A match this device is already in is a navigation, not a new seat: entering again would
		// only mint a second token for the same chair and drop the one it is holding.
		if (gameId !== null && onlineGameStore.view?.id === gameId) {
			navigationStore.enterOnlineGame();
			return;
		}
		const session = await tournamentEventStore.enterTableGame(tableIndex);
		if (!session) return;
		await onlineGameStore.adoptSession(session);
		navigationStore.enterOnlineGame();
	}

	/** Walks out of a concluded event: no seat to free, so nothing to tell the server. */
	function leaveConcludedTournament(): void {
		tournamentEventStore.leaveConcluded();
		navigationStore.leaveTournamentLobby();
	}

	/** The startup prompt's destructive branch — discards the run and stays on the main menu. */
	function abandonResumableGame(): void {
		// The mode says which progress record the open game belongs to.
		if (resumableGame?.game.mode === 'two-player') twoPlayerProgressStore.abandonGame();
		else missionProgressStore.abandonGame();
		resumableGame = null;
	}

	let inviteUrl = $derived(
		browser && onlineGameStore.view
			? `${window.location.origin}/join/${onlineGameStore.view.id}`
			: ''
	);

	let seasons = $derived(getSeasons(contentStore.missions));
	let missionsForSeason = $derived(
		navigationStore.selectedSeason
			? getMissionsForSeason(contentStore.missions, navigationStore.selectedSeason)
			: []
	);
	let selectedMission = $derived(
		contentStore.missions.find((mission) => mission.id === navigationStore.selectedMissionId) ??
			null
	);
	let resultsForMission = $derived(selectedMission ? getScoreableResults(selectedMission) : []);
	/** Results grouped into per-round cards, shared by the briefing and the solo tracker. */
	let resultsEntries = $derived(groupResults(resultsForMission));

	// Online mode derived values
	let missionsBySeason = $derived(
		Object.fromEntries(
			seasons.map((season) => [season, getMissionsForSeason(contentStore.missions, season)])
		)
	);
	let onlineMission = $derived(
		onlineGameStore.view?.missionId
			? (contentStore.missions.find((mission) => mission.id === onlineGameStore.view?.missionId) ??
					null)
			: null
	);
	let onlineResults = $derived(onlineMission ? getScoreableResults(onlineMission) : []);
	let onlineEntries = $derived(groupResults(onlineResults));
	let onlineMyCard = $derived(
		onlineGameStore.view?.self.progress.scheme
			? (contentStore.schemes.find(
					(card) => card.id === onlineGameStore.view?.self.progress.scheme?.schemeId
				) ?? null)
			: null
	);
	let onlineOpponentRevealedCard = $derived(
		onlineGameStore.view?.opponent?.revealedScheme
			? (contentStore.schemes.find(
					(card) => card.id === onlineGameStore.view?.opponent?.revealedScheme?.schemeId
				) ?? null)
			: null
	);
	let onlineMyVP = $derived(onlineMission ? onlineGameStore.myVP(onlineMission, onlineMyCard) : 0);
	/**
	 * The opponent's running total, from what the filter publishes: their objective counts and,
	 * once revealed, their scheme and its boxes. A hidden scheme scores nothing, as on the table.
	 */
	let onlineOpponentVP = $derived.by(() => {
		const view = onlineGameStore.view;
		const opponent = view?.opponent ?? null;
		if (!onlineMission || !opponent) return 0;
		return calculateTwoPlayerVP(
			onlineMission,
			{
				checkedObjectiveCounts: opponent.checkedObjectiveCounts,
				scheme: opponent.revealedScheme,
				schemeDraft: { factionId: null, intelligence: null },
				schemeRevealed: opponent.schemeRevealed
			},
			onlineOpponentRevealedCard
		);
	});

	/**
	 * The roster a seat may browse. A Roster registration's contents are public once the game is
	 * running and never before; a Standard registration has no roster to reveal, because its
	 * registered list is the match list.
	 */
	function rosterViewFor(seat: PlayerKey): ArmyView | null {
		const view = onlineGameStore.view;
		if (view === null) return null;
		if (view.seat === seat) {
			const registered = view.self.army;
			if (pickedArmyFormat(registered) !== 'roster') return null;
			return contentStore.armyView(registered, {});
		}
		const opponent = view.opponent;
		if (opponent === null || opponent.rosterCode === null) return null;
		return contentStore.armyView(
			{
				name: opponent.army.name,
				factionId: opponent.army.factionId,
				code: opponent.rosterCode,
				format: 'roster'
			},
			{}
		);
	}

	let onlineRosterViews = $derived<Record<PlayerKey, ArmyView | null>>({
		player1: rosterViewFor('player1'),
		player2: rosterViewFor('player2')
	});

	// The online screens decode army codes — the roster browse, the Leader picker, the cut — and a
	// reload lands straight on them without ever passing a picker that loads the catalogs.
	$effect(() => {
		if (navigationStore.screen !== 'online-game') return;
		if (onlineGameStore.view === null) return;
		if (contentStore.armyLoaded) return;
		void contentStore.loadArmy();
	});

	/** This seat's own match list resolved into rows: what the Leader is chosen from. */
	let onlineCombatView = $derived.by(() =>
		onlineGameStore.view?.self.combatArmy
			? contentStore.armyView(onlineGameStore.view.self.combatArmy, {})
			: null
	);

	/** Assigns the Leader, declaring the two statistics the initiative roll will need. */
	function assignLeader(row: ArmyRosterRow): void {
		void onlineGameStore.setLeader({
			entryId: row.entryId,
			m: row.effectiveStats.M,
			int: row.effectiveStats.INT
		});
	}

	// --- the online flower board: the match's log, folded ---------------------------
	/**
	 * Both seats' boards and the sentences the history lists. Nothing stores vitality: the first
	 * pass builds the boards empty to learn each copy's base stats, the fold replays the log
	 * against those, and the second pass paints the result - so this device and the opponent's
	 * render the same log into the same maps.
	 */
	let onlineBoard = $derived.by(() => {
		const empty: Record<PlayerKey, ArmyView | null> = { player1: null, player2: null };
		const view = onlineGameStore.view;
		if (!view || view.phase !== 'playing') return { boards: empty, sentences: {} };
		const mine = view.seat;
		const theirs: PlayerKey = mine === 'player1' ? 'player2' : 'player1';
		const own = view.self.combatArmy ? contentStore.armyView(view.self.combatArmy, {}) : null;
		const opponent = view.opponent;
		const published = opponent?.combatRoster ?? null;
		const opp =
			published && opponent
				? contentStore.armyViewFromEntries(
						{
							name: opponent.army.name,
							factionId: opponent.army.factionId,
							format: opponent.army.format
						},
						published,
						{}
					)
				: null;
		const bases: VitalityBases = { player1: {}, player2: {} };
		for (const [seat, board] of [
			[mine, own],
			[theirs, opp]
		] as Array<[PlayerKey, ArmyView | null]>) {
			if (!board) continue;
			for (const flower of battleFlowersFor(board)) {
				bases[seat][flower.entryId] = {
					hp: flower.life?.max ?? 0,
					sta: flower.stamina?.max ?? null,
					undead: flower.undead
				};
			}
		}
		const fold = foldHistory(onlineGameStore.history, bases);
		const boards: Record<PlayerKey, ArmyView | null> = { player1: null, player2: null };
		// The folded summons ride along with the vitality: a creature is not in either published
		// roster, so the log is the only thing that knows it is out there at all.
		boards[mine] = own
			? {
					...own,
					vitality: fold.vitality[mine],
					summons: contentStore.summonRows(fold.summons[mine])
				}
			: null;
		boards[theirs] = opp
			? {
					...opp,
					vitality: fold.vitality[theirs],
					summons: contentStore.summonRows(fold.summons[theirs])
				}
			: null;
		return { boards, sentences: fold.sentences };
	});

	let onlineUndoableSeq = $derived.by(() => {
		const view = onlineGameStore.view;
		if (!view) return null;
		return undoableAction(onlineGameStore.history, view.seat)?.seq ?? null;
	});

	// The server cannot derive entry ids from the stored code - it loads no army catalogs - so
	// each device publishes its own board once the round runs. The guard is once-only server-side,
	// and the store swallows the 409 a duplicate publish races into.
	$effect(() => {
		const view = onlineGameStore.view;
		if (!view || view.phase !== 'playing') return;
		if (seatPublishedRoster(view.self) !== null) return;
		const entries = contentStore.armyEntries(view.self.combatArmy);
		if (!entries) return;
		void onlineGameStore.publishRoster(entries);
	});

	function onlineCommit(commit: VitalityCommitInput): void {
		void onlineGameStore.commitVitality(commit);
	}

	function onlineUndo(seq: number): void {
		void onlineGameStore.undoVitality(seq);
	}

	// --- the battle report ----------------------------------------------------------
	/**
	 * One seat as the report lists it. The own seat reads its full state, the opponent's the
	 * public view; both armies come from the folded boards, so the report lists exactly what the
	 * match's devices were rendering - including an opponent whose board never published.
	 */
	function reportPlayer(seat: PlayerKey): BattleReportPlayer | null {
		const view = onlineGameStore.view;
		if (!view) return null;
		const self = view.seat === seat;
		const seatView = self ? view.self : view.opponent;
		if (!seatView) return null;
		const army = seatView.army;
		const scheme = self ? view.self.progress.scheme : (view.opponent?.revealedScheme ?? null);
		const board = onlineBoard.boards[seat];
		const { units, totalPoints } = board
			? battleReportUnits(board)
			: { units: [], totalPoints: null };
		return {
			seat,
			nickname: seatView.nickname,
			armyName: army.name,
			factionName:
				contentStore.armyFactions.find((candidate) => candidate.id === army.factionId)?.name ??
				army.factionId,
			format: army.format === 'roster' ? 'Roster' : 'Standard',
			totalPoints,
			units,
			schemeTitle: scheme
				? (contentStore.schemes.find((card) => card.id === scheme.schemeId)?.title ??
					scheme.schemeId)
				: null,
			schemeIncrements: scheme?.checkedIncrements ?? null
		};
	}

	/**
	 * Builds the report and hands it to the browser as a download. Everything is assembled on
	 * this device from the view, the folded log and the local catalogs; no PDF is ever stored on
	 * the server or locally.
	 */
	function downloadBattleReport(): void {
		const view = onlineGameStore.view;
		const mission = onlineMission;
		if (!view || !mission) return;
		const nicknames: Record<PlayerKey, string> = {
			player1: reportPlayer('player1')?.nickname ?? 'Player 1',
			player2: reportPlayer('player2')?.nickname ?? 'Player 2'
		};
		const finalScore = view.resultSummary
			? {
					player1: view.resultSummary.finalVp.player1,
					player2: view.resultSummary.finalVp.player2
				}
			: null;
		const players = [reportPlayer('player1'), reportPlayer('player2')].filter(
			(player): player is BattleReportPlayer => player !== null
		);
		const input: BattleReportInput = {
			code: view.id,
			playedAt: onlineGameStore.startedAt,
			seasonName: view.season ?? 'Unknown season',
			missionName: mission.name,
			map: mission.map,
			players,
			rounds: battleReportRounds(
				onlineGameStore.history,
				onlineBoard.sentences,
				view.roundSnapshots,
				finalScore
			),
			finalScore,
			winner: view.resultSummary?.winner ?? null,
			...battleReportStats(onlineGameStore.history, nicknames)
		};
		downloadPdf(`oni-quest-battle-report-${view.id}.pdf`, buildBattleReportPdf(input));
	}

	// --- the tournament report ------------------------------------------------------
	let tournamentReportBusy = $state(false);

	/**
	 * The organizer's report: fetches the archived rounds and every match's interaction log,
	 * folds the field and the statistics out of them with the local catalogs, and hands the PDF
	 * to the browser. Nothing is stored - not here, not on the server.
	 */
	async function downloadTournamentReport(): Promise<void> {
		const view = tournamentEventStore.view;
		if (!view || tournamentReportBusy) return;
		tournamentReportBusy = true;
		try {
			// The organizer's device may never have opened the army builder, and the faction
			// names the report prints come from the army catalogs.
			await contentStore.loadArmy();
			const data = await tournamentEventStore.fetchReport();
			if (!data) return;
			const titleFor = (missionId: string) =>
				contentStore.missions.find((mission) => mission.id === missionId)?.name ?? missionId;
			const factionFor = (factionId: string) =>
				contentStore.armyFactions.find((faction) => faction.id === factionId)?.name ?? factionId;
			const stats = tournamentReportStats(tournamentReportMatches(data.rounds, data.matchLogs));
			const armies = view.standings.map((row) => {
				const seat = view.seats[row.seatIndex];
				return {
					place: row.place,
					nickname: row.name,
					armyName: seat?.army?.name ?? 'Unknown army',
					factionName: seat?.army ? factionFor(seat.army.factionId) : 'Unknown faction',
					organizer: seat?.organizer ?? false,
					victoryPoints: row.victoryPoints
				};
			});
			const input: TournamentReportInput = {
				name: view.name,
				code: view.code,
				organizerName: view.organizerName,
				externalLink: view.externalLink,
				createdAt: data.createdAt,
				concludedAt: data.concludedAt,
				missions: data.rounds.map((round) => ({
					round: round.number,
					title: titleFor(round.missionId)
				})),
				armies,
				tableNames: view.tableNames,
				rounds: data.rounds.map((round) => ({
					number: round.number,
					missionTitle: titleFor(round.missionId),
					tables: round.tables.map((table) => tournamentTableLine(table))
				})),
				damage: stats.damage,
				healing: stats.healing
			};
			downloadPdf(`oni-quest-tournament-report-${view.code}.pdf`, buildTournamentReportPdf(input));
		} finally {
			tournamentReportBusy = false;
		}
	}

	// --- cutting a registered Roster army down to a match list ---
	let onlineCutError = $state<string | null>(null);

	/**
	 * Borrows the army builder for the online prep step. The catalogs are loaded first because a
	 * reload lands straight on this screen without ever passing the picker that loads them, and
	 * decoding an army code needs them.
	 */
	async function openRosterCut(): Promise<void> {
		onlineCutError = null;
		const registered = onlineGameStore.view?.self.army ?? null;
		if (registered === null) return;
		await contentStore.loadArmy();
		const error = armyBuilderStore.beginRosterCut(registered.code);
		if (error === 'roster-mismatch') {
			onlineCutError = 'Your roster was built with a different army roster version.';
			return;
		}
		if (error !== null) {
			onlineCutError = 'This army code is not valid.';
			return;
		}
		navigationStore.borrowArmyBuilder('online-game');
	}

	/** Leaves the online game on this device only; the stored seat session resumes it later. */
	function leaveOnlineGame(): void {
		// A tournament table's match ends at its table: the event is still running and this device
		// still holds a seat in it, so the main menu would leave both of them behind. The game view
		// says so while it is loaded; a reconnect that never got that far falls back on the event
		// this device is still sitting in, which only a table's match can explain.
		const toTournament =
			onlineGameStore.view?.tournament != null || tournamentEventStore.view != null;
		onlineGameStore.leave();
		if (toTournament) navigationStore.leaveOnlineToTournament();
		else navigationStore.leaveOnline();
	}

	/**
	 * Steps off a live online screen without dropping the seat session, so the next app launch
	 * resumes into the same game. Clearing the session here would strand the seat: the server game
	 * lives on but the token that authenticates this device is gone.
	 */
	function stepAwayFromOnlineGame(): void {
		if (onlineGameStore.view?.tournament) navigationStore.leaveOnlineToTournament();
		else navigationStore.leaveOnline();
	}

	/** Hands the finished cut to the match. The code is read before leaving wipes the builder. */
	function acceptRosterCut(): void {
		const code = armyBuilderStore.acceptCut();
		const registered = onlineGameStore.view?.self.army ?? null;
		navigationStore.leaveArmyBuilder();
		if (code === null || registered === null) return;
		onlineCutError = null;
		void onlineGameStore.setCombatArmy({
			name: registered.name,
			factionId: registered.factionId,
			code,
			format: 'standard'
		});
	}

	// Solo mode derived values
	let chosenSchemeCard = $derived(
		missionProgressStore.progress?.scheme
			? (contentStore.schemes.find(
					(scheme) => scheme.id === missionProgressStore.progress?.scheme?.schemeId
				) ?? null)
			: null
	);
	let totalVP = $derived(
		selectedMission ? missionProgressStore.totalVP(selectedMission, chosenSchemeCard) : 0
	);

	// Two-player mode derived values
	let chosenCardP1 = $derived(
		twoPlayerProgressStore.progress?.player1.scheme
			? (contentStore.schemes.find(
					(s) => s.id === twoPlayerProgressStore.progress?.player1.scheme?.schemeId
				) ?? null)
			: null
	);
	let chosenCardP2 = $derived(
		twoPlayerProgressStore.progress?.player2.scheme
			? (contentStore.schemes.find(
					(s) => s.id === twoPlayerProgressStore.progress?.player2.scheme?.schemeId
				) ?? null)
			: null
	);
	let totalVPP1 = $derived(
		selectedMission ? twoPlayerProgressStore.totalVP('player1', selectedMission, chosenCardP1) : 0
	);
	let totalVPP2 = $derived(
		selectedMission ? twoPlayerProgressStore.totalVP('player2', selectedMission, chosenCardP2) : 0
	);
	let isTwoPlayer = $derived(navigationStore.gameMode === 'two-player');

	// Army builder derived values
	let armyFaction = $derived(
		armyBuilderStore.factionId
			? (contentStore.armyFactions.find((faction) => faction.id === armyBuilderStore.factionId) ??
					null)
			: null
	);
	let armyRows = $derived(
		resolveArmyEntries(
			armyBuilderStore.entries,
			armyBuilderStore.units,
			armyBuilderStore.mounts,
			armyBuilderStore.upgradeIndex,
			armyBuilderStore.itemIndex
		)
	);
	let armyCounts = $derived(armyCopyCounts(armyBuilderStore.entries));
	let armyClassIndex = $derived(indexArmyRules(contentStore.armyClasses));
	let armySkillIndex = $derived(indexArmyRules(contentStore.armySkills));
	let armyTraitIndex = $derived(indexArmyRules(contentStore.armyTraits));
	let armyCombatArtIndex = $derived(indexArmyRules(contentStore.armyCombatArts));
	let armySpellcraftIndex = $derived(indexArmyRules(contentStore.armySpellcrafts));
	let armyStratagemIndex = $derived(indexArmyRules(contentStore.armyStratagems));
	let armyItemIndex = $derived(indexArmyRules(contentStore.armyItems));

	// The armies attached to the current run, resolved for the read-only Army views.
	let armyView = $derived(missionProgressStore.armyView());
	let armyViewP1 = $derived(twoPlayerProgressStore.armyView('player1'));
	let armyViewP2 = $derived(twoPlayerProgressStore.armyView('player2'));

	/**
	 * Every creature a spell can put on the field, across both the summon tokens and the Undead
	 * that live in a faction's file. Each screen gates this per model - who may call what depends
	 * on the summoner's own spellcraft, Affinity and inventory, not on the pool.
	 */
	let summonPool = $derived(summonableUnits(contentStore.armyUnits));

	/** The bases a vitality commit needs for one board id, plus the view holding its record. */
	type VitalityBasesOf = { view: ArmyView; hp: number; sta: number | null };

	/**
	 * One board's bases for an id. An army copy reads them off its roster row, where upgrades and
	 * the mount are already applied; a summoned creature has no row, so it reads them off its own
	 * spec. Without that second branch a summon resolves to null and every flow against it -
	 * damage, healing, States, Stagger, Stun, activations - would silently no-op.
	 */
	function basesWithin(view: ArmyView, entryId: string): VitalityBasesOf | null {
		const summon = view.summons.find((candidate) => candidate.id === entryId);
		if (summon) return { view, hp: summon.unit.stats.HP ?? 0, sta: summon.unit.stats.STA };
		const row = view.rows.find((candidate) => candidate.entryId === entryId);
		return row ? { view, hp: row.effectiveStats.HP ?? 0, sta: row.effectiveStats.STA } : null;
	}

	/**
	 * A vitality flow's target resolved against the seat that owns it: the base stats a commit
	 * needs, plus the seat's own vitality map. Null when that seat fields nothing, its snapshot
	 * no longer decodes, or the id is on neither board.
	 */
	function seatBasesOf(target: VitalityTarget): VitalityBasesOf | null {
		const view = target.player === 'player1' ? armyViewP1 : armyViewP2;
		return view ? basesWithin(view, target.entryId) : null;
	}

	/**
	 * The solo run's bases for a vitality target. Solo fields one army, so unlike seatBasesOf
	 * there is no seat to look up - the target's entry id is the whole key.
	 */
	function soloBasesOf(target: VitalityTarget): VitalityBasesOf | null {
		return armyView ? basesWithin(armyView, target.entryId) : null;
	}

	function factionOf(army: PickedArmy | null) {
		return army
			? contentStore.armyFactions.find((faction) => faction.id === army.factionId)
			: undefined;
	}

	/**
	 * The briefing's army slots: one for solo, one per seat in hot-seat. Each carries its own
	 * button label, panel heading and colour, so the briefing itself stays mode-agnostic.
	 */
	let briefingArmies = $derived.by((): BriefingArmy[] => {
		if (!isTwoPlayer) {
			const picked = missionProgressStore.progress?.pickedArmy ?? null;
			return [
				{
					id: 'solo',
					pickLabel: 'Pick Army',
					panelTitle: 'Selected Army',
					hue: 'sky',
					army: picked,
					faction: factionOf(picked)
				}
			];
		}
		const pickedP1 = twoPlayerProgressStore.progress?.player1.pickedArmy ?? null;
		const pickedP2 = twoPlayerProgressStore.progress?.player2.pickedArmy ?? null;
		return [
			{
				id: 'player1',
				pickLabel: 'Pick P1 Army',
				panelTitle: 'Player 1 Army',
				hue: 'sky',
				army: pickedP1,
				faction: factionOf(pickedP1)
			},
			{
				id: 'player2',
				pickLabel: 'Pick P2 Army',
				panelTitle: 'Player 2 Army',
				hue: 'orange',
				army: pickedP2,
				faction: factionOf(pickedP2)
			}
		];
	});

	// A resumed run may carry armies whose catalogs are not loaded yet.
	$effect(() => {
		const attached =
			missionProgressStore.progress?.pickedArmy ??
			twoPlayerProgressStore.progress?.player1.pickedArmy ??
			twoPlayerProgressStore.progress?.player2.pickedArmy;
		if (attached && !contentStore.armyLoaded) {
			void contentStore.loadArmy();
		}
	});

	// The organizer's picked army resolved for display in the wizard's seat row.
	let organizerArmyFaction = $derived.by(() => {
		const army = tournamentStore.draft.organizerArmy;
		return army
			? contentStore.armyFactions.find((faction) => faction.id === army.factionId)
			: undefined;
	});

	// --- tournament creation and join ---
	let creatingTournament = $state(false);

	/** The overview's Create, behind the 48-hour retention notice: the first server contact. */
	async function createTournamentFromWizard(): Promise<void> {
		const draft = tournamentStore.draft;
		creatingTournament = true;
		const created = await tournamentEventStore.create({
			name: draft.name.trim(),
			externalLink: draft.externalLink.trim(),
			organizerName: draft.organizerName.trim(),
			organizerPlays: draft.organizerPlays,
			organizerArmy: draft.organizerArmy,
			participantCount: draft.participantCount,
			manualPairing: draft.manualPairing,
			missionIds: draft.missionIds,
			tableNames: draft.tableNames
		});
		creatingTournament = false;
		if (created) {
			tournamentStore.leave();
			navigationStore.enterTournamentLobby();
		}
	}

	let joinName = $state('');
	let joinArmy = $state<PickedArmy | null>(null);
	let joinArmyFaction = $derived.by(() =>
		joinArmy
			? contentStore.armyFactions.find((faction) => faction.id === joinArmy?.factionId)
			: undefined
	);
	let joinReady = $derived(
		tournamentEventStore.peek?.canJoin === true && joinName.trim() !== '' && joinArmy !== null
	);

	// Online drafts: the army each of the two online screens attaches, chosen locally before
	// any server call. Either format is allowed — a Roster list is cut down after the start.
	let onlineCreateArmy = $state<PickedArmy | null>(null);
	let onlineJoinArmy = $state<PickedArmy | null>(null);
	let onlineCreateArmyFaction = $derived.by(() =>
		onlineCreateArmy
			? contentStore.armyFactions.find((faction) => faction.id === onlineCreateArmy?.factionId)
			: undefined
	);
	let onlineJoinArmyFaction = $derived.by(() =>
		onlineJoinArmy
			? contentStore.armyFactions.find((faction) => faction.id === onlineJoinArmy?.factionId)
			: undefined
	);

	// Entering the join screen: a device that already holds a seat goes to the lobby, everyone
	// else gets the pre-join look at the tournament the code points at.
	$effect(() => {
		if (navigationStore.screen !== 'tournament-join') return;
		const code = navigationStore.tournamentJoinCode;
		if (!code) return;
		if (tournamentEventStore.code === code && tournamentEventStore.view) {
			navigationStore.enterTournamentLobby();
			return;
		}
		void tournamentEventStore.loadPeek(code);
	});

	async function joinTournamentFromInvite(): Promise<void> {
		const code = navigationStore.tournamentJoinCode;
		if (!code || !joinArmy) return;
		const joined = await tournamentEventStore.join(code, joinName.trim(), joinArmy);
		if (joined) {
			joinName = '';
			joinArmy = null;
			navigationStore.enterTournamentLobby();
		}
	}

	// Pick Army dialog
	let showPickArmy = $state(false);
	let showCreateArmyPrompt = $state(false);
	let pickArmies = $state<SavedArmy[]>([]);
	/** Which slot the picker is choosing for: a briefing seat, or the tournament organizer. */
	let pickTarget = $state<string | null>(null);

	/**
	 * Mission runs field standard lists; a playing organizer and a tournament joiner bring a
	 * Roster one; an online player may bring either, so their slots are unfiltered.
	 */
	function pickFormatFor(slotId: string | null): ArmyFormat | null {
		if (slotId === 'tournament' || slotId === 'tournament-join') return 'roster';
		if (slotId === 'online-create' || slotId === 'online-join') return null;
		return 'standard';
	}

	async function openPickArmy(slotId: string): Promise<void> {
		await contentStore.loadArmy();
		armyBuilderStore.refreshSavedArmies();
		const format = pickFormatFor(slotId);
		const listed = armyBuilderStore.savedArmies.filter(
			(army) => format === null || savedArmyFormat(army) === format
		);
		if (listed.length === 0) {
			showCreateArmyPrompt = true;
			return;
		}
		pickTarget = slotId;
		pickArmies = listed;
		showPickArmy = true;
	}

	function isSeatSlot(slotId: string | null): slotId is PlayerKey {
		return slotId === 'player1' || slotId === 'player2';
	}

	function selectPickedArmy(army: SavedArmy): void {
		const picked: PickedArmy = {
			name: army.name,
			factionId: army.factionId,
			code: army.code,
			format: savedArmyFormat(army)
		};
		if (pickTarget === 'tournament') tournamentStore.setOrganizerArmy(picked);
		else if (pickTarget === 'tournament-join') joinArmy = picked;
		else if (pickTarget === 'online-create') onlineCreateArmy = picked;
		else if (pickTarget === 'online-join') onlineJoinArmy = picked;
		else if (isSeatSlot(pickTarget)) twoPlayerProgressStore.pickArmy(pickTarget, picked);
		else missionProgressStore.pickArmy(picked);
		showPickArmy = false;
	}

	function clearPickedArmy(slotId: string): void {
		if (slotId === 'tournament') tournamentStore.clearOrganizerArmy();
		else if (slotId === 'tournament-join') joinArmy = null;
		else if (slotId === 'online-create') onlineCreateArmy = null;
		else if (slotId === 'online-join') onlineJoinArmy = null;
		else if (isSeatSlot(slotId)) twoPlayerProgressStore.clearPickedArmy(slotId);
		else missionProgressStore.clearPickedArmy();
	}

	// Save/Load Army dialogs
	let showSaveArmy = $state(false);
	let showLoadArmy = $state(false);
	let loadFilter = $state<ArmyFormat>('standard');
	let savedArmyGroups = $derived(
		groupSavedArmies(
			armyBuilderStore.savedArmies.filter((army) => savedArmyFormat(army) === loadFilter),
			contentStore.armyFactions.map((faction) => faction.id)
		)
	);

	// Format switch with a destructive-change confirmation
	let formatSwitchTarget = $state<ArmyFormat | null>(null);

	function requestFormat(format: ArmyFormat): void {
		if (format === armyBuilderStore.format) return;
		if (armyBuilderStore.entries.length > 0 || armyBuilderStore.rosterPicks.length > 0) {
			formatSwitchTarget = format;
		} else {
			armyBuilderStore.setFormat(format);
		}
	}

	// Mount toggle that would drop upgrades, confirmed the same way
	let mountConflict = $state<{ entryId: string; names: string[] } | null>(null);

	function requestToggleMount(entryId: string): void {
		const conflicts = armyBuilderStore.mountConflicts(entryId);
		if (conflicts.length > 0) {
			mountConflict = { entryId, names: conflicts.map((upgrade) => upgrade.name) };
		} else {
			armyBuilderStore.toggleMount(entryId);
		}
	}

	/** Copies the army share code; returns it so the UI can show it either way. */
	async function copyArmyCode(): Promise<{ code: string; copied: boolean } | null> {
		const code = armyBuilderStore.exportArmyCode();
		if (!code) return null;
		try {
			await navigator.clipboard.writeText(code);
			return { code, copied: true };
		} catch {
			return { code, copied: false };
		}
	}
</script>

{#if navigationStore.showOnlineIntro}
	<OnlineIntroNotice
		onConfirm={() => navigationStore.acceptOnlineIntro()}
		onCancel={() => navigationStore.cancelOnlineIntro()}
	/>
{/if}

{#if navigationStore.screen === 'game-mode'}
	<GameModeSelect
		notice={tournamentEventStore.notice}
		onDismissNotice={() => tournamentEventStore.dismissNotice()}
		onSoloSelect={() => navigationStore.selectSoloMode()}
		onTwoPlayerSelect={() => navigationStore.selectTwoPlayerMode()}
		onOnlineSelect={() => navigationStore.selectOnlineMode()}
		onTournamentSelect={() => navigationStore.selectTournament()}
		onArmyBuilderSelect={() => {
			void contentStore.loadArmy();
			navigationStore.selectArmyBuilder();
		}}
	/>
{:else if navigationStore.screen === 'army-faction-select'}
	{#if contentStore.armyLoaded}
		<ArmyFactionSelect
			factions={contentStore.armyFactions}
			onSelect={(factionId) => navigationStore.selectArmyFaction(factionId)}
			onImportCode={(code) => {
				const error = armyBuilderStore.importArmy(code);
				if (error === null) navigationStore.openImportedArmy();
				return error;
			}}
			onLoadArmy={() => {
				armyBuilderStore.refreshSavedArmies();
				showLoadArmy = true;
			}}
			onReturn={() => navigationStore.returnToGameMode()}
		/>
	{:else}
		<div class="flex justify-center p-8">
			<p class="text-sm text-slate-200">Loading army builder…</p>
		</div>
	{/if}
{:else if navigationStore.screen === 'army-builder' && armyFaction}
	<ArmyBuilderView
		faction={armyFaction}
		units={armyBuilderStore.units}
		classIndex={armyClassIndex}
		skillIndex={armySkillIndex}
		traitIndex={armyTraitIndex}
		combatArtIndex={armyCombatArtIndex}
		spellcraftIndex={armySpellcraftIndex}
		spells={contentStore.armySpells}
		stratagemIndex={armyStratagemIndex}
		itemIndex={armyItemIndex}
		entries={armyBuilderStore.entries}
		upgrades={armyBuilderStore.upgrades}
		upgradeIndex={armyBuilderStore.upgradeIndex}
		rulesIndexes={armyBuilderStore.rulesIndexes}
		{armyRows}
		counts={armyCounts}
		format={armyBuilderStore.format}
		points={armyBuilderStore.points}
		limit={armyBuilderStore.limit}
		isOverLimit={armyBuilderStore.isOverLimit}
		startOnArmyPanel={armyBuilderStore.startOnArmyPanel}
		constrained={armyBuilderStore.constraint !== null}
		constraint={armyBuilderStore.constraint}
		unitBudget={(unitId) => armyBuilderStore.unitBudget(unitId)}
		mountBlock={(entryId) => armyBuilderStore.mountBlock(entryId)}
		poolRemaining={armyBuilderStore.poolRemaining}
		onAccept={acceptRosterCut}
		onReturn={() => navigationStore.leaveArmyBuilder()}
		onSetFormat={requestFormat}
		onCopyCode={copyArmyCode}
		onSaveArmy={() => (showSaveArmy = true)}
		rosterPicks={armyBuilderStore.rosterPicks}
		onAddPick={(upgradeId) => armyBuilderStore.addRosterPick(upgradeId)}
		onRemovePick={(upgradeId) => armyBuilderStore.removeRosterPick(upgradeId)}
		onAddUnit={(unitId) => armyBuilderStore.addUnit(unitId)}
		onRemoveUnit={(unitId) => armyBuilderStore.removeUnit(unitId)}
		onRemoveEntry={(entryId) => armyBuilderStore.removeEntry(entryId)}
		onToggleMount={requestToggleMount}
		onAddUpgrade={(entryId, upgradeId, selection) =>
			armyBuilderStore.addUpgrade(entryId, upgradeId, selection)}
		onRemoveUpgrade={(entryId, upgradeId) => armyBuilderStore.removeUpgrade(entryId, upgradeId)}
	/>
{:else if navigationStore.screen === 'online-create'}
	<OnlineCreate
		{seasons}
		{missionsBySeason}
		army={onlineCreateArmy}
		armyFaction={onlineCreateArmyFaction}
		onCreate={async (nickname, setup) => {
			await onlineGameStore.createGame(nickname, setup);
			onlineCreateArmy = null;
			navigationStore.enterOnlineGame();
		}}
		onPickArmy={() => void openPickArmy('online-create')}
		onClearArmy={() => clearPickedArmy('online-create')}
		onReturn={() => navigationStore.returnToGameMode()}
	/>
{:else if navigationStore.screen === 'online-join'}
	<OnlineJoin
		gameCode={navigationStore.onlineJoinCode ?? ''}
		pendingNickname={onlineGameStore.pendingJoin?.nickname ?? null}
		army={onlineJoinArmy}
		armyFaction={onlineJoinArmyFaction}
		onRequestJoin={(nickname, army) =>
			onlineGameStore.requestJoin(navigationStore.onlineJoinCode ?? '', nickname, army)}
		onPickArmy={() => void openPickArmy('online-join')}
		onClearArmy={() => clearPickedArmy('online-join')}
		onPollPending={() => onlineGameStore.pollPendingJoin()}
		onAccepted={() => {
			onlineGameStore.completePendingJoin();
			onlineJoinArmy = null;
			navigationStore.enterOnlineGame();
		}}
		onReturn={() => {
			onlineGameStore.cancelPendingJoin();
			navigationStore.leaveOnline();
		}}
	/>
{:else if navigationStore.screen === 'online-game' && onlineGameStore.view}
	{#if onlineGameStore.view.status === 'active' && onlineGameStore.view.phase === 'armies'}
		<OnlineArmyReveal
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			error={onlineGameStore.error}
			missionName={onlineMission?.name ?? null}
			armyFactions={contentStore.armyFactions}
			rosterViews={onlineRosterViews}
			onAdvance={() => onlineGameStore.advancePhase()}
			onCloseGame={() => onlineGameStore.closeGame()}
			onReturn={stepAwayFromOnlineGame}
			megaphone={tableMegaphone}
		/>
	{:else if onlineGameStore.view.status === 'active' && onlineGameStore.view.phase === 'prep'}
		<OnlineArmyPrep
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			error={onlineGameStore.error ?? onlineCutError}
			missionName={onlineMission?.name ?? null}
			armyFactions={contentStore.armyFactions}
			rosterViews={onlineRosterViews}
			combatView={onlineCombatView}
			onCutArmy={() => void openRosterCut()}
			onSetLeader={assignLeader}
			onAdvance={() => onlineGameStore.advancePhase()}
			onCloseGame={() => onlineGameStore.closeGame()}
			onReturn={stepAwayFromOnlineGame}
			megaphone={tableMegaphone}
		/>
	{:else if onlineGameStore.view.status === 'active' && onlineGameStore.view.phase === 'setup'}
		<OnlineSchemeSelect
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			error={onlineGameStore.error}
			missionName={onlineMission?.name ?? null}
			armyFactions={contentStore.armyFactions}
			combatView={onlineCombatView}
			factions={contentStore.factions}
			schemes={contentStore.schemes}
			onDrawSchemes={() => onlineGameStore.drawSchemes()}
			onChooseScheme={(schemeId) => onlineGameStore.chooseScheme(schemeId)}
			onDeleteScheme={() => onlineGameStore.deleteScheme()}
			onAdvance={() => onlineGameStore.advancePhase()}
			onCloseGame={() => onlineGameStore.closeGame()}
			onReturn={stepAwayFromOnlineGame}
			megaphone={tableMegaphone}
		/>
	{:else if onlineGameStore.view.status === 'active' && onlineMission}
		<OnlineTracker
			view={onlineGameStore.view}
			mission={onlineMission}
			entries={onlineEntries}
			isLeader={onlineGameStore.isLeader}
			error={onlineGameStore.error}
			myCard={onlineMyCard}
			opponentCard={onlineOpponentRevealedCard}
			myVP={onlineMyVP}
			opponentVP={onlineOpponentVP}
			onSetObjectiveChecked={(objectiveId, checkedCount) =>
				onlineGameStore.setObjectiveChecked(objectiveId, checkedCount)}
			onSetSchemeChecked={(checkedIncrements) =>
				onlineGameStore.setSchemeChecked(checkedIncrements)}
			onRevealScheme={() => onlineGameStore.revealScheme()}
			onAdvance={() => onlineGameStore.advancePhase()}
			onReturn={stepAwayFromOnlineGame}
			megaphone={tableMegaphone}
			boards={onlineBoard.boards}
			history={onlineGameStore.history}
			sentences={onlineBoard.sentences}
			undoableSeq={onlineUndoableSeq}
			onCommit={onlineCommit}
			onUndo={onlineUndo}
			{summonPool}
		/>
	{:else if onlineGameStore.view.status === 'finished'}
		<OnlineStats
			view={onlineGameStore.view}
			factions={contentStore.factions}
			schemes={contentStore.schemes}
			onReturnToMenu={leaveOnlineGame}
			onReport={downloadBattleReport}
			megaphone={tableMegaphone}
		/>
	{:else}
		<OnlineLobby
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			{inviteUrl}
			error={onlineGameStore.error}
			armyFactions={contentStore.armyFactions}
			selectedMission={onlineMission}
			resultsForMission={onlineResults}
			onAcceptJoin={() => onlineGameStore.acceptJoin()}
			onDenyJoin={() => onlineGameStore.denyJoin()}
			onCloseGame={() => onlineGameStore.closeGame()}
			onReturnToMenu={leaveOnlineGame}
			onReturn={stepAwayFromOnlineGame}
			onToggleReady={() => onlineGameStore.toggleReady()}
			onStartGame={() => onlineGameStore.startGame()}
			megaphone={tableMegaphone}
		/>
	{/if}
{:else if navigationStore.screen === 'online-game'}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
		{#if onlineGameStore.resuming}
			<p class="text-lg text-sky-200">Reconnecting to your game…</p>
		{:else}
			<p class="text-slate-100">{onlineGameStore.error ?? 'Could not load the game.'}</p>
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={leaveOnlineGame}
			>
				{tournamentEventStore.view ? 'Return to Tournament' : 'Return to Main Menu'}
			</button>
		{/if}
	</div>
{:else if navigationStore.screen === 'tournament-setup'}
	<TournamentSetup
		draft={tournamentStore.draft}
		step={tournamentStore.step}
		canContinue={tournamentStore.canContinue}
		externalLinkInvalid={tournamentStore.externalLinkInvalid}
		organizerArmyMissing={tournamentStore.organizerArmyMissing}
		organizerFaction={organizerArmyFaction}
		onNameChange={(name) => tournamentStore.setName(name)}
		onExternalLinkChange={(link) => tournamentStore.setExternalLink(link)}
		onOrganizerNameChange={(name) => tournamentStore.setOrganizerName(name)}
		onOrganizerPlaysChange={(plays) => tournamentStore.setOrganizerPlays(plays)}
		onParticipantStep={(pairs) => tournamentStore.stepParticipants(pairs)}
		onManualPairingChange={(manual) => tournamentStore.setManualPairing(manual)}
		onPickArmy={() => void openPickArmy('tournament')}
		onClearArmy={() => clearPickedArmy('tournament')}
		{seasons}
		missions={contentStore.missions}
		canCreate={tournamentStore.canCreate}
		creating={creatingTournament}
		createError={tournamentEventStore.error}
		onAddMission={(missionId) => tournamentStore.addMission(missionId)}
		onRemoveMission={(missionId) => tournamentStore.removeMission(missionId)}
		onTableNameChange={(index, name) => tournamentStore.setTableName(index, name)}
		onCreate={() => void createTournamentFromWizard()}
		onBack={() =>
			tournamentStore.step === 'basics'
				? navigationStore.leaveTournament()
				: tournamentStore.back()}
		onContinue={() => tournamentStore.continueSetup()}
		onReview={() => tournamentStore.reviewTournament()}
	/>
{:else if navigationStore.screen === 'tournament-lobby'}
	{#if tournamentEventStore.view}
		<TournamentLobby
			view={tournamentEventStore.view}
			missions={contentStore.missions}
			factions={contentStore.armyFactions}
			error={tournamentEventStore.error}
			onStart={() => void tournamentEventStore.start()}
			onLeave={() => (abandoningFromLobby = true)}
		/>
	{:else}
		<TournamentUnavailable
			error={tournamentEventStore.error}
			onRetry={() => void tournamentEventStore.retry()}
			onAbandon={() => (abandoningFromLobby = true)}
		/>
	{/if}
{:else if navigationStore.screen === 'tournament-round'}
	{#if tournamentEventStore.view?.round}
		<TournamentRoundPrep
			view={tournamentEventStore.view}
			round={tournamentEventStore.view.round}
			missions={contentStore.missions}
			factions={contentStore.armyFactions}
			error={tournamentEventStore.error}
			activeGameId={onlineGameStore.view?.id ?? null}
			{megaphone}
			onAssign={(occupant, tableIndex) => void tournamentEventStore.assign(occupant, tableIndex)}
			onStartRound={() => void tournamentEventStore.startRound()}
			onNextRound={() => void tournamentEventStore.nextRound()}
			onConclude={() => void tournamentEventStore.conclude()}
			onShout={(tableIndex, text) => tournamentEventStore.sendMessage(tableIndex, text)}
			onEnterGame={(tableIndex) => void enterTableGame(tableIndex)}
			onLeave={() => (abandoningFromLobby = true)}
		/>
	{:else}
		<TournamentUnavailable
			error={tournamentEventStore.error}
			onRetry={() => void tournamentEventStore.retry()}
			onAbandon={() => (abandoningFromLobby = true)}
		/>
	{/if}
{:else if navigationStore.screen === 'tournament-results'}
	{#if tournamentEventStore.view}
		<TournamentResults
			view={tournamentEventStore.view}
			error={tournamentEventStore.error}
			onLeave={leaveConcludedTournament}
			onReport={downloadTournamentReport}
			reportBusy={tournamentReportBusy}
		/>
	{:else}
		<TournamentUnavailable
			error={tournamentEventStore.error}
			onRetry={() => void tournamentEventStore.retry()}
			onAbandon={() => (abandoningFromLobby = true)}
		/>
	{/if}
{:else if navigationStore.screen === 'tournament-join'}
	<TournamentJoin
		peek={tournamentEventStore.peek}
		error={tournamentEventStore.error}
		name={joinName}
		army={joinArmy}
		armyFaction={joinArmyFaction}
		canJoin={joinReady}
		onNameChange={(value) => (joinName = value)}
		onPickArmy={() => void openPickArmy('tournament-join')}
		onClearArmy={() => clearPickedArmy('tournament-join')}
		onJoin={() => void joinTournamentFromInvite()}
		onLeave={() => {
			tournamentEventStore.cancelJoin();
			navigationStore.leaveTournamentLobby();
		}}
	/>
{:else if navigationStore.screen === 'season-select'}
	<SeasonSelect
		{seasons}
		onSelect={(season) => navigationStore.selectSeason(season)}
		onReturn={() => navigationStore.returnToGameMode()}
	/>
{:else if navigationStore.screen === 'mission-select'}
	<MissionSelect
		season={navigationStore.selectedSeason ?? ''}
		missions={missionsForSeason}
		onReturn={() => navigationStore.returnToSeasonSelect()}
		onRandom={() => navigationStore.rollRandomMission()}
		onSelectMission={(missionId) => navigationStore.selectMission(missionId)}
	/>
{:else if navigationStore.screen === 'mission-briefing' && selectedMission}
	<MissionBriefing
		mission={selectedMission}
		entries={resultsEntries}
		armies={briefingArmies}
		onReturn={() => navigationStore.returnToMissionSelect()}
		onPickArmy={(slotId) => void openPickArmy(slotId)}
		onClearArmy={clearPickedArmy}
		onStart={() => navigationStore.startGame()}
	/>
{:else if isTwoPlayer && selectedMission && twoPlayerProgressStore.progress}
	<MissionDetailTwoPlayer
		mission={selectedMission}
		entries={resultsEntries}
		progress={twoPlayerProgressStore.progress}
		{totalVPP1}
		{totalVPP2}
		factions={contentStore.factions}
		drawnP1={twoPlayerProgressStore.drawnSchemesP1}
		drawnP2={twoPlayerProgressStore.drawnSchemesP2}
		{chosenCardP1}
		{chosenCardP2}
		activePlayer={twoPlayerProgressStore.activePlayer}
		{armyViewP1}
		{armyViewP2}
		onAbandon={() => navigationStore.abandonGame()}
		onSetObjectiveChecked={(player, objectiveId, checkedCount, maxCount) =>
			twoPlayerProgressStore.setObjectiveChecked(player, objectiveId, checkedCount, maxCount)}
		onSetDraftFaction={(player, factionId) =>
			twoPlayerProgressStore.setDraftFaction(player, factionId)}
		onSetDraftIntelligence={(player, intelligence) =>
			twoPlayerProgressStore.setDraftIntelligence(player, intelligence)}
		onDrawSchemes={(player) => twoPlayerProgressStore.drawSchemes(player, contentStore.schemes)}
		onChooseScheme={(player, schemeId) => twoPlayerProgressStore.chooseScheme(player, schemeId)}
		onSetSchemeChecked={(player, checkedIncrements) => {
			const card = player === 'player1' ? chosenCardP1 : chosenCardP2;
			if (card)
				twoPlayerProgressStore.setSchemeChecked(player, checkedIncrements, card.maxIncrements);
		}}
		onDeleteScheme={(player) => twoPlayerProgressStore.deleteScheme(player)}
		onRevealScheme={(player) => twoPlayerProgressStore.revealScheme(player)}
		onSetRound={(round) => twoPlayerProgressStore.setRound(round)}
		onSwap={() => twoPlayerProgressStore.swapPlayer()}
		onDamage={(target, amount) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterDamage(seat.view.vitality[target.entryId], seat.hp, seat.sta, amount),
				target.flower.undead
			);
		}}
		onHeal={(target, amount) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterHeal(seat.view.vitality[target.entryId], seat.hp, seat.sta, amount),
				target.flower.undead
			);
		}}
		onStatuses={(target, statuses) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterStatuses(seat.view.vitality[target.entryId], seat.hp, seat.sta, statuses),
				target.flower.undead
			);
		}}
		onStamina={(target, delta) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterStamina(seat.view.vitality[target.entryId], seat.hp, seat.sta, delta),
				target.flower.undead
			);
		}}
		onStagger={(target) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterStagger(seat.view.vitality[target.entryId], seat.hp, seat.sta),
				target.flower.undead
			);
		}}
		onStun={(target) => {
			const seat = seatBasesOf(target);
			if (!seat) return;
			twoPlayerProgressStore.setUnitVitality(
				target.player,
				target.entryId,
				vitalityAfterStun(seat.view.vitality[target.entryId], seat.hp, seat.sta),
				target.flower.undead
			);
		}}
		{summonPool}
		onSummon={(target, unitId) =>
			twoPlayerProgressStore.summonCreature(target.player, target.entryId, unitId)}
		onDismissSummon={(target) =>
			twoPlayerProgressStore.dismissSummon(target.player, target.entryId)}
	/>
{:else if selectedMission && missionProgressStore.progress}
	<MissionDetail
		mission={selectedMission}
		entries={resultsEntries}
		progress={missionProgressStore.progress}
		{totalVP}
		factions={contentStore.factions}
		drawnSchemes={missionProgressStore.drawnSchemes}
		{chosenSchemeCard}
		{armyView}
		onAbandon={() => navigationStore.abandonGame()}
		onReset={() => missionProgressStore.resetMission()}
		onSetObjectiveChecked={(objectiveId, checkedCount, maxCount) =>
			missionProgressStore.setObjectiveChecked(objectiveId, checkedCount, maxCount)}
		onSetDraftFaction={(factionId) => missionProgressStore.setDraftFaction(factionId)}
		onSetDraftIntelligence={(intelligence) =>
			missionProgressStore.setDraftIntelligence(intelligence)}
		onDrawSchemes={() => missionProgressStore.drawSchemes(contentStore.schemes)}
		onChooseScheme={(schemeId) => missionProgressStore.chooseScheme(schemeId)}
		onSetSchemeChecked={(checkedIncrements) =>
			chosenSchemeCard &&
			missionProgressStore.setSchemeChecked(checkedIncrements, chosenSchemeCard.maxIncrements)}
		onDeleteScheme={() => missionProgressStore.deleteScheme()}
		onSetRound={(round) => missionProgressStore.setRound(round)}
		onDamage={(target, amount) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterDamage(seat.view.vitality[target.entryId], seat.hp, seat.sta, amount),
				target.flower.undead
			);
		}}
		onHeal={(target, amount) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterHeal(seat.view.vitality[target.entryId], seat.hp, seat.sta, amount),
				target.flower.undead
			);
		}}
		onStatuses={(target, statuses) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterStatuses(seat.view.vitality[target.entryId], seat.hp, seat.sta, statuses),
				target.flower.undead
			);
		}}
		onStagger={(target) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterStagger(seat.view.vitality[target.entryId], seat.hp, seat.sta),
				target.flower.undead
			);
		}}
		onStun={(target) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterStun(seat.view.vitality[target.entryId], seat.hp, seat.sta),
				target.flower.undead
			);
		}}
		onStamina={(target, delta) => {
			const seat = soloBasesOf(target);
			if (!seat) return;
			missionProgressStore.setUnitVitality(
				target.entryId,
				vitalityAfterStamina(seat.view.vitality[target.entryId], seat.hp, seat.sta, delta),
				target.flower.undead
			);
		}}
		{summonPool}
		onSummon={(target, unitId) => missionProgressStore.summonCreature(target.entryId, unitId)}
		onDismissSummon={(target) => missionProgressStore.dismissSummon(target.entryId)}
	/>
{/if}

<!-- Escape and the prominent button both resume: abandoning a run is never the accidental choice. -->
{#if resumableGame}
	<ConfirmDialog
		text={'You have an open game: ' +
			resumableGame.mission.name +
			'. Abandoning it loses all progress.'}
		confirmLabel="Abandon"
		cancelLabel="Resume Game"
		onConfirm={abandonResumableGame}
		onCancel={resumeOpenGame}
	/>
{/if}

<!--
	Same shape for a tournament, and the same rule: Escape and the prominent button return to the
	lobby. Abandoning here is not local — it tells the server, which frees the seat or cancels the
	event, so a failure keeps the dialog open with the reason.
-->
{#if showTournamentAbandon}
	<ConfirmDialog
		text={tournamentAbandonText}
		confirmLabel={tournamentAbandonLabel}
		cancelLabel="Return"
		confirming={abandoningTournament}
		errorText={tournamentEventStore.error}
		onConfirm={() => void abandonTournament()}
		onCancel={returnToTournament}
	/>
{/if}

{#if showSaveArmy}
	<SaveArmyDialog
		onSave={(name) => {
			const error = armyBuilderStore.saveArmy(name);
			if (error === null) showSaveArmy = false;
			return error;
		}}
		onCancel={() => (showSaveArmy = false)}
	/>
{/if}

{#if showLoadArmy}
	<LoadArmyDialog
		groups={savedArmyGroups}
		factions={contentStore.armyFactions}
		filter={loadFilter}
		onSetFilter={(format) => (loadFilter = format)}
		onLoad={(army) => {
			const error = armyBuilderStore.importArmy(army.code);
			if (error === null) {
				showLoadArmy = false;
				navigationStore.openImportedArmy();
			}
			return error;
		}}
		onDelete={(army) => armyBuilderStore.deleteSavedArmy(army.id)}
		onCancel={() => (showLoadArmy = false)}
	/>
{/if}

{#if formatSwitchTarget}
	<ConfirmDialog
		text={'Switch to ' +
			(formatSwitchTarget === 'standard' ? 'Standard' : 'Roster') +
			'? The current list will be deleted.'}
		confirmLabel="Yes"
		cancelLabel="No"
		onConfirm={() => {
			const target = formatSwitchTarget;
			if (target) armyBuilderStore.setFormat(target);
			formatSwitchTarget = null;
		}}
		onCancel={() => (formatSwitchTarget = null)}
	/>
{/if}

{#if mountConflict}
	<ConfirmDialog
		text={'Mount this model? Its size changes, so ' +
			mountConflict.names.join(', ') +
			' will be removed.'}
		confirmLabel="Yes"
		cancelLabel="No"
		onConfirm={() => {
			const conflict = mountConflict;
			if (conflict) armyBuilderStore.toggleMount(conflict.entryId);
			mountConflict = null;
		}}
		onCancel={() => (mountConflict = null)}
	/>
{/if}

{#if showPickArmy}
	<PickArmyDialog
		armies={pickArmies}
		factions={contentStore.armyFactions}
		note={pickTarget === 'tournament' || pickTarget === 'tournament-join'
			? 'Roster-format armies (125 points). The list is attached as it is now.'
			: pickTarget === 'online-create' || pickTarget === 'online-join'
				? 'A Standard army is combat-ready at once; a Roster army is cut down to 85 points once the game starts.'
				: undefined}
		onPick={selectPickedArmy}
		onCancel={() => (showPickArmy = false)}
	/>
{/if}

{#if showCreateArmyPrompt}
	<ConfirmDialog
		text="It seems you don't have any saved armies. Do you want to create one?"
		confirmLabel="Create one"
		cancelLabel="Not now"
		onConfirm={() => {
			showCreateArmyPrompt = false;
			navigationStore.selectArmyBuilder();
		}}
		onCancel={() => (showCreateArmyPrompt = false)}
	/>
{/if}
