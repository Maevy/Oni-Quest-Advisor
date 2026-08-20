<script lang="ts">
	import type { SetupItem } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = { setup: SetupItem[]; collapsible?: boolean };

	let { setup, collapsible = false }: Props = $props();
</script>

<Panel title="Setup" {collapsible}>
	<ul class="list-disc space-y-2 pl-5 text-slate-300">
		{#each setup as item, index (index)}
			<li><span class="font-semibold text-slate-100">{item.label}:</span> {item.description}</li>
		{/each}
	</ul>
</Panel>
