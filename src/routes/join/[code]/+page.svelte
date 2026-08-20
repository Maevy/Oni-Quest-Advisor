<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores';

	let { data }: { data: { code: string } } = $props();

	// Invite link entry point: hand the game code to the navigation store,
	// then continue in the single-page flow on "/".
	onMount(() => {
		navigationStore.prepareOnlineJoin(data.code);
		void goto(resolve('/'), { replaceState: true });
	});
</script>
