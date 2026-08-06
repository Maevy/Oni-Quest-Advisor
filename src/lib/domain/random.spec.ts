import { describe, expect, it } from 'vitest';
import { pickRandom } from './random';

function sequenceRng(values: number[]) {
	let index = 0;
	return () => values[index++];
}

describe('pickRandom', () => {
	it('picks the item at the index implied by the rng value', () => {
		const items = ['a', 'b', 'c'];
		expect(pickRandom(items, sequenceRng([0]))).toBe('a');
		expect(pickRandom(items, sequenceRng([0.5]))).toBe('b');
		expect(pickRandom(items, sequenceRng([0.999]))).toBe('c');
	});

	it('throws when the list is empty', () => {
		expect(() => pickRandom([], sequenceRng([0]))).toThrow();
	});
});
