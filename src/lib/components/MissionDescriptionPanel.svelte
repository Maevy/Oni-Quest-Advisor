<script lang="ts">
	import type { RuleCallout } from '$lib/domain';
	import Panel from './Panel.svelte';
	import RuleCalloutDialog from './RuleCalloutDialog.svelte';
	import RuleLabels from './RuleLabels.svelte';

	type Props = {
		description: string;
		brokenMorale: boolean;
		ceasefire: boolean;
		collapsible?: boolean;
	};

	let { description, brokenMorale, ceasefire, collapsible = false }: Props = $props();

	let openRule = $state<RuleCallout | null>(null);
</script>

<Panel title="Mission Description" {collapsible}>
	<p class="text-slate-300">{description}</p>
	<div class="mt-3">
		<RuleLabels {brokenMorale} {ceasefire} onOpenRule={(rule) => (openRule = rule)} />
	</div>
</Panel>

<!-- Sibling of <Panel>, never inside it: Panel's backdrop-blur would become the overlay's
     containing block and trap it inside the panel. -->
<RuleCalloutDialog rule={openRule} onClose={() => (openRule = null)} />
