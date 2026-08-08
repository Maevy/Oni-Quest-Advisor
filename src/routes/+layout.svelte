<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import background from '$lib/assets/oniquestCompanion_background.jpg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div
	class="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
	style="background-image: linear-gradient(to right, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.15) 25%, rgba(2, 6, 23, 0.15) 75%, rgba(2, 6, 23, 0.95) 100%), url({background});"
></div>

{@render children()}
