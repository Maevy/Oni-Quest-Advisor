import * as domain from '$lib/domain';
import { contentStore } from './content.svelte';
import { missionProgressStore } from './missionProgress.svelte';

export type Screen = 'game-mode' | 'season-select' | 'mission-select' | 'mission-detail';

class NavigationStore {
	screen = $state<Screen>('game-mode');
	selectedSeason = $state<string | null>(null);
	selectedMissionId = $state<string | null>(null);

	selectGameMode(): void {
		this.screen = 'season-select';
	}

	returnToGameMode(): void {
		this.screen = 'game-mode';
		this.selectedSeason = null;
		this.selectedMissionId = null;
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
		missionProgressStore.loadForMission(missionId);
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
