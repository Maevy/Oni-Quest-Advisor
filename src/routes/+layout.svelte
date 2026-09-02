<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import background from '$lib/assets/OniQuestAdvisorBackgroundv3.jpg';
	import PrivacyNotice from '$lib/components/PrivacyNotice.svelte';
	import { navigationStore } from '$lib/stores';

	let { children } = $props();

	onMount(() => {
		navigationStore.initNotices();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div
	class="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
	style="background-image: linear-gradient(to right, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.15) 25%, rgba(2, 6, 23, 0.15) 75%, rgba(2, 6, 23, 0.95) 100%), url({background});"
></div>

<div class="flex min-h-dvh flex-col">
	<div class="flex-1">{@render children()}</div>
	<footer class="px-4 pt-6 pb-3 text-center text-[10px] leading-relaxed text-slate-100">
		Oni Quest Advisor is a pure fan project and not affiliated in any kind with FreeCompany d.o.o.
		<span class="mt-1 block">
			Artwork for this fan project has been provided by Freecompany d.o.o. under a free license for
			use in connection with the project.
		</span>
		<span class="mt-1 block">v{__APP_VERSION__}</span>
	</footer>
</div>

{#if navigationStore.showPrivacyNotice}
	<PrivacyNotice onDismiss={() => navigationStore.dismissPrivacyNotice()} />
{/if}
