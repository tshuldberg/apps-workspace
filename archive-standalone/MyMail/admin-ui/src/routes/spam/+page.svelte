<script lang="ts">
	import { toasts } from '$lib/stores';
	import type { SpamConfig } from '$lib/types';

	interface Props {
		data: { spam: SpamConfig };
	}

	let { data }: Props = $props();

	let sensitivity = $state(data.spam.sensitivity);
	let whitelist = $state(data.spam.whitelist.join('\n'));
	let blacklist = $state(data.spam.blacklist.join('\n'));
	let quarantine = $state(data.spam.quarantine);

	function saveSensitivity() {
		toasts.success(`Spam sensitivity updated to ${sensitivity}`);
	}

	function releaseItem(id: string) {
		quarantine = quarantine.filter((q) => q.id !== id);
		toasts.success('Message released from quarantine');
	}

	function deleteItem(id: string) {
		quarantine = quarantine.filter((q) => q.id !== id);
		toasts.success('Message deleted');
	}

	function saveWhitelist() {
		toasts.success('Whitelist updated');
	}

	function saveBlacklist() {
		toasts.success('Blacklist updated');
	}

	function sensitivityLabel(val: number): string {
		if (val <= 3) return 'Low';
		if (val <= 6) return 'Medium';
		if (val <= 8) return 'High';
		return 'Aggressive';
	}

	function sensitivityColor(val: number): string {
		if (val <= 3) return 'text-green-400';
		if (val <= 6) return 'text-yellow-400';
		if (val <= 8) return 'text-orange-400';
		return 'text-red-400';
	}
</script>

<div class="space-y-6">
	<!-- Stats row -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p class="text-sm text-zinc-400">Blocked Today</p>
			<p class="text-3xl font-bold text-red-400">{data.spam.blockedToday}</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p class="text-sm text-zinc-400">False Positives</p>
			<p class="text-3xl font-bold text-yellow-400">{data.spam.falsePositives}</p>
		</div>
	</div>

	<!-- Sensitivity slider -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-zinc-100">Spam Sensitivity</h2>
			<span class="text-sm font-medium {sensitivityColor(sensitivity)}">
				{sensitivity}/10 - {sensitivityLabel(sensitivity)}
			</span>
		</div>
		<input
			type="range"
			min="1"
			max="10"
			bind:value={sensitivity}
			class="w-full accent-blue-500"
		/>
		<div class="mt-2 flex justify-between text-xs text-zinc-600">
			<span>Permissive</span>
			<span>Aggressive</span>
		</div>
		<button
			onclick={saveSensitivity}
			class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Save
		</button>
	</div>

	<!-- Quarantine -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Quarantine ({quarantine.length})</h2>
		{#if quarantine.length === 0}
			<p class="text-sm text-zinc-500">No quarantined messages</p>
		{:else}
			<div class="space-y-2">
				{#each quarantine as item}
					<div class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-zinc-200 truncate">{item.subject}</p>
								<span class="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-400">{item.score.toFixed(1)}</span>
							</div>
							<p class="text-xs text-zinc-500">From: {item.from} &rarr; {item.to}</p>
						</div>
						<div class="flex shrink-0 gap-2 ml-4">
							<button
								onclick={() => releaseItem(item.id)}
								class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/10 transition-colors"
							>
								Release
							</button>
							<button
								onclick={() => deleteItem(item.id)}
								class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Whitelist / Blacklist -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h2 class="mb-3 text-lg font-semibold text-zinc-100">Whitelist</h2>
			<p class="mb-2 text-xs text-zinc-500">One email or pattern per line</p>
			<textarea
				bind:value={whitelist}
				rows={6}
				class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			></textarea>
			<button
				onclick={saveWhitelist}
				class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
			>
				Save Whitelist
			</button>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h2 class="mb-3 text-lg font-semibold text-zinc-100">Blacklist</h2>
			<p class="mb-2 text-xs text-zinc-500">One email or pattern per line</p>
			<textarea
				bind:value={blacklist}
				rows={6}
				class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			></textarea>
			<button
				onclick={saveBlacklist}
				class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
			>
				Save Blacklist
			</button>
		</div>
	</div>
</div>
