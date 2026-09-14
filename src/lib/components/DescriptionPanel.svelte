<script lang="ts">
	import type { RuleCallout } from '$lib/domain';
	import Panel from './Panel.svelte';
	import RuleLabels from './RuleLabels.svelte';

	type Props = {
		name: string;
		description: string;
		brokenMorale: boolean;
		ceasefire: boolean;
		collapsible?: boolean;
		/**
		 * The screen renders `RuleCalloutDialog` for this. The overlay has to sit above every
		 * transformed or backdrop-filtered ancestor — the solo tracker's sliding strip carries a
		 * transform, which would become the dialog's containing block and push its card
		 * off-screen while only the backdrop shows.
		 */
		onOpenRule: (rule: RuleCallout) => void;
	};

	let {
		name,
		description,
		brokenMorale,
		ceasefire,
		collapsible = false,
		onOpenRule
	}: Props = $props();
</script>

<Panel title={name} {collapsible}>
	<div class="mb-3">
		<RuleLabels {brokenMorale} {ceasefire} {onOpenRule} />
	</div>
	<p class="text-slate-300">{description}</p>
</Panel>
