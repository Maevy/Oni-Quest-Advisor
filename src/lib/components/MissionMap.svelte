<script lang="ts">
	import {
		drawCircularDeployment,
		drawHorizontalDeployment,
		MAP_SIZE_INCHES,
		rulerAnchor,
		type MapSpec,
		type Marker
	} from '$lib/domain';
	import Panel from './Panel.svelte';

	type Props = { map: MapSpec };

	let { map }: Props = $props();

	const BLUE = {
		fill: 'rgba(56, 189, 248, 0.18)',
		stroke: 'rgba(56, 189, 248, 0.6)',
		text: 'rgb(186, 230, 253)'
	};
	const RED = {
		fill: 'rgba(248, 113, 113, 0.18)',
		stroke: 'rgba(248, 113, 113, 0.6)',
		text: 'rgb(254, 202, 202)'
	};

	function arcPath(zone: {
		cx: number;
		cy: number;
		r: number;
		arcStart: { x: number; y: number };
		arcEnd: { x: number; y: number };
	}) {
		return `M ${zone.cx} ${zone.cy} L ${zone.arcStart.x} ${zone.arcStart.y} A ${zone.r} ${zone.r} 0 0 1 ${zone.arcEnd.x} ${zone.arcEnd.y} Z`;
	}

	function starPoints(marker: Marker, r: number): string {
		const points: string[] = [];
		for (let i = 0; i < 10; i++) {
			const angle = (Math.PI / 5) * i - Math.PI / 2;
			const radius = i % 2 === 0 ? r : r * 0.45;
			points.push(`${marker.x + radius * Math.cos(angle)},${marker.y + radius * Math.sin(angle)}`);
		}
		return points.join(' ');
	}

	function trianglePoints(marker: Marker, r: number): string {
		return [
			`${marker.x},${marker.y - r}`,
			`${marker.x + r},${marker.y + r}`,
			`${marker.x - r},${marker.y + r}`
		].join(' ');
	}

	const rulerMarkers = $derived(map.markers.filter((marker) => marker.showRuler));

	/** Position among ruler markers sharing a coordinate, so their distance labels stagger instead of overlapping. */
	function rulerLabelOffset(marker: Marker, axis: 'x' | 'y'): number {
		return rulerMarkers.filter((m) => m[axis] === marker[axis]).indexOf(marker);
	}

	const GRID_STEP_INCHES = 6;
	/** Internal orientation lines only, every {@link GRID_STEP_INCHES} inches — no gameplay meaning. */
	const gridPositions = Array.from(
		{ length: Math.floor(MAP_SIZE_INCHES / GRID_STEP_INCHES) - 1 },
		(_unused, index) => (index + 1) * GRID_STEP_INCHES
	);
</script>

<Panel title="Deployment Map">
	<svg
		viewBox="0 0 {MAP_SIZE_INCHES} {MAP_SIZE_INCHES}"
		class="mx-auto w-full max-w-72 rounded-xl border border-slate-700/60 bg-slate-950/70"
	>
		{#each gridPositions as pos (pos)}
			<line
				x1={pos}
				y1="0"
				x2={pos}
				y2={MAP_SIZE_INCHES}
				stroke="rgba(148, 163, 184, 0.18)"
				stroke-width="0.08"
				stroke-dasharray="0.6 0.6"
			/>
			<line
				x1="0"
				y1={pos}
				x2={MAP_SIZE_INCHES}
				y2={pos}
				stroke="rgba(148, 163, 184, 0.18)"
				stroke-width="0.08"
				stroke-dasharray="0.6 0.6"
			/>
		{/each}

		{#if map.zone.type === 'horizontal'}
			{@const zones = drawHorizontalDeployment(map.zone.rangeInches)}
			<rect
				x={zones.red.x}
				y={zones.red.y}
				width={zones.red.width}
				height={zones.red.height}
				fill={RED.fill}
				stroke={RED.stroke}
				stroke-width="0.15"
			/>
			<rect
				x={zones.blue.x}
				y={zones.blue.y}
				width={zones.blue.width}
				height={zones.blue.height}
				fill={BLUE.fill}
				stroke={BLUE.stroke}
				stroke-width="0.15"
			/>
			<text x="0.8" y={zones.red.y + zones.red.height / 2} fill={RED.text} font-size="1.6"
				>{map.zone.rangeInches}"</text
			>
			<text x="0.8" y={zones.blue.y + zones.blue.height / 2} fill={BLUE.text} font-size="1.6"
				>{map.zone.rangeInches}"</text
			>
		{:else}
			{@const zones = drawCircularDeployment(map.zone.rangeInches)}
			<path d={arcPath(zones.red)} fill={RED.fill} stroke={RED.stroke} stroke-width="0.15" />
			<path d={arcPath(zones.blue)} fill={BLUE.fill} stroke={BLUE.stroke} stroke-width="0.15" />
			<text x={zones.red.r * 0.32} y={zones.red.r * 0.32} fill={RED.text} font-size="1.6"
				>{map.zone.rangeInches}"</text
			>
			<text
				x={MAP_SIZE_INCHES - zones.blue.r * 0.32}
				y={MAP_SIZE_INCHES - zones.blue.r * 0.32}
				fill={BLUE.text}
				font-size="1.6"
				text-anchor="end">{map.zone.rangeInches}"</text
			>
		{/if}

		{#if map.quarters}
			{@const mid = MAP_SIZE_INCHES / 2}
			<line
				x1={mid}
				y1="0"
				x2={mid}
				y2={MAP_SIZE_INCHES}
				stroke="rgba(148, 163, 184, 0.8)"
				stroke-width="0.2"
			/>
			<line
				x1="0"
				y1={mid}
				x2={MAP_SIZE_INCHES}
				y2={mid}
				stroke="rgba(148, 163, 184, 0.8)"
				stroke-width="0.2"
			/>
		{/if}

		{#each map.markers as marker (marker.id)}
			{#if marker.showRuler}
				{@const anchor = rulerAnchor(marker)}
				<line
					x1={anchor.xEdge === 'left' ? 0 : MAP_SIZE_INCHES}
					y1={marker.y}
					x2={marker.x}
					y2={marker.y}
					stroke="rgba(148, 163, 184, 0.7)"
					stroke-width="0.1"
					stroke-dasharray="0.4 0.4"
				/>
				<line
					x1={marker.x}
					y1={anchor.yEdge === 'top' ? 0 : MAP_SIZE_INCHES}
					x2={marker.x}
					y2={marker.y}
					stroke="rgba(148, 163, 184, 0.7)"
					stroke-width="0.1"
					stroke-dasharray="0.4 0.4"
				/>
				{@const rowIndex = rulerLabelOffset(marker, 'y')}
				{@const colIndex = rulerLabelOffset(marker, 'x')}
				<text
					x={anchor.xEdge === 'left'
						? 0.4 + rowIndex * 2.4
						: MAP_SIZE_INCHES - 0.4 - rowIndex * 2.4}
					y={marker.y - 0.5}
					fill="rgb(203, 213, 225)"
					font-size="1.2"
					text-anchor={anchor.xEdge === 'left' ? 'start' : 'end'}>{anchor.xDistance}"</text
				>
				<text
					x={marker.x + 0.4}
					y={anchor.yEdge === 'top' ? 1.4 + colIndex * 1.6 : MAP_SIZE_INCHES - 0.7 - colIndex * 1.6}
					fill="rgb(203, 213, 225)"
					font-size="1.2">{anchor.yDistance}"</text
				>
			{/if}

			{#if marker.shape === 'circle'}
				<circle cx={marker.x} cy={marker.y} r="1.2" fill={marker.color} />
			{:else if marker.shape === 'box'}
				<rect x={marker.x - 1.2} y={marker.y - 1.2} width="2.4" height="2.4" fill={marker.color} />
			{:else if marker.shape === 'x'}
				<g stroke={marker.color} stroke-width="0.4">
					<line x1={marker.x - 1.2} y1={marker.y - 1.2} x2={marker.x + 1.2} y2={marker.y + 1.2} />
					<line x1={marker.x - 1.2} y1={marker.y + 1.2} x2={marker.x + 1.2} y2={marker.y - 1.2} />
				</g>
			{:else if marker.shape === 'triangle'}
				<polygon points={trianglePoints(marker, 1.4)} fill={marker.color} />
			{:else if marker.shape === 'star'}
				<polygon points={starPoints(marker, 1.4)} fill={marker.color} />
			{/if}

			<text
				x={marker.x}
				y={marker.y + (marker.labelPosition === 'above' ? -1.8 : 2.3)}
				fill="rgb(226, 232, 240)"
				font-size="1.3"
				text-anchor="middle">{marker.label}</text
			>
		{/each}
	</svg>
</Panel>
