/**
 * Overlays stack in this app — the Load Army dialog over the builder, its delete confirmation
 * over itself, a unit card's rules popups over the card — and only the topmost layer should
 * answer an Escape press.
 *
 * Binding `onkeydown` to a backdrop element does not achieve that: backdrops are not focusable,
 * so the handler only fires while focus happens to sit inside the overlay. Every open overlay
 * registers here instead, and a single window listener dispatches to the most recently
 * registered handler, so one keypress closes exactly one layer.
 */

type EscapeHandler = () => void;

const handlers: EscapeHandler[] = [];

function onKeyDown(event: KeyboardEvent): void {
	if (event.key !== 'Escape') return;
	handlers[handlers.length - 1]?.();
}

/**
 * Registers `handler` as the Escape responder while the caller keeps the returned disposer.
 * Call it from an `$effect` and return the disposer as the effect's cleanup:
 *
 * ```svelte
 * $effect(() => onEscapeKey(onClose));
 * ```
 */
export function onEscapeKey(handler: EscapeHandler): () => void {
	handlers.push(handler);
	if (handlers.length === 1) window.addEventListener('keydown', onKeyDown);

	return () => {
		const index = handlers.lastIndexOf(handler);
		if (index !== -1) handlers.splice(index, 1);
		if (handlers.length === 0) window.removeEventListener('keydown', onKeyDown);
	};
}
