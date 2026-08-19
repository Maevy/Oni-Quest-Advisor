<script lang="ts">
	import type {
		Faction,
		Mission,
		PlayerKey,
		ResultObjectiveDef,
		SchemeCard,
		TwoPlayerMissionProgress
	} from '$lib/domain';
	import DescriptionPanel from './DescriptionPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';
	import MissionMap from './MissionMap.svelte';
	import ResultsPanelTwoPlayer from './ResultsPanelTwoPlayer.svelte';
	import SchemesPanelTwoPlayer from './SchemesPanelTwoPlayer.svelte';
	import QuestRulesPanel from './QuestRulesPanel.svelte';
	import CommandPanelTwoPlayer from './CommandPanelTwoPlayer.svelte';
	import CountdownOverlay from './CountdownOverlay.svelte';

	type Props = {
		mission: Mission;
		results: ResultObjectiveDef[];
		progress: TwoPlayerMissionProgress;
		totalVPP1: number;
		totalVPP2: number;
		factions: Faction[];
		drawnP1: SchemeCard[];
		drawnP2: SchemeCard[];
		chosenCardP1: SchemeCard | null;
		chosenCardP2: SchemeCard | null;
		activePlayer: PlayerKey;
		onReturn: () => void;
		onReset: () => void;
		onSetObjectiveChecked: (
			player: PlayerKey,
			objectiveId: string,
			checkedCount: number,
			maxCount: number
		) => void;
		onSetDraftFaction: (player: PlayerKey, factionId: string) => void;
		onSetDraftIntelligence: (player: PlayerKey, intelligence: number | null) => void;
		onDrawSchemes: (player: PlayerKey) => void;
		onChooseScheme: (player: PlayerKey, schemeId: string) => void;
		onSetSchemeChecked: (player: PlayerKey, checkedIncrements: number) => void;
		onDeleteScheme: (player: PlayerKey) => void;
		onRevealScheme: (player: PlayerKey) => void;
		onSetRound: (round: number) => void;
		onSwap: () => void;
	};

	let {
		mission,
		results,
		progress,
		totalVPP1,
		totalVPP2,
		factions,
		drawnP1,
		drawnP2,
		chosenCardP1,
		chosenCardP2,
		activePlayer,
		onReturn,
		onReset,
		onSetObjectiveChecked,
		onSetDraftFaction,
		onSetDraftIntelligence,
		onDrawSchemes,
		onChooseScheme,
		onSetSchemeChecked,
		onDeleteScheme,
		onRevealScheme,
		onSetRound,
		onSwap
	}: Props = $props();

	let isSwapping = $state(false);

	function handleSwap(): void {
		isSwapping = true;
	}

	function handleSwapComplete(): void {
		isSwapping = false;
		onSwap();
	}

	function handleSwapSkip(): void {
		isSwapping = false;
		onSwap();
	}
</script>

<CommandPanelTwoPlayer
	{totalVPP1}
	{totalVPP2}
	round={progress.currentRound}
	{activePlayer}
	{onSetRound}
	{onReset}
	onSwap={handleSwap}
/>

{#if isSwapping}
	<CountdownOverlay onComplete={handleSwapComplete} onSkip={handleSwapSkip} />
{/if}

<div class="min-h-dvh py-4 pr-10 pl-4">
	<div class="mx-auto flex w-full max-w-xl flex-col">
		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				class="rounded-lg bg-sky-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
				onclick={onReturn}
			>
				Return
			</button>
		</div>

		<div class="mt-6 flex flex-col gap-4">
			<DescriptionPanel
				name={mission.name}
				description={mission.description}
				brokenMorale={mission.brokenMorale}
				ceasefire={mission.ceasefire}
			/>
			<SetupPanel setup={mission.setup} />
			<MissionMap map={mission.map} />
			<ResultsPanelTwoPlayer
				{results}
				important={mission.important}
				checkedP1={progress.player1.checkedObjectiveCounts}
				checkedP2={progress.player2.checkedObjectiveCounts}
				onSetCheckedP1={(objectiveId, checkedCount, maxCount) =>
					onSetObjectiveChecked('player1', objectiveId, checkedCount, maxCount)}
				onSetCheckedP2={(objectiveId, checkedCount, maxCount) =>
					onSetObjectiveChecked('player2', objectiveId, checkedCount, maxCount)}
			/>
			<SchemesPanelTwoPlayer
				{factions}
				draftP1={progress.player1.schemeDraft}
				draftP2={progress.player2.schemeDraft}
				{drawnP1}
				{drawnP2}
				chosenP1={progress.player1.scheme}
				chosenP2={progress.player2.scheme}
				{chosenCardP1}
				{chosenCardP2}
				revealedP1={progress.player1.schemeRevealed}
				revealedP2={progress.player2.schemeRevealed}
				{activePlayer}
				onSetFaction={onSetDraftFaction}
				onSetIntelligence={onSetDraftIntelligence}
				onDraw={onDrawSchemes}
				onChoose={onChooseScheme}
				onSetChecked={onSetSchemeChecked}
				onDelete={onDeleteScheme}
				onReveal={onRevealScheme}
			/>
			<QuestRulesPanel sections={mission.questRules} />
		</div>
	</div>
</div>
