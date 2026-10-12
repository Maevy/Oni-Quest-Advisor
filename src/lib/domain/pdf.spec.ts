import { describe, expect, it } from 'vitest';
import {
	pdfTextWidth,
	pdfWrapText,
	renderPdf,
	PDF_PAGE_HEIGHT,
	PDF_PAGE_WIDTH,
	type PdfDoc,
	type PdfText
} from './pdf';

function decode(bytes: Uint8Array): string {
	let text = '';
	for (const byte of bytes) text += String.fromCharCode(byte);
	return text;
}

function docWith(...pages: PdfDoc['pages']): PdfDoc {
	return { width: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT, title: 'Test', pages };
}

describe('pdfTextWidth', () => {
	it('uses the Helvetica widths table', () => {
		// H 722, e 556, l 222, l 222, o 556 -> 2278/1000 * 10
		expect(pdfTextWidth('Hello', 'helvetica', 10)).toBeCloseTo(22.78, 2);
	});

	it('is wider in bold and grows with size', () => {
		expect(pdfTextWidth('Hello', 'helvetica-bold', 10)).toBeGreaterThan(
			pdfTextWidth('Hello', 'helvetica', 10)
		);
		expect(pdfTextWidth('Hello', 'helvetica', 20)).toBeCloseTo(
			pdfTextWidth('Hello', 'helvetica', 10) * 2,
			5
		);
	});
});

describe('pdfWrapText', () => {
	it('wraps at word boundaries within the width', () => {
		const lines = pdfWrapText('one two three four five', 'helvetica', 10, 60);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(pdfTextWidth(line, 'helvetica', 10)).toBeLessThanOrEqual(60);
		expect(lines.join(' ')).toBe('one two three four five');
	});

	it('breaks a word wider than the line instead of dropping it', () => {
		const lines = pdfWrapText('supercalifragilistic', 'helvetica', 10, 40);
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.join('')).toBe('supercalifragilistic');
	});

	it('returns nothing for an empty string', () => {
		expect(pdfWrapText('   ', 'helvetica', 10, 100)).toEqual([]);
	});
});

describe('renderPdf', () => {
	const text: PdfText = {
		kind: 'text',
		x: 40,
		y: 60,
		text: 'Citadel Guard takes 2 damage',
		font: 'helvetica',
		size: 10
	};

	it('writes the header, trailer and EOF marker', () => {
		const pdf = decode(renderPdf(docWith([text])));
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
		expect(pdf).toContain('trailer');
		expect(pdf).toContain('/Root 1 0 R');
		expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
	});

	it('points every xref entry at its object', () => {
		const bytes = renderPdf(docWith([text]));
		const pdf = decode(bytes);
		const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
		expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
		const table = pdf.slice(startxref).split('\n');
		const count = Number(table[1].split(' ')[1]);
		for (let index = 1; index < count; index += 1) {
			const entry = table[1 + index + 1];
			const offset = Number(entry.slice(0, 10));
			expect(pdf.slice(offset, offset + `${index} 0 obj`.length)).toBe(`${index} 0 obj`);
		}
	});

	it('keeps the text greppable in an uncompressed stream, escaped', () => {
		const pdf = decode(
			renderPdf(
				docWith([
					{ ...text, text: 'a (b) \\ c - d' },
					{ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10 },
					{ kind: 'rect', x: 1, y: 2, w: 3, h: 4, fill: [0.5, 0.5, 0.5] },
					{
						kind: 'polygon',
						points: [
							{ x: 0, y: 0 },
							{ x: 5, y: 5 }
						],
						stroke: [0, 0, 0]
					}
				])
			)
		);
		expect(pdf).toContain('(a \\(b\\) \\\\ c - d)');
		expect(pdf).toContain(' re');
		expect(pdf).toContain(' m ');
	});

	it('maps typographic characters into WinAnsi and unknown ones to ?', () => {
		const pdf = decode(renderPdf(docWith([{ ...text, text: 'a — b ★' }])));
		expect(pdf).toContain('(a - b ?)');
	});

	it('numbers one page pair per page and counts them', () => {
		const pdf = decode(renderPdf(docWith([text], [text], [text])));
		expect(pdf).toContain('/Count 3');
		expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(3);
	});

	it('is deterministic: same input, same bytes', () => {
		const a = renderPdf(docWith([text]));
		const b = renderPdf(docWith([text]));
		expect(a).toEqual(b);
	});
});
