/**
 * A minimal QR Code model 2 encoder: byte mode, error correction level M, versions 1–6, mask
 * pattern 0. Small on purpose — the app only ever encodes one join URL, and no dependency can
 * be installed on this machine. Mask 0 is a legal choice for any symbol (the mask is signalled
 * in the format information, not chosen by fitness), so the penalty rules are deliberately not
 * implemented; decoders read the format and undo whichever mask the symbol declares.
 */

type VersionSpec = {
	version: number;
	/** Data codewords at EC level M, i.e. total codewords minus the ECC ones. */
	dataCodewords: number;
	ecPerBlock: number;
	/** [block count, data codewords per block] groups; versions 1–6 need at most one group. */
	groups: [number, number][];
};

const VERSIONS: VersionSpec[] = [
	{ version: 1, dataCodewords: 16, ecPerBlock: 10, groups: [[1, 16]] },
	{ version: 2, dataCodewords: 28, ecPerBlock: 16, groups: [[1, 28]] },
	{ version: 3, dataCodewords: 44, ecPerBlock: 26, groups: [[1, 44]] },
	{ version: 4, dataCodewords: 64, ecPerBlock: 18, groups: [[2, 32]] },
	{ version: 5, dataCodewords: 86, ecPerBlock: 24, groups: [[2, 43]] },
	{ version: 6, dataCodewords: 108, ecPerBlock: 16, groups: [[4, 27]] }
];

/** Byte-mode payload bits left after the 4-bit mode and 8-bit count headers. */
function byteCapacity(spec: VersionSpec): number {
	return Math.floor((spec.dataCodewords * 8 - 4 - 8) / 8);
}

/** GF(256) with the QR primitive polynomial 0x11d, as log/exp tables. */
const GF_EXP = new Array<number>(512).fill(0);
const GF_LOG = new Array<number>(256).fill(0);
{
	let value = 1;
	for (let i = 0; i < 255; i++) {
		GF_EXP[i] = value;
		GF_LOG[value] = i;
		value <<= 1;
		if (value & 0x100) value ^= 0x11d;
	}
	for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMultiply(a: number, b: number): number {
	return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** The monic Reed-Solomon generator polynomial of degree `ecCount`, highest coefficient first. */
function rsGenerator(ecCount: number): number[] {
	let generator = [1];
	for (let i = 0; i < ecCount; i++) {
		// Multiply by (x + a^i): the x term keeps each coefficient's index (the array grows at
		// the top), the constant term shifts them one slot towards the low end.
		const next = new Array<number>(generator.length + 1).fill(0);
		for (let j = 0; j < generator.length; j++) {
			next[j] ^= generator[j];
			next[j + 1] ^= gfMultiply(generator[j], GF_EXP[i]);
		}
		generator = next;
	}
	return generator;
}

/** The `ecCount` ECC codewords for a block: the remainder of data·x^ecCount mod generator. */
function rsRemainder(data: number[], ecCount: number): number[] {
	const generator = rsGenerator(ecCount);
	const remainder = new Array<number>(ecCount).fill(0);
	for (const byte of data) {
		const factor = byte ^ remainder[0];
		remainder.shift();
		remainder.push(0);
		for (let i = 0; i < ecCount; i++) remainder[i] ^= gfMultiply(generator[i + 1], factor);
	}
	return remainder;
}

function encodeBits(text: string, spec: VersionSpec): number[] {
	const bytes = Array.from(new TextEncoder().encode(text));
	const bits: number[] = [];
	const push = (value: number, length: number) => {
		for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
	};
	push(0b0100, 4); // byte mode
	push(bytes.length, 8);
	for (const byte of bytes) push(byte, 8);
	push(0, Math.min(4, spec.dataCodewords * 8 - bits.length)); // terminator
	while (bits.length % 8 !== 0) bits.push(0);
	const codewords: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
	}
	for (let pad = 0xec; codewords.length < spec.dataCodewords; pad ^= 0xec ^ 0x11) {
		codewords.push(pad);
	}
	return codewords;
}

/** Splits into blocks, adds ECC and interleaves per the spec. */
function interleave(codewords: number[], spec: VersionSpec): number[] {
	const blocks: { data: number[]; ec: number[] }[] = [];
	let offset = 0;
	for (const [count, perBlock] of spec.groups) {
		for (let i = 0; i < count; i++) {
			const data = codewords.slice(offset, offset + perBlock);
			offset += perBlock;
			blocks.push({ data, ec: rsRemainder(data, spec.ecPerBlock) });
		}
	}
	const result: number[] = [];
	const longestData = Math.max(...blocks.map((block) => block.data.length));
	for (let i = 0; i < longestData; i++) {
		for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
	}
	for (let i = 0; i < spec.ecPerBlock; i++) {
		for (const block of blocks) result.push(block.ec[i]);
	}
	return result;
}

type Matrix = {
	size: number;
	dark: boolean[][];
	reserved: boolean[][];
};

function newMatrix(size: number): Matrix {
	return {
		size,
		dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
		reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
	};
}

function setFunction(matrix: Matrix, row: number, col: number, dark: boolean): void {
	matrix.dark[row][col] = dark;
	matrix.reserved[row][col] = true;
}

function drawFinder(matrix: Matrix, row: number, col: number): void {
	for (let r = -1; r <= 7; r++) {
		for (let c = -1; c <= 7; c++) {
			const y = row + r;
			const x = col + c;
			if (y < 0 || y >= matrix.size || x < 0 || x >= matrix.size) continue;
			const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
			const dark =
				inRing &&
				(r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
			setFunction(matrix, y, x, dark);
		}
	}
}

/** The 15 module coordinates of each format-information copy, in bit order, as [row, col]. */
function formatCoordinates(size: number): [number, number][][] {
	const first: [number, number][] = [];
	for (let i = 0; i <= 5; i++) first.push([i, 8]);
	first.push([7, 8], [8, 8], [8, 7]);
	for (let i = 9; i < 15; i++) first.push([8, 14 - i]);
	const second: [number, number][] = [];
	for (let i = 0; i < 8; i++) second.push([8, size - 1 - i]);
	for (let i = 8; i < 15; i++) second.push([size - 15 + i, 8]);
	return [first, second];
}

function drawFunctionPatterns(matrix: Matrix, version: number): void {
	const { size } = matrix;
	// Timing first: the finder patterns drawn afterwards overwrite its ends, which is exactly
	// how the symbol is defined — drawing them the other way round shreds a finder ring.
	for (let i = 0; i < size; i++) {
		setFunction(matrix, 6, i, i % 2 === 0);
		setFunction(matrix, i, 6, i % 2 === 0);
	}
	drawFinder(matrix, 0, 0);
	drawFinder(matrix, 0, size - 7);
	drawFinder(matrix, size - 7, 0);
	if (version >= 2) {
		// Of the four alignment-pattern centres only the bottom-right one survives — the other
		// three fall inside finder patterns and are never drawn.
		const last = size - 7;
		for (let r = -2; r <= 2; r++) {
			for (let c = -2; c <= 2; c++) {
				setFunction(matrix, last + r, last + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
			}
		}
	}
	// Reserve the format strips (filled after masking) and the always-dark module.
	for (const copy of formatCoordinates(size)) {
		for (const [row, col] of copy) setFunction(matrix, row, col, false);
	}
	setFunction(matrix, size - 8, 8, true);
}

function drawCodewords(matrix: Matrix, codewords: number[]): void {
	let bit = 0;
	for (let right = matrix.size - 1; right >= 1; right -= 2) {
		// The vertical timing pattern owns column 6: the pair shifts left past it, and the
		// shifted column joins the sequence (5, 3, 1) rather than being visited twice.
		if (right === 6) right = 5;
		for (let vert = 0; vert < matrix.size; vert++) {
			for (let j = 0; j < 2; j++) {
				const col = right - j;
				const upward = ((right + 1) & 2) === 0;
				const row = upward ? matrix.size - 1 - vert : vert;
				if (matrix.reserved[row][col]) continue;
				if (bit < codewords.length * 8) {
					matrix.dark[row][col] = ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) !== 0;
				}
				bit += 1;
			}
		}
	}
}

/** Mask 0: invert where (row + col) is even. */
function applyMask(matrix: Matrix): void {
	for (let row = 0; row < matrix.size; row++) {
		for (let col = 0; col < matrix.size; col++) {
			if (!matrix.reserved[row][col] && (row + col) % 2 === 0) {
				matrix.dark[row][col] = !matrix.dark[row][col];
			}
		}
	}
}

function drawFormatBits(matrix: Matrix, mask: number): void {
	// EC level M is 0b00 in the format's two level bits.
	const data = (0b00 << 3) | mask;
	let rem = data;
	for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
	const bits = ((data << 10) | rem) ^ 0x5412;
	const bit = (i: number) => ((bits >>> i) & 1) !== 0;
	for (const copy of formatCoordinates(matrix.size)) {
		copy.forEach(([row, col], i) => setFunction(matrix, row, col, bit(i)));
	}
}

/**
 * Encodes text into a QR module matrix (true = dark module), row-major. Throws when the text
 * does not fit the supported versions — a join URL never comes close.
 */
export function qrCodeMatrix(text: string): boolean[][] {
	const bytes = new TextEncoder().encode(text);
	const spec = VERSIONS.find((candidate) => bytes.length <= byteCapacity(candidate));
	if (!spec) throw new Error('Text too long for the supported QR versions');

	const matrix = newMatrix(17 + 4 * spec.version);
	drawFunctionPatterns(matrix, spec.version);
	drawCodewords(matrix, interleave(encodeBits(text, spec), spec));
	applyMask(matrix);
	drawFormatBits(matrix, 0);
	return matrix.dark;
}

/** The side length in modules of the matrix `qrCodeMatrix` would produce for this text. */
export function qrCodeSize(text: string): number {
	return qrCodeMatrix(text).length;
}
