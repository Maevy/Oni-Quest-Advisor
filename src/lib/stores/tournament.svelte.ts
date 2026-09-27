import * as domain from '$lib/domain';
import type { PickedArmy, TournamentDraft, TournamentSetupStep } from '$lib/domain';

class TournamentStore {
	/**
	 * The wizard's draft, in memory only. A tournament does not exist — locally or on the
	 * server — until configuration finishes and it is created, so leaving the wizard mid-way
	 * discards everything typed into it.
	 */
	draft = $state<TournamentDraft>(domain.createEmptyTournamentDraft());
	step = $state<TournamentSetupStep>('basics');

	/** Whether the wizard may advance: both names, and a usable link if one was typed. */
	get canContinue(): boolean {
		return domain.canContinueTournamentSetup(this.draft);
	}

	/** True when a link was typed but is not a usable http(s) URL — the field's error state. */
	get externalLinkInvalid(): boolean {
		const raw = this.draft.externalLink.trim();
		return raw.length > 0 && !domain.checkExternalLink(raw).ok;
	}

	/**
	 * True while the organizer holds a seat without an army for it — a seat without a list
	 * cannot participate, so this blocks Continue and is shown as the reason why.
	 */
	get organizerArmyMissing(): boolean {
		return domain.organizerSeatNeedsArmy(this.draft);
	}

	/**
	 * Whether the tournament may be created: at least one mission on the list. The same gate
	 * opens the overview pane, which is where creation happens.
	 */
	get canCreate(): boolean {
		return domain.canCreateTournament(this.draft);
	}

	/** Entering the wizard always starts from a clean sheet. */
	start(): void {
		this.draft = domain.createEmptyTournamentDraft();
		this.step = 'basics';
	}

	/** Leaving discards the draft. */
	leave(): void {
		this.start();
	}

	setName(name: string): void {
		this.draft = { ...this.draft, name };
	}

	setExternalLink(externalLink: string): void {
		this.draft = { ...this.draft, externalLink };
	}

	setOrganizerName(organizerName: string): void {
		this.draft = { ...this.draft, organizerName };
	}

	/** Un-ticking the seat also drops the army picked for it. */
	setOrganizerPlays(organizerPlays: boolean): void {
		this.draft = domain.setTournamentOrganizerPlays(this.draft, organizerPlays);
	}

	setOrganizerArmy(army: PickedArmy): void {
		this.draft = domain.setTournamentOrganizerArmy(this.draft, army);
	}

	clearOrganizerArmy(): void {
		this.draft = domain.setTournamentOrganizerArmy(this.draft, null);
	}

	setManualPairing(manualPairing: boolean): void {
		this.draft = { ...this.draft, manualPairing };
	}

	/** Moves the field by whole pairs, clamped at both ends — the −/+ stepper's only entry point. */
	stepParticipants(pairs: number): void {
		const participantCount = domain.stepTournamentPlayers(this.draft.participantCount, pairs);
		// The table count follows the field, so the names have to follow with it.
		this.draft = domain.syncTournamentTables({ ...this.draft, participantCount });
	}

	addMission(missionId: string): void {
		this.draft = domain.addTournamentMission(this.draft, missionId);
	}

	removeMission(missionId: string): void {
		this.draft = domain.removeTournamentMission(this.draft, missionId);
	}

	setTableName(index: number, name: string): void {
		this.draft = domain.setTournamentTableName(this.draft, index, name);
	}

	/** Basics → missions & tables, once both names are given and the optional link is usable. */
	continueSetup(): void {
		if (!this.canContinue) return;
		this.step = 'missions';
	}

	/** Missions & tables → the read-only overview, once at least one mission is on the list. */
	reviewTournament(): void {
		if (!this.canCreate) return;
		this.step = 'overview';
	}

	/** One pane back. The first pane has nowhere to go back to — leaving is the page's call. */
	back(): void {
		const previous = domain.previousTournamentStep(this.step);
		if (previous) this.step = previous;
	}
}

export const tournamentStore = new TournamentStore();
