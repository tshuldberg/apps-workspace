<script lang="ts">
	import { goto } from '$app/navigation';
	import StatChart from '$lib/components/StatChart.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import type { MailStats } from '$lib/types';

	interface Props {
		data: {
			period: '7d' | '30d' | '90d';
			stats: MailStats;
		};
	}

	let { data }: Props = $props();

	const periods = [
		{ value: '7d', label: '7 Days' },
		{ value: '30d', label: '30 Days' },
		{ value: '90d', label: '90 Days' }
	];

	function changePeriod(period: string) {
		goto(`/stats?period=${period}`);
	}

	const deliverabilityColumns = [
		{ key: 'provider', label: 'Provider' },
		{ key: 'delivered', label: 'Delivered' },
		{ key: 'bounced', label: 'Bounced' },
		{ key: 'deferred', label: 'Deferred' },
		{
			key: 'rate',
			label: 'Rate',
			render: (val: unknown) => {
				const rate = val as number;
				const color = rate >= 97 ? 'text-green-400' : rate >= 95 ? 'text-yellow-400' : 'text-red-400';
				return `<span class="${color} font-medium">${rate.toFixed(1)}%</span>`;
			}
		}
	];

	const senderColumns = [
		{ key: 'email', label: 'Email' },
		{ key: 'count', label: 'Messages' }
	];
</script>

<div class="space-y-6">
	<!-- Period selector -->
	<div class="flex gap-2">
		{#each periods as p}
			<button
				onclick={() => changePeriod(p.value)}
				class="rounded-lg px-4 py-2 text-sm font-medium transition-colors
					{data.period === p.value
						? 'bg-blue-600 text-white'
						: 'border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
			>
				{p.label}
			</button>
		{/each}
	</div>

	<!-- Charts -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h3 class="mb-3 text-sm font-medium text-zinc-300">Sent</h3>
			<StatChart data={data.stats.sent} labels={data.stats.labels} color="#3b82f6" />
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h3 class="mb-3 text-sm font-medium text-zinc-300">Received</h3>
			<StatChart data={data.stats.received} labels={data.stats.labels} color="#22c55e" />
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h3 class="mb-3 text-sm font-medium text-zinc-300">Blocked</h3>
			<StatChart data={data.stats.blocked} labels={data.stats.labels} color="#ef4444" />
		</div>
	</div>

	<!-- Deliverability -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h3 class="mb-4 text-lg font-semibold text-zinc-100">Deliverability by Provider</h3>
		<DataTable columns={deliverabilityColumns} data={data.stats.deliverability} />
	</div>

	<!-- Top senders / recipients -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h3 class="mb-4 text-lg font-semibold text-zinc-100">Top Senders</h3>
			<DataTable columns={senderColumns} data={data.stats.topSenders} />
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h3 class="mb-4 text-lg font-semibold text-zinc-100">Top Recipients</h3>
			<DataTable columns={senderColumns} data={data.stats.topRecipients} />
		</div>
	</div>
</div>
