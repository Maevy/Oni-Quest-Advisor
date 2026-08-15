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

<div class="flex min-h-dvh flex-col">
	<div class="flex-1">{@render children()}</div>
	<footer class="px-4 pt-6 pb-3 text-center text-[10px] leading-relaxed text-slate-500">
		Oni Quest Advisor is a pure fan project and not affiliated in any kind with FreeCompany d.o.o.
		<span class="mt-1 block">v{__APP_VERSION__}</span>
	</footer>
</div>
