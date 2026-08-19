import * as domain from '$lib/domain';
import { contentStore } from './content.svelte';
import { missionProgressStore } from './missionProgress.svelte';
import { twoPlayerProgressStore } from './twoPlayerProgress.svelte';

export type Screen = 'game-mode' | 'season-select' | 'mission-select' | 'mission-detail';

class NavigationStore {
	screen = $state<Screen>('game-mode');
	selectedSeason = $state<string | null>(null);
	selectedMissionId = $state<string | null>(null);
	gameMode = $state<domain.GameMode>('solo');

	selectSoloMode(): void {
		this.gameMode = 'solo';
		this.screen = 'season-select';
	}

	selectTwoPlayerMode(): void {
		this.gameMode = 'two-player';
		this.screen = 'season-select';
	}

	returnToGameMode(): void {
		this.screen = 'game-mode';
		this.selectedSeason = null;
		this.selectedMissionId = null;
		this.gameMode = 'solo';
	}

	selectSeason(season: string): void {
		this.selectedSeason = season;
		this.screen = 'mission-select';
	}

	returnToSeasonSelect(): void {
		this.screen = 'season-select';
		this.selectedSeason = null;
		this.selectedMissionId = null;
	}

	selectMission(missionId: string): void {
		this.selectedMissionId = missionId;
		this.screen = 'mission-detail';
		if (this.gameMode === 'two-player') {
			twoPlayerProgressStore.loadForMission(missionId);
		} else {
			missionProgressStore.loadForMission(missionId);
		}
	}

	returnToMissionSelect(): void {
		this.screen = 'mission-select';
		this.selectedMissionId = null;
	}

	/** Picks a random mission from the current season and opens it directly, same as a manual click. */
	rollRandomMission(rng: domain.Rng = Math.random): void {
		if (!this.selectedSeason) return;
		const missions = domain.getMissionsForSeason(contentStore.missions, this.selectedSeason);
		if (missions.length === 0) return;
		const mission = domain.pickRandomMission(missions, rng);
		this.selectMission(mission.id);
	}
}

export const navigationStore = new NavigationStore();
