<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		armyCopyCounts,
		getMissionsForSeason,
		getScoreableResults,
		getSeasons,
		groupResults,
		groupSavedArmies,
		indexArmyRules,
		resolveArmyEntries,
		savedArmyFormat,
		type ArmyFormat
	} from '$lib/domain';
	import {
		armyBuilderStore,
		contentStore,
		missionProgressStore,
		navigationStore,
		onlineGameStore,
		twoPlayerProgressStore
	} from '$lib/stores';
	import GameModeSelect from '$lib/components/GameModeSelect.svelte';
	import ArmyBuilderView from '$lib/components/ArmyBuilderView.svelte';
	import ArmyFactionSelect from '$lib/components/ArmyFactionSelect.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadArmyDialog from '$lib/components/LoadArmyDialog.svelte';
	import SaveArmyDialog from '$lib/components/SaveArmyDialog.svelte';
	import SeasonSelect from '$lib/components/SeasonSelect.svelte';
	import MissionSelect from '$lib/components/MissionSelect.svelte';
	import MissionBriefing from '$lib/components/MissionBriefing.svelte';
	import MissionDetail from '$lib/components/MissionDetail.svelte';
	import MissionDetailTwoPlayer from '$lib/components/MissionDetailTwoPlayer.svelte';
	import OnlineCreate from '$lib/components/OnlineCreate.svelte';
	import OnlineGameView from '$lib/components/OnlineGameView.svelte';
	import OnlineIntroNotice from '$lib/components/OnlineIntroNotice.svelte';
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
	/** Results grouped into per-round cards for the read-only briefing. */
	let briefingEntries = $derived(groupResults(resultsForMission));

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

	// Army builder derived values
	let armyFaction = $derived(
		armyBuilderStore.factionId
			? (contentStore.armyFactions.find((faction) => faction.id === armyBuilderStore.factionId) ??
					null)
			: null
	);
	let armyRows = $derived(
		resolveArmyEntries(
			armyBuilderStore.entries,
			armyBuilderStore.units,
			armyBuilderStore.mounts,
			armyBuilderStore.upgradeIndex,
			armyBuilderStore.itemIndex
		)
	);
	let armyCounts = $derived(armyCopyCounts(armyBuilderStore.entries));
	let armyClassIndex = $derived(indexArmyRules(contentStore.armyClasses));
	let armySkillIndex = $derived(indexArmyRules(contentStore.armySkills));
	let armyTraitIndex = $derived(indexArmyRules(contentStore.armyTraits));
	let armyCombatArtIndex = $derived(indexArmyRules(contentStore.armyCombatArts));
	let armySpellcraftIndex = $derived(indexArmyRules(contentStore.armySpellcrafts));
	let armyStratagemIndex = $derived(indexArmyRules(contentStore.armyStratagems));
	let armyItemIndex = $derived(indexArmyRules(contentStore.armyItems));

	// Save/Load Army dialogs
	let showSaveArmy = $state(false);
	let showLoadArmy = $state(false);
	let loadFilter = $state<ArmyFormat>('standard');
	let savedArmyGroups = $derived(
		groupSavedArmies(
			armyBuilderStore.savedArmies.filter((army) => savedArmyFormat(army) === loadFilter),
			contentStore.armyFactions.map((faction) => faction.id)
		)
	);

	// Format switch with a destructive-change confirmation
	let formatSwitchTarget = $state<ArmyFormat | null>(null);

	function requestFormat(format: ArmyFormat): void {
		if (format === armyBuilderStore.format) return;
		if (armyBuilderStore.entries.length > 0 || armyBuilderStore.rosterPicks.length > 0) {
			formatSwitchTarget = format;
		} else {
			armyBuilderStore.setFormat(format);
		}
	}

	// Mount toggle that would drop upgrades, confirmed the same way
	let mountConflict = $state<{ entryId: string; names: string[] } | null>(null);

	function requestToggleMount(entryId: string): void {
		const conflicts = armyBuilderStore.mountConflicts(entryId);
		if (conflicts.length > 0) {
			mountConflict = { entryId, names: conflicts.map((upgrade) => upgrade.name) };
		} else {
			armyBuilderStore.toggleMount(entryId);
		}
	}

	/** Copies the army share code; returns it so the UI can show it either way. */
	async function copyArmyCode(): Promise<{ code: string; copied: boolean } | null> {
		const code = armyBuilderStore.exportArmyCode();
		if (!code) return null;
		try {
			await navigator.clipboard.writeText(code);
			return { code, copied: true };
		} catch {
			return { code, copied: false };
		}
	}
</script>

{#if navigationStore.showOnlineIntro}
	<OnlineIntroNotice
		onConfirm={() => navigationStore.acceptOnlineIntro()}
		onCancel={() => navigationStore.cancelOnlineIntro()}
	/>
{/if}

{#if navigationStore.screen === 'game-mode'}
	<GameModeSelect
		onSoloSelect={() => navigationStore.selectSoloMode()}
		onTwoPlayerSelect={() => navigationStore.selectTwoPlayerMode()}
		onOnlineSelect={() => navigationStore.selectOnlineMode()}
		onArmyBuilderSelect={() => {
			void contentStore.loadArmy();
			navigationStore.selectArmyBuilder();
		}}
	/>
{:else if navigationStore.screen === 'army-faction-select'}
	{#if contentStore.armyLoaded}
		<ArmyFactionSelect
			factions={contentStore.armyFactions}
			onSelect={(factionId) => navigationStore.selectArmyFaction(factionId)}
			onImportCode={(code) => {
				const error = armyBuilderStore.importArmy(code);
				if (error === null) navigationStore.openImportedArmy();
				return error;
			}}
			onLoadArmy={() => {
				armyBuilderStore.refreshSavedArmies();
				showLoadArmy = true;
			}}
			onReturn={() => navigationStore.returnToGameMode()}
		/>
	{:else}
		<div class="flex justify-center p-8">
			<p class="text-sm text-slate-400">Loading army builder…</p>
		</div>
	{/if}
{:else if navigationStore.screen === 'army-builder' && armyFaction}
	<ArmyBuilderView
		faction={armyFaction}
		units={armyBuilderStore.units}
		classIndex={armyClassIndex}
		skillIndex={armySkillIndex}
		traitIndex={armyTraitIndex}
		combatArtIndex={armyCombatArtIndex}
		spellcraftIndex={armySpellcraftIndex}
		spells={contentStore.armySpells}
		stratagemIndex={armyStratagemIndex}
		itemIndex={armyItemIndex}
		entries={armyBuilderStore.entries}
		upgrades={armyBuilderStore.upgrades}
		upgradeIndex={armyBuilderStore.upgradeIndex}
		rulesIndexes={armyBuilderStore.rulesIndexes}
		{armyRows}
		counts={armyCounts}
		format={armyBuilderStore.format}
		points={armyBuilderStore.points}
		limit={armyBuilderStore.limit}
		isOverLimit={armyBuilderStore.isOverLimit}
		startOnArmyPanel={armyBuilderStore.startOnArmyPanel}
		onReturn={() => navigationStore.leaveArmyBuilder()}
		onSetFormat={requestFormat}
		onCopyCode={copyArmyCode}
		onSaveArmy={() => (showSaveArmy = true)}
		rosterPicks={armyBuilderStore.rosterPicks}
		onAddPick={(upgradeId) => armyBuilderStore.addRosterPick(upgradeId)}
		onRemovePick={(upgradeId) => armyBuilderStore.removeRosterPick(upgradeId)}
		onAddUnit={(unitId) => armyBuilderStore.addUnit(unitId)}
		onRemoveUnit={(unitId) => armyBuilderStore.removeUnit(unitId)}
		onRemoveEntry={(entryId) => armyBuilderStore.removeEntry(entryId)}
		onToggleMount={requestToggleMount}
		onAddUpgrade={(entryId, upgradeId, selection) =>
			armyBuilderStore.addUpgrade(entryId, upgradeId, selection)}
		onRemoveUpgrade={(entryId, upgradeId) => armyBuilderStore.removeUpgrade(entryId, upgradeId)}
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
		onAccepted={() => {
			onlineGameStore.completePendingJoin();
			navigationStore.enterOnlineGame();
		}}
		onReturn={() => {
			onlineGameStore.cancelPendingJoin();
			navigationStore.leaveOnline();
		}}
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
{:else if navigationStore.screen === 'mission-briefing' && selectedMission}
	<MissionBriefing
		mission={selectedMission}
		entries={briefingEntries}
		onReturn={() => navigationStore.returnToMissionSelect()}
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

{#if showSaveArmy}
	<SaveArmyDialog
		onSave={(name) => {
			const error = armyBuilderStore.saveArmy(name);
			if (error === null) showSaveArmy = false;
			return error;
		}}
		onCancel={() => (showSaveArmy = false)}
	/>
{/if}

{#if showLoadArmy}
	<LoadArmyDialog
		groups={savedArmyGroups}
		factions={contentStore.armyFactions}
		filter={loadFilter}
		onSetFilter={(format) => (loadFilter = format)}
		onLoad={(army) => {
			const error = armyBuilderStore.importArmy(army.code);
			if (error === null) {
				showLoadArmy = false;
				navigationStore.openImportedArmy();
			}
			return error;
		}}
		onDelete={(army) => armyBuilderStore.deleteSavedArmy(army.id)}
		onCancel={() => (showLoadArmy = false)}
	/>
{/if}

{#if formatSwitchTarget}
	<ConfirmDialog
		text={'Switch to ' +
			(formatSwitchTarget === 'standard' ? 'Standard' : 'Roster') +
			'? The current list will be deleted.'}
		confirmLabel="Yes"
		cancelLabel="No"
		onConfirm={() => {
			const target = formatSwitchTarget;
			if (target) armyBuilderStore.setFormat(target);
			formatSwitchTarget = null;
		}}
		onCancel={() => (formatSwitchTarget = null)}
	/>
{/if}

{#if mountConflict}
	<ConfirmDialog
		text={'Mount this model? Its size changes, so ' +
			mountConflict.names.join(', ') +
			' will be removed.'}
		confirmLabel="Yes"
		cancelLabel="No"
		onConfirm={() => {
			const conflict = mountConflict;
			if (conflict) armyBuilderStore.toggleMount(conflict.entryId);
			mountConflict = null;
		}}
		onCancel={() => (mountConflict = null)}
	/>
{/if}
