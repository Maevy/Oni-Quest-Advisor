import { describe, expect, it } from 'vitest';
import { qrCodeMatrix, qrCodeSize } from './qr';

/**
 * An independent reader, written against the ISO/IEC 18004 reading order (the same order
 * jsQR uses): unmask with the declared mask, walk the zigzag, de-interleave nothing (the data
 * codewords come out in stream order) and parse the byte-mode segment. If the encoder drifts
 * from the standard in placement, masking or Reed-Solomon, this round-trip breaks.
 */
const DATA_MASKS = [
	(p: { x: number; y: number }) => (p.y + p.x) % 2 === 0,
	(p: { x: number; y: number }) => p.y % 2 === 0,
	(p: { x: number; y: number }) => p.x % 3 === 0,
	(p: { x: number; y: number }) => (p.y + p.x) % 3 === 0,
	(p: { x: number; y: number }) => (Math.floor(p.y / 2) + Math.floor(p.x / 3)) % 2 === 0,
	(p: { x: number; y: number }) => ((p.x * p.y) % 2) + ((p.x * p.y) % 3) === 0,
	(p: { x: number; y: number }) => (((p.y * p.x) % 2) + ((p.y * p.x) % 3)) % 2 === 0,
	(p: { x: number; y: number }) => (((p.y + p.x) % 2) + ((p.y * p.x) % 3)) % 2 === 0
];

/** The format information's 15 bits, read most-significant first, from the top-left strip. */
function readFormat(matrix: boolean[][]): number {
	const get = (x: number, y: number) => (matrix[y][x] ? 1 : 0);
	let bits = 0;
	for (let x = 0; x <= 8; x++) if (x !== 6) bits = (bits << 1) | get(x, 8);
	for (let y = 7; y >= 0; y--) if (y !== 6) bits = (bits << 1) | get(8, y);
	return bits;
}

/** The 32 masked format words; index 4..7 are EC level M, masks 0..7 (this encoder's choice). */
const M_FORMAT_WORDS = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

function functionMask(size: number, version: number): boolean[][] {
	const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
	const region = (left: number, top: number, width: number, height: number) => {
		for (let y = top; y < top + height; y++) {
			for (let x = left; x < left + width; x++) reserved[y][x] = true;
		}
	};
	region(0, 0, 9, 9);
	region(size - 8, 0, 8, 9);
	region(0, size - 8, 9, 8);
	if (version >= 2) {
		const last = size - 7;
		region(last - 2, last - 2, 5, 5);
	}
	region(6, 9, 1, size - 17);
	region(9, 6, size - 17, 1);
	return reserved;
}

function readCodewords(matrix: boolean[][], mask: number): number[] {
	const size = matrix.length;
	const version = (size - 17) / 4;
	const reserved = functionMask(size, version);
	const out: number[] = [];
	let current = 0;
	let bits = 0;
	let readingUp = true;
	for (let column = size - 1; column > 0; column -= 2) {
		if (column === 6) column -= 1;
		for (let i = 0; i < size; i++) {
			const y = readingUp ? size - 1 - i : i;
			for (let offset = 0; offset < 2; offset++) {
				const x = column - offset;
				if (reserved[y][x]) continue;
				let bit = matrix[y][x];
				if (DATA_MASKS[mask]({ x, y })) bit = !bit;
				current = (current << 1) | (bit ? 1 : 0);
				bits += 1;
				if (bits === 8) {
					out.push(current);
					current = 0;
					bits = 0;
				}
			}
		}
		readingUp = !readingUp;
	}
	return out;
}

/** Reads the byte-mode segment back out of a symbol the encoder produced. */
function readBack(text: string): string {
	const matrix = qrCodeMatrix(text);
	const version = (matrix.length - 17) / 4;
	const mask = M_FORMAT_WORDS.indexOf(readFormat(matrix));
	expect(mask).toBe(0); // this encoder always declares mask 0
	const stream = readCodewords(matrix, mask);
	// Undo the block interleaving: data codewords of all blocks column by column, then the ECC.
	const perBlock: number[] = [];
	for (const [count, per] of BLOCKS[version]) {
		for (let i = 0; i < count; i++) perBlock.push(per);
	}
	const blocks: number[][] = perBlock.map(() => []);
	const longest = Math.max(...perBlock);
	let at = 0;
	for (let k = 0; k < longest; k++) {
		blocks.forEach((block, index) => {
			if (k < perBlock[index]) block.push(stream[at++]);
		});
	}
	const codewords = blocks.flat();
	let bit = 0;
	const take = (count: number) => {
		let value = 0;
		for (let i = 0; i < count; i++) {
			const byte = codewords[bit >>> 3];
			value = (value << 1) | ((byte >>> (7 - (bit & 7))) & 1);
			bit += 1;
		}
		return value;
	};
	expect(take(4)).toBe(0b0100); // byte mode
	const length = take(8);
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) bytes[i] = take(8);
	return new TextDecoder().decode(bytes);
}

/** [block count, data codewords per block] per version, EC level M. */
const BLOCKS: Record<number, [number, number][]> = {
	1: [[1, 16]],
	2: [[1, 28]],
	3: [[1, 44]],
	4: [[2, 32]],
	5: [[2, 43]],
	6: [[4, 27]]
};

describe('qrCodeMatrix', () => {
	it('picks the smallest version that fits', () => {
		expect(qrCodeSize('A')).toBe(21); // version 1
		expect(qrCodeSize('https://oni-quest-advisor.fly.dev/tournament-join/ABC234')).toBe(33);
	});

	it('refuses text beyond version 6', () => {
		expect(() => qrCodeMatrix('x'.repeat(107))).toThrow();
	});

	it.each(['A', 'HELLO', 'http://localhost:5173/tournament-join/ABC234', 'x'.repeat(100)])(
		'round-trips %s through an independent standard-order reader',
		(text) => {
			expect(readBack(text)).toBe(text);
		}
	);

	it('draws the three finder patterns with their separators', () => {
		const matrix = qrCodeMatrix('HELLO');
		const size = matrix.length;
		for (const [row, col] of [
			[0, 0],
			[0, size - 7],
			[size - 7, 0]
		]) {
			expect(matrix[row][col]).toBe(true);
			expect(matrix[row + 1][col + 1]).toBe(false);
			expect(matrix[row + 3][col + 3]).toBe(true);
		}
	});

	it('draws the timing patterns between the finders', () => {
		const matrix = qrCodeMatrix('HELLO');
		for (let i = 8; i < matrix.length - 8; i++) {
			expect(matrix[6][i]).toBe(i % 2 === 0);
			expect(matrix[i][6]).toBe(i % 2 === 0);
		}
	});

	it('keeps the always-dark module', () => {
		const matrix = qrCodeMatrix('HELLO');
		expect(matrix[matrix.length - 8][8]).toBe(true);
	});

	it('is deterministic', () => {
		expect(qrCodeMatrix('HELLO')).toEqual(qrCodeMatrix('HELLO'));
	});
});
