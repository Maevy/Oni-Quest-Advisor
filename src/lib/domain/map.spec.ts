import { describe, expect, it } from 'vitest';
import {
	drawCircularDeployment,
	drawHorizontalDeployment,
	MAP_SIZE_INCHES,
	rulerAnchor
} from './map';

describe('drawHorizontalDeployment', () => {
	it("spans the full map width and mirrors Blue's box from the bottom to Red's from the top", () => {
		const zones = drawHorizontalDeployment(8);

		expect(zones.blue).toEqual({ x: 0, y: MAP_SIZE_INCHES - 8, width: MAP_SIZE_INCHES, height: 8 });
		expect(zones.red).toEqual({ x: 0, y: 0, width: MAP_SIZE_INCHES, height: 8 });
	});
});

describe('drawCircularDeployment', () => {
	it("centers Blue's wedge on the bottom-right corner and Red's on the top-left, same radius", () => {
		const zones = drawCircularDeployment(10);

		expect(zones.blue).toEqual({
			cx: MAP_SIZE_INCHES,
			cy: MAP_SIZE_INCHES,
			r: 10,
			arcStart: { x: MAP_SIZE_INCHES - 10, y: MAP_SIZE_INCHES },
			arcEnd: { x: MAP_SIZE_INCHES, y: MAP_SIZE_INCHES - 10 }
		});
		expect(zones.red).toEqual({
			cx: 0,
			cy: 0,
			r: 10,
			arcStart: { x: 10, y: 0 },
			arcEnd: { x: 0, y: 10 }
		});
	});
});

describe('rulerAnchor', () => {
	it('measures from the left/top edges for a marker near the top-left corner', () => {
		expect(rulerAnchor({ x: 9, y: 5 })).toEqual({
			xEdge: 'left',
			yEdge: 'top',
			xDistance: 9,
			yDistance: 5
		});
	});

	it('measures from the right edge instead of showing a long left distance (Toxic Vine case)', () => {
		expect(rulerAnchor({ x: 31, y: 5 })).toEqual({
			xEdge: 'right',
			yEdge: 'top',
			xDistance: 5,
			yDistance: 5
		});
	});

	it('measures from the bottom edge for a marker near the bottom-left corner', () => {
		expect(rulerAnchor({ x: 5, y: 31 })).toEqual({
			xEdge: 'left',
			yEdge: 'bottom',
			xDistance: 5,
			yDistance: 5
		});
	});

	it('measures from the right/bottom edges for a marker near the bottom-right corner', () => {
		expect(rulerAnchor({ x: 20, y: 30 })).toEqual({
			xEdge: 'right',
			yEdge: 'bottom',
			xDistance: 16,
			yDistance: 6
		});
	});

	it('prefers left/top edges for an exactly centered marker', () => {
		expect(rulerAnchor({ x: 18, y: 18 })).toEqual({
			xEdge: 'left',
			yEdge: 'top',
			xDistance: 18,
			yDistance: 18
		});
	});
});
