<script lang="ts">
	import { BROKEN_MORALE_RULE, CEASEFIRE_RULE, type RuleCallout } from '$lib/domain';

	type Props = {
		brokenMorale: boolean;
		ceasefire: boolean;
		/**
		 * The parent renders {@link RuleCalloutDialog} for this — the overlay has to sit outside any
		 * `backdrop-blur` panel, or that panel becomes its containing block and traps it.
		 */
		onOpenRule: (rule: RuleCallout) => void;
	};

	let { brokenMorale, ceasefire, onOpenRule }: Props = $props();
</script>

<div class="flex flex-wrap gap-2">
	<button
		type="button"
		class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={() => onOpenRule(BROKEN_MORALE_RULE)}
	>
		Broken Morale: {brokenMorale ? 'Yes' : 'No'}
	</button>
	<button
		type="button"
		class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
		onclick={() => onOpenRule(CEASEFIRE_RULE)}
	>
		Ceasefire: {ceasefire ? 'Yes' : 'No'}
	</button>
</div>
