<script lang="ts">
	import type { ArmyUpgradeSpec } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		upgrade: ArmyUpgradeSpec;
		/** Effective cost inside the current army (cost reductions applied). */
		cost: number;
		factionColor: string;
		onClose: () => void;
	};

	let { upgrade, cost, factionColor, onClose }: Props = $props();

	$effect(() => onEscapeKey(onClose));
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onClose();
	}}
>
	<div
		role="dialog"
		tabindex="-1"
		aria-label={upgrade.name}
		class="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl"
		style="border-color: {factionColor}"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="flex min-w-0 items-center gap-3">
				{#if upgrade.icon}
					<img
						src={upgrade.icon}
						alt=""
						class="h-16 w-16 shrink-0 rounded-xl border border-slate-700/50 object-cover"
					/>
				{/if}
				<div class="min-w-0">
					<h2 class="text-sm font-semibold text-slate-100">{upgrade.name}</h2>
					<p class="mt-0.5 text-xs font-semibold text-orange-300 tabular-nums">
						{cost} points
					</p>
					{#if upgrade.limit}
						<p class="mt-0.5 text-[10px] tracking-wide text-slate-500 uppercase">
							Max {upgrade.limit} per army
						</p>
					{/if}
				</div>
			</div>
			<button
				type="button"
				aria-label={'Close ' + upgrade.name}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 text-slate-300 transition hover:bg-slate-800/60 active:bg-slate-800"
				onclick={onClose}
			>
				✕
			</button>
		</div>
		<p class="mt-3 text-xs text-slate-300">
			{upgrade.description.map((segment) => segment.text).join('')}
		</p>
	</div>
</div>
