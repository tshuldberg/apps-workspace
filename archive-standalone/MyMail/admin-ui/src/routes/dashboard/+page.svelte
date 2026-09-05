<script lang="ts">
	import StatusCard from '$lib/components/StatusCard.svelte';
	import StatChart from '$lib/components/StatChart.svelte';
	import { toasts } from '$lib/stores';

	interface Props {
		data: {
			health: {
				status: 'ok' | 'warning' | 'error';
				uptime: number;
				storage: { used: number; total: number };
				mailQueue: number;
				messagesToday: { sent: number; received: number };
			};
			recentActivity: {
				labels: string[];
				sent: number[];
				received: number[];
			};
			alerts: { level: 'warning' | 'info' | 'error'; message: string }[];
		};
	}

	let { data }: Props = $props();

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		return `${days}d ${hours}h`;
	}

	function formatBytes(bytes: number): string {
		const gb = bytes / 1e9;
		return `${gb.toFixed(1)} GB`;
	}

	async function sendTestEmail() {
		toasts.info('Sending test email...');
		try {
			const res = await fetch('/api/setup/test-email', { method: 'POST' });
			const data = await res.json();
			if (data.success) toasts.success('Test email sent');
			else toasts.error(data.message);
		} catch {
			toasts.error('Failed to send test email');
		}
	}

	async function checkDns() {
		toasts.info('Checking DNS records...');
		try {
			const res = await fetch('/api/setup/dns-check', { method: 'POST' });
			const data = await res.json();
			toasts.success(`DNS check complete: ${data.results.length} records checked`);
		} catch {
			toasts.error('DNS check failed');
		}
	}

	async function triggerBackup() {
		toasts.info('Starting backup...');
		try {
			const res = await fetch('/api/backups', { method: 'POST' });
			if (res.ok) toasts.success('Backup started');
			else toasts.error('Failed to start backup');
		} catch {
			toasts.error('Failed to start backup');
		}
	}

	const alertStyles = {
		warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
		info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
		error: 'border-red-500/30 bg-red-500/10 text-red-400'
	};
</script>

<div class="space-y-6">
	<!-- Status Cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<StatusCard
			title="Server Uptime"
			value={formatUptime(data.health.uptime)}
			status={data.health.status}
			icon="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
			subtitle="All services running"
		/>
		<StatusCard
			title="Storage"
			value="{formatBytes(data.health.storage.used)} / {formatBytes(data.health.storage.total)}"
			status={data.health.storage.used / data.health.storage.total > 0.9 ? 'error' : data.health.storage.used / data.health.storage.total > 0.7 ? 'warning' : 'ok'}
			icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
			subtitle="{((data.health.storage.used / data.health.storage.total) * 100).toFixed(0)}% used"
		/>
		<StatusCard
			title="Mail Queue"
			value={String(data.health.mailQueue)}
			status={data.health.mailQueue > 100 ? 'error' : data.health.mailQueue > 20 ? 'warning' : 'ok'}
			icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			subtitle="messages pending"
		/>
		<StatusCard
			title="Messages Today"
			value="{data.health.messagesToday.sent + data.health.messagesToday.received}"
			status="ok"
			icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
			subtitle="{data.health.messagesToday.sent} sent / {data.health.messagesToday.received} received"
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Recent Activity Chart -->
		<div class="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<h2 class="mb-4 text-lg font-semibold text-zinc-100">Recent Activity</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<h3 class="mb-2 text-sm text-zinc-400">Sent</h3>
					<StatChart
						data={data.recentActivity.sent}
						labels={data.recentActivity.labels}
						color="#3b82f6"
					/>
				</div>
				<div>
					<h3 class="mb-2 text-sm text-zinc-400">Received</h3>
					<StatChart
						data={data.recentActivity.received}
						labels={data.recentActivity.labels}
						color="#22c55e"
					/>
				</div>
			</div>
		</div>

		<!-- Alerts + Quick Actions -->
		<div class="space-y-6">
			<!-- Alerts -->
			<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
				<h2 class="mb-3 text-lg font-semibold text-zinc-100">Alerts</h2>
				{#if data.alerts.length === 0}
					<p class="text-sm text-zinc-500">No active alerts</p>
				{:else}
					<div class="space-y-2">
						{#each data.alerts as alert}
							<div class="rounded-lg border px-3 py-2 text-sm {alertStyles[alert.level]}">
								{alert.message}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Quick Actions -->
			<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
				<h2 class="mb-3 text-lg font-semibold text-zinc-100">Quick Actions</h2>
				<div class="space-y-2">
					<button
						onclick={sendTestEmail}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-left"
					>
						Send Test Email
					</button>
					<button
						onclick={checkDns}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-left"
					>
						Check DNS Records
					</button>
					<button
						onclick={triggerBackup}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-left"
					>
						Trigger Backup
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
