<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(2));

	let domain = $state($wizard.data.domain);
	let hostname = $state($wizard.data.hostname);
	let serverIp = $state($wizard.data.serverIp);

	let domainError = $state('');
	let ipError = $state('');

	// Auto-fill hostname when domain changes
	$effect(() => {
		if (domain && !hostname) {
			hostname = `mail.${domain}`;
		}
	});

	function validateDomain(value: string): boolean {
		if (!value) {
			domainError = 'Domain is required';
			return false;
		}
		const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
		if (!domainRegex.test(value)) {
			domainError = 'Enter a valid domain (e.g., example.com)';
			return false;
		}
		domainError = '';
		return true;
	}

	function validateIp(value: string): boolean {
		if (!value) {
			ipError = 'Server IP is required';
			return false;
		}
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
		if (!ipv4Regex.test(value) || value.split('.').some((n) => parseInt(n) > 255)) {
			ipError = 'Enter a valid IPv4 address (e.g., 203.0.113.10)';
			return false;
		}
		ipError = '';
		return true;
	}

	function goBack() {
		wizard.updateData({ domain, hostname, serverIp });
		wizard.prev();
		goto('/setup/welcome');
	}

	function goNext() {
		const domainValid = validateDomain(domain);
		const ipValid = validateIp(serverIp);

		if (!domainValid || !ipValid) return;

		wizard.updateData({ domain, hostname, serverIp });
		wizard.next();
		goto('/setup/dns');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-bold text-zinc-100">Domain Configuration</h2>
		<p class="mt-1 text-sm text-zinc-400">Enter your domain and server details. These will be used to configure your mail server and DNS records.</p>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
		<!-- Domain -->
		<div>
			<label for="domain" class="mb-1.5 block text-sm font-medium text-zinc-300">Domain Name</label>
			<input
				id="domain"
				type="text"
				bind:value={domain}
				oninput={() => {
					domainError = '';
					if (hostname === '' || hostname.startsWith('mail.')) {
						hostname = domain ? `mail.${domain}` : '';
					}
				}}
				placeholder="example.com"
				class="w-full rounded-lg border bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors
					{domainError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-blue-500 focus:ring-blue-500'}"
			/>
			{#if domainError}
				<p class="mt-1 text-xs text-red-400">{domainError}</p>
			{:else}
				<p class="mt-1 text-xs text-zinc-600">The domain you own and want to receive email on</p>
			{/if}
		</div>

		<!-- Hostname -->
		<div>
			<label for="hostname" class="mb-1.5 block text-sm font-medium text-zinc-300">Mail Hostname</label>
			<input
				id="hostname"
				type="text"
				bind:value={hostname}
				placeholder="mail.example.com"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
			/>
			<p class="mt-1 text-xs text-zinc-600">The subdomain that points to your mail server (usually mail.yourdomain.com)</p>
		</div>

		<!-- Server IP -->
		<div>
			<label for="serverIp" class="mb-1.5 block text-sm font-medium text-zinc-300">Server IP Address</label>
			<input
				id="serverIp"
				type="text"
				bind:value={serverIp}
				oninput={() => (ipError = '')}
				placeholder="203.0.113.10"
				class="w-full rounded-lg border bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors
					{ipError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-blue-500 focus:ring-blue-500'}"
			/>
			{#if ipError}
				<p class="mt-1 text-xs text-red-400">{ipError}</p>
			{:else}
				<p class="mt-1 text-xs text-zinc-600">The public IP address of the VPS running MyMail</p>
			{/if}
		</div>
	</div>

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
			class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Continue
		</button>
	</div>
</div>
