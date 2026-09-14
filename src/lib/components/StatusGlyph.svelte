<script lang="ts">
	import type { UnitStatus } from '$lib/domain';

	type Props = {
		status: UnitStatus;
		/** Off statuses read grey; on statuses read in their own colour. */
		active: boolean;
		/** Tailwind box classes; the glyph scales to whatever it is given. */
		size?: string;
	};

	let { status, active, size = 'h-6 w-6' }: Props = $props();

	/** The colour each State owns once switched on. */
	const STATUS_COLORS: Record<UnitStatus, string> = {
		bleeding: 'fill-red-500 stroke-red-500',
		blinded: 'fill-yellow-400 stroke-yellow-400',
		confused: 'fill-orange-400 stroke-orange-400',
		crippled: 'fill-orange-400 stroke-orange-400',
		crouched: 'fill-purple-300 stroke-purple-300',
		dead: 'fill-red-500 stroke-red-500',
		flying: 'fill-cyan-400 stroke-cyan-400',
		fatigued: 'fill-orange-400 stroke-orange-400',
		immobilized: 'fill-purple-300 stroke-purple-300',
		incapacitated: 'fill-yellow-400 stroke-yellow-400',
		panicked: 'fill-orange-400 stroke-orange-400',
		'poison-1': 'fill-emerald-500 stroke-emerald-500',
		'poison-2': 'fill-emerald-500 stroke-emerald-500',
		slowed: 'fill-purple-300 stroke-purple-300',
		weakened: 'fill-slate-200 stroke-slate-200'
	};

	/** Inner cut-outs (eyes, numbers, spirals) read dark on any fill, grey included. */
	const CUT = '#0f172a';

	let classes = $derived(
		`${size} ${active ? STATUS_COLORS[status] : 'fill-slate-500 stroke-slate-500'}`
	);
</script>

<svg viewBox="0 0 24 24" class={classes} aria-hidden="true">
	{#if status === 'bleeding' || status === 'poison-1' || status === 'poison-2'}
		<path
			d="M12 2.6c3.5 4.5 6.4 8.3 6.4 11.9a6.4 6.4 0 0 1-12.8 0C5.6 10.9 8.5 7.1 12 2.6z"
			stroke="none"
		/>
		{#if status !== 'bleeding'}
			<text
				x="12"
				y="16.4"
				text-anchor="middle"
				font-size="9.5"
				font-weight="700"
				fill={CUT}
				stroke="none"
			>
				{status === 'poison-1' ? '1' : '2'}
			</text>
		{/if}
	{:else if status === 'blinded'}
		<path
			d="M2.6 12S6.2 6.6 12 6.6 21.4 12 21.4 12 17.8 17.4 12 17.4 2.6 12 2.6 12z"
			fill="none"
			stroke-width="1.8"
			stroke-dasharray="2.6 2.2"
		/>
		<circle cx="12" cy="12" r="2.7" stroke="none" />
	{:else if status === 'confused'}
		<circle cx="12" cy="16.8" r="4.8" stroke="none" />
		<path d="M5.5 4.3 6.2 5.8 7.7 6.5 6.2 7.2 5.5 8.7 4.8 7.2 3.3 6.5 4.8 5.8z" stroke="none" />
		<path d="M12 2 12.8 3.8 14.6 4.6 12.8 5.4 12 7.2 11.2 5.4 9.4 4.6 11.2 3.8z" stroke="none" />
		<path
			d="M18.5 4.3 19.2 5.8 20.7 6.5 19.2 7.2 18.5 8.7 17.8 7.2 16.3 6.5 17.8 5.8z"
			stroke="none"
		/>
	{:else if status === 'crippled'}
		<circle cx="5.2" cy="9.9" r="2.3" stroke="none" />
		<circle cx="5.2" cy="14.1" r="2.3" stroke="none" />
		<path d="M5.2 9.9h5l1.6 2.1-1.6 2.1h-5z" stroke="none" />
		<g transform="translate(1.4 1.6)">
			<circle cx="18.8" cy="9.9" r="2.3" stroke="none" />
			<circle cx="18.8" cy="14.1" r="2.3" stroke="none" />
			<path d="M18.8 9.9h-4.4l-1.2 2.1 1.2 2.1h4.4z" stroke="none" />
		</g>
	{:else if status === 'crouched'}
		<path d="M12 21.4 4.8 12.6h4.1V2.6h6.2v10h4.1z" stroke="none" />
	{:else if status === 'dead'}
		<path
			d="M12 2.6a7.6 7.6 0 0 0-7.6 7.6c0 2.7 1.4 4.8 3.2 6.1v3.2a1.9 1.9 0 0 0 1.9 1.9h5a1.9 1.9 0 0 0 1.9-1.9v-3.2c1.8-1.3 3.2-3.4 3.2-6.1A7.6 7.6 0 0 0 12 2.6z"
			stroke="none"
		/>
		<circle cx="9.2" cy="10.6" r="1.9" fill={CUT} stroke="none" />
		<circle cx="14.8" cy="10.6" r="1.9" fill={CUT} stroke="none" />
		<path d="M12 12.8l1.1 2.2h-2.2z" fill={CUT} stroke="none" />
		<path
			d="M10.4 18.4v2.2M12 18.4v2.4M13.6 18.4v2.2"
			stroke={CUT}
			stroke-width="1.1"
			fill="none"
		/>
	{:else if status === 'flying'}
		<path
			d="M21 4.5c-9 .8-15 6-17.5 15 2.6-1.7 5-2.6 7.3-2.7-.9 1.2-1.6 2.6-2 4.2 2.4-1.5 4.6-2.3 6.8-2.4-.5 1-.8 2.1-1 3.4 4-3 6.4-7.6 6.4-13.5z"
			stroke="none"
		/>
	{:else if status === 'fatigued'}
		<circle cx="16.6" cy="8.6" r="2.5" stroke="none" />
		<path d="M15 10.6c-2.6.6-4.6 2-5.6 4" fill="none" stroke-width="2.3" stroke-linecap="round" />
		<path
			d="M9.4 14.6 8 20M9.4 14.6l3.4 4.6"
			fill="none"
			stroke-width="2.3"
			stroke-linecap="round"
		/>
		<path d="M12.6 12.2l-2.8 4" fill="none" stroke-width="2.3" stroke-linecap="round" />
	{:else if status === 'immobilized'}
		<path
			d="M8.2 3.2h4.8v8.6c3.2.5 6 2.2 7.2 5 .6 1.4-.4 3-2 3H8.2z"
			fill="none"
			stroke-width="1.7"
			stroke-linejoin="round"
		/>
		<path d="M3.8 3.8l16.7 16.7" fill="none" stroke-width="2.4" stroke-linecap="round" />
	{:else if status === 'incapacitated'}
		<circle cx="12" cy="12" r="8.4" stroke="none" />
		<path
			d="M7.6 8.6l3 3M10.6 8.6l-3 3M13.4 8.6l3 3M16.4 8.6l-3 3"
			stroke={CUT}
			stroke-width="1.7"
			stroke-linecap="round"
			fill="none"
		/>
		<path d="M9.6 16.4h4.8" stroke={CUT} stroke-width="1.7" stroke-linecap="round" fill="none" />
	{:else if status === 'panicked'}
		<path d="M12 3v10.2" fill="none" stroke-width="2.8" stroke-linecap="round" />
		<circle cx="12" cy="17.6" r="1.8" stroke="none" />
		<path d="M6.6 6.4v8" fill="none" stroke-width="2.2" stroke-linecap="round" />
		<circle cx="6.6" cy="17.4" r="1.4" stroke="none" />
		<path d="M17.4 6.4v8" fill="none" stroke-width="2.2" stroke-linecap="round" />
		<circle cx="17.4" cy="17.4" r="1.4" stroke="none" />
	{:else if status === 'slowed'}
		<path d="M3.2 19.6h17.6" fill="none" stroke-width="2.2" stroke-linecap="round" />
		<path
			d="M5.6 19.6c-.4-3.2 1-5.4 3.2-6.2"
			fill="none"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<circle cx="8.8" cy="11.4" r="1.9" stroke="none" />
		<path d="M8.1 9.8 7.2 7.8M9.6 9.8l1-2" fill="none" stroke-width="1.5" stroke-linecap="round" />
		<circle cx="15.8" cy="13.4" r="5.2" stroke="none" />
		<path
			d="M15.8 13.4a2.6 2.6 0 0 1 2.6 2.6"
			stroke={CUT}
			stroke-width="1.4"
			fill="none"
			stroke-linecap="round"
		/>
	{:else if status === 'weakened'}
		<path
			d="M11 3 4.6 5.5v6.2c0 4.4 2.7 7.9 6.4 9.3l.5-2.3-1.3-1.9 1.4-2-1.2-2 1.4-2-1-2z"
			stroke="none"
		/>
		<g transform="translate(1.6 1.6)">
			<path
				d="M13 3.4l6.4 2.1v6.2c0 4.1-2.4 7.5-5.8 9l-.5-2.2 1.3-1.9-1.4-2 1.2-2-1.4-2 1-2z"
				stroke="none"
			/>
		</g>
	{/if}
</svg>
