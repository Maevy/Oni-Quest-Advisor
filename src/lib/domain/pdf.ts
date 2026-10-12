/**
 * A minimal, dependency-free PDF writer. The app cannot install packages, and a battle report is
 * text, rules and simple vector shapes - everything PDF 1.4 expresses directly. Output is
 * deterministic and streams are left uncompressed on purpose: the same input yields the same
 * bytes, which makes the writer unit-testable without opening a viewer.
 *
 * Coordinates are in points (1/72"), origin TOP-LEFT, y growing downward - the writer flips to
 * PDF's bottom-left origin. Colors are 0..1 RGB triples.
 */

export type PdfFont = 'helvetica' | 'helvetica-bold';
export type PdfColor = [number, number, number];

export type PdfText = {
	kind: 'text';
	x: number;
	y: number;
	text: string;
	font: PdfFont;
	size: number;
	color?: PdfColor;
};
export type PdfLine = {
	kind: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	width?: number;
	color?: PdfColor;
};
export type PdfRect = {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill?: PdfColor;
	stroke?: PdfColor;
	lineWidth?: number;
};
/** A filled and/or stroked path; circles, arcs and stars arrive pre-flattened from the layout. */
export type PdfPolygon = {
	kind: 'polygon';
	points: Array<{ x: number; y: number }>;
	close?: boolean;
	fill?: PdfColor;
	stroke?: PdfColor;
	lineWidth?: number;
};
export type PdfOp = PdfText | PdfLine | PdfRect | PdfPolygon;

export type PdfDoc = {
	width: number;
	height: number;
	title?: string;
	/** Each inner array is one page's ops, painted in order. */
	pages: PdfOp[][];
};

/** A4 portrait, the size a printed battle report wants. */
export const PDF_PAGE_WIDTH = 595.28;
export const PDF_PAGE_HEIGHT = 841.89;

/** Adobe's Helvetica widths, units/1000, for codes 32..126. */
const HELVETICA_WIDTHS = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
	611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
	222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];
const HELVETICA_BOLD_WIDTHS = [
	278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
	611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
	278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

/** Characters a report is likely to carry that WinAnsi would mangle, mapped to ASCII. */
const UNICODE_FALLBACKS: Record<string, string> = {
	'\u2013': '-',
	'\u2014': '-',
	'\u2018': "'",
	'\u2019': "'",
	'\u201c': '"',
	'\u201d': '"',
	'\u2026': '...',
	'\u00b7': '-',
	'\u2212': '-',
	'\u00a0': ' '
};

/** The text as the PDF can store it: WinAnsi-safe, with literals escaped. */
function encodeText(text: string): string {
	let out = '';
	for (const char of text) {
		const code = char.codePointAt(0) ?? 63;
		if (code >= 32 && code <= 126) {
			out += char === '(' || char === ')' || char === '\\' ? `\\${char}` : char;
		} else if (code >= 160 && code <= 255) {
			out += char;
		} else {
			out += UNICODE_FALLBACKS[char] ?? '?';
		}
	}
	return out;
}

function widthsFor(font: PdfFont): number[] {
	return font === 'helvetica-bold' ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
}

/** The rendered width of a string in points. */
export function pdfTextWidth(text: string, font: PdfFont, size: number): number {
	const widths = widthsFor(font);
	let total = 0;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 63;
		total += code >= 32 && code <= 126 ? (widths[code - 32] ?? 556) : 556;
	}
	return (total / 1000) * size;
}

/** Greedy word wrap at a maximum width; over-long words are broken rather than dropped. */
export function pdfWrapText(text: string, font: PdfFont, size: number, maxWidth: number): string[] {
	const words = text.split(/\s+/).filter((word) => word.length > 0);
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const candidate = current === '' ? word : `${current} ${word}`;
		if (pdfTextWidth(candidate, font, size) <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current !== '') lines.push(current);
		// A single word wider than the line: break it at the character boundary.
		if (pdfTextWidth(word, font, size) > maxWidth) {
			let piece = '';
			for (const char of word) {
				if (pdfTextWidth(piece + char, font, size) > maxWidth && piece !== '') {
					lines.push(piece);
					piece = char;
				} else {
					piece += char;
				}
			}
			current = piece;
		} else {
			current = word;
		}
	}
	if (current !== '') lines.push(current);
	return lines;
}

function num(value: number): string {
	return Number(value.toFixed(2)).toString();
}

function color(value: PdfColor | undefined, fallback: PdfColor): string {
	const [r, g, b] = value ?? fallback;
	return `${num(r)} ${num(g)} ${num(b)}`;
}

function opToStream(op: PdfOp, pageHeight: number): string {
	switch (op.kind) {
		case 'text': {
			const y = pageHeight - op.y;
			return `BT ${color(op.color, [0, 0, 0])} rg /${
				op.font === 'helvetica-bold' ? 'F2' : 'F1'
			} ${num(op.size)} Tf 1 0 0 1 ${num(op.x)} ${num(y)} Tm (${encodeText(op.text)}) Tj ET`;
		}
		case 'line':
			return `${color(op.color, [0, 0, 0])} RG ${num(op.width ?? 1)} w ${num(op.x1)} ${num(
				pageHeight - op.y1
			)} m ${num(op.x2)} ${num(pageHeight - op.y2)} l S`;
		case 'rect': {
			const y = pageHeight - op.y - op.h;
			const path = `${num(op.x)} ${num(y)} ${num(op.w)} ${num(op.h)} re`;
			if (op.fill && op.stroke)
				return `${color(op.fill, [0, 0, 0])} rg ${color(op.stroke, [0, 0, 0])} RG ${num(
					op.lineWidth ?? 1
				)} w ${path} B`;
			if (op.fill) return `${color(op.fill, [0, 0, 0])} rg ${path} f`;
			return `${color(op.stroke, [0, 0, 0])} RG ${num(op.lineWidth ?? 1)} w ${path} S`;
		}
		case 'polygon': {
			if (op.points.length === 0) return '';
			const parts = op.points.map(
				(point, index) => `${num(point.x)} ${num(pageHeight - point.y)} ${index === 0 ? 'm' : 'l'}`
			);
			if (op.close !== false) parts.push('h');
			const path = parts.join(' ');
			if (op.fill && op.stroke)
				return `${color(op.fill, [0, 0, 0])} rg ${color(op.stroke, [0, 0, 0])} RG ${num(
					op.lineWidth ?? 1
				)} w ${path} B`;
			if (op.fill) return `${color(op.fill, [0, 0, 0])} rg ${path} f`;
			return `${color(op.stroke, [0, 0, 0])} RG ${num(op.lineWidth ?? 1)} w ${path} S`;
		}
	}
}

/** A circle flattened to a polyline; good enough for markers at report scale. */
export function pdfCirclePoints(
	cx: number,
	cy: number,
	r: number,
	segments = 24
): Array<{ x: number; y: number }> {
	return Array.from({ length: segments }, (_unused, index) => {
		const angle = (index / segments) * Math.PI * 2;
		return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
	});
}

/** An arc flattened to a polyline, angles in degrees, clockwise on screen. */
export function pdfArcPoints(
	cx: number,
	cy: number,
	r: number,
	startDeg: number,
	endDeg: number,
	segments = 24
): Array<{ x: number; y: number }> {
	return Array.from({ length: segments + 1 }, (_unused, index) => {
		const angle = ((startDeg + ((endDeg - startDeg) * index) / segments) * Math.PI) / 180;
		return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
	});
}

/**
 * Renders the document to PDF 1.4 bytes. Object numbers are assigned in a fixed order - catalog,
 * pages tree, the two fonts, info, then page/content pairs - so the byte output is a pure
 * function of the input.
 */
export function renderPdf(doc: PdfDoc): Uint8Array {
	const objects: string[] = [];
	const pageIds = doc.pages.map((_page, index) => 6 + index * 2);
	const contentIds = doc.pages.map((_page, index) => 7 + index * 2);
	const kids = pageIds.map((id) => `${id} 0 R`).join(' ');

	objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
	objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${doc.pages.length} >>`);
	objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
	objects.push(
		`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
	);
	const title = doc.title ? ` /Title (${encodeText(doc.title)})` : '';
	objects.push(`<< /Producer (Oni Quest Advisor)${title} >>`);

	doc.pages.forEach((ops, index) => {
		objects.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(doc.width)} ${num(doc.height)}] ` +
				`/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
		);
		const stream = ops
			.map((op) => opToStream(op, doc.height))
			.filter((line) => line !== '')
			.join('\n');
		objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	});

	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [];
	objects.forEach((body, index) => {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xrefOffset = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

	const bytes = new Uint8Array(pdf.length);
	for (let index = 0; index < pdf.length; index += 1) bytes[index] = pdf.charCodeAt(index) & 0xff;
	return bytes;
}
