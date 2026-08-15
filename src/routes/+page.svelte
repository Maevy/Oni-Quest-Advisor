<script lang="ts">
	import { getMissionsForSeason, getScoreableResults, getSeasons } from '$lib/domain';
	import { contentStore, missionProgressStore, navigationStore } from '$lib/stores';
	import SeasonSelect from '$lib/components/SeasonSelect.svelte';
	import MissionSelect from '$lib/components/MissionSelect.svelte';
	import MissionDetail from '$lib/components/MissionDetail.svelte';

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
</script>

{#if navigationStore.screen === 'season-select'}
	<SeasonSelect {seasons} onSelect={(season) => navigationStore.selectSeason(season)} />
{:else if navigationStore.screen === 'mission-select'}
	<MissionSelect
		season={navigationStore.selectedSeason ?? ''}
		missions={missionsForSeason}
		onReturn={() => navigationStore.returnToSeasonSelect()}
		onRandom={() => navigationStore.rollRandomMission()}
		onSelectMission={(missionId) => navigationStore.selectMission(missionId)}
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
