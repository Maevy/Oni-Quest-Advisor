<script lang="ts">
	import {
		drawCountForIntelligence,
		type ChosenScheme,
		type Faction,
		type PlayerKey,
		type SchemeCard,
		type SchemeDraft
	} from '$lib/domain';
	import IncrementBoxes from './IncrementBoxes.svelte';
	import Panel from './Panel.svelte';

	type Props = {
		factions: Faction[];
		draftP1: SchemeDraft;
		draftP2: SchemeDraft;
		drawnP1: SchemeCard[];
		drawnP2: SchemeCard[];
		chosenP1: ChosenScheme | null;
		chosenP2: ChosenScheme | null;
		chosenCardP1: SchemeCard | null;
		chosenCardP2: SchemeCard | null;
		revealedP1: boolean;
		revealedP2: boolean;
		activePlayer: PlayerKey;
		onSetFaction: (player: PlayerKey, factionId: string) => void;
		onSetIntelligence: (player: PlayerKey, intelligence: number | null) => void;
		onDraw: (player: PlayerKey) => void;
		onChoose: (player: PlayerKey, schemeId: string) => void;
		onSetChecked: (player: PlayerKey, checkedIncrements: number) => void;
		onDelete: (player: PlayerKey) => void;
		onReveal: (player: PlayerKey) => void;
	};

	let {
		factions,
		draftP1,
		draftP2,
		drawnP1,
		drawnP2,
		chosenP1,
		chosenP2,
		chosenCardP1,
		chosenCardP2,
		revealedP1,
		revealedP2,
		activePlayer,
		onSetFaction,
		onSetIntelligence,
		onDraw,
		onChoose,
		onSetChecked,
		onDelete,
		onReveal
	}: Props = $props();
</script>

<Panel title="Schemes">
	<div class="flex flex-col gap-4">
		{#each [{ key: 'player1' as PlayerKey, label: 'Player 1', border: 'border-sky-500/40', labelColor: 'text-sky-400', textColor: 'text-sky-100', btnBorder: 'border-sky-500/40', btnHover: 'hover:bg-sky-500/10', draft: draftP1, drawn: drawnP1, chosen: chosenP1, card: chosenCardP1, revealed: revealedP1 }, { key: 'player2' as PlayerKey, label: 'Player 2', border: 'border-orange-500/40', labelColor: 'text-orange-400', textColor: 'text-orange-100', btnBorder: 'border-orange-500/40', btnHover: 'hover:bg-orange-500/10', draft: draftP2, drawn: drawnP2, chosen: chosenP2, card: chosenCardP2, revealed: revealedP2 }] as player (player.key)}
			<div class="rounded-xl border {player.border} bg-slate-900/40 p-3">
				<span class="mb-2 block text-xs font-semibold tracking-wide {player.labelColor} uppercase">
					{player.label}
				</span>

				{#if activePlayer === player.key}
					{#if player.chosen && player.card}
						<div class="flex items-start justify-between gap-3">
							<div>
								<h3 class="font-semibold {player.textColor}">{player.card.title}</h3>
								<p class="mt-1 text-sm text-slate-300">{player.card.ruleText}</p>
								<div class="mt-3">
									<IncrementBoxes
										count={player.card.maxIncrements}
										checkedCount={player.chosen.checkedIncrements}
										onSetChecked={(count) => onSetChecked(player.key, count)}
									/>
								</div>
							</div>
							<div class="flex shrink-0 flex-col gap-1">
								<button
									type="button"
									class="rounded-lg border border-red-500/60 bg-slate-900/60 px-2 py-1 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
									onclick={() => onDelete(player.key)}
									aria-label="Delete chosen Scheme"
								>
									✕
								</button>
								{#if !player.revealed}
									<button
										type="button"
										class="rounded-lg border {player.btnBorder} bg-slate-900/60 px-2 py-1 text-[10px] font-medium {player.labelColor} transition {player.btnHover}"
										onclick={() => onReveal(player.key)}
									>
										Reveal
									</button>
								{/if}
							</div>
						</div>
					{:else if player.drawn.length > 0}
						<div class="flex flex-col gap-2">
							{#each player.drawn as card (card.id)}
								<button
									type="button"
									class="rounded-xl border-2 {player.btnBorder} bg-slate-900/40 p-3 text-left transition {player.btnHover}"
									onclick={() => onChoose(player.key, card.id)}
								>
									<h3 class="font-semibold {player.textColor}">{card.title}</h3>
									<p class="mt-1 text-sm text-slate-300">{card.ruleText}</p>
								</button>
							{/each}
						</div>
					{:else}
						{@const canDraw = player.draft.factionId !== null && player.draft.intelligence !== null}
						{@const drawCount =
							player.draft.intelligence !== null
								? drawCountForIntelligence(player.draft.intelligence)
								: null}
						<div class="flex flex-wrap items-end gap-2">
							<label class="flex flex-col gap-1 text-sm text-slate-300">
								Faction
								<select
									class="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
									value={player.draft.factionId ?? ''}
									onchange={(event) =>
										onSetFaction(player.key, (event.target as HTMLSelectElement).value)}
								>
									<option value="" disabled>Select…</option>
									{#each factions as faction (faction.id)}
										<option value={faction.id}>{faction.name}</option>
									{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1 text-sm text-slate-300">
								Intelligence
								<input
									type="number"
									min="0"
									class="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
									value={player.draft.intelligence ?? ''}
									oninput={(event) => {
										const value = (event.target as HTMLInputElement).value;
										onSetIntelligence(player.key, value === '' ? null : Number(value));
									}}
								/>
							</label>
							<button
								type="button"
								disabled={!canDraw}
								class="rounded-lg border {player.btnBorder} bg-slate-900/60 px-3 py-1.5 text-sm font-medium {player.textColor} transition {player.btnHover} disabled:cursor-not-allowed disabled:opacity-40"
								onclick={() => onDraw(player.key)}
							>
								Draw Missions
							</button>
							{#if drawCount !== null}
								<span class="text-xs text-slate-500">Draws {drawCount}</span>
							{/if}
						</div>
					{/if}
				{:else}
					{#if player.chosen && player.card && player.revealed}
						<div>
							<h3 class="font-semibold {player.textColor}">{player.card.title}</h3>
							<p class="mt-1 text-sm text-slate-300">{player.card.ruleText}</p>
							<div class="mt-3">
								<IncrementBoxes
									count={player.card.maxIncrements}
									checkedCount={player.chosen.checkedIncrements}
									onSetChecked={(count) => onSetChecked(player.key, count)}
								/>
							</div>
						</div>
					{:else if player.chosen}
						<span class="text-sm text-slate-500 italic">Hidden</span>
					{:else}
						<span class="text-sm text-slate-500 italic">No schemes</span>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</Panel>
