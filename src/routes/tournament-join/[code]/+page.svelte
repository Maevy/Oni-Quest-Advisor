<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores';

	let { data }: { data: { code: string } } = $props();

	// Invite-link / QR entry point: hand the tournament code to the navigation store,
	// then continue in the single-page flow on "/".
	onMount(() => {
		navigationStore.prepareTournamentJoin(data.code);
		void goto(resolve('/'), { replaceState: true });
	});
</script>
