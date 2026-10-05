<script lang="ts">
	import { MAX_TOURNAMENT_MESSAGE_LENGTH } from '$lib/domain';
	import type { TournamentMessageView } from '$lib/domain';
	import { onEscapeKey } from './escapeKey';

	type Props = {
		/** The announcements this seat may see, newest first. Omitted for the organizer, who only sends. */
		messages?: TournamentMessageView[];
		unread?: number;
		/** Called once per new announcement when the inbox opens — the glow goes out with it. */
		onRead?: () => void;
		/** Set for the organizer's megaphone: what a shout does. Resolves false when it failed. */
		onSend?: (text: string) => Promise<boolean> | boolean;
		/** Which tables this megaphone reaches, as the one line above the textarea. */
		target?: string;
		/** Why the last shout failed; keeps the card open with the reason in it. */
		error?: string | null;
		/** The table panel's corner button rather than the top bar's. */
		small?: boolean;
		label?: string;
	};

	let {
		messages,
		unread = 0,
		onRead,
		onSend,
		target,
		error = null,
		small = false,
		label = 'Organizer messages'
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let text = $state('');
	let busy = $state(false);
	/** The newest announcement this seat has already opened, so the glow does not need the refetch. */
	let seen = $state<string | null>(null);

	const newest = $derived(messages?.[0]?.id ?? null);
	const glowing = $derived(unread > 0 && newest !== seen);
	// A shout is amber at rest — it is the organizer's voice, not an unread badge.
	const buttonClasses = $derived(
		[
			'relative grid place-items-center rounded-xl border-2 transition',
			small ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg',
			glowing
				? 'border-yellow-300 bg-yellow-400 text-slate-950 shadow-[0_0_18px_rgba(250,204,21,0.75)] motion-safe:animate-pulse'
				: onSend
					? 'border-amber-500/50 bg-slate-900/60 text-amber-200 hover:bg-amber-500/10 active:bg-amber-500/20'
					: 'border-slate-600/60 bg-slate-900/60 text-slate-400 hover:text-slate-200'
		].join(' ')
	);

	function toggle(): void {
		open = !open;
		if (open && glowing) {
			seen = newest;
			onRead?.();
		}
	}

	function close(): void {
		open = false;
	}

	async function send(): Promise<void> {
		const body = text.trim();
		if (body === '' || !onSend || busy) return;
		busy = true;
		const sent = await onSend(body);
		busy = false;
		if (sent !== false) {
			text = '';
			close();
		}
	}

	// Clicking anywhere outside closes it — that is the gesture the player was told about, and the
	// one that leaves the megaphone grey. The target is guarded because this listener runs on
	// every pointerdown the app sees, and a synthetic one (a test, an extension) can carry a
	// target that is not a Node at all.
	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (root && target instanceof Node && !root.contains(target)) close();
		};
		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	});

	$effect(() => {
		if (!open) return;
		return onEscapeKey(close);
	});

	function clockOf(sentAt: string): string {
		const parsed = Date.parse(sentAt);
		if (Number.isNaN(parsed)) return '';
		return new Date(parsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="relative shrink-0" bind:this={root}>
	<button
		type="button"
		class={buttonClasses}
		aria-label={label}
		aria-expanded={open}
		onclick={toggle}
	>
		<span aria-hidden="true">📣</span>
		{#if glowing && unread > 1}
			<span
				class="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border border-slate-950 bg-red-500 px-1 text-[11px] leading-none font-bold text-slate-50"
			>
				{unread > 9 ? '9+' : unread}
			</span>
		{/if}
	</button>

	{#if open}
		<!-- Anchored to the button rather than centred on the screen: it is a note from the
		     organizer, not a modal, and the top bar it hangs from is a sticky, backdrop-filtered
		     ancestor — a `fixed` child would be positioned against that instead of the viewport. -->
		<div
			role="dialog"
			aria-label={label}
			class="absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-600/60 bg-slate-900/95 p-3 shadow-2xl backdrop-blur"
		>
			{#if onSend}
				<p class="text-xs font-semibold tracking-wide text-amber-200 uppercase">
					{target ?? 'Shout at every table'}
				</p>
				<textarea
					class="mt-2 w-full rounded-xl border-2 border-slate-600/60 bg-slate-950/60 p-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-amber-400/70 focus:outline-none"
					rows="3"
					maxlength={MAX_TOURNAMENT_MESSAGE_LENGTH}
					placeholder="Time is up, last activations please…"
					bind:value={text}></textarea>
				{#if error}
					<p class="mt-1 text-xs text-red-400">{error}</p>
				{/if}
				<button
					type="button"
					class="mt-2 w-full rounded-xl border-2 border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm font-bold text-amber-100 transition enabled:hover:bg-amber-500/25 enabled:active:bg-amber-500/35 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600"
					disabled={busy || text.trim() === ''}
					onclick={() => void send()}
				>
					{busy ? 'Sending…' : 'Send'}
				</button>
			{:else}
				<p class="text-xs font-semibold tracking-wide text-slate-200 uppercase">
					From the organizer
				</p>
				<ul class="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto overscroll-contain">
					{#each messages ?? [] as message (message.id)}
						<li
							class="rounded-xl border p-2 {message.read
								? 'border-slate-700/50 bg-slate-800/40'
								: 'border-yellow-400/50 bg-yellow-500/10'}"
						>
							<p class="text-sm break-words text-slate-100">{message.text}</p>
							<p class="mt-1 text-[11px] text-slate-400">
								Round {message.round}
								{#if message.tableIndex !== null}· your table{/if}
								{#if clockOf(message.sentAt)}· {clockOf(message.sentAt)}{/if}
							</p>
						</li>
					{:else}
						<li class="text-sm text-slate-400 italic">No messages yet.</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
