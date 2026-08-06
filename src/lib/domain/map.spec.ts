import { describe, expect, it } from 'vitest';
import { drawCircularDeployment, drawHorizontalDeployment, MAP_SIZE_INCHES } from './map';

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
