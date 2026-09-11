<script lang="ts">
	import type { RuleCallout } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		/** The callout to explain, or null while closed. */
		rule: RuleCallout | null;
		onClose: () => void;
	};

	let { rule, onClose }: Props = $props();

	$effect(() => {
		if (!rule) return;
		return onEscapeKey(onClose);
	});
</script>

{#if rule}
	<!-- Clicking anywhere outside the card lands on this backdrop and closes the dialog. -->
	<button
		type="button"
		class="fixed inset-0 z-50 cursor-default bg-slate-950/70 backdrop-blur-sm"
		aria-label="Close rule explanation"
		onclick={onClose}
	></button>
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
		<div
			role="dialog"
			aria-modal="true"
			class="pointer-events-auto max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/90 p-4 backdrop-blur"
		>
			<h3 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">{rule.title}</h3>
			{#if rule.heading}
				<p class="mt-2 text-xs font-semibold tracking-wide text-slate-200 uppercase">
					{rule.heading}
				</p>
			{/if}
			<p class="mt-2 text-sm text-slate-300">{rule.text}</p>
		</div>
	</div>
{/if}
