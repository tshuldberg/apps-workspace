<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import ProviderInstructions from '$lib/components/ProviderInstructions.svelte';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(4));

	type Provider = 'ses' | 'sendgrid' | 'mailgun' | 'postmark' | 'none';

	let relayProvider = $state<Provider | ''>($wizard.data.relayProvider || '');
	let relayHost = $state($wizard.data.relayHost);
	let relayPort = $state($wizard.data.relayPort || 587);
	let relayUser = $state($wizard.data.relayUser);
	let relayPassword = $state($wizard.data.relayPassword);

	let testStatus = $state<'idle' | 'testing' | 'success' | 'failed'>('idle');
	let testMessage = $state('');

	const providerDefaults: Record<string, { host: string; port: number }> = {
		ses: { host: 'email-smtp.us-east-1.amazonaws.com', port: 587 },
		sendgrid: { host: 'smtp.sendgrid.net', port: 587 },
		mailgun: { host: 'smtp.mailgun.org', port: 587 },
		postmark: { host: 'smtp.postmarkapp.com', port: 587 }
	};

	const providers: { id: Provider; name: string; description: string; badge?: string }[] = [
		{ id: 'ses', name: 'Amazon SES', description: 'Cheapest option, great for high volume', badge: 'Recommended' },
		{ id: 'sendgrid', name: 'SendGrid', description: 'Easy to set up, free tier available', badge: 'Easiest' },
		{ id: 'mailgun', name: 'Mailgun', description: 'Developer-friendly, good API', badge: '' },
		{ id: 'postmark', name: 'Postmark', description: 'Best deliverability reputation', badge: '' },
		{ id: 'none', name: 'Direct Sending', description: 'Send directly without relay', badge: 'Not recommended' }
	];

	function selectProvider(id: Provider) {
		relayProvider = id;
		if (id !== 'none' && providerDefaults[id]) {
			relayHost = providerDefaults[id].host;
			relayPort = providerDefaults[id].port;
		}
		if (id === 'none') {
			relayHost = '';
			relayPort = 25;
			relayUser = '';
			relayPassword = '';
		}
	}

	async function testConnection() {
		testStatus = 'testing';
		testMessage = '';

		try {
			const res = await fetch('/api/setup/test-relay', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					host: relayHost,
					port: relayPort,
					user: relayUser,
					password: relayPassword
				})
			});

			const data = await res.json();
			testStatus = data.success ? 'success' : 'failed';
			testMessage = data.message;
		} catch {
			testStatus = 'failed';
			testMessage = 'Could not connect to the server. Check your network connection.';
		}
	}

	function goBack() {
		wizard.updateData({ relayProvider, relayHost, relayPort, relayUser, relayPassword });
		wizard.prev();
		goto('/setup/dns');
	}

	function goNext() {
		wizard.updateData({ relayProvider, relayHost, relayPort, relayUser, relayPassword });
		wizard.next();
		goto('/setup/account');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-bold text-zinc-100">Relay Configuration</h2>
		<p class="mt-1 text-sm text-zinc-400">Choose a relay service to ensure reliable email delivery. Relays route your outbound email through trusted providers.</p>
	</div>

	<!-- Provider selection -->
	<div class="grid gap-3 sm:grid-cols-2">
		{#each providers as provider}
			<button
				onclick={() => selectProvider(provider.id)}
				class="relative rounded-xl border p-4 text-left transition-all
					{relayProvider === provider.id
						? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500'
						: provider.id === 'none'
							? 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
							: 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}"
			>
				{#if provider.badge}
					<span class="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium
						{provider.badge === 'Recommended' ? 'bg-green-500/15 text-green-400' :
						 provider.badge === 'Easiest' ? 'bg-blue-500/15 text-blue-400' :
						 'bg-red-500/15 text-red-400'}">
						{provider.badge}
					</span>
				{/if}
				<p class="text-sm font-medium text-zinc-200">{provider.name}</p>
				<p class="mt-0.5 text-xs text-zinc-500">{provider.description}</p>
			</button>
		{/each}
	</div>

	<!-- Provider instructions -->
	{#if relayProvider && relayProvider !== 'none'}
		<ProviderInstructions provider={relayProvider} />
	{/if}

	<!-- Direct sending warning -->
	{#if relayProvider === 'none'}
		<div class="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
			<svg class="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
			</svg>
			<div>
				<p class="text-sm font-medium text-red-400">Direct sending is not recommended</p>
				<p class="text-xs text-red-400/60">Without a relay, your emails are much more likely to land in spam folders. Most residential and cloud IP addresses are flagged by spam filters.</p>
			</div>
		</div>
	{/if}

	<!-- SMTP Configuration -->
	{#if relayProvider && relayProvider !== 'none'}
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
			<h3 class="text-sm font-semibold text-zinc-200">SMTP Configuration</h3>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="relay-host" class="mb-1.5 block text-sm font-medium text-zinc-300">SMTP Host</label>
					<input
						id="relay-host"
						type="text"
						bind:value={relayHost}
						placeholder="smtp.provider.com"
						class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>
				<div>
					<label for="relay-port" class="mb-1.5 block text-sm font-medium text-zinc-300">Port</label>
					<input
						id="relay-port"
						type="number"
						bind:value={relayPort}
						placeholder="587"
						class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>

			<div>
				<label for="relay-user" class="mb-1.5 block text-sm font-medium text-zinc-300">Username</label>
				<input
					id="relay-user"
					type="text"
					bind:value={relayUser}
					placeholder="SMTP username or API key"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="relay-password" class="mb-1.5 block text-sm font-medium text-zinc-300">Password</label>
				<input
					id="relay-password"
					type="password"
					bind:value={relayPassword}
					placeholder="SMTP password"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<!-- Test connection -->
			<div class="flex items-center gap-3 pt-2">
				<button
					onclick={testConnection}
					disabled={testStatus === 'testing' || !relayHost || !relayUser}
					class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
				>
					{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
				</button>
				{#if testStatus === 'success'}
					<div class="flex items-center gap-1.5 text-sm text-green-400">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						{testMessage}
					</div>
				{:else if testStatus === 'failed'}
					<div class="flex items-center gap-1.5 text-sm text-red-400">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
						{testMessage}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Navigation -->
	<div class="flex justify-between">
		<button
			onclick={goBack}
			class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
		>
			Back
		</button>
		<button
			onclick={goNext}
			disabled={!relayProvider}
			class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
		>
			Continue
		</button>
	</div>
</div>
