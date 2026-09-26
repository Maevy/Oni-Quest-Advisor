import * as domain from '$lib/domain';
import { clearOpenGame, loadOpenGame } from '$lib/data';
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
		} else {
			missionProgressStore.loadForMission(missionId);
		}
		// Both local modes land on the read-only briefing; Start Game moves on to the tracker.
		this.screen = 'mission-briefing';
	}

	/** Leaves the briefing for the interactive tracker and marks the run as the open game. */
	startGame(): void {
		if (this.gameMode === 'two-player') twoPlayerProgressStore.beginGame();
		else missionProgressStore.beginGame();
		this.screen = 'mission-detail';
	}

	/**
	 * Re-enters the open game found at app start, straight into the tracker — the briefing is for
	 * deciding whether to play, and that decision was already made. The record's mode decides
	 * which progress store and which tracker the run resumes into.
	 */
	resumeOpenGame(game: domain.OpenGame, mission: domain.Mission): void {
		this.gameMode = game.mode;
		this.selectedSeason = mission.season;
		this.selectedMissionId = mission.id;
		if (game.mode === 'two-player') twoPlayerProgressStore.loadForMission(mission.id);
		else missionProgressStore.loadForMission(mission.id);
		this.screen = 'mission-detail';
	}

	/**
	 * App start: returns the local game left open, so the page can offer to resume it. A record
	 * pointing at a mission the bundled content no longer has is stale, and is dropped here
	 * rather than offered.
	 */
	findResumableGame(): { game: domain.OpenGame; mission: domain.Mission } | null {
		const open = loadOpenGame();
		if (!open) return null;
		const mission = contentStore.missions.find((candidate) => candidate.id === open.missionId);
		if (!mission) {
			clearOpenGame();
			return null;
		}
		return { game: open, mission };
	}

	/** The tracker's Return, once confirmed. Discards the run and goes back to the list. */
	abandonGame(): void {
		if (this.gameMode === 'two-player') twoPlayerProgressStore.abandonGame();
		else missionProgressStore.abandonGame();
		this.returnToMissionSelect();
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
