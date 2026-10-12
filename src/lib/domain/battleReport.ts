import {
	drawCircularDeployment,
	drawHorizontalDeployment,
	MAP_SIZE_INCHES,
	type MapSpec
} from './map';
import type { ArmyView } from './savedArmy';
import {
	pdfArcPoints,
	pdfCirclePoints,
	pdfTextWidth,
	pdfWrapText,
	renderPdf,
	PDF_PAGE_HEIGHT,
	PDF_PAGE_WIDTH,
	type PdfColor,
	type PdfOp
} from './pdf';
import type { HistoryEntry } from './vitalityHistory';
import type { RoundSnapshot } from './online';
import type { PlayerKey } from './twoPlayer';

/**
 * The battle report's data model and its layout. Everything here is pure: the page assembles the
 * input from the game view, the folded log and the local catalogs, and the writer turns it into
 * PDF bytes that the browser downloads. Nothing is persisted anywhere - the report exists only
 * in the download.
 */

export type BattleReportUnitLine = { name: string; copies: number; size: string; points: number };

export type BattleReportPlayer = {
	seat: PlayerKey;
	nickname: string;
	armyName: string;
	factionName: string;
	format: string;
	totalPoints: number | null;
	units: BattleReportUnitLine[];
	schemeTitle: string | null;
	schemeIncrements: number | null;
};

export type BattleReportInteraction = {
	actor: PlayerKey;
	lines: string[];
	undone: boolean;
};

export type BattleReportRound = {
	round: number;
	score: { player1: number | null; player2: number | null };
	interactions: BattleReportInteraction[];
};

export type BattleReportStat = { name: string; total: number };

export type BattleReportInput = {
	code: string;
	/** ISO timestamp of the match's creation; null when unknown. */
	playedAt: string | null;
	seasonName: string;
	missionName: string;
	map: MapSpec | null;
	players: BattleReportPlayer[];
	rounds: BattleReportRound[];
	finalScore: { player1: number | null; player2: number | null } | null;
	winner: PlayerKey | 'draw' | null;
	damage: BattleReportStat[];
	healing: BattleReportStat[];
};

/**
 * Damage and healing per acting model, highest first. Cross-model commits name the model that
 * acted; a self commit has no origin - its owner recorded a hit that arrived from off-board - so
 * it is tallied under the seat's nickname, marked unattributed, rather than dropped: the total
 * still has to balance against what the board shows.
 */
export function battleReportStats(
	history: HistoryEntry[],
	nicknames: Record<PlayerKey, string>
): { damage: BattleReportStat[]; healing: BattleReportStat[] } {
	const damage = new Map<string, number>();
	const healing = new Map<string, number>();
	const add = (totals: Map<string, number>, key: string, amount: number) =>
		totals.set(key, (totals.get(key) ?? 0) + amount);

	for (const entry of history) {
		if (entry.kind !== 'action' || entry.undoneBy !== null) continue;
		if (entry.action.kind !== 'damage' && entry.action.kind !== 'heal') continue;
		const key = entry.originName ?? `${nicknames[entry.actor]} (unattributed)`;
		add(entry.action.kind === 'damage' ? damage : healing, key, entry.action.amount);
	}
	const sorted = (totals: Map<string, number>): BattleReportStat[] =>
		[...totals.entries()]
			.map(([name, total]) => ({ name, total }))
			.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
	return { damage: sorted(damage), healing: sorted(healing) };
}

/**
 * The log grouped into rounds, with the score each round ended on. Undone interactions stay in
 * their round, marked, because the report tells what happened at the table - including the
 * mis-tap that was walked back.
 */
export function battleReportRounds(
	history: HistoryEntry[],
	sentences: Record<number, string[]>,
	snapshots: Record<number, RoundSnapshot>,
	finalScore: { player1: number | null; player2: number | null } | null
): BattleReportRound[] {
	let highest = 0;
	for (const entry of history)
		if (entry.kind === 'action') highest = Math.max(highest, entry.round);
	for (const round of Object.keys(snapshots)) highest = Math.max(highest, Number(round));
	if (finalScore) highest = Math.max(highest, 1);

	const rounds: BattleReportRound[] = [];
	for (let round = 1; round <= highest; round += 1) {
		const interactions: BattleReportInteraction[] = [];
		for (const entry of history) {
			if (entry.kind !== 'action' || entry.round !== round) continue;
			interactions.push({
				actor: entry.actor,
				lines: sentences[entry.seq] ?? [],
				undone: entry.undoneBy !== null
			});
		}
		const snapshot = snapshots[round];
		// The last round's score may only exist as the final tally, taken when the game finished.
		const isLast = round === highest;
		rounds.push({
			round,
			score: {
				player1: snapshot?.player1 ?? (isLast ? (finalScore?.player1 ?? null) : null),
				player2: snapshot?.player2 ?? (isLast ? (finalScore?.player2 ?? null) : null)
			},
			interactions
		});
	}
	return rounds;
}

/** The army's copies grouped per unit, as the report lists them. */
export function battleReportUnits(army: ArmyView): {
	units: BattleReportUnitLine[];
	totalPoints: number;
} {
	const groups = new Map<string, BattleReportUnitLine>();
	let totalPoints = 0;
	for (const row of army.rows) {
		totalPoints += row.points;
		const existing = groups.get(row.unitId);
		const size = row.effectiveSize.charAt(0).toUpperCase() + row.effectiveSize.slice(1);
		if (existing) {
			existing.copies += 1;
			existing.points += row.points;
		} else {
			groups.set(row.unitId, { name: row.name, copies: 1, size, points: row.points });
		}
	}
	return { units: [...groups.values()], totalPoints };
}

// --- layout ---------------------------------------------------------------------

const MARGIN = 48;
const CONTENT_WIDTH = PDF_PAGE_WIDTH - MARGIN * 2;
const TOP = 56;
const BOTTOM = PDF_PAGE_HEIGHT - 56;
const INK: PdfColor = [0.1, 0.12, 0.18];
const MUTED: PdfColor = [0.42, 0.46, 0.55];
const ACCENT: PdfColor = [0.05, 0.35, 0.55];
const RULE: PdfColor = [0.72, 0.76, 0.82];

type Layout = { pages: PdfOp[][]; y: number };

function newPage(layout: Layout): void {
	layout.pages.push([]);
	layout.y = TOP;
}

function put(layout: Layout, op: PdfOp): void {
	layout.pages[layout.pages.length - 1].push(op);
}

function ensure(layout: Layout, needed: number): void {
	if (layout.y + needed > BOTTOM) newPage(layout);
}

function drawText(
	layout: Layout,
	text: string,
	options: {
		size?: number;
		font?: 'helvetica' | 'helvetica-bold';
		color?: PdfColor;
		indent?: number;
		maxWidth?: number;
		leading?: number;
	} = {}
): void {
	const size = options.size ?? 9;
	const font = options.font ?? 'helvetica';
	const indent = options.indent ?? 0;
	const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;
	const leading = options.leading ?? size * 1.35;
	for (const line of pdfWrapText(text, font, size, maxWidth)) {
		ensure(layout, leading);
		put(layout, {
			kind: 'text',
			x: MARGIN + indent,
			y: layout.y + size * 0.8,
			text: line,
			font,
			size,
			color: options.color ?? INK
		});
		layout.y += leading;
	}
}

function drawHeading(layout: Layout, text: string): void {
	ensure(layout, 34);
	layout.y += 8;
	put(layout, {
		kind: 'text',
		x: MARGIN,
		y: layout.y + 8,
		text: text.toUpperCase(),
		font: 'helvetica-bold',
		size: 11,
		color: ACCENT
	});
	layout.y += 15;
	put(layout, {
		kind: 'line',
		x1: MARGIN,
		y1: layout.y,
		x2: MARGIN + CONTENT_WIDTH,
		y2: layout.y,
		width: 0.8,
		color: ACCENT
	});
	layout.y += 8;
}

function formatPlayedAt(playedAt: string | null): string {
	if (!playedAt) return 'unknown';
	return `${playedAt.slice(0, 10)} ${playedAt.slice(11, 16)} UTC`;
}

function hexToColor(value: string, fallback: PdfColor): PdfColor {
	const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
	if (!match) return fallback;
	const int = Number.parseInt(match[1], 16);
	return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

const MAP_SIZE = 150;

/** The mission's map as vector ops: field, deployment zones, quarters, markers and labels. */
function mapOps(map: MapSpec, x: number, y: number): PdfOp[] {
	const ops: PdfOp[] = [];
	const scale = MAP_SIZE / MAP_SIZE_INCHES;
	const at = (inches: { x: number; y: number }) => ({
		x: x + inches.x * scale,
		y: y + inches.y * scale
	});

	if (map.zone.type === 'horizontal') {
		const zones = drawHorizontalDeployment(map.zone.rangeInches);
		ops.push({
			kind: 'rect',
			x: x + zones.red.x * scale,
			y: y + zones.red.y * scale,
			w: zones.red.width * scale,
			h: zones.red.height * scale,
			fill: [0.95, 0.85, 0.85]
		});
		ops.push({
			kind: 'rect',
			x: x + zones.blue.x * scale,
			y: y + zones.blue.y * scale,
			w: zones.blue.width * scale,
			h: zones.blue.height * scale,
			fill: [0.85, 0.9, 0.97]
		});
	} else {
		const zones = drawCircularDeployment(map.zone.rangeInches);
		for (const [wedge, fill] of [
			[zones.red, [0.95, 0.85, 0.85]],
			[zones.blue, [0.85, 0.9, 0.97]]
		] as const) {
			const startDeg = wedge.cx === 0 ? 0 : 180;
			const endDeg = wedge.cx === 0 ? 90 : 270;
			const corner = at({ x: wedge.cx, y: wedge.cy });
			ops.push({
				kind: 'polygon',
				points: [
					at(wedge.arcStart),
					...pdfArcPoints(
						wedge.cx * scale + x,
						wedge.cy * scale + y,
						wedge.r * scale,
						startDeg,
						endDeg
					).map((point) => ({ x: point.x, y: point.y })),
					at(wedge.arcEnd),
					corner
				],
				fill: fill as PdfColor
			});
		}
	}

	if (map.quarters) {
		const mid = MAP_SIZE_INCHES / 2;
		ops.push({
			kind: 'line',
			x1: x + mid * scale,
			y1: y,
			x2: x + mid * scale,
			y2: y + MAP_SIZE,
			width: 0.5,
			color: MUTED
		});
		ops.push({
			kind: 'line',
			x1: x,
			y1: y + mid * scale,
			x2: x + MAP_SIZE,
			y2: y + mid * scale,
			width: 0.5,
			color: MUTED
		});
	}

	for (const marker of map.markers) {
		const centre = at({ x: marker.x, y: marker.y });
		const color = hexToColor(marker.color, ACCENT);
		const r = 3.4;
		switch (marker.shape) {
			case 'box':
				ops.push({
					kind: 'rect',
					x: centre.x - r,
					y: centre.y - r,
					w: r * 2,
					h: r * 2,
					stroke: color,
					lineWidth: 1.2
				});
				break;
			case 'circle':
				ops.push({
					kind: 'polygon',
					points: pdfCirclePoints(centre.x, centre.y, r),
					stroke: color,
					lineWidth: 1.2
				});
				break;
			case 'triangle':
				ops.push({
					kind: 'polygon',
					points: [
						{ x: centre.x, y: centre.y - r * 1.2 },
						{ x: centre.x - r * 1.1, y: centre.y + r },
						{ x: centre.x + r * 1.1, y: centre.y + r }
					],
					stroke: color,
					lineWidth: 1.2
				});
				break;
			case 'x':
				ops.push({
					kind: 'line',
					x1: centre.x - r,
					y1: centre.y - r,
					x2: centre.x + r,
					y2: centre.y + r,
					width: 1.4,
					color
				});
				ops.push({
					kind: 'line',
					x1: centre.x - r,
					y1: centre.y + r,
					x2: centre.x + r,
					y2: centre.y - r,
					width: 1.4,
					color
				});
				break;
			case 'star': {
				const points: Array<{ x: number; y: number }> = [];
				for (let index = 0; index < 10; index += 1) {
					const radius = index % 2 === 0 ? r * 1.7 : r * 0.75;
					const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
					points.push({
						x: centre.x + Math.cos(angle) * radius,
						y: centre.y + Math.sin(angle) * radius
					});
				}
				ops.push({ kind: 'polygon', points, stroke: color, lineWidth: 1.1 });
				break;
			}
		}
		const above = marker.labelPosition === 'above';
		ops.push({
			kind: 'text',
			x: centre.x + r + 3,
			y: above ? centre.y - r - 2 : centre.y + 2.6,
			text: marker.label,
			font: 'helvetica-bold',
			size: 7,
			color: INK
		});
	}

	ops.push({
		kind: 'rect',
		x,
		y,
		w: MAP_SIZE,
		h: MAP_SIZE,
		stroke: INK,
		lineWidth: 1
	});
	return ops;
}

function statTable(layout: Layout, title: string, stats: BattleReportStat[], unit: string): void {
	drawHeading(layout, title);
	if (stats.length === 0) {
		drawText(layout, `No ${unit} was recorded.`, { color: MUTED });
		return;
	}
	for (const [index, stat] of stats.entries()) {
		ensure(layout, 13);
		const label = `${index + 1}.`;
		const total = `${stat.total} ${unit}`;
		put(layout, {
			kind: 'text',
			x: MARGIN + 6,
			y: layout.y + 7.5,
			text: label,
			font: 'helvetica',
			size: 9,
			color: MUTED
		});
		put(layout, {
			kind: 'text',
			x: MARGIN + 26,
			y: layout.y + 7.5,
			text: stat.name,
			font: 'helvetica',
			size: 9,
			color: INK
		});
		const totalWidth = pdfTextWidth(total, 'helvetica-bold', 9);
		put(layout, {
			kind: 'text',
			x: MARGIN + CONTENT_WIDTH - totalWidth,
			y: layout.y + 7.5,
			text: total,
			font: 'helvetica-bold',
			size: 9,
			color: ACCENT
		});
		layout.y += 13;
	}
}

/** The whole report, as PDF bytes. */
export function buildBattleReportPdf(input: BattleReportInput): Uint8Array {
	const layout: Layout = { pages: [], y: TOP };
	newPage(layout);

	// --- header ---
	put(layout, {
		kind: 'text',
		x: MARGIN,
		y: TOP - 16,
		text: 'ONI QUEST - BATTLE REPORT',
		font: 'helvetica-bold',
		size: 17,
		color: ACCENT
	});
	put(layout, {
		kind: 'line',
		x1: MARGIN,
		y1: TOP - 8,
		x2: MARGIN + CONTENT_WIDTH,
		y2: TOP - 8,
		width: 1.2,
		color: ACCENT
	});
	layout.y = TOP + 4;
	drawText(layout, `Game code ${input.code}   -   Played ${formatPlayedAt(input.playedAt)}`, {
		size: 9,
		color: MUTED
	});
	layout.y += 4;

	// --- mission + map ---
	drawHeading(layout, 'Mission');
	if (input.map) {
		// The map sits right of its caption block; reserve its height before writing text.
		const mapTop = layout.y;
		for (const op of mapOps(input.map, MARGIN + CONTENT_WIDTH - MAP_SIZE, mapTop)) put(layout, op);
		const zone =
			input.map.zone.type === 'horizontal'
				? `horizontal deployment, ${input.map.zone.rangeInches}"`
				: `radial deployment, ${input.map.zone.rangeInches}"`;
		const textWidth = CONTENT_WIDTH - MAP_SIZE - 16;
		let y = mapTop;
		put(layout, {
			kind: 'text',
			x: MARGIN,
			y: y + 8.5,
			text: `${input.seasonName} - ${input.missionName}`,
			font: 'helvetica-bold',
			size: 10,
			color: INK
		});
		y += 15;
		for (const line of [
			`36" x 36" field, ${zone}`,
			`${input.map.markers.length} objective marker${input.map.markers.length === 1 ? '' : 's'}`
		]) {
			for (const wrapped of pdfWrapText(line, 'helvetica', 9, textWidth)) {
				put(layout, {
					kind: 'text',
					x: MARGIN,
					y: y + 7.5,
					text: wrapped,
					font: 'helvetica',
					size: 9,
					color: INK
				});
				y += 12;
			}
		}
		layout.y = mapTop + MAP_SIZE + 12;
	} else {
		drawText(layout, `${input.seasonName} - ${input.missionName}`, {
			font: 'helvetica-bold',
			size: 10
		});
		drawText(layout, 'This mission carries no map.', { color: MUTED });
	}

	// --- players and armies ---
	drawHeading(layout, 'Players and armies');
	for (const player of input.players) {
		const seatLabel = player.seat === 'player1' ? 'Player 1' : 'Player 2';
		const points = player.totalPoints === null ? '' : `, ${player.totalPoints} pts`;
		drawText(
			layout,
			`${seatLabel}: ${player.nickname} - ${player.factionName} - "${player.armyName}" (${player.format}${points})`,
			{ font: 'helvetica-bold', size: 10 }
		);
		if (player.schemeTitle) {
			const increments =
				player.schemeIncrements === null ? '' : `, ${player.schemeIncrements} increments scored`;
			drawText(layout, `Scheme: ${player.schemeTitle}${increments}`, { indent: 10, color: MUTED });
		}
		for (const unit of player.units) {
			ensure(layout, 12);
			drawText(layout, `${unit.copies}x ${unit.name} - ${unit.size} - ${unit.points} pts`, {
				indent: 10
			});
		}
		if (player.units.length === 0)
			drawText(layout, 'Army contents unknown on this device.', { indent: 10, color: MUTED });
		layout.y += 4;
	}

	// --- rounds ---
	drawHeading(layout, 'Rounds');
	for (const round of input.rounds) {
		ensure(layout, 40);
		const p1 = input.players.find((player) => player.seat === 'player1');
		const p2 = input.players.find((player) => player.seat === 'player2');
		const score =
			round.score.player1 === null && round.score.player2 === null
				? 'no score recorded'
				: `${p1?.nickname ?? 'Player 1'} ${round.score.player1 ?? '-'} : ${
						round.score.player2 ?? '-'
					} ${p2?.nickname ?? 'Player 2'}`;
		put(layout, {
			kind: 'text',
			x: MARGIN,
			y: layout.y + 8,
			text: `Round ${round.round}`,
			font: 'helvetica-bold',
			size: 10,
			color: INK
		});
		const scoreWidth = pdfTextWidth(score, 'helvetica', 9);
		put(layout, {
			kind: 'text',
			x: MARGIN + CONTENT_WIDTH - scoreWidth,
			y: layout.y + 8,
			text: score,
			font: 'helvetica',
			size: 9,
			color: ACCENT
		});
		layout.y += 15;
		if (round.interactions.length === 0) {
			drawText(layout, 'No interactions were recorded in this round.', {
				indent: 10,
				color: MUTED
			});
		}
		for (const interaction of round.interactions) {
			const tag = interaction.actor === 'player1' ? 'P1' : 'P2';
			for (const [index, line] of interaction.lines.entries()) {
				const suffix =
					interaction.undone && index === interaction.lines.length - 1 ? '  [undone]' : '';
				drawText(layout, `[${tag}] ${line}${suffix}`, {
					indent: 10,
					color: interaction.undone ? MUTED : INK
				});
			}
		}
		layout.y += 4;
	}
	if (input.finalScore) {
		ensure(layout, 24);
		const winner =
			input.winner === 'draw'
				? 'The match ended in a draw.'
				: input.winner
					? `Victory for ${input.players.find((player) => player.seat === input.winner)?.nickname ?? input.winner}.`
					: 'The match was not concluded.';
		drawText(
			layout,
			`Final score ${input.finalScore.player1 ?? '-'} : ${input.finalScore.player2 ?? '-'} - ${winner}`,
			{ font: 'helvetica-bold', size: 10 }
		);
	}

	// --- statistics ---
	statTable(layout, 'Damage dealt by model', input.damage, 'damage');
	statTable(layout, 'Healing done by model', input.healing, 'Life');

	// --- footers, once the page count is known ---
	const pageCount = layout.pages.length;
	layout.pages.forEach((page, index) => {
		const footerY = PDF_PAGE_HEIGHT - 34;
		page.push({
			kind: 'line',
			x1: MARGIN,
			y1: footerY - 8,
			x2: MARGIN + CONTENT_WIDTH,
			y2: footerY - 8,
			width: 0.6,
			color: RULE
		});
		page.push({
			kind: 'text',
			x: MARGIN,
			y: footerY,
			text: 'Generated by Oni Quest Advisor - not persisted on any server',
			font: 'helvetica',
			size: 7.5,
			color: MUTED
		});
		const label = `Page ${index + 1} of ${pageCount}`;
		page.push({
			kind: 'text',
			x: MARGIN + CONTENT_WIDTH - pdfTextWidth(label, 'helvetica', 7.5),
			y: footerY,
			text: label,
			font: 'helvetica',
			size: 7.5,
			color: MUTED
		});
	});

	return renderPdf({
		width: PDF_PAGE_WIDTH,
		height: PDF_PAGE_HEIGHT,
		title: `Oni Quest battle report ${input.code}`,
		pages: layout.pages
	});
}
