<script lang="ts">
	import { getMissionsForSeason, getScoreableResults, getSeasons } from '$lib/domain';
	import {
		contentStore,
		missionProgressStore,
		navigationStore,
		twoPlayerProgressStore
	} from '$lib/stores';
	import GameModeSelect from '$lib/components/GameModeSelect.svelte';
	import SeasonSelect from '$lib/components/SeasonSelect.svelte';
	import MissionSelect from '$lib/components/MissionSelect.svelte';
	import MissionDetail from '$lib/components/MissionDetail.svelte';
	import MissionDetailTwoPlayer from '$lib/components/MissionDetailTwoPlayer.svelte';

	contentStore.load();

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
