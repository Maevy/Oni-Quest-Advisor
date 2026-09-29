<script lang="ts">
	import type { TournamentRoadmapStep } from '$lib/domain';

	type Props = {
		steps: TournamentRoadmapStep[];
		/** The step the event is on; -1 while nothing has started. */
		currentIndex: number;
	};

	let { steps, currentIndex }: Props = $props();

	const dot = 'relative h-3.5 w-3.5 shrink-0 rounded-full transition';
	const dotDone = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]';
	const dotNow = 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.95)]';
	const dotLater = 'bg-slate-600';
	const link = 'h-0.5 w-8 shrink-0 transition sm:w-10';
	const linkDone = 'bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.5)]';
	const linkLater = 'bg-slate-700';

	/** Which step the caption names: the one tapped, or the one the event is on. */
	let picked = $state<number | null>(null);
	const shown = $derived(picked ?? Math.max(currentIndex, 0));
	const shownStep = $derived(steps[shown] ?? null);

	function label(step: TournamentRoadmapStep): string {
		if (step.phase === 'conclusion') return 'Tournament Conclusion';
		const phase = step.phase === 'setup' ? 'Setup' : step.phase === 'game' ? 'Game' : 'Scoring';
		return `Round ${step.round} ${phase}`;
	}

	function stateOf(index: number): 'done' | 'now' | 'upcoming' {
		if (index < currentIndex) return 'done';
		return index === currentIndex ? 'now' : 'upcoming';
	}

	// The strip scrolls the current step into view: a nine-mission tournament has 28 steps, and
	// the one that matters is never the first.
	let strip = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const container = strip;
		if (!container) return;
		const target = container.querySelector<HTMLElement>(
			`[data-step-index="${Math.max(currentIndex, 0)}"]`
		);
		if (!target) return;
		container.scrollTo({
			left: target.offsetLeft - container.clientWidth / 2 + target.offsetWidth / 2,
			behavior: 'smooth'
		});
	});
</script>

<div class="flex flex-col gap-1">
	<!--
		Centring lives on an inner `w-max min-w-full justify-center` row, not on the scroller: the
		row centres the dots when they fit and overflows from the left edge when they do not, while
		`justify-center` on the scroller itself would clip the steps before the current one. The
		`relative` is what makes the auto-scroll's offsetLeft maths resolve against this element.
	-->
	<div bind:this={strip} class="relative overflow-x-auto overscroll-x-contain py-2">
		<div
			class="flex w-max min-w-full items-center justify-center"
			role="list"
			aria-label="Tournament progress"
		>
			{#each steps as step, index (step.id)}
				<div class="flex shrink-0 items-center" role="listitem">
					<button
						type="button"
						data-step-index={index}
						class="{dot} {stateOf(index) === 'done'
							? dotDone
							: stateOf(index) === 'now'
								? dotNow
								: dotLater}"
						aria-current={index === currentIndex ? 'step' : undefined}
						aria-label="{label(step)} — {stateOf(index)}"
						title={label(step)}
						onclick={() => (picked = picked === index ? null : index)}
					>
						{#if index === currentIndex}
							<span
								class="absolute inset-0 rounded-full bg-emerald-400/70 motion-safe:animate-ping"
								aria-hidden="true"
							></span>
						{/if}
					</button>
					{#if index < steps.length - 1}
						<span class="{link} {index < currentIndex ? linkDone : linkLater}" aria-hidden="true"
						></span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<p
		class="text-center text-xs {shown === currentIndex ? 'text-emerald-300' : 'text-slate-400'}"
		aria-live="polite"
	>
		{#if shownStep}
			{label(shownStep)}
			<span class="text-slate-300">
				·
				{stateOf(shown) === 'done' ? 'done' : stateOf(shown) === 'now' ? 'now' : 'upcoming'}
			</span>
		{/if}
	</p>
</div>
