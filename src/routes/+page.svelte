<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getMissionsForSeason, getScoreableResults, getSeasons } from '$lib/domain';
	import {
		contentStore,
		missionProgressStore,
		navigationStore,
		onlineGameStore,
		twoPlayerProgressStore
	} from '$lib/stores';
	import GameModeSelect from '$lib/components/GameModeSelect.svelte';
	import SeasonSelect from '$lib/components/SeasonSelect.svelte';
	import MissionSelect from '$lib/components/MissionSelect.svelte';
	import MissionDetail from '$lib/components/MissionDetail.svelte';
	import MissionDetailTwoPlayer from '$lib/components/MissionDetailTwoPlayer.svelte';
	import OnlineCreate from '$lib/components/OnlineCreate.svelte';
	import OnlineGameView from '$lib/components/OnlineGameView.svelte';
	import OnlineJoin from '$lib/components/OnlineJoin.svelte';
	import OnlineLobby from '$lib/components/OnlineLobby.svelte';
	import OnlineStats from '$lib/components/OnlineStats.svelte';

	contentStore.load();

	// Resume an online seat from a previous visit, if any.
	onMount(() => {
		void onlineGameStore.resumeSession().then((resumed) => {
			if (resumed) navigationStore.enterOnlineGame();
		});
	});

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
</script>

{#if navigationStore.screen === 'game-mode'}
	<GameModeSelect
		onSoloSelect={() => navigationStore.selectSoloMode()}
		onTwoPlayerSelect={() => navigationStore.selectTwoPlayerMode()}
		onOnlineSelect={() => navigationStore.selectOnlineMode()}
	/>
{:else if navigationStore.screen === 'online-create'}
	<OnlineCreate
		onCreate={async (nickname) => {
			await onlineGameStore.createGame(nickname);
			navigationStore.enterOnlineGame();
		}}
		onReturn={() => navigationStore.returnToGameMode()}
	/>
{:else if navigationStore.screen === 'online-join'}
	<OnlineJoin
		gameCode={navigationStore.onlineJoinCode ?? ''}
		pendingNickname={onlineGameStore.pendingJoin?.nickname ?? null}
		onRequestJoin={(nickname) =>
			onlineGameStore.requestJoin(navigationStore.onlineJoinCode ?? '', nickname)}
		onPollPending={() => onlineGameStore.pollPendingJoin()}
		onAccepted={() => navigationStore.enterOnlineGame()}
		onReturn={() => navigationStore.leaveOnline()}
	/>
{:else if navigationStore.screen === 'online-game' && onlineGameStore.view}
	{#if onlineGameStore.view.status === 'active' && onlineMission}
		<OnlineGameView
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			error={onlineGameStore.error}
			mission={onlineMission}
			results={onlineResults}
			myCard={onlineMyCard}
			myVP={onlineMyVP}
			opponentRevealedCard={onlineOpponentRevealedCard}
			onToggleRevealIntent={() => onlineGameStore.toggleRevealIntent()}
			onSetObjectiveChecked={(objectiveId, checkedCount) =>
				onlineGameStore.setObjectiveChecked(objectiveId, checkedCount)}
			onSetSchemeChecked={(checkedIncrements) =>
				onlineGameStore.setSchemeChecked(checkedIncrements)}
			onAdvancePhase={() => onlineGameStore.advancePhase()}
			onFinishGame={() => onlineGameStore.finishGame()}
			onCloseGame={() => onlineGameStore.closeGame()}
		/>
	{:else if onlineGameStore.view.status === 'finished'}
		<OnlineStats
			view={onlineGameStore.view}
			factions={contentStore.factions}
			schemes={contentStore.schemes}
			onReturnToMenu={() => {
				onlineGameStore.leave();
				navigationStore.leaveOnline();
			}}
		/>
	{:else}
		<OnlineLobby
			view={onlineGameStore.view}
			isLeader={onlineGameStore.isLeader}
			{inviteUrl}
			error={onlineGameStore.error}
			factions={contentStore.factions}
			schemes={contentStore.schemes}
			{seasons}
			{missionsBySeason}
			selectedMission={onlineMission}
			resultsForMission={onlineResults}
			onAcceptJoin={() => onlineGameStore.acceptJoin()}
			onDenyJoin={() => onlineGameStore.denyJoin()}
			onCloseGame={() => onlineGameStore.closeGame()}
			onReturnToMenu={() => {
				onlineGameStore.leave();
				navigationStore.leaveOnline();
			}}
			onDraftFaction={(factionId) => onlineGameStore.draftFaction(factionId)}
			onDraftIntelligence={(intelligence) => onlineGameStore.draftIntelligence(intelligence)}
			onDrawSchemes={() => onlineGameStore.drawSchemes()}
			onChooseScheme={(schemeId) => onlineGameStore.chooseScheme(schemeId)}
			onDeleteScheme={() => onlineGameStore.deleteScheme()}
			onSelectMission={(season, missionId) => onlineGameStore.selectMission(season, missionId)}
			onStartGame={() => onlineGameStore.startGame()}
		/>
	{/if}
{:else if navigationStore.screen === 'online-game'}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
		{#if onlineGameStore.resuming}
			<p class="text-lg text-sky-200">Reconnecting to your game…</p>
		{:else}
			<p class="text-slate-300">{onlineGameStore.error ?? 'Could not load the game.'}</p>
			<button
				type="button"
				class="rounded-xl bg-sky-300 px-6 py-2 font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={() => {
					onlineGameStore.leave();
					navigationStore.leaveOnline();
				}}
			>
				Return to Main Menu
			</button>
		{/if}
	</div>
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
{:else if isTwoPlayer && selectedMission && twoPlayerProgressStore.progress}
	<MissionDetailTwoPlayer
		mission={selectedMission}
		results={resultsForMission}
		progress={twoPlayerProgressStore.progress}
		{totalVPP1}
		{totalVPP2}
		factions={contentStore.factions}
		drawnP1={twoPlayerProgressStore.drawnSchemesP1}
		drawnP2={twoPlayerProgressStore.drawnSchemesP2}
		{chosenCardP1}
		{chosenCardP2}
		activePlayer={twoPlayerProgressStore.activePlayer}
		onReturn={() => navigationStore.returnToMissionSelect()}
		onReset={() => twoPlayerProgressStore.resetMission()}
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
	/>
{:else if selectedMission && missionProgressStore.progress}
	<MissionDetail
		mission={selectedMission}
		results={resultsForMission}
		progress={missionProgressStore.progress}
		{totalVP}
		factions={contentStore.factions}
		drawnSchemes={missionProgressStore.drawnSchemes}
		{chosenSchemeCard}
		onReturn={() => navigationStore.returnToMissionSelect()}
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
	/>
{/if}
