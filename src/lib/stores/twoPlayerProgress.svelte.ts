import {
	clearOpenGame,
	clearTwoPlayerProgress,
	loadOpenGame,
	loadTwoPlayerProgress,
	saveOpenGame,
	saveTwoPlayerProgress
} from '$lib/data';
import * as domain from '$lib/domain';
import type {
	ArmyView,
	Mission,
	PlayerKey,
	PickedArmy,
	SchemeCard,
	TwoPlayerMissionProgress,
	UnitVitality
} from '$lib/domain';
import { contentStore } from './content.svelte';

class TwoPlayerProgressStore {
	progress = $state<TwoPlayerMissionProgress | null>(null);
	drawnSchemesP1 = $state<SchemeCard[]>([]);
	drawnSchemesP2 = $state<SchemeCard[]>([]);
	activePlayer = $state<PlayerKey>('player1');

	loadForMission(missionId: string): void {
		const loaded = loadTwoPlayerProgress(missionId);
		// Hydrated per seat, not spread over the record: a save from before the army or its
		// vitality existed would otherwise carry `undefined` into the nested player objects.
		this.progress = domain.hydrateTwoPlayerProgress(missionId, loaded ?? {});
		this.drawnSchemesP1 = [];
		this.drawnSchemesP2 = [];
		this.activePlayer = 'player1';
	}

	private persist(): void {
		if (this.progress) saveTwoPlayerProgress(this.progress);
	}

	private drawnSchemesFor(player: PlayerKey): SchemeCard[] {
		return player === 'player1' ? this.drawnSchemesP1 : this.drawnSchemesP2;
	}

	private setDrawnSchemes(player: PlayerKey, schemes: SchemeCard[]): void {
		if (player === 'player1') {
			this.drawnSchemesP1 = schemes;
		} else {
			this.drawnSchemesP2 = schemes;
		}
	}

	/** Marks the loaded mission as the open hot-seat game — called when Start Game is pressed. */
	beginGame(): void {
		if (!this.progress) return;
		saveOpenGame({ missionId: this.progress.missionId, mode: 'two-player' });
	}

	/**
	 * Abandons the open game. The record and that mission's saved progress both go, so the run
	 * cannot be resumed later and its boxes cannot score again.
	 */
	abandonGame(): void {
		const open = loadOpenGame();
		clearOpenGame();
		if (open) clearTwoPlayerProgress(open.missionId);
		this.progress = null;
		this.drawnSchemesP1 = [];
		this.drawnSchemesP2 = [];
		this.activePlayer = 'player1';
	}

	setObjectiveChecked(
		player: PlayerKey,
		objectiveId: string,
		checkedCount: number,
		maxCount: number
	): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerObjectiveChecked(
			this.progress,
			player,
			objectiveId,
			checkedCount,
			maxCount
		);
		this.persist();
	}

	/** Attaches a saved army to one seat as a snapshot; later edits to the save cannot leak in. */
	pickArmy(player: PlayerKey, army: PickedArmy): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerPickedArmy(this.progress, player, army);
		this.persist();
	}

	clearPickedArmy(player: PlayerKey): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerPickedArmy(this.progress, player, null);
		this.persist();
	}

	/** Commits a copy's Life/stamina/States once that seat's vitality menu is accepted. */
	setUnitVitality(player: PlayerKey, entryId: string, vitality: UnitVitality): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerVitality(
			this.progress,
			player,
			entryId,
			domain.applyZeroHpStates(vitality)
		);
		this.persist();
	}

	/**
	 * One seat's attached army resolved for display; null when that seat picked nothing, the
	 * catalogs are still loading, or the snapshot no longer decodes against the current roster.
	 */
	armyView(player: PlayerKey): ArmyView | null {
		const seat = this.progress?.[player];
		return contentStore.armyView(seat?.pickedArmy ?? null, seat?.vitality ?? {});
	}

	setDraftFaction(player: PlayerKey, factionId: string | null): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerSchemeDraft(this.progress, player, { factionId });
		this.persist();
	}

	setDraftIntelligence(player: PlayerKey, intelligence: number | null): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerSchemeDraft(this.progress, player, { intelligence });
		this.persist();
	}

	drawSchemes(player: PlayerKey, allSchemes: SchemeCard[], rng: domain.Rng = Math.random): void {
		const draft = this.progress?.[player].schemeDraft;
		if (!draft?.factionId || draft.intelligence == null) return;
		const pool = domain.getSchemePool(allSchemes, draft.factionId);
		const count = domain.drawCountForIntelligence(draft.intelligence);
		this.setDrawnSchemes(player, domain.drawUniqueSchemes(pool, count, rng, draft.factionId));
	}

	chooseScheme(player: PlayerKey, schemeId: string): void {
		const draft = this.progress?.[player].schemeDraft;
		if (!this.progress || !draft?.factionId || draft.intelligence == null) return;
		this.progress = domain.chooseTwoPlayerScheme(
			this.progress,
			player,
			schemeId,
			draft.factionId,
			draft.intelligence
		);
		this.setDrawnSchemes(player, []);
		this.persist();
	}

	setSchemeChecked(player: PlayerKey, checkedIncrements: number, maxIncrements: number): void {
		if (!this.progress?.[player].scheme) return;
		this.progress = domain.setTwoPlayerSchemeChecked(
			this.progress,
			player,
			checkedIncrements,
			maxIncrements
		);
		this.persist();
	}

	deleteScheme(player: PlayerKey): void {
		if (!this.progress) return;
		this.progress = domain.clearTwoPlayerScheme(this.progress, player);
		this.setDrawnSchemes(player, []);
		this.persist();
	}

	revealScheme(player: PlayerKey): void {
		if (!this.progress) return;
		this.progress = domain.revealTwoPlayerScheme(this.progress, player);
		this.persist();
	}

	swapPlayer(): void {
		this.activePlayer = this.activePlayer === 'player1' ? 'player2' : 'player1';
	}

	setRound(round: number): void {
		if (!this.progress) return;
		this.progress = domain.setTwoPlayerRound(this.progress, round);
		this.persist();
	}

	totalVP(player: PlayerKey, mission: Mission, schemeCard: SchemeCard | null): number {
		if (!this.progress) return 0;
		return domain.calculateTwoPlayerVP(mission, this.progress[player], schemeCard);
	}
}

export const twoPlayerProgressStore = new TwoPlayerProgressStore();
