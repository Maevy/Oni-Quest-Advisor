<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		armyCopyCounts,
		calculateTwoPlayerVP,
		getMissionsForSeason,
		getScoreableResults,
		getSeasons,
		groupResults,
		groupSavedArmies,
		indexArmyRules,
		pickedArmyFormat,
		resolveArmyEntries,
		savedArmyFormat,
		type ArmyFormat,
		type ArmyRosterRow,
		type ArmyView,
		type Mission,
		type OpenGame,
		type PickedArmy,
		type PlayerKey,
		type SavedArmy
	} from '$lib/domain';
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
	import TournamentUnavailable from '$lib/components/TournamentUnavailable.svelte';
	import type { BriefingArmy } from '$lib/components/briefingArmy';

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
		void onlineGameStore.resumeSession().then((resumed) => {
			if (resumed) {
				navigationStore.enterOnlineGame();
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

	/** The two screens a live tournament shows, which its status switches between. */
	function onTournamentScreen(): boolean {
		return (
			navigationStore.screen === 'tournament-lobby' || navigationStore.screen === 'tournament-round'
		);
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
	 * The event's status decides which screen a device shows, not a click: the organizer pressing
	 * Start Tournament moves every participant to the round over the change notification. Only
	 * followed while a tournament screen is up, so a device that walked away to the menu is never
	 * yanked back into the event.
	 */
	$effect(() => {
		const status = tournamentEventStore.view?.status;
		if (!status || !onTournamentScreen()) return;
		if (status === 'active') {
			if (navigationStore.screen !== 'tournament-round') navigationStore.enterTournamentRound();
		} else if (navigationStore.screen !== 'tournament-lobby') {
			navigationStore.enterTournamentLobby();
		}
	});

	let showTournamentAbandon = $derived(resumableTournament || abandoningFromLobby);
	let tournamentAbandonText = $derived.by(() => {
		const name = tournamentEventStore.tournamentName;
		const what = name ? `"${name}"` : 'this tournament';
		return tournamentEventStore.isOrganizer
			? `You are the organizer of ${what}. Abandoning it cancels the tournament and deletes it for everyone.`
			: `You are participating in ${what}. Abandoning it gives up your seat.`;
	});

	/** The prompt's safe branch — back onto the screen the event is on, which resynchronizes. */
	function returnToTournament(): void {
		resumableTournament = false;
		abandoningFromLobby = false;
		// Without a view (the resume fetch failed) the lobby's retry panel is the honest landing
		// spot; the status effect above moves on from there once a view arrives.
		if (tournamentEventStore.view?.status === 'active') navigationStore.enterTournamentRound();
		else navigationStore.enterTournamentLobby();
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
		onlineGameStore.leave();
		navigationStore.leaveOnline();
	}

	/**
	 * Steps off a live online screen without dropping the seat session, so the next app launch
	 * resumes into the same game. Clearing the session here would strand the seat: the server game
	 * lives on but the token that authenticates this device is gone.
	 */
	function stepAwayFromOnlineGame(): void {
		navigationStore.leaveOnline();
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
		/>
	{:else if onlineGameStore.view.status === 'finished'}
		<OnlineStats
			view={onlineGameStore.view}
			factions={contentStore.factions}
			schemes={contentStore.schemes}
			onReturnToMenu={leaveOnlineGame}
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
				Return to Main Menu
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
			onAssign={(occupant, tableIndex) => void tournamentEventStore.assign(occupant, tableIndex)}
			onStartRound={() => void tournamentEventStore.startRound()}
			onLeave={() => (abandoningFromLobby = true)}
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
		onSetVitality={(player, entryId, vitality) =>
			twoPlayerProgressStore.setUnitVitality(player, entryId, vitality)}
		onSwap={() => twoPlayerProgressStore.swapPlayer()}
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
		onSetVitality={(entryId, vitality) => missionProgressStore.setUnitVitality(entryId, vitality)}
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
		confirmLabel="Abandon"
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
