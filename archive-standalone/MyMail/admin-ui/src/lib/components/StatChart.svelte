<script lang="ts">
	interface Props {
		data: number[];
		labels: string[];
		color?: string;
		height?: number;
	}

	let { data, labels, color = '#3b82f6', height = 200 }: Props = $props();

	let maxVal = $derived(Math.max(...data, 1));
	let barWidth = $derived(data.length > 0 ? 100 / data.length : 0);
</script>

<div class="w-full">
	<svg
		viewBox="0 0 {data.length * 40 + 20} {height + 30}"
		class="w-full"
		preserveAspectRatio="xMidYMid meet"
	>
		<!-- Grid lines -->
		{#each [0, 0.25, 0.5, 0.75, 1] as ratio}
			<line
				x1="0"
				y1={height - ratio * height}
				x2={data.length * 40 + 20}
				y2={height - ratio * height}
				stroke="currentColor"
				class="text-zinc-800"
				stroke-width="0.5"
			/>
			<text
				x="0"
				y={height - ratio * height - 4}
				class="text-zinc-600"
				fill="currentColor"
				font-size="8"
			>
				{Math.round(maxVal * ratio)}
			</text>
		{/each}

		<!-- Bars -->
		{#each data as value, i}
			{@const barHeight = (value / maxVal) * height}
			<rect
				x={i * 40 + 15}
				y={height - barHeight}
				width="25"
				height={barHeight}
				fill={color}
				rx="3"
				opacity="0.85"
			>
				<title>{labels[i]}: {value}</title>
			</rect>

			<!-- Label -->
			<text
				x={i * 40 + 27.5}
				y={height + 15}
				text-anchor="middle"
				fill="currentColor"
				class="text-zinc-500"
				font-size="8"
			>
				{labels[i]}
			</text>
		{/each}
	</svg>
</div>
