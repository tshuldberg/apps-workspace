<script lang="ts">
	import { toasts } from '$lib/stores';

	interface Props {
		type: string;
		hostname: string;
		value: string;
		verified: boolean;
	}

	let { type, hostname, value, verified }: Props = $props();

	const typeBadgeColors: Record<string, string> = {
		MX: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		TXT: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
		CNAME: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
		A: 'bg-green-500/15 text-green-400 border-green-500/30',
		AAAA: 'bg-teal-500/15 text-teal-400 border-teal-500/30'
	};

	function copyToClipboard() {
		navigator.clipboard.writeText(value).then(() => {
			toasts.success('Copied to clipboard');
		});
	}
</script>

<div class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
	<!-- Type badge -->
	<span class="shrink-0 rounded border px-2 py-0.5 text-xs font-mono font-semibold {typeBadgeColors[type] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'}">
		{type}
	</span>

	<!-- Record details -->
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-zinc-300 truncate">{hostname}</p>
		<p class="text-xs text-zinc-500 font-mono truncate">{value}</p>
	</div>

	<!-- Copy button -->
	<button
		onclick={copyToClipboard}
		class="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
		title="Copy value"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
		</svg>
	</button>

	<!-- Status indicator -->
	<div class="shrink-0 flex items-center gap-1.5">
		{#if verified}
			<svg class="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
			<span class="text-xs text-green-400">Verified</span>
		{:else}
			<svg class="h-4 w-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" />
			</svg>
			<span class="text-xs text-yellow-400">Pending</span>
		{/if}
	</div>
</div>
