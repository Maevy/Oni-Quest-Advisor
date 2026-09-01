<script lang="ts">
	import {
		ARMY_STAT_KEYS,
		classPopupFor,
		combatArtPopupFor,
		inventorySpaceUsed,
		itemTypeDisplay,
		reachBoxLines,
		romanNumeral,
		rulesLinkPopup,
		skillPopupFor,
		spellCostDisplay,
		spellcraftPopupFor,
		stratagemsFor,
		traitPopupFor,
		type ArmyFactionConfig,
		type ArmyItemCategory,
		type ArmyItemSpec,
		type ArmyRulesIndexes,
		type ArmyRulesPopup,
		type ArmyRulesSpec,
		type ArmySpellRow,
		type ArmySpellSpec,
		type ArmyStats,
		type ArmyStratagemSpec,
		type ArmyStratagemType,
		type ArmyTextSegment,
		type ArmyUnitSpec
	} from '$lib/domain';

	/** Chip styling per spell element - literal classes so Tailwind sees them. */
	const ELEMENT_CHIP_CLASSES: Record<string, string> = {
		elder: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
		air: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
		earth: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
		divine: 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200',
		fire: 'border-red-400/30 bg-red-400/10 text-red-300',
		profane: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300',
		water: 'border-blue-400/30 bg-blue-400/10 text-blue-300'
	};

	type SpellGroup = { element: string; label: string; rows: ArmySpellRow[] };

	/** Group the already Elder-first sorted spell rows by element. */
	function spellGroups(spells: ArmySpellRow[]): SpellGroup[] {
		const groups: SpellGroup[] = [];
		for (const row of spells) {
			const last = groups[groups.length - 1];
			if (last && last.element === row.element) last.rows.push(row);
			else groups.push({ element: row.element, label: row.elementName, rows: [row] });
		}
		return groups;
	}

	/** Chip styling per stratagem type - literal classes so Tailwind sees them. */
	const STRATAGEM_TYPE_CHIPS: Record<ArmyStratagemType, { label: string; classes: string }> = {
		authority: {
			label: 'Authority',
			classes: 'border-sky-400/30 bg-sky-400/10 text-sky-300'
		},
		subterfuge: {
			label: 'Subterfuge',
			classes: 'border-violet-400/30 bg-violet-400/10 text-violet-300'
		},
		tribe: {
			label: 'Tribe',
			classes: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
		}
	};

	type StratagemGroup = {
		type: ArmyStratagemType;
		label: string;
		entries: ArmyStratagemSpec[];
	};

	/** Group the already type-sorted stratagems by their type. */
	function stratagemGroups(stratagems: ArmyStratagemSpec[]): StratagemGroup[] {
		const groups: StratagemGroup[] = [];
		for (const entry of stratagems) {
			const last = groups[groups.length - 1];
			if (last && last.type === entry.type) last.entries.push(entry);
			else
				groups.push({
					type: entry.type,
					label: STRATAGEM_TYPE_CHIPS[entry.type].label,
					entries: [entry]
				});
		}
		return groups;
	}

	/** Group header chips per item category - literal classes so Tailwind sees them. */
	const ITEM_CATEGORY_CHIPS: Record<ArmyItemCategory, { label: string; classes: string }> = {
		weapon: {
			label: 'Weapons',
			classes: 'border-sky-400/30 bg-sky-400/10 text-sky-300'
		},
		shield: {
			label: 'Shields',
			classes: 'border-blue-400/30 bg-blue-400/10 text-blue-300'
		},
		accessory: {
			label: 'Accessories',
			classes: 'border-violet-400/30 bg-violet-400/10 text-violet-300'
		},
		consumable: {
			label: 'Consumables',
			classes: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
		}
	};

	/** Display order of the item categories. */
	const ITEM_CATEGORY_ORDER: ArmyItemCategory[] = ['weapon', 'shield', 'accessory', 'consumable'];

	type InventoryRow = { item: ArmyItemSpec; qty: number };

	/** The unit's inventory slots resolved against the item catalog. */
	function resolveInventory(
		slots: { id: string; qty: number }[],
		index: Record<string, ArmyItemSpec>
	): InventoryRow[] {
		return slots.flatMap((slot) => {
			const item = index[slot.id];
			return item ? [{ item, qty: slot.qty }] : [];
		});
	}

	type InventoryGroup = { category: ArmyItemCategory; rows: InventoryRow[] };

	/** Group inventory rows by category in the rulebook order. */
	function inventoryGroups(rows: InventoryRow[]): InventoryGroup[] {
		return ITEM_CATEGORY_ORDER.flatMap((category) => {
			const matching = rows.filter((row) => row.item.category === category);
			return matching.length > 0 ? [{ category, rows: matching }] : [];
		});
	}

	type Props = {
		unit: ArmyUnitSpec;
		faction: ArmyFactionConfig;
		classIndex: Record<string, ArmyRulesSpec>;
		skillIndex: Record<string, ArmyRulesSpec>;
		traitIndex: Record<string, ArmyRulesSpec>;
		combatArtIndex: Record<string, ArmyRulesSpec>;
		spellcraftIndex: Record<string, ArmyRulesSpec>;
		spells: ArmySpellSpec[];
		stratagemIndex: Record<string, ArmyStratagemSpec>;
		itemIndex: Record<string, ArmyItemSpec>;
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
		stratagemIndex,
		itemIndex,
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
	let stratagems = $derived(unit.stratagems ? stratagemsFor(unit.stratagems, stratagemIndex) : []);
	let inventoryRows = $derived(unit.inventory ? resolveInventory(unit.inventory, itemIndex) : []);
	let usedSpace = $derived(unit.inventory ? inventorySpaceUsed(unit.inventory, itemIndex) : 0);

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

		<div class="mt-4 grid grid-cols-11 gap-1">
			{#each ARMY_STAT_KEYS as key (key)}
				<div class="rounded-md bg-slate-800/60 px-0.5 py-1.5 text-center">
					<p class="text-[9px] font-semibold tracking-wide text-sky-300">{key}</p>
					<p class="text-xs font-medium text-slate-100 tabular-nums">{stats[key] ?? '–'}</p>
				</div>
			{/each}
		</div>

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
			{#if inventoryRows.length > 0 || spellcraftTags.length > 0 || stratagems.length > 0}
				<hr class="border-slate-700/50" />
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
			{#if inventoryRows.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">
						Inventory
						{#if unit.inventorySpace}
							<span class="ml-1 font-normal text-slate-300 normal-case">
								({usedSpace}/{unit.inventorySpace} Space used)
							</span>
						{/if}
					</h3>
					<div class="space-y-2.5">
						{#each inventoryGroups(inventoryRows) as group (group.category)}
							<div>
								<span
									class="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase {ITEM_CATEGORY_CHIPS[
										group.category
									].classes}"
								>
									{ITEM_CATEGORY_CHIPS[group.category].label}
								</span>
								<div class="mt-1.5 space-y-1.5">
									{#each group.rows as row (row.item.id)}
										<div class="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
											<p class="text-sm font-medium text-slate-100">{row.item.name}</p>
											<p class="mt-0.5 text-[10px] tracking-wide text-slate-400 uppercase">
												{itemTypeDisplay(row.item.category, row.item.mode)}
											</p>
											{#if row.item.effect.length > 0}
												<p class="mt-1 text-xs text-slate-300">
													{@render segmentsView(row.item.effect)}
												</p>
											{/if}
											<div class="mt-1.5 grid grid-cols-5 gap-1">
												<div class="rounded-md bg-slate-800/60 px-0.5 py-1 text-center">
													<p class="text-[9px] font-semibold tracking-wide text-sky-300">PW</p>
													<p class="text-[9px] font-medium text-slate-100 tabular-nums">
														{spellCostDisplay(row.item.toughness, stats) ?? '–'}
													</p>
												</div>
												<div class="rounded-md bg-slate-800/60 px-0.5 py-1 text-center">
													<p class="text-[9px] font-semibold tracking-wide text-sky-300">RCH</p>
													{#each reachBoxLines(row.item.reach) as line (line)}
														<p class="text-[10px] font-medium text-slate-100 tabular-nums">
															{line}
														</p>
													{/each}
												</div>
												<div class="rounded-md bg-slate-800/60 px-0.5 py-1 text-center">
													<p class="text-[9px] font-semibold tracking-wide text-sky-300">STK</p>
													<p class="text-[9px] font-medium text-slate-100 tabular-nums">
														{spellCostDisplay(row.item.stk, stats) ?? '–'}
													</p>
												</div>
												<div class="rounded-md bg-slate-800/60 px-0.5 py-1 text-center">
													<p class="text-[9px] font-semibold tracking-wide text-sky-300">QTY</p>
													<p class="text-[10px] font-medium text-slate-100 tabular-nums">
														{row.qty}
													</p>
												</div>
												<div class="rounded-md bg-slate-800/60 px-0.5 py-1 text-center">
													<p class="text-[9px] font-semibold tracking-wide text-sky-300">WGT</p>
													<p class="text-[10px] font-medium text-slate-100 tabular-nums">
														{row.item.weight ?? '–'}
													</p>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if stratagems.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-sky-300 uppercase">
						Stratagems
					</h3>
					<div class="space-y-2.5">
						{#each stratagemGroups(stratagems) as group (group.type)}
							<div>
								<span
									class="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase {STRATAGEM_TYPE_CHIPS[
										group.type
									].classes}"
								>
									{group.label}
								</span>
								<div class="mt-1.5 space-y-1.5">
									{#each group.entries as stratagem (stratagem.id)}
										<div class="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
											<p class="text-sm font-medium text-slate-100">{stratagem.name}</p>
											<p class="mt-1 text-xs text-slate-300">
												{@render segmentsView(stratagem.effect)}
											</p>
										</div>
									{/each}
								</div>
							</div>
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
					(popup.spells ? 'max-w-md' : 'max-w-sm')}
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
						<div class="mt-2 space-y-3">
							{#each spellGroups(popup.spells) as group (group.element)}
								<div>
									<span
										class="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase {ELEMENT_CHIP_CLASSES[
											group.element
										] ?? 'border-slate-500/30 bg-slate-500/10 text-slate-300'}"
									>
										{group.label}
									</span>
									<div class="mt-1.5 space-y-1.5">
										{#each group.rows as spell (spell.element + '-' + spell.level + '-' + spell.name)}
											<div class="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
												<div class="flex items-baseline justify-between gap-2">
													<p class="text-sm font-medium text-slate-100">{spell.name}</p>
													<p
														class="text-[10px] font-semibold whitespace-nowrap text-sky-300 uppercase"
													>
														Lv {spell.level}
													</p>
												</div>
												<p class="mt-1 text-xs text-slate-300">
													{@render segmentsView(spell.effect)}
												</p>
												{#if spell.pw || spell.type || spell.rch || spell.stk}
													<div class="mt-1.5 flex flex-wrap gap-1">
														{#each [['PW', spell.pw], ['Type', spell.type], ['RCH', spell.rch], ['STK', spell.stk]] as [label, value] (label)}
															{#if value}
																<span
																	class="rounded-md bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-200"
																>
																	<span class="font-semibold tracking-wide text-slate-500 uppercase"
																		>{label}</span
																	>
																	<span class="tabular-nums">{value}</span>
																</span>
															{/if}
														{/each}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/each}
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
