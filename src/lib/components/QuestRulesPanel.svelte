<script lang="ts">
	import type { QuestRuleSection } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = { sections: QuestRuleSection[] };

	let { sections }: Props = $props();
</script>

<Panel title="Quest Rules">
	<div class="flex flex-col gap-4">
		{#each sections as section, index (index)}
			<div>
				{#if section.label}
					<h3 class="font-semibold text-slate-100">{section.label}</h3>
				{/if}
				<p class="mt-1 whitespace-pre-line text-slate-300">{section.description}</p>
			</div>
		{/each}
	</div>
</Panel>
