<script lang="ts">
	import { roundAccent } from './roundAccent';

	type Props = {
		/** Round the objective scores at the end of — absent when it can be scored any time. */
		round?: number;
	};

	let { round }: Props = $props();
</script>

{#if round}
	{@const accent = roundAccent(round)}
	<span
		class="mr-1.5 inline-block rounded-md border px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase {accent.border} {accent.background} {accent.text}"
		>R{round}</span
	>
{/if}
