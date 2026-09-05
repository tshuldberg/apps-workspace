<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import DnsChecker from '$lib/components/DnsChecker.svelte';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(3));

	let activeTab = $state<'cloudflare' | 'namecheap' | 'godaddy'>('cloudflare');

	let showSkipWarning = $state(false);

	function goBack() {
		wizard.prev();
		goto('/setup/domain');
	}

	function goNext() {
		wizard.next();
		goto('/setup/relay');
	}

	function skipDns() {
		if (!showSkipWarning) {
			showSkipWarning = true;
			return;
		}
		wizard.next();
		goto('/setup/relay');
	}

	const providerGuides: Record<string, { name: string; steps: string[] }> = {
		cloudflare: {
			name: 'Cloudflare',
			steps: [
				'Log in to your Cloudflare dashboard and select your domain.',
				'Go to DNS > Records.',
				'Click "Add record" for each DNS record listed above.',
				'For MX records, set the priority to 10.',
				'For TXT records, paste the full value including quotes.',
				'If using Cloudflare proxy, set the A record to "DNS only" (gray cloud).'
			]
		},
		namecheap: {
			name: 'Namecheap',
			steps: [
				'Log in to Namecheap and go to Domain List > Manage.',
				'Click on "Advanced DNS".',
				'Add each record using the "Add New Record" button.',
				'For MX records, set the mail server and priority.',
				'For TXT records, use the "TXT Record" type and paste the value.',
				'Save all changes when done.'
			]
		},
		godaddy: {
			name: 'GoDaddy',
			steps: [
				'Log in to GoDaddy and go to My Products > DNS.',
				'Select your domain.',
				'Click "Add" to create each DNS record.',
				'For MX records, enter the hostname and priority.',
				'For TXT records, use @ as host for domain-level records.',
				'Changes may take a few minutes to apply within GoDaddy.'
			]
		}
	};
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-bold text-zinc-100">DNS Configuration</h2>
		<p class="mt-1 text-sm text-zinc-400">Add these DNS records to your domain's DNS settings. This ensures email is properly routed and authenticated.</p>
	</div>

	<!-- DNS Records Checker -->
	<DnsChecker domain={$wizard.data.domain} hostname={$wizard.data.hostname} serverIp={$wizard.data.serverIp} />

	<!-- Provider Instructions -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
		<!-- Tabs -->
		<div class="flex border-b border-zinc-800">
			{#each Object.entries(providerGuides) as [key, guide]}
				<button
					onclick={() => (activeTab = key as typeof activeTab)}
					class="flex-1 px-4 py-3 text-sm font-medium transition-colors
						{activeTab === key
							? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
							: 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}"
				>
					{guide.name}
				</button>
			{/each}
		</div>

		<!-- Instructions -->
		<div class="p-5">
			<ol class="space-y-2">
				{#each providerGuides[activeTab].steps as step, i}
					<li class="flex gap-3 text-sm text-zinc-400">
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
							{i + 1}
						</span>
						<span>{step}</span>
					</li>
				{/each}
			</ol>
		</div>
	</div>

	<!-- Propagation notice -->
	<div class="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
		<svg class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
		</svg>
		<div>
			<p class="text-sm font-medium text-yellow-400">DNS changes can take up to 48 hours to propagate</p>
			<p class="text-xs text-yellow-400/60">Most changes propagate within 15-30 minutes, but full propagation may take longer.</p>
		</div>
	</div>

	<!-- Skip warning -->
	{#if showSkipWarning}
		<div class="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
			<svg class="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
			</svg>
			<div>
				<p class="text-sm font-medium text-red-400">Your email will not work properly without DNS records</p>
				<p class="text-xs text-red-400/60">Click "Skip for now" again to continue anyway. You can configure DNS later from the admin dashboard.</p>
			</div>
		</div>
	{/if}

	<!-- Navigation -->
	<div class="flex items-center justify-between">
		<button
			onclick={goBack}
			class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
		>
			Back
		</button>
		<div class="flex gap-3">
			<button
				onclick={skipDns}
				class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
			>
				Skip for now
			</button>
			<button
				onclick={goNext}
				class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
			>
				Continue
			</button>
		</div>
	</div>
</div>
