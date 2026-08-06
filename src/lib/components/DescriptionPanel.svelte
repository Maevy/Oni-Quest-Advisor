<script lang="ts">
	import Panel from './Panel.svelte';

	type Props = {
		name: string;
		description: string;
		brokenMorale: boolean;
		ceasefire: boolean;
	};

	let { name, description, brokenMorale, ceasefire }: Props = $props();
</script>

<Panel title={name}>
	<div class="mb-3 flex flex-wrap gap-2">
		<span class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950">
			Broken Morale: {brokenMorale ? 'Yes' : 'No'}
		</span>
		<span class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950">
			Ceasefire: {ceasefire ? 'Yes' : 'No'}
		</span>
	</div>
	<p class="text-slate-300">{description}</p>
</Panel>
