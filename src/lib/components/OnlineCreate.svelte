<script lang="ts">
	import chiohime from '$lib/assets/Chiohime.png';
	import rasetsu from '$lib/assets/Rasetsu.png';
	import ScreenHeader from './ScreenHeader.svelte';
	import {
		MAX_NICKNAME_LENGTH,
		pickedArmyFormat,
		type ArmyFactionConfig,
		type Mission,
		type OnlineGameSetup,
		type PickedArmy
	} from '$lib/domain';

	type Props = {
		seasons: string[];
		missionsBySeason: Record<string, Mission[]>;
		/** The army picked for this screen; null until the player picks one. */
		army: PickedArmy | null;
		/** The picked army's faction resolved for display, when there is one. */
		armyFaction: ArmyFactionConfig | undefined;
		/** Rejects on failure, so the draft stays on screen and can be corrected. */
		onCreate: (nickname: string, setup: OnlineGameSetup) => Promise<void>;
		onPickArmy: () => void;
		onClearArmy: () => void;
		onReturn: () => void;
	};

	let {
		seasons,
		missionsBySeason,
		army,
		armyFaction,
		onCreate,
		onPickArmy,
		onClearArmy,
		onReturn
	}: Props = $props();

	let nickname = $state('');
	let season = $state('');
	let missionId = $state('');
	let preparing = $state(false);
	let error = $state<string | null>(null);

	let trimmed = $derived(nickname.trim());
	let nameValid = $derived(trimmed.length >= 1 && trimmed.length <= MAX_NICKNAME_LENGTH);
	let valid = $derived(nameValid && season !== '' && missionId !== '' && army !== null);

	function handleSeasonChange(event: Event): void {
		season = (event.target as HTMLSelectElement).value;
		missionId = '';
	}

	async function handleCreate() {
		if (!valid || !army || preparing) return;
		preparing = true;
		error = null;
		try {
			await onCreate(trimmed, { season, missionId, army });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not create the game.';
			preparing = false;
		}
	}

	const label = 'text-left text-sm font-semibold tracking-wide text-sky-300 uppercase';
	const panel =
		'flex w-full flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur';
	const select =
		'rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2.5 text-sky-100 backdrop-blur outline-none focus:border-sky-400';
</script>

<div class="flex min-h-dvh flex-col">
	<ScreenHeader onBack={onReturn} />

	<div class="flex flex-1 flex-col items-center gap-6 px-4 py-6">
		<div class="flex w-full max-w-xl flex-col items-center gap-6">
			<div class="flex w-full flex-col items-center gap-2">
				<div
					class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-3 py-5 backdrop-blur"
				>
					<img
						src={chiohime}
						alt="Chiohime"
						class="w-[70px] shrink-0 object-contain sm:w-[106px]"
					/>
					<h1
						class="flex-1 text-3xl font-extrabold tracking-tight text-slate-100 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)] sm:text-4xl"
					>
						Oni Quest Advisor
					</h1>
					<img src={rasetsu} alt="Rasetsu" class="w-16 shrink-0 object-contain sm:w-24" />
				</div>
				<p class="text-slate-200">Online 2 Player Game</p>
			</div>

			<div class={panel}>
				<label for="create-nickname" class={label}>Your Player Name</label>
				<input
					id="create-nickname"
					type="text"
					maxlength={MAX_NICKNAME_LENGTH}
					bind:value={nickname}
					placeholder="e.g. Konichan"
					autocomplete="off"
					class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-4 py-3 text-lg text-sky-100 backdrop-blur outline-none placeholder:text-slate-400 focus:border-sky-400"
				/>
			</div>

			<div class={panel}>
				<label for="create-season" class={label}>Mission</label>
				<select
					id="create-season"
					class={select}
					value={season}
					onchange={handleSeasonChange}
					aria-label="Season"
				>
					<option value="" disabled>Select a season…</option>
					{#each seasons as entry (entry)}
						<option value={entry}>{entry}</option>
					{/each}
				</select>
				<select
					class={select}
					value={missionId}
					disabled={season === ''}
					onchange={(event) => (missionId = (event.target as HTMLSelectElement).value)}
					aria-label="Mission"
				>
					<option value="" disabled>{season ? 'Select a mission…' : 'Mission'}</option>
					{#each missionsBySeason[season] ?? [] as mission (mission.id)}
						<option value={mission.id}>{mission.name}</option>
					{/each}
				</select>
				<p class="text-left text-xs text-slate-200">
					The mission is fixed for the whole game — your opponent joins into it.
				</p>
			</div>

			<div class={panel}>
				<span class={label}>Your Army</span>
				{#if army}
					<div
						class="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2.5"
					>
						<button
							type="button"
							class="min-w-0 flex-1 text-left"
							aria-label="Change your army"
							onclick={onPickArmy}
						>
							<span class="block truncate text-sm font-semibold text-slate-100">{army.name}</span>
							<span
								class="mt-0.5 block truncate text-xs {armyFaction ? '' : 'text-slate-200'}"
								style={armyFaction ? `color: ${armyFaction.color}` : undefined}
							>
								{armyFaction?.name ?? army.factionId}
							</span>
						</button>
						<span
							class="shrink-0 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 uppercase"
						>
							{pickedArmyFormat(army) === 'roster' ? 'Roster' : 'Standard'}
						</span>
						<button
							type="button"
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-slate-900/60 text-sm font-bold text-red-300 transition enabled:hover:bg-red-500/10 enabled:active:bg-red-500/20"
							aria-label="Remove your army"
							onclick={onClearArmy}
						>
							<span aria-hidden="true">✕</span>
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="rounded-xl border-2 border-sky-500/50 bg-slate-900/60 px-3 py-2.5 text-sm font-medium text-sky-100 backdrop-blur transition enabled:hover:bg-sky-500/10 enabled:active:bg-sky-500/20"
						onclick={onPickArmy}
					>
						Pick Army
					</button>
					<p class="text-left text-xs text-slate-200">
						A Standard army (85 points) is combat-ready at once. A Roster army (125 points) is cut
						down to 85 after the game starts.
					</p>
				{/if}
			</div>

			<button
				type="button"
				disabled={!valid || preparing}
				class="w-full max-w-xl rounded-xl border-2 border-emerald-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium text-emerald-100 backdrop-blur transition enabled:hover:bg-emerald-500/10 enabled:active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
				onclick={handleCreate}
			>
				Open Lobby
			</button>
			{#if !valid}
				<p class="-mt-3 text-xs text-slate-200">Name, mission and army open the lobby.</p>
			{/if}
			{#if error}
				<p class="text-sm text-red-400" role="alert">{error}</p>
			{/if}
		</div>
	</div>
</div>

{#if preparing}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur-sm"
	>
		<p class="text-xl font-semibold text-sky-200 drop-shadow-[0_0_16px_rgba(56,189,248,0.55)]">
			Preparing the battlefield…
		</p>
	</div>
{/if}
