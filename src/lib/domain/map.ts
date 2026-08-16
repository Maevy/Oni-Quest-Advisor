export const MAP_SIZE_INCHES = 36;

export type MarkerShape = 'star' | 'box' | 'triangle' | 'circle' | 'x';

export type Marker = {
	id: string;
	/** Inches from the left edge of the map. */
	x: number;
	/** Inches from the top edge of the map. */
	y: number;
	shape: MarkerShape;
	label: string;
	color: string;
	showRuler: boolean;
	/** Side of the marker the label renders on — 'below' unless set, useful to avoid overlap with a nearby marker's label. */
	labelPosition?: 'above' | 'below';
};

export type DeploymentZone =
	{ type: 'horizontal'; rangeInches: number } | { type: 'radial'; rangeInches: number };

export type MapSpec = {
	zone: DeploymentZone;
	markers: Marker[];
	/** Draws a center cross splitting the field into 4 gameplay-relevant Quarters (e.g. Quarter War). */
	quarters?: boolean;
};

export type RulerAnchor = {
	/** Vertical edge the horizontal distance is measured from. */
	xEdge: 'left' | 'right';
	/** Horizontal edge the vertical distance is measured from. */
	yEdge: 'top' | 'bottom';
	xDistance: number;
	yDistance: number;
};

/**
 * Edges a player would actually measure from — always the shortest way to the
 * marker, one of the 4 corner combinations (e.g. a marker 5" from the right edge
 * is shown as 5", not 31" from the left).
 */
export function rulerAnchor(marker: { x: number; y: number }): RulerAnchor {
	const xEdge = marker.x <= MAP_SIZE_INCHES / 2 ? 'left' : 'right';
	const yEdge = marker.y <= MAP_SIZE_INCHES / 2 ? 'top' : 'bottom';
	return {
		xEdge,
		yEdge,
		xDistance: xEdge === 'left' ? marker.x : MAP_SIZE_INCHES - marker.x,
		yDistance: yEdge === 'top' ? marker.y : MAP_SIZE_INCHES - marker.y
	};
}

export type ZoneRect = { x: number; y: number; width: number; height: number };

export type HorizontalDeploymentZones = {
	blue: ZoneRect;
	red: ZoneRect;
};

/** Blue's box rises from the bottom edge, Red's mirrors down from the top — both `rangeInches` deep. */
export function drawHorizontalDeployment(rangeInches: number): HorizontalDeploymentZones {
	return {
		blue: { x: 0, y: MAP_SIZE_INCHES - rangeInches, width: MAP_SIZE_INCHES, height: rangeInches },
		red: { x: 0, y: 0, width: MAP_SIZE_INCHES, height: rangeInches }
	};
}

/** A quarter-circle wedge: center, radius, and the two points where its arc meets the map edges. */
export type ZoneArc = {
	cx: number;
	cy: number;
	r: number;
	arcStart: { x: number; y: number };
	arcEnd: { x: number; y: number };
};

export type RadialDeploymentZones = {
	blue: ZoneArc;
	red: ZoneArc;
};

/** Blue's wedge is centered on the bottom-right corner, Red's mirrors on the top-left — both radius `rangeInches`. */
export function drawCircularDeployment(rangeInches: number): RadialDeploymentZones {
	const size = MAP_SIZE_INCHES;
	return {
		blue: {
			cx: size,
			cy: size,
			r: rangeInches,
			arcStart: { x: size - rangeInches, y: size },
			arcEnd: { x: size, y: size - rangeInches }
		},
		red: {
			cx: 0,
			cy: 0,
			r: rangeInches,
			arcStart: { x: rangeInches, y: 0 },
			arcEnd: { x: 0, y: rangeInches }
		}
	};
}
