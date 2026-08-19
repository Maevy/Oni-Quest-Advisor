import { loadTwoPlayerProgress, saveTwoPlayerProgress } from '$lib/data';
import * as domain from '$lib/domain';
import type { Mission, PlayerKey, SchemeCard, TwoPlayerMissionProgress } from '$lib/domain';

class TwoPlayerProgressStore {
	progress = $state<TwoPlayerMissionProgress | null>(null);
	drawnSchemesP1 = $state<SchemeCard[]>([]);
	drawnSchemesP2 = $state<SchemeCard[]>([]);
	activePlayer = $state<PlayerKey>('player1');

	loadForMission(missionId: string): void {
		const loaded = loadTwoPlayerProgress(missionId);
		this.progress = loaded
			? { ...domain.createEmptyTwoPlayerProgress(missionId), ...loaded }
			: domain.createEmptyTwoPlayerProgress(missionId);
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

	resetMission(): void {
		if (!this.progress) return;
		this.progress = domain.createEmptyTwoPlayerProgress(this.progress.missionId);
		this.drawnSchemesP1 = [];
		this.drawnSchemesP2 = [];
		this.activePlayer = 'player1';
		this.persist();
	}

	totalVP(player: PlayerKey, mission: Mission, schemeCard: SchemeCard | null): number {
		if (!this.progress) return 0;
		return domain.calculateTwoPlayerVP(mission, this.progress[player], schemeCard);
	}
}

export const twoPlayerProgressStore = new TwoPlayerProgressStore();
