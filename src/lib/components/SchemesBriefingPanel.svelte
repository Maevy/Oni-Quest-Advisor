<script lang="ts">
	import Panel from './Panel.svelte';

	type Props = { collapsible?: boolean };

	let { collapsible = false }: Props = $props();
</script>

<Panel title="Schemes" {collapsible}>
	<p class="text-slate-300">Can be selected when the game starts.</p>
</Panel>
