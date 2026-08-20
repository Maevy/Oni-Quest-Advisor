<script lang="ts">
	import { BROKEN_MORALE_RULE, CEASEFIRE_RULE, type RuleCallout } from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = {
		name: string;
		description: string;
		brokenMorale: boolean;
		ceasefire: boolean;
		collapsible?: boolean;
	};

	let { name, description, brokenMorale, ceasefire, collapsible = false }: Props = $props();

	let openRule = $state<RuleCallout | null>(null);

	$effect(() => {
		if (!openRule) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') openRule = null;
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<Panel title={name} {collapsible}>
	<div class="mb-3 flex flex-wrap gap-2">
		<button
			type="button"
			class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
			onclick={() => (openRule = BROKEN_MORALE_RULE)}
		>
			Broken Morale: {brokenMorale ? 'Yes' : 'No'}
		</button>
		<button
			type="button"
			class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
			onclick={() => (openRule = CEASEFIRE_RULE)}
		>
			Ceasefire: {ceasefire ? 'Yes' : 'No'}
		</button>
	</div>
	<p class="text-slate-300">{description}</p>
</Panel>

{#if openRule}
	<button
		type="button"
		class="fixed inset-0 z-30 cursor-default bg-slate-950/60"
		aria-label="Close rule explanation"
		onclick={() => (openRule = null)}
	></button>
	<div class="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-6">
		<div
			role="dialog"
			aria-modal="true"
			class="pointer-events-auto max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/90 p-4 backdrop-blur"
		>
			<h3 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">{openRule.title}</h3>
			{#if openRule.heading}
				<p class="mt-2 text-xs font-semibold tracking-wide text-slate-200 uppercase">
					{openRule.heading}
				</p>
			{/if}
			<p class="mt-2 text-sm text-slate-300">{openRule.text}</p>
		</div>
	</div>
{/if}
