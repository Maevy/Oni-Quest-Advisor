import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onEscapeKey } from './escapeKey';

type StubListener = (event: { key: string }) => void;

let listeners: Set<StubListener>;
let disposers: Array<() => void>;

function press(key: string): void {
	for (const listener of [...listeners]) listener({ key });
}

function register(handler: () => void): void {
	disposers.push(onEscapeKey(handler));
}

describe('onEscapeKey', () => {
	beforeEach(() => {
		listeners = new Set();
		disposers = [];
		vi.stubGlobal('window', {
			addEventListener: (type: string, listener: StubListener) => {
				if (type === 'keydown') listeners.add(listener);
			},
			removeEventListener: (type: string, listener: StubListener) => {
				if (type === 'keydown') listeners.delete(listener);
			}
		});
	});

	afterEach(() => {
		for (const dispose of disposers.splice(0)) dispose();
		vi.unstubAllGlobals();
	});

	it('calls the handler when Escape is pressed', () => {
		const calls: string[] = [];
		register(() => calls.push('closed'));

		press('Escape');

		expect(calls).toEqual(['closed']);
	});

	it('ignores every other key', () => {
		const calls: string[] = [];
		register(() => calls.push('closed'));

		press('Enter');
		press('a');
		press('Tab');

		expect(calls).toEqual([]);
	});

	it('answers with the topmost handler only, so stacked overlays close one layer', () => {
		const calls: string[] = [];
		register(() => calls.push('dialog'));
		register(() => calls.push('confirm'));

		press('Escape');

		expect(calls).toEqual(['confirm']);
	});

	it('falls back to the handler beneath once the topmost is disposed', () => {
		const calls: string[] = [];
		register(() => calls.push('dialog'));
		disposers.push(onEscapeKey(() => calls.push('confirm')));
		disposers.pop()?.();

		press('Escape');

		expect(calls).toEqual(['dialog']);
	});

	it('keeps working when a handler in the middle of the stack is disposed', () => {
		const calls: string[] = [];
		register(() => calls.push('bottom'));
		const disposeMiddle = onEscapeKey(() => calls.push('middle'));
		register(() => calls.push('top'));

		disposeMiddle();
		press('Escape');

		expect(calls).toEqual(['top']);
	});

	it('shares one window listener and detaches it when the last handler goes', () => {
		register(() => {});
		register(() => {});
		expect(listeners.size).toBe(1);

		for (const dispose of disposers.splice(0)) dispose();
		expect(listeners.size).toBe(0);

		register(() => {});
		expect(listeners.size).toBe(1);
	});

	it('ignores a second dispose of the same handler', () => {
		const calls: string[] = [];
		register(() => calls.push('first'));
		const disposeSecond = onEscapeKey(() => calls.push('second'));

		disposeSecond();
		disposeSecond();
		press('Escape');

		expect(calls).toEqual(['first']);
		expect(listeners.size).toBe(1);
	});
});
