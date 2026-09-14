<script lang="ts">
	import type { RuleCallout } from '$lib/domain';
	import Panel from './Panel.svelte';
	import RuleLabels from './RuleLabels.svelte';

	type Props = {
		description: string;
		brokenMorale: boolean;
		ceasefire: boolean;
		collapsible?: boolean;
		/** The screen renders `RuleCalloutDialog` for this - see DescriptionPanel's note. */
		onOpenRule: (rule: RuleCallout) => void;
	};

	let { description, brokenMorale, ceasefire, collapsible = false, onOpenRule }: Props = $props();
</script>

<Panel title="Mission Description" {collapsible}>
	<p class="text-slate-300">{description}</p>
	<div class="mt-3">
		<RuleLabels {brokenMorale} {ceasefire} {onOpenRule} />
	</div>
</Panel>
