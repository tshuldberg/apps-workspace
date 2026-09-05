<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import CopyButton from './CopyButton.svelte';

	interface Props {
		domain: string;
		hostname: string;
		serverIp: string;
	}

	let { domain, hostname, serverIp }: Props = $props();

	type DnsStatus = 'pending' | 'checking' | 'verified' | 'failed';

	interface DnsCheck {
		type: string;
		label: string;
		hostname: string;
		value: string;
		status: DnsStatus;
	}

	let records = $state<DnsCheck[]>([]);
	let polling = $state(false);
	let interval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		records = [
			{
				type: 'MX',
				label: 'Mail Exchange',
				hostname: domain || 'example.com',
				value: `${hostname || 'mail.example.com'} (priority 10)`,
				status: 'pending'
			},
			{
				type: 'A',
				label: 'Mail Server',
				hostname: hostname || 'mail.example.com',
				value: serverIp || '0.0.0.0',
				status: 'pending'
			},
			{
				type: 'TXT',
				label: 'SPF',
				hostname: domain || 'example.com',
				value: `v=spf1 a mx include:amazonses.com -all`,
				status: 'pending'
			},
			{
				type: 'TXT',
				label: 'DKIM',
				hostname: `default._domainkey.${domain || 'example.com'}`,
				value: 'v=DKIM1; k=rsa; p=YOUR_DKIM_KEY_HERE',
				status: 'pending'
			},
			{
				type: 'TXT',
				label: 'DMARC',
				hostname: `_dmarc.${domain || 'example.com'}`,
				value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain || 'example.com'}`,
				status: 'pending'
			}
		];
	});

	async function checkDns() {
		polling = true;
		records = records.map((r) => ({ ...r, status: 'checking' as DnsStatus }));

		try {
			const res = await fetch('/api/setup/dns-check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain })
			});

			if (res.ok) {
				const data = await res.json();
				records = records.map((r, i) => ({
					...r,
					status: data.results[i]?.verified ? 'verified' : 'failed'
				}));
			} else {
				records = records.map((r) => ({ ...r, status: 'pending' as DnsStatus }));
			}
		} catch {
			records = records.map((r) => ({ ...r, status: 'pending' as DnsStatus }));
		}

		polling = false;
	}

	function startPolling() {
		checkDns();
		interval = setInterval(checkDns, 15000);
	}

	function stopPolling() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	onMount(() => {
		if (domain) startPolling();
	});

	onDestroy(() => {
		stopPolling();
	});

	const statusConfig: Record<DnsStatus, { icon: string; label: string; color: string }> = {
		pending: {
			icon: 'M12 8v4m0 4h.01',
			label: 'Pending',
			color: 'text-zinc-500'
		},
		checking: {
			icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
			label: 'Checking...',
			color: 'text-blue-400'
		},
		verified: {
			icon: 'M5 13l4 4L19 7',
			label: 'Verified',
			color: 'text-green-400'
		},
		failed: {
			icon: 'M6 18L18 6M6 6l12 12',
			label: 'Not Found',
			color: 'text-red-400'
		}
	};

	const typeBadgeColors: Record<string, string> = {
		MX: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		TXT: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
		A: 'bg-green-500/15 text-green-400 border-green-500/30'
	};
</script>

<div class="space-y-3">
	{#each records as record}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
			<div class="flex items-center gap-3">
				<!-- Type badge -->
				<span class="shrink-0 rounded border px-2 py-0.5 text-xs font-mono font-semibold {typeBadgeColors[record.type] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'}">
					{record.type}
				</span>

				<!-- Record details -->
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<p class="text-sm font-medium text-zinc-300">{record.label}</p>
					</div>
					<p class="text-xs text-zinc-500 font-mono truncate">{record.hostname}</p>
				</div>

				<!-- Copy button -->
				<CopyButton text={record.value} />

				<!-- Status -->
				<div class="shrink-0 flex items-center gap-1.5">
					<svg class="h-4 w-4 {statusConfig[record.status].color} {record.status === 'checking' ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={statusConfig[record.status].icon} />
					</svg>
					<span class="text-xs {statusConfig[record.status].color}">{statusConfig[record.status].label}</span>
				</div>
			</div>

			<!-- Value row -->
			<div class="mt-2 rounded bg-zinc-950 px-3 py-2">
				<code class="text-xs text-zinc-400 break-all">{record.value}</code>
			</div>
		</div>
	{/each}

	<div class="flex items-center justify-between pt-2">
		<button
			onclick={checkDns}
			disabled={polling}
			class="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
		>
			<svg class="h-4 w-4 {polling ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			{polling ? 'Checking...' : 'Check DNS Records'}
		</button>
		<p class="text-xs text-zinc-600">Auto-checks every 15 seconds</p>
	</div>
</div>
