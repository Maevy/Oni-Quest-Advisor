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
