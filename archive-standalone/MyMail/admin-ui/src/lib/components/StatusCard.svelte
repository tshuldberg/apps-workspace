<script lang="ts">
	interface Props {
		title: string;
		value: string;
		status: 'ok' | 'warning' | 'error';
		icon: string;
		subtitle?: string;
	}

	let { title, value, status, icon, subtitle = '' }: Props = $props();

	const statusColors = {
		ok: 'text-green-400 bg-green-500/10 border-green-500/20',
		warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
		error: 'text-red-400 bg-red-500/10 border-red-500/20'
	};

	const dotColors = {
		ok: 'bg-green-500',
		warning: 'bg-yellow-500',
		error: 'bg-red-500'
	};
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700">
	<div class="flex items-start justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg {statusColors[status]}">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d={icon} />
				</svg>
			</div>
			<div>
				<p class="text-sm text-zinc-400">{title}</p>
				<p class="text-2xl font-semibold text-zinc-100">{value}</p>
			</div>
		</div>
		<span class="mt-1 h-2.5 w-2.5 rounded-full {dotColors[status]}"></span>
	</div>
	{#if subtitle}
		<p class="mt-3 text-xs text-zinc-500">{subtitle}</p>
	{/if}
</div>

<style>
	:global(html.light) div:first-child {
		@apply bg-white border-zinc-200 hover:border-zinc-300;
	}
	:global(html.light) div:first-child p.text-zinc-100 {
		@apply text-zinc-900;
	}
</style>
