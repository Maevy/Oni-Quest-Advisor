<script lang="ts">
	import type { PlayerKey } from '$lib/domain';
	import Panel from './Panel.svelte';
	import { PLAYER_SEATS, playerAccent } from './playerAccent';

	type Props = {
		activePlayer: PlayerKey;
		/** The active seat's attached army, or null when that seat fields no list. */
		armyName: string | null;
	};

	let { activePlayer, armyName }: Props = $props();

	let seat = $derived(PLAYER_SEATS[activePlayer]);
	let accent = $derived(playerAccent(activePlayer));
</script>

<Panel title="Active Player" titleClass={accent.text}>
	<p class="text-center text-lg font-bold {accent.text}">
		{seat.label} is the active Player
	</p>
	<p
		class="mt-1 text-center text-sm font-semibold text-slate-100"
		aria-label="Active player's army"
	>
		{#if armyName}
			{armyName}
		{:else}
			<span class="font-normal text-slate-300 italic">No army picked</span>
		{/if}
	</p>
</Panel>
