import * as domain from '$lib/domain';
import {
	acknowledgePrivacyNotice,
	isOnlineIntroSeen,
	isPrivacyNoticeAcknowledged,
	markOnlineIntroSeen
} from '$lib/data/notices';
import { armyBuilderStore } from './armyBuilder.svelte';
import { contentStore } from './content.svelte';
import { missionProgressStore } from './missionProgress.svelte';
import { twoPlayerProgressStore } from './twoPlayerProgress.svelte';

export type Screen =
	| 'game-mode'
	| 'army-faction-select'
	| 'army-builder'
	| 'season-select'
	| 'mission-select'
	| 'mission-briefing'
	| 'mission-detail'
	| 'online-create'
	| 'online-join'
	| 'online-game';

class NavigationStore {
	screen = $state<Screen>('game-mode');
	selectedSeason = $state<string | null>(null);
	selectedMissionId = $state<string | null>(null);
	gameMode = $state<domain.GameMode>('solo');
	/** Game code from an invite link, consumed by the online-join screen. */
	onlineJoinCode = $state<string | null>(null);
	/** One-time local-storage/privacy notice, dismissed permanently per device. */
	showPrivacyNotice = $state(false);
	/** One-time heads-up shown before first entering the experimental online mode. */
	showOnlineIntro = $state(false);

	selectSoloMode(): void {
		this.gameMode = 'solo';
		this.screen = 'season-select';
	}

	selectTwoPlayerMode(): void {
		this.gameMode = 'two-player';
		this.screen = 'season-select';
	}

	/** Call once on app start (browser only) to surface the privacy notice if unseen. */
	initNotices(): void {
		this.showPrivacyNotice = !isPrivacyNoticeAcknowledged();
	}

	dismissPrivacyNotice(): void {
		acknowledgePrivacyNotice();
		this.showPrivacyNotice = false;
	}

	selectOnlineMode(): void {
		if (!isOnlineIntroSeen()) {
			this.showOnlineIntro = true;
			return;
		}
		this.screen = 'online-create';
	}

	acceptOnlineIntro(): void {
		markOnlineIntroSeen();
		this.showOnlineIntro = false;
		this.screen = 'online-create';
	}

	cancelOnlineIntro(): void {
		this.showOnlineIntro = false;
	}

	prepareOnlineJoin(code: string): void {
		this.onlineJoinCode = code;
		this.screen = 'online-join';
	}

	enterOnlineGame(): void {
		this.screen = 'online-game';
	}

	leaveOnline(): void {
		this.onlineJoinCode = null;
		this.screen = 'game-mode';
	}

	returnToGameMode(): void {
		this.screen = 'game-mode';
		this.selectedSeason = null;
		this.selectedMissionId = null;
		this.gameMode = 'solo';
	}

	selectArmyBuilder(): void {
		this.screen = 'army-faction-select';
	}

	selectArmyFaction(factionId: domain.ArmyFactionId): void {
		armyBuilderStore.selectFaction(factionId);
		this.screen = 'army-builder';
	}

	/** Enters the builder after an army code import (faction and list already loaded). */
	openImportedArmy(): void {
		this.screen = 'army-builder';
	}

	leaveArmyBuilder(): void {
		armyBuilderStore.leave();
		this.screen = 'game-mode';
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
		if (this.gameMode === 'two-player') {
			twoPlayerProgressStore.loadForMission(missionId);
			this.screen = 'mission-detail';
			return;
		}
		missionProgressStore.loadForMission(missionId);
		// Solo phase 1: the read-only briefing. Phase 2 (the interactive tracker) follows later.
		this.screen = 'mission-briefing';
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
