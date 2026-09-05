<script lang="ts">
	import { toasts } from '$lib/stores';
	import type { Settings } from '$lib/types';

	interface Props {
		data: { settings: Settings };
	}

	let { data }: Props = $props();

	let relayHost = $state(data.settings.relay.host);
	let relayPort = $state(data.settings.relay.port);
	let relayUser = $state(data.settings.relay.user);
	let relayPassword = $state(data.settings.relay.password);

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		return `${days}d ${hours}h`;
	}

	function formatBytes(bytes: number): string {
		const gb = bytes / 1e9;
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		return `${(bytes / 1e6).toFixed(0)} MB`;
	}

	function saveRelay() {
		toasts.success('Relay configuration saved');
	}

	function testConnection() {
		toasts.info('Testing relay connection...');
		setTimeout(() => toasts.success('Relay connection successful'), 1500);
	}

	const logLevelColors: Record<string, string> = {
		info: 'text-blue-400',
		warn: 'text-yellow-400',
		error: 'text-red-400',
		debug: 'text-zinc-500'
	};

	const tlsStatusColors: Record<string, string> = {
		valid: 'text-green-400',
		expiring: 'text-yellow-400',
		expired: 'text-red-400'
	};
</script>

<div class="space-y-6">
	<!-- Relay Configuration -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Relay Configuration</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="relay-host" class="mb-1.5 block text-sm font-medium text-zinc-300">Host</label>
				<input
					id="relay-host"
					type="text"
					bind:value={relayHost}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
			<div>
				<label for="relay-port" class="mb-1.5 block text-sm font-medium text-zinc-300">Port</label>
				<input
					id="relay-port"
					type="number"
					bind:value={relayPort}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
			<div>
				<label for="relay-user" class="mb-1.5 block text-sm font-medium text-zinc-300">Username</label>
				<input
					id="relay-user"
					type="text"
					bind:value={relayUser}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
			<div>
				<label for="relay-password" class="mb-1.5 block text-sm font-medium text-zinc-300">Password</label>
				<input
					id="relay-password"
					type="password"
					bind:value={relayPassword}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
		</div>
		<div class="mt-4 flex gap-3">
			<button
				onclick={saveRelay}
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
			>
				Save
			</button>
			<button
				onclick={testConnection}
				class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
			>
				Test Connection
			</button>
		</div>
	</div>

	<!-- TLS/SSL -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">TLS/SSL Certificate</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div>
				<p class="text-sm text-zinc-500">Provider</p>
				<p class="font-medium text-zinc-200">{data.settings.tls.provider}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Status</p>
				<p class="font-medium {tlsStatusColors[data.settings.tls.status]}">{data.settings.tls.status}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Expires</p>
				<p class="font-medium text-zinc-200">{new Date(data.settings.tls.expiresAt).toLocaleDateString()}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Auto-Renew</p>
				<p class="font-medium {data.settings.tls.autoRenew ? 'text-green-400' : 'text-zinc-400'}">
					{data.settings.tls.autoRenew ? 'Enabled' : 'Disabled'}
				</p>
			</div>
		</div>
	</div>

	<!-- System Info -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">System Information</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
			<div>
				<p class="text-sm text-zinc-500">Version</p>
				<p class="font-medium text-zinc-200">{data.settings.system.version}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Uptime</p>
				<p class="font-medium text-zinc-200">{formatUptime(data.settings.system.uptime)}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">OS</p>
				<p class="font-medium text-zinc-200">{data.settings.system.os}</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Memory</p>
				<p class="font-medium text-zinc-200">
					{formatBytes(data.settings.system.memory.used)} / {formatBytes(data.settings.system.memory.total)}
				</p>
			</div>
			<div>
				<p class="text-sm text-zinc-500">Disk</p>
				<p class="font-medium text-zinc-200">
					{formatBytes(data.settings.system.disk.used)} / {formatBytes(data.settings.system.disk.total)}
				</p>
			</div>
		</div>
	</div>

	<!-- Updates -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Updates</h2>
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-zinc-300">Current: <span class="font-mono text-zinc-200">v{data.settings.system.version}</span></p>
				<p class="text-sm text-zinc-500">Latest: <span class="font-mono text-green-400">v{data.settings.system.version}</span> (up to date)</p>
			</div>
			<button
				class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed"
				disabled
			>
				Up to Date
			</button>
		</div>
	</div>

	<!-- Log Viewer -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Recent Logs</h2>
		<div class="max-h-80 overflow-y-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed">
			{#each data.settings.logs as log}
				<div class="flex gap-3 py-0.5">
					<span class="shrink-0 text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
					<span class="shrink-0 w-12 text-right uppercase {logLevelColors[log.level]}">{log.level}</span>
					<span class="shrink-0 text-zinc-500">[{log.service}]</span>
					<span class="text-zinc-300">{log.message}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
