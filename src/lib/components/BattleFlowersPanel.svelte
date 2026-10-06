<script lang="ts">
	import type { ArmyView, BattleFlowerSpec, PlayerKey } from '$lib/domain';
	import { battleFlowersFor } from '$lib/domain';
	import BattleFlower from './BattleFlower.svelte';
	import type { FlowerRect } from './BattleFlower.svelte';
	import Panel from './Panel.svelte';
	import { PLAYER_SEATS, seatAccent } from './playerAccent';

	type Props = {
		p1: ArmyView | null;
		p2: ArmyView | null;
		/** Every flower fades while one of them is focused in the overlay. */
		dimmed?: boolean;
		/** Carries the seat's view along, so the screen can resolve the flower's unit card. */
		onSelect?: (flower: BattleFlowerSpec, rect: FlowerRect, army: ArmyView) => void;
	};

	let { p1, p2, dimmed = false, onSelect }: Props = $props();

	const SEAT_ORDER: PlayerKey[] = ['player1', 'player2'];

	function viewFor(player: PlayerKey): ArmyView | null {
		return player === 'player1' ? p1 : p2;
	}
</script>

{#snippet half(player: PlayerKey)}
	{@const army = viewFor(player)}
	{@const seat = PLAYER_SEATS[player]}
	{@const accent = seatAccent(seat.hue)}
	<div class="flex flex-col gap-3 rounded-2xl border {accent.border} {accent.wash} p-3">
		<div class="min-w-0">
			<p class="text-xs font-semibold tracking-wide uppercase {accent.text}">{seat.label}</p>
			<p class="truncate text-[11px] text-slate-200">{army?.army.name ?? 'No army attached'}</p>
		</div>
		{#if army}
			<!-- One flower per row: a two-column grid squeezed each flower below its design size
			     on a phone, and the ring's box count is the thing that must stay legible. -->
			<div class="flex flex-col items-center gap-3">
				{#each battleFlowersFor(army) as flower (flower.entryId)}
					<BattleFlower
						{flower}
						{dimmed}
						onSelect={onSelect ? (rect) => onSelect(flower, rect, army) : undefined}
					/>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-slate-200">
				{seat.label} fields nothing this run — an army can be picked from the briefing before the game
				starts.
			</p>
		{/if}
	</div>
{/snippet}

<Panel title="Armies">
	<div class="grid grid-cols-2 gap-2">
		{#each SEAT_ORDER as player (player)}
			{@render half(player)}
		{/each}
	</div>
</Panel>
