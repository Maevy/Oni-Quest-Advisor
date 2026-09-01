<script lang="ts">
	import {
		ARMY_STAT_KEYS,
		classPopupFor,
		combatArtPopupFor,
		romanNumeral,
		rulesLinkPopup,
		skillPopupFor,
		spellcraftPopupFor,
		traitPopupFor,
		type ArmyFactionConfig,
		type ArmyRulesIndexes,
		type ArmyRulesPopup,
		type ArmyRulesSpec,
		type ArmySpellSpec,
		type ArmyStats,
		type ArmyTextSegment,
		type ArmyUnitSpec
	} from '$lib/domain';

	type Props = {
		unit: ArmyUnitSpec;
		faction: ArmyFactionConfig;
		classIndex: Record<string, ArmyRulesSpec>;
		skillIndex: Record<string, ArmyRulesSpec>;
		traitIndex: Record<string, ArmyRulesSpec>;
		combatArtIndex: Record<string, ArmyRulesSpec>;
		spellcraftIndex: Record<string, ArmyRulesSpec>;
		spells: ArmySpellSpec[];
		stats: ArmyStats;
		mounted: boolean;
		mountName?: string;
		onClose: () => void;
	};

	let {
		unit,
		faction,
		classIndex,
		skillIndex,
		traitIndex,
		combatArtIndex,
		spellcraftIndex,
		spells,
		stats,
		mounted,
		mountName,
		onClose
	}: Props = $props();

	/** Open rules popups, stacked - a link inside a popup pushes the next layer. */
	let popupStack = $state<ArmyRulesPopup[]>([]);

	let indexes = $derived<ArmyRulesIndexes>({
		classes: classIndex,
		skills: skillIndex,
		traits: traitIndex,
		combatArts: combatArtIndex
	});
	let classTags = $derived(
		unit.classes.flatMap((id) => {
			const popup = classPopupFor(classIndex[id]);
			return popup ? [popup] : [];
		})
	);
	let skillTags = $derived(
		(unit.skills ?? []).flatMap((ref) => {
			const popup = skillPopupFor(skillIndex[ref.id], ref);
			return popup ? [popup] : [];
		})
	);
	let traitTags = $derived(
		(unit.traits ?? []).flatMap((ref) => {
			const popup = traitPopupFor(traitIndex[ref.id], ref);
			return popup ? [popup] : [];
		})
	);
	let combatArtTags = $derived(
		(unit.combatArts ?? []).flatMap((ref) => {
			const popup = combatArtPopupFor(combatArtIndex[ref.id], ref);
			return popup ? [popup] : [];
		})
	);
	let spellcraftTags = $derived(
		(unit.spellcrafts ?? []).flatMap((ref) => {
			const popup = spellcraftPopupFor(spellcraftIndex[ref.id], ref, unit, stats, spells);
			return popup ? [popup] : [];
		})
	);

	function openPopup(popup: ArmyRulesPopup): void {
		popupStack = [...popupStack, popup];
	}

	function closeTopPopup(): void {
		popupStack = popupStack.slice(0, -1);
	}
</script>

{#snippet segmentsView(segments: ArmyTextSegment[])}
	{#each segments as segment, segmentIndex (segmentIndex)}
		{#if segment.link}
			{@const target = rulesLinkPopup(indexes, segment.link)}
			{#if target}
				<button
					type="button"
					class="font-semibold text-orange-300 underline decoration-orange-300/50 underline-offset-2 transition hover:text-orange-200"
					onclick={() => openPopup(target)}
				>
					{segment.text}
				</button>
			{:else}
				{segment.text}
			{/if}
		{:else}
			{segment.text}
		{/if}
	{/each}
{/snippet}

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
	role="presentation"
	onclick={onClose}
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
>
	<div
		role="dialog"
		tabindex="-1"
		aria-label={unit.name}
		class="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl"
		style="border-color: {faction.color}"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				if (popupStack.length > 0) closeTopPopup();
				else onClose();
			}
			event.stopPropagation();
		}}
	>
		<div class="flex items-start gap-3">
			{#if unit.icon}
				<img
					src={unit.icon}
					alt=""
					class="h-[70px] w-[70px] shrink-0 rounded-lg border-2 bg-slate-800/60 object-contain"
					style="border-color: {faction.color}"
				/>
			{/if}
			<div class="min-w-0">
				<h2 class="text-lg font-bold text-slate-100">{unit.name}</h2>
				<p class="text-sm font-semibold" style="color: {faction.color}">{faction.name}</p>
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					{#each classTags as tag (tag.title)}
						<button
							type="button"
							class="rounded-full bg-sky-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-200 active:bg-sky-200"
							onclick={() => openPopup(tag)}
						>
							{tag.title}
						</button>
					{/each}
				</div>
				{#if mounted && mountName}
					<p class="mt-1 text-xs font-semibold text-emerald-300">Mounted on {mountName}</p>
				{/if}
			</div>
		</div>

		<table class="mt-4 w-full table-fixed border-collapse text-center">
			<thead>
				<tr>
					{#each ARMY_STAT_KEYS as key (key)}
						<th
							class="border border-slate-700/50 bg-slate-800/60 px-0.5 py-1 text-[10px] font-semibold tracking-wide text-sky-300"
						>
							{key}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr>
					{#each ARMY_STAT_KEYS as key (key)}
						<td
							class="border border-slate-700/50 px-0.5 py-1 text-xs font-medium text-slate-100 tabular-nums"
						>
							{stats[key] ?? '–'}
						</td>
					{/each}
				</tr>
			</tbody>
		</table>

		<div class="mt-4 space-y-3">
			{#if skillTags.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">Skills</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each skillTags as tag (tag.title)}
							<button
								type="button"
								class="rounded-full bg-orange-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
								onclick={() => openPopup(tag)}
							>
								{tag.title}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if traitTags.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">Traits</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each traitTags as tag (tag.title)}
							<button
								type="button"
								class="rounded-full bg-orange-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
								onclick={() => openPopup(tag)}
							>
								{tag.title}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if combatArtTags.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">
						Combat Arts
					</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each combatArtTags as tag (tag.title)}
							<button
								type="button"
								class="rounded-full bg-orange-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
								onclick={() => openPopup(tag)}
							>
								{tag.title}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if spellcraftTags.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">
						Spellcrafts
					</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each spellcraftTags as tag (tag.title)}
							<button
								type="button"
								class="rounded-full bg-orange-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-orange-300 active:bg-orange-300"
								onclick={() => openPopup(tag)}
							>
								{tag.title}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#each popupStack as popup, index (index)}
		<div
			class="fixed inset-0 flex items-center justify-center bg-slate-950/50 p-6"
			style="z-index: {60 + index * 10}"
			role="presentation"
			onclick={(event) => {
				event.stopPropagation();
				closeTopPopup();
			}}
		>
			<div
				role="dialog"
				tabindex="-1"
				aria-label={popup.title}
				class={'max-h-[75dvh] w-full overflow-y-auto rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl ' +
					(popup.spells ? 'max-w-lg' : 'max-w-sm')}
				style="border-color: {faction.color}"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => {
					if (event.key === 'Escape') {
						event.stopPropagation();
						closeTopPopup();
					}
				}}
			>
				<h3 class="text-sm font-semibold tracking-wide text-sky-300 uppercase">{popup.title}</h3>
				{#if popup.spells}
					{#if popup.spells.length > 0}
						<div class="mt-2 overflow-x-auto">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr>
										{#each ['Element', 'Lv', 'Spell', 'Effect', 'PW', 'Type', 'RCH', 'STK'] as column (column)}
											<th
												class="border border-slate-700/50 bg-slate-800/60 px-1.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap text-sky-300"
											>
												{column}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each popup.spells as spell (spell.element + '-' + spell.level + '-' + spell.name)}
										<tr>
											<td
												class="border border-slate-700/50 px-1.5 py-1 whitespace-nowrap text-slate-300"
											>
												{spell.elementName}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 text-center text-slate-400 tabular-nums"
											>
												{spell.level}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 font-medium whitespace-nowrap text-slate-100"
											>
												{spell.name}
											</td>
											<td class="min-w-44 border border-slate-700/50 px-1.5 py-1 text-slate-300">
												{@render segmentsView(spell.effect)}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 whitespace-nowrap text-slate-300 tabular-nums"
											>
												{spell.pw ?? '–'}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 whitespace-nowrap text-slate-300"
											>
												{spell.type ?? '–'}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 whitespace-nowrap text-slate-300"
											>
												{spell.rch ?? '–'}
											</td>
											<td
												class="border border-slate-700/50 px-1.5 py-1 whitespace-nowrap text-slate-300"
											>
												{spell.stk ?? '–'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="mt-2 text-sm text-slate-500">
							No spells at this level for the unit's affinities.
						</p>
					{/if}
				{:else}
					<div class="mt-2 space-y-3">
						{#each popup.sections as section, sectionIndex (sectionIndex)}
							<div class={section.available ? '' : 'opacity-50'}>
								{#if popup.sections.length > 1 && section.level !== undefined}
									<p class="text-xs font-semibold tracking-wide text-sky-300 uppercase">
										Level {romanNumeral(section.level)}
									</p>
								{/if}
								<p class="text-sm text-slate-300">
									{@render segmentsView(section.text)}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>
